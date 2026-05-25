"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import {
  isIsoDateOnly,
  isUuid,
  parseFixedEnumParam,
  parsePositiveIntParam,
  validateBoundedString,
} from "@/lib/security/validation";
import type { ApprovalStatus, ApprovalType, RenewalScenario } from "@/lib/types";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import { autoTransitionTasksForApproval } from "@/actions/tasks";
import { isNotificationTypeAllowedForWorkspace } from "@/lib/notification-policy";
import { emitVisibleMutationErrorTelemetry, emitWorkActionTelemetry } from "@/lib/product-telemetry";
import { recordV10AuditEvent } from "@/lib/server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/read-model-refresh";
import { validateV10ApprovalDecision } from "@/lib/approval-exception";
import {
  appendApprovalEvent,
  approvalAuditActionForStatus,
  approvalDecisionMessage,
  buildApprovalMutationEnvelope,
  canManageApprovalsForOrg,
  revalidateApprovalPaths,
} from "./approvals-helpers";

const APPROVAL_TYPES: ApprovalType[] = [
  "renewal_decision",
  "notice_action",
  "commercial_exception",
  "ownership_handoff",
];
const APPROVAL_STATUSES: ApprovalStatus[] = ["pending", "approved", "rejected", "changes_requested"];
const RENEWAL_SCENARIOS: RenewalScenario[] = [
  "renew",
  "renegotiate",
  "terminate",
  "replace",
  "discontinue",
  "temporary_extension",
  "awaiting_decision",
];

const MAX_NOTE_LEN = 4000;
const MAX_EXCEPTION_REASON_LEN = 800;
const MAX_BLOCKER_LEN = 800;

const APPROVAL_CATEGORIES = ["standard", "policy_exception", "financial", "operational"] as const;
const RENEWAL_WORKSPACE_STATUSES = ["not_started", "in_progress", "blocked", "decision_pending", "closed"] as const;

type ApprovalCategory = (typeof APPROVAL_CATEGORIES)[number];
type RenewalWorkspaceStatus = (typeof RENEWAL_WORKSPACE_STATUSES)[number];

function validateOptionalApprovalText(
  value: unknown,
  options: { maxLength: number; tooLong: string; unsafe: string }
): { ok: true; value: string | null } | { ok: false; error: string } {
  const validation = validateBoundedString(value ?? "", {
    maxLength: options.maxLength,
    allowEmpty: true,
    allowTextWhitespaceControls: true,
  });
  if (!validation.ok) {
    if (validation.error === "string_too_long") return { ok: false, error: options.tooLong };
    if (validation.error === "unsafe_characters") return { ok: false, error: options.unsafe };
    return { ok: false, error: options.unsafe };
  }
  return { ok: true, value: validation.value || null };
}

function parseApprovalFormEnum<T extends string>(raw: FormDataEntryValue | null, allowed: readonly T[]): T | null {
  if (raw != null && typeof raw !== "string") return null;
  const value = (raw ?? "").trim();
  if (!value) return null;
  const parsed = parseFixedEnumParam(value, allowed, allowed[0]);
  return parsed === value ? parsed : null;
}

function parseOptionalScenarioConfidence(raw: string): number | null {
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  return parsePositiveIntParam(raw, { defaultValue: 1, min: 1, max: 100 });
}

