"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isUuid } from "@/lib/security/validation";
import type { ApprovalStatus, ApprovalType, RenewalScenario } from "@/lib/types";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import { hasRoleCapability } from "@/lib/access-control";
import { autoTransitionTasksForApproval } from "@/actions/tasks";
import { isNotificationTypeAllowedForWorkspace } from "@/lib/notification-policy";

const APPROVAL_TYPES: ApprovalType[] = [
  "renewal_decision",
  "notice_action",
  "commercial_exception",
  "ownership_handoff",
];
const APPROVAL_STATUSES: ApprovalStatus[] = ["pending", "approved", "rejected"];
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

async function appendApprovalEvent(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: {
    organizationId: string;
    contractId: string;
    approvalId: string;
    actorId: string | null;
    eventType: "requested" | "status_changed" | "delegated" | "escalated" | "exception_logged";
    details?: Record<string, unknown>;
  }
) {
  await admin.from("contract_approval_events").insert({
    organization_id: input.organizationId,
    contract_id: input.contractId,
    approval_id: input.approvalId,
    actor_id: input.actorId,
    event_type: input.eventType,
    details: input.details ?? {},
  });
}

async function canManageApprovalsForOrg(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  organizationId: string,
  userId: string
) {
  const role = await getOrgMemberRole(admin, userId, organizationId);
  if (canEditContracts(role)) return true;
  const { data: workflowSettings } = await admin
    .from("organization_workflow_settings")
    .select("role_policy_json")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return hasRoleCapability({
    role,
    capability: "approvals_manage",
    rolePolicyJson: (workflowSettings?.role_policy_json as Record<string, unknown> | null) ?? {},
  });
}

export async function requestContractApproval(input: {
  contractId: string;
  approvalType: ApprovalType;
  approverId?: string | null;
  notes?: string | null;
  category?: "standard" | "policy_exception" | "financial" | "operational";
  exceptionFlag?: boolean;
  exceptionReason?: string | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.contractId)) return { error: "Invalid contract" };
  if (!APPROVAL_TYPES.includes(input.approvalType)) return { error: "Invalid approval type" };

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > MAX_NOTE_LEN) return { error: "Notes are too long" };
  const category = input.category ?? "standard";
  if (!["standard", "policy_exception", "financial", "operational"].includes(category)) {
    return { error: "Invalid category" };
  }
  const exceptionReason = input.exceptionReason?.trim() || null;
  if (exceptionReason && exceptionReason.length > MAX_EXCEPTION_REASON_LEN) {
    return { error: "Exception reason is too long" };
  }

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id, contract_type, annual_value")
    .eq("id", input.contractId)
    .maybeSingle();
  if (!contract) return { error: "Contract not found" };

  if (!(await canManageApprovalsForOrg(admin, contract.organization_id, user.id))) {
    return { error: "You do not have approval permissions." };
  }

  let approverId = input.approverId?.trim() || null;
  if (approverId && !isUuid(approverId)) return { error: "Invalid approver" };

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

  return { success: true as const, approvalId: approval.id };
}