export async function requestContractApproval(input: {
  contractId: string;
  approvalType: ApprovalType;
  approverId?: string | null;
  notes?: string | null;
  category?: ApprovalCategory;
  exceptionFlag?: boolean;
  exceptionReason?: string | null;
}) {
  if (!isUuid(input.contractId)) return { error: "Invalid contract" };
  if (!APPROVAL_TYPES.includes(input.approvalType)) return { error: "Invalid approval type" };

  const notesValidation = validateOptionalApprovalText(input.notes, {
    maxLength: MAX_NOTE_LEN,
    tooLong: "Notes are too long",
    unsafe: "Notes contain unsupported characters",
  });
  if (!notesValidation.ok) return { error: notesValidation.error };
  const category = input.category ?? "standard";
  if (!APPROVAL_CATEGORIES.includes(category)) {
    return { error: "Invalid category" };
  }
  const exceptionReasonValidation = validateOptionalApprovalText(input.exceptionReason, {
    maxLength: MAX_EXCEPTION_REASON_LEN,
    tooLong: "Exception reason is too long",
    unsafe: "Exception reason contains unsupported characters",
  });
  if (!exceptionReasonValidation.ok) return { error: exceptionReasonValidation.error };
  let approverId = input.approverId?.trim() || null;
  if (approverId && !isUuid(approverId)) return { error: "Invalid approver" };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const notes = notesValidation.value;
  const exceptionReason = exceptionReasonValidation.value;

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id, contract_type, annual_value")
    .eq("id", input.contractId)
    .maybeSingle();
  if (!contract) return { error: "Contract not found" };

  if (!(await canManageApprovalsForOrg(admin, contract.organization_id, user.id))) {
    return { error: "You do not have approval permissions." };
  }

  if (approverId) {
    const { data: approverMembership } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", contract.organization_id)
      .eq("user_id", approverId)
      .maybeSingle();
    if (!approverMembership) return { error: "Approver must be an organization member" };
  }

  const { data: policies } = await admin
    .from("approval_policies")
    .select("required_approver_id, min_annual_value, contract_type, sla_hours, policy_category")
    .eq("organization_id", contract.organization_id)
    .eq("approval_type", input.approvalType)
    .eq("active", true);

  const matchingPolicy = (policies ?? []).find((policy) => {
    const typeMatches =
      !policy.contract_type || policy.contract_type === contract.contract_type;
    const valueMatches =
      policy.min_annual_value == null ||
      Number(contract.annual_value ?? 0) >= Number(policy.min_annual_value);
    return typeMatches && valueMatches;
  });
  if (matchingPolicy?.required_approver_id) {
    approverId = matchingPolicy.required_approver_id;
  }
  const slaHours = Math.max(1, Number(matchingPolicy?.sla_hours ?? 72));
  const dueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();
  const policyCategory =
    (matchingPolicy?.policy_category as
      | "standard"
      | "policy_exception"
      | "financial"
      | "operational"
      | undefined) ?? category;

  const { data: approval, error } = await admin
    .from("contract_approvals")
    .insert({
      contract_id: input.contractId,
      organization_id: contract.organization_id,
      approval_type: input.approvalType,
      requested_by: user.id,
      approver_id: approverId,
      due_at: dueAt,
      category: policyCategory,
      exception_flag: Boolean(input.exceptionFlag),
      exception_reason: exceptionReason,
      notes,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) return { error: mapDataSourceError(error.message) };

  if (approverId) {
    const notificationsAllowed = await isNotificationTypeAllowedForWorkspace(admin as never, {
      organizationId: contract.organization_id,
      notificationType: "approval_requested",
    });
    if (notificationsAllowed) {
      await admin.from("internal_notifications").insert({
        organization_id: contract.organization_id,
        user_id: approverId,
        notification_type: "approval_requested",
        title: "Approval requested",
        body: notes ?? "A contract approval request is waiting for review.",
        entity_type: "contract_approval",
        entity_id: approval.id,
      });
    }
  }

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: input.contractId,
    user_id: user.id,
    action: "approval.requested",
    details: {
      approval_id: approval.id,
      approval_type: input.approvalType,
      approver_id: approverId,
      due_at: dueAt,
      category: policyCategory,
      exception_flag: Boolean(input.exceptionFlag),
    },
  });
  const v10AuditEventId = await recordV10AuditEvent(admin, {
    organizationId: contract.organization_id,
    actorUserId: user.id,
    action: "approval.requested",
    targetType: "approval",
    targetId: approval.id,
    contractId: input.contractId,
    outcome: "success",
    safeMetadata: {
      approval_type: input.approvalType,
      assigned: Boolean(approverId),
      due_at: dueAt,
      category: policyCategory,
    },
  });
  await appendApprovalEvent(admin, {
    organizationId: contract.organization_id,
    contractId: input.contractId,
    approvalId: approval.id,
    actorId: user.id,
    eventType: "requested",
    details: {
      approval_type: input.approvalType,
      approver_id: approverId,
      due_at: dueAt,
      category: policyCategory,
      exception_reason: exceptionReason,
    },
  });
  if (input.exceptionFlag || exceptionReason) {
    await appendApprovalEvent(admin, {
      organizationId: contract.organization_id,
      contractId: input.contractId,
      approvalId: approval.id,
      actorId: user.id,
      eventType: "exception_logged",
      details: { exception_reason: exceptionReason },
    });
  }
  await admin.from("contract_notes").insert({
    contract_id: input.contractId,
    organization_id: contract.organization_id,
    author_id: user.id,
    note: `[Timeline] Approval requested (${input.approvalType})`,
    pinned: false,
  });
  await enqueueOutboundEvent({
    organizationId: contract.organization_id,
    eventType: "approval.requested",
    entityType: "contract_approval",
    entityId: approval.id,
    schemaVersion: "v1",
    payload: {
      contract_id: contract.id,
      approval_type: input.approvalType,
      category: policyCategory,
      exception_flag: Boolean(input.exceptionFlag),
    },
  });
  await autoTransitionTasksForApproval({
    admin,
    organizationId: contract.organization_id,
    contractId: contract.id,
    actorId: user.id,
    approvalStatus: "pending",
    approvalDueAt: dueAt,
  });
  await refreshV10ReadModelsForOrganization(admin, contract.organization_id, {
    refreshScope: "one_contract",
    contractId: contract.id,
    reason: "approval_request_mutation",
    modelKeys: ["work_items", "contract_health_snapshots", "contract_activity_events", "approval_records", "audit_events", "command_search_index"],
  });
  revalidateApprovalPaths(contract.id);

  return {
    success: true as const,
    approvalId: approval.id,
    v10AuditEventId,
    v10: buildApprovalMutationEnvelope({
      outcome: v10AuditEventId ? "success" : "audit_write_failed",
      message: v10AuditEventId ? "Approval requested." : "Approval requested, but audit confirmation is missing.",
      approvalId: approval.id,
      contractId: contract.id,
      auditEventId: v10AuditEventId,
    }),
  };
}

export async function requestContractApprovalForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const approvalType = parseApprovalFormEnum(formData.get("approvalType"), APPROVAL_TYPES);
  const approverId = String(formData.get("approverId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const category = parseApprovalFormEnum(formData.get("category"), APPROVAL_CATEGORIES);
  const exceptionFlag = String(formData.get("exceptionFlag") ?? "") === "1";
  const exceptionReason = String(formData.get("exceptionReason") ?? "").trim();
  if (!approvalType) return;
  const res = await requestContractApproval({
    contractId,
    approvalType,
    approverId: approverId || null,
    notes: notes || null,
    category: category || undefined,
    exceptionFlag,
    exceptionReason: exceptionReason || null,
  });
  if (res && "error" in res && res.error) {
    console.error("[approvals] requestContractApprovalForm", res.error);
  }
}

export async function updateContractApprovalStatus(input: {
  approvalId: string;
  status: ApprovalStatus;
  notes?: string | null;
}) {
  if (!isUuid(input.approvalId)) return { error: "Invalid approval" };
  if (!APPROVAL_STATUSES.includes(input.status)) return { error: "Invalid status" };
  const notesValidation = validateOptionalApprovalText(input.notes, {
    maxLength: MAX_NOTE_LEN,
    tooLong: "Notes are too long",
    unsafe: "Notes contain unsupported characters",
  });
  if (!notesValidation.ok) return { error: notesValidation.error };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const notes = notesValidation.value;

  const { data: approval } = await admin
    .from("contract_approvals")
    .select("id, contract_id, organization_id, approver_id, status")
    .eq("id", input.approvalId)
    .maybeSingle();
  if (!approval) return { error: "Approval not found" };
  if (approval.status !== "pending") {
    return { error: "Only pending approvals can be updated" };
  }
  if (input.status === "pending") {
    return { error: "Approval decisions must approve, reject, or request changes." };
  }
  const nextDecision = input.status;
  const v10DecisionFailures = validateV10ApprovalDecision({
    status: approval.status,
    decision: nextDecision,
    note: notes,
  });
  if (v10DecisionFailures.includes("decision_note_required")) {
    return { error: "Add a decision note before rejecting this approval or requesting changes." };
  }
  if (v10DecisionFailures.length > 0) {
    return { error: "This approval can no longer be decided." };
  }

  const canResolve =
    (await canManageApprovalsForOrg(admin, approval.organization_id, user.id)) ||
    approval.approver_id === user.id;
  if (!canResolve) return { error: "Access denied" };

  await emitWorkActionTelemetry(
    admin,
    {
      organizationId: approval.organization_id,
      userId: user.id,
      contractId: approval.contract_id,
    },
    "approval",
    "update_status",
    "attempted"
  );

  const { error } = await admin
    .from("contract_approvals")
    .update({
      status: input.status,
      notes,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", input.approvalId);
  if (error) {
    await emitWorkActionTelemetry(
      admin,
      {
        organizationId: approval.organization_id,
        userId: user.id,
        contractId: approval.contract_id,
      },
      "approval",
      "update_status",
      "failed"
    );
    await emitVisibleMutationErrorTelemetry(admin, {
      organizationId: approval.organization_id,
      userId: user.id,
      contractId: approval.contract_id,
      surface: "work",
      mutation: "updateContractApprovalStatus",
      code: mapDataSourceError(error.message),
    });
    return { error: mapDataSourceError(error.message) };
  }

  await admin.from("audit_events").insert({
    organization_id: approval.organization_id,
    contract_id: approval.contract_id,
    user_id: user.id,
    action: "approval.updated",
    details: { approval_id: input.approvalId, status: input.status },
  });
  const v10AuditEventId = await recordV10AuditEvent(admin, {
    organizationId: approval.organization_id,
    actorUserId: user.id,
    action: approvalAuditActionForStatus(input.status),
    targetType: "approval",
    targetId: input.approvalId,
    contractId: approval.contract_id,
    outcome: "success",
    beforeStateHash: "pending",
    afterStateHash: input.status,
    safeMetadata: { note_state: notes ? "provided" : "not_provided" },
  });
  await appendApprovalEvent(admin, {
    organizationId: approval.organization_id,
    contractId: approval.contract_id,
    approvalId: approval.id,
    actorId: user.id,
    eventType: "status_changed",
    details: { status: input.status, notes },
  });

  await admin.from("contract_notes").insert({
    contract_id: approval.contract_id,
    organization_id: approval.organization_id,
    author_id: user.id,
    note: `[Timeline] Approval ${input.status}: ${input.approvalId}`,
    pinned: false,
  });
  await enqueueOutboundEvent({
    organizationId: approval.organization_id,
    eventType: "approval.status_changed",
    entityType: "contract_approval",
    entityId: approval.id,
    payload: { contract_id: approval.contract_id, status: input.status },
    schemaVersion: "v1",
  });
  const taskTransitionSummary = await autoTransitionTasksForApproval({
    admin,
    organizationId: approval.organization_id,
    contractId: approval.contract_id,
    actorId: user.id,
    approvalStatus: input.status,
    approvalDueAt: null,
  });

  await emitWorkActionTelemetry(
    admin,
    {
      organizationId: approval.organization_id,
      userId: user.id,
      contractId: approval.contract_id,
    },
    "approval",
    "update_status",
    "succeeded"
  );
  await refreshV10ReadModelsForOrganization(admin, approval.organization_id, {
    refreshScope: "one_contract",
    contractId: approval.contract_id,
    reason: "approval_status_mutation",
    modelKeys: ["work_items", "contract_health_snapshots", "contract_activity_events", "approval_records", "audit_events", "command_search_index"],
  });
  revalidateApprovalPaths(approval.contract_id);

  return {
    success: true as const,
    reopenedTaskCount: taskTransitionSummary?.reopenedCount ?? 0,
    blockedTaskCount: taskTransitionSummary?.blockedCount ?? 0,
    v10AuditEventId,
    v10: buildApprovalMutationEnvelope({
      outcome: v10AuditEventId ? "success" : "audit_write_failed",
      message: v10AuditEventId
        ? approvalDecisionMessage(input.status)
        : `${approvalDecisionMessage(input.status).replace(/[.]$/, "")}, but audit confirmation is missing.`,
      approvalId: input.approvalId,
      contractId: approval.contract_id,
      auditEventId: v10AuditEventId,
    }),
  };
}

export async function updateContractApprovalStatusForm(formData: FormData) {
  const approvalId = String(formData.get("approvalId") ?? "").trim();
  const status = parseApprovalFormEnum(formData.get("status"), APPROVAL_STATUSES);
  const notes = String(formData.get("notes") ?? "").trim();
  if (!status) return;
  const res = await updateContractApprovalStatus({
    approvalId,
    status,
    notes: notes || null,
  });
  if (res && "error" in res && res.error) {
    console.error("[approvals] updateContractApprovalStatusForm", res.error);
  }
}

export async function delegateContractApproval(input: {
  approvalId: string;
  delegateToUserId: string;
  reason?: string | null;
}) {
  if (!isUuid(input.approvalId) || !isUuid(input.delegateToUserId)) {
    return { error: "Invalid request" };
  }
  const reasonValidation = validateOptionalApprovalText(input.reason, {
    maxLength: MAX_EXCEPTION_REASON_LEN,
    tooLong: "Delegation reason is too long",
    unsafe: "Delegation reason contains unsupported characters",
  });
  if (!reasonValidation.ok) return { error: reasonValidation.error };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const reason = reasonValidation.value;

  const { data: approval } = await admin
    .from("contract_approvals")
    .select("id, contract_id, organization_id, approver_id, status")
    .eq("id", input.approvalId)
    .maybeSingle();
  if (!approval) return { error: "Approval not found" };
  if (approval.status !== "pending") return { error: "Only pending approvals can be delegated" };

  const allowed =
    (await canManageApprovalsForOrg(admin, approval.organization_id, user.id)) ||
    approval.approver_id === user.id;
  if (!allowed) return { error: "Access denied" };

  const { data: membership } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", approval.organization_id)
    .eq("user_id", input.delegateToUserId)
    .maybeSingle();
  if (!membership) return { error: "Delegate must be an organization member" };

  const { error } = await admin
    .from("contract_approvals")
    .update({
      delegated_from_id: approval.approver_id,
      delegated_to_id: input.delegateToUserId,
      approver_id: input.delegateToUserId,
    })
    .eq("id", approval.id);
  if (error) return { error: mapDataSourceError(error.message) };

  const v10AuditEventId = await recordV10AuditEvent(admin, {
    organizationId: approval.organization_id,
    actorUserId: user.id,
    action: "approval.delegated",
    targetType: "approval",
    targetId: approval.id,
    contractId: approval.contract_id,
    outcome: "success",
    beforeStateHash: approval.status,
    afterStateHash: "delegated",
    safeMetadata: { delegate_user_assigned: true, reason_state: reason ? "provided" : "not_provided" },
  });
  await appendApprovalEvent(admin, {
    organizationId: approval.organization_id,
    contractId: approval.contract_id,
    approvalId: approval.id,
    actorId: user.id,
    eventType: "delegated",
    details: {
      delegated_from_id: approval.approver_id,
      delegated_to_id: input.delegateToUserId,
      reason,
    },
  });
  await admin.from("audit_events").insert({
    organization_id: approval.organization_id,
    contract_id: approval.contract_id,
    user_id: user.id,
    action: "approval.delegated",
    details: {
      approval_id: approval.id,
      delegated_to_id: input.delegateToUserId,
      reason,
    },
  });
  await enqueueOutboundEvent({
    organizationId: approval.organization_id,
    eventType: "approval.delegated",
    entityType: "contract_approval",
    entityId: approval.id,
    payload: {
      contract_id: approval.contract_id,
      delegated_to_id: input.delegateToUserId,
      delegated_from_id: approval.approver_id,
      reason,
    },
    schemaVersion: "v1",
  });

  await refreshV10ReadModelsForOrganization(admin, approval.organization_id, {
    refreshScope: "one_contract",
    contractId: approval.contract_id,
    reason: "approval_delegate_mutation",
    modelKeys: ["work_items", "contract_health_snapshots", "contract_activity_events", "approval_records", "audit_events", "command_search_index"],
  });
  revalidateApprovalPaths(approval.contract_id);

  return { success: true as const, v10AuditEventId };
}

export async function delegateContractApprovalForm(formData: FormData) {
  const approvalId = String(formData.get("approvalId") ?? "").trim();
  const delegateToUserId = String(formData.get("delegateToUserId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const res = await delegateContractApproval({
    approvalId,
    delegateToUserId,
    reason: reason || null,
  });
  if (res && "error" in res && res.error) {
    console.error("[approvals] delegateContractApprovalForm", res.error);
  }
}

export async function upsertRenewalScenario(input: {
  contractId: string;
  scenario: RenewalScenario;
  decisionNotes?: string | null;
  blocker?: string | null;
  workspaceStatus?: RenewalWorkspaceStatus;
  ownerId?: string | null;
  targetDecisionDate?: string | null;
  escalationDate?: string | null;
  commercialContext?: string | null;
  scenarioConfidence?: number | null;
}) {
  if (!isUuid(input.contractId)) return { error: "Invalid contract" };
  if (!RENEWAL_SCENARIOS.includes(input.scenario)) return { error: "Invalid scenario" };

  const decisionNotesValidation = validateOptionalApprovalText(input.decisionNotes, {
    maxLength: MAX_NOTE_LEN,
    tooLong: "Decision notes are too long",
    unsafe: "Decision notes contain unsupported characters",
  });
  if (!decisionNotesValidation.ok) return { error: decisionNotesValidation.error };
  const blockerValidation = validateOptionalApprovalText(input.blocker, {
    maxLength: MAX_BLOCKER_LEN,
    tooLong: "Blocker is too long",
    unsafe: "Blocker contains unsupported characters",
  });
  if (!blockerValidation.ok) return { error: blockerValidation.error };
  const workspaceStatus = input.workspaceStatus ?? "in_progress";
  if (!RENEWAL_WORKSPACE_STATUSES.includes(workspaceStatus)) {
    return { error: "Invalid workspace status" };
  }
  const ownerId = input.ownerId?.trim() || null;
  if (ownerId && !isUuid(ownerId)) return { error: "Invalid owner" };
  const targetDecisionDate = input.targetDecisionDate?.trim() || null;
  const escalationDate = input.escalationDate?.trim() || null;
  if (targetDecisionDate && !isIsoDateOnly(targetDecisionDate)) {
    return { error: "Invalid target decision date" };
  }
  if (escalationDate && !isIsoDateOnly(escalationDate)) {
    return { error: "Invalid escalation date" };
  }
  const commercialContextValidation = validateOptionalApprovalText(input.commercialContext, {
    maxLength: MAX_NOTE_LEN,
    tooLong: "Commercial context is too long",
    unsafe: "Commercial context contains unsupported characters",
  });
  if (!commercialContextValidation.ok) return { error: commercialContextValidation.error };
  const scenarioConfidence =
    typeof input.scenarioConfidence === "number" &&
    Number.isFinite(input.scenarioConfidence) &&
    input.scenarioConfidence >= 1 &&
    input.scenarioConfidence <= 100
      ? Math.trunc(input.scenarioConfidence)
      : null;

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const decisionNotes = decisionNotesValidation.value;
  const blocker = blockerValidation.value;
  const commercialContext = commercialContextValidation.value;

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", input.contractId)
    .maybeSingle();
  if (!contract) return { error: "Contract not found" };

  if (!(await canManageApprovalsForOrg(admin, contract.organization_id, user.id))) {
    return { error: "You do not have approval permissions." };
  }

  const { error } = await admin
    .from("contract_renewal_scenarios")
    .upsert(
      {
        contract_id: input.contractId,
        organization_id: contract.organization_id,
        scenario: input.scenario,
        decision_notes: decisionNotes,
        blocker,
        workspace_status: workspaceStatus,
        owner_id: ownerId,
        target_decision_date: targetDecisionDate,
        escalation_date: escalationDate,
        commercial_context: commercialContext,
        scenario_confidence: scenarioConfidence,
        decision_date:
          workspaceStatus === "closed" ? new Date().toISOString().slice(0, 10) : null,
        last_reviewed_at: new Date().toISOString(),
        decided_by: user.id,
        decided_at: new Date().toISOString(),
      },
      { onConflict: "contract_id", ignoreDuplicates: false }
    );
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: input.contractId,
    user_id: user.id,
    action: "renewal.scenario_updated",
    details: {
      scenario: input.scenario,
      blocker,
      workspace_status: workspaceStatus,
      target_decision_date: targetDecisionDate,
      escalation_date: escalationDate,
      scenario_confidence: scenarioConfidence,
    },
  });
  await admin.from("contract_notes").insert({
    contract_id: input.contractId,
    organization_id: contract.organization_id,
    author_id: user.id,
    note: `[Timeline] Renewal scenario set to ${input.scenario}${blocker ? ` (blocker: ${blocker})` : ""}`,
    pinned: false,
  });
  await enqueueOutboundEvent({
    organizationId: contract.organization_id,
    eventType: "renewal.scenario_updated",
    entityType: "contract_renewal_scenario",
    entityId: contract.id,
    payload: {
      contract_id: contract.id,
      scenario: input.scenario,
      workspace_status: workspaceStatus,
      scenario_confidence: scenarioConfidence,
    },
    schemaVersion: "v1",
  });

  return { success: true as const };
}

export async function upsertRenewalScenarioForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const scenario = parseApprovalFormEnum(formData.get("scenario"), RENEWAL_SCENARIOS);
  const blocker = String(formData.get("blocker") ?? "").trim();
  const decisionNotes = String(formData.get("decisionNotes") ?? "").trim();
  const workspaceStatus = parseApprovalFormEnum(formData.get("workspaceStatus"), RENEWAL_WORKSPACE_STATUSES);
  const ownerId = String(formData.get("ownerId") ?? "").trim();
  const targetDecisionDate = String(formData.get("targetDecisionDate") ?? "").trim();
  const escalationDate = String(formData.get("escalationDate") ?? "").trim();
  const commercialContext = String(formData.get("commercialContext") ?? "").trim();
  const scenarioConfidenceRaw = String(formData.get("scenarioConfidence") ?? "").trim();
  const scenarioConfidence = parseOptionalScenarioConfidence(scenarioConfidenceRaw);
  if (!scenario) return;
  const res = await upsertRenewalScenario({
    contractId,
    scenario,
    blocker: blocker || null,
    decisionNotes: decisionNotes || null,
    workspaceStatus: workspaceStatus || undefined,
    ownerId: ownerId || null,
    targetDecisionDate: targetDecisionDate || null,
    escalationDate: escalationDate || null,
    commercialContext: commercialContext || null,
    scenarioConfidence,
  });
  if (res && "error" in res && res.error) {
    console.error("[approvals] upsertRenewalScenarioForm", res.error);
  }
}