export async function requestContractApprovalForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const approvalType = String(formData.get("approvalType") ?? "").trim();
  const approverId = String(formData.get("approverId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const exceptionFlag = String(formData.get("exceptionFlag") ?? "") === "1";
  const exceptionReason = String(formData.get("exceptionReason") ?? "").trim();
  const res = await requestContractApproval({
    contractId,
    approvalType: approvalType as ApprovalType,
    approverId: approverId || null,
    notes: notes || null,
    category: (category as "standard" | "policy_exception" | "financial" | "operational") || undefined,
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
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.approvalId)) return { error: "Invalid approval" };
  if (!APPROVAL_STATUSES.includes(input.status)) return { error: "Invalid status" };

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > MAX_NOTE_LEN) return { error: "Notes are too long" };

  const { data: approval } = await admin
    .from("contract_approvals")
    .select("id, contract_id, organization_id, approver_id")
    .eq("id", input.approvalId)
    .maybeSingle();
  if (!approval) return { error: "Approval not found" };

  const canResolve =
    (await canManageApprovalsForOrg(admin, approval.organization_id, user.id)) ||
    approval.approver_id === user.id;
  if (!canResolve) return { error: "Access denied" };

  const { error } = await admin
    .from("contract_approvals")
    .update({
      status: input.status,
      notes,
      resolved_at: input.status === "pending" ? null : new Date().toISOString(),
    })
    .eq("id", input.approvalId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: approval.organization_id,
    contract_id: approval.contract_id,
    user_id: user.id,
    action: "approval.updated",
    details: { approval_id: input.approvalId, status: input.status },
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
  await autoTransitionTasksForApproval({
    admin,
    organizationId: approval.organization_id,
    contractId: approval.contract_id,
    actorId: user.id,
    approvalStatus: input.status,
    approvalDueAt: null,
  });

  return { success: true as const };
}

export async function updateContractApprovalStatusForm(formData: FormData) {
  const approvalId = String(formData.get("approvalId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const res = await updateContractApprovalStatus({
    approvalId,
    status: status as ApprovalStatus,
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
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.approvalId) || !isUuid(input.delegateToUserId)) {
    return { error: "Invalid request" };
  }
  const reason = input.reason?.trim() || null;
  if (reason && reason.length > MAX_EXCEPTION_REASON_LEN) {
    return { error: "Delegation reason is too long" };
  }

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

  return { success: true as const };
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
  workspaceStatus?: "not_started" | "in_progress" | "blocked" | "decision_pending" | "closed";
  ownerId?: string | null;
  targetDecisionDate?: string | null;
  escalationDate?: string | null;
  commercialContext?: string | null;
  scenarioConfidence?: number | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.contractId)) return { error: "Invalid contract" };
  if (!RENEWAL_SCENARIOS.includes(input.scenario)) return { error: "Invalid scenario" };

  const decisionNotes = input.decisionNotes?.trim() || null;
  const blocker = input.blocker?.trim() || null;
  const workspaceStatus = input.workspaceStatus ?? "in_progress";
  const ownerId = input.ownerId?.trim() || null;
  const targetDecisionDate = input.targetDecisionDate?.trim() || null;
  const escalationDate = input.escalationDate?.trim() || null;
  const commercialContext = input.commercialContext?.trim() || null;
  const scenarioConfidence =
    typeof input.scenarioConfidence === "number" &&
    Number.isFinite(input.scenarioConfidence) &&
    input.scenarioConfidence >= 1 &&
    input.scenarioConfidence <= 100
      ? Math.trunc(input.scenarioConfidence)
      : null;
  if (decisionNotes && decisionNotes.length > MAX_NOTE_LEN) return { error: "Decision notes are too long" };
  if (blocker && blocker.length > 800) return { error: "Blocker is too long" };
  if (!["not_started", "in_progress", "blocked", "decision_pending", "closed"].includes(workspaceStatus)) {
    return { error: "Invalid workspace status" };
  }
  if (ownerId && !isUuid(ownerId)) return { error: "Invalid owner" };
  if (targetDecisionDate && Number.isNaN(new Date(`${targetDecisionDate}T12:00:00`).getTime())) {
    return { error: "Invalid target decision date" };
  }
  if (escalationDate && Number.isNaN(new Date(`${escalationDate}T12:00:00`).getTime())) {
    return { error: "Invalid escalation date" };
  }
  if (commercialContext && commercialContext.length > MAX_NOTE_LEN) {
    return { error: "Commercial context is too long" };
  }

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
  const scenario = String(formData.get("scenario") ?? "").trim();
  const blocker = String(formData.get("blocker") ?? "").trim();
  const decisionNotes = String(formData.get("decisionNotes") ?? "").trim();
  const workspaceStatus = String(formData.get("workspaceStatus") ?? "").trim();
  const ownerId = String(formData.get("ownerId") ?? "").trim();
  const targetDecisionDate = String(formData.get("targetDecisionDate") ?? "").trim();
  const escalationDate = String(formData.get("escalationDate") ?? "").trim();
  const commercialContext = String(formData.get("commercialContext") ?? "").trim();
  const scenarioConfidenceRaw = String(formData.get("scenarioConfidence") ?? "").trim();
  const scenarioConfidence = scenarioConfidenceRaw ? Number(scenarioConfidenceRaw) : null;
  const res = await upsertRenewalScenario({
    contractId,
    scenario: scenario as RenewalScenario,
    blocker: blocker || null,
    decisionNotes: decisionNotes || null,
    workspaceStatus:
      (workspaceStatus as "not_started" | "in_progress" | "blocked" | "decision_pending" | "closed") ||
      undefined,
    ownerId: ownerId || null,
    targetDecisionDate: targetDecisionDate || null,
    escalationDate: escalationDate || null,
    commercialContext: commercialContext || null,
    scenarioConfidence:
      scenarioConfidence != null && Number.isFinite(scenarioConfidence) ? scenarioConfidence : null,
  });
  if (res && "error" in res && res.error) {
    console.error("[approvals] upsertRenewalScenarioForm", res.error);
  }
}
