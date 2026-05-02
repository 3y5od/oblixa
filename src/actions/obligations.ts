"use server";

import { createAdminClient, createClient, getOrEnsureDeterministicMembership } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isUuid } from "@/lib/security/validation";
import type { ContractObligationStatus } from "@/lib/types";
import { recomputeContractSignals } from "@/lib/workflow-signals";
import { emitProductTelemetryEvent, emitVisibleMutationErrorTelemetry, emitWorkActionTelemetry } from "@/lib/product-telemetry";
import { recordV10AuditEvent } from "@/lib/v10-server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";
import { buildV10MutationResponse, type V10MutationResponse } from "@/lib/v10-mutation-envelope";

const OBLIGATION_STATUSES: ContractObligationStatus[] = [
  "open",
  "in_progress",
  "done",
  "waived",
];

const VALID_OBLIGATION_TRANSITIONS: Record<ContractObligationStatus, ContractObligationStatus[]> = {
  open: ["in_progress", "done", "waived"],
  in_progress: ["open", "done", "waived"],
  done: ["open"],
  waived: ["open"],
};

const MAX_TITLE_LEN = 240;
const MAX_DETAILS_LEN = 4000;
const MAX_EVIDENCE_LEN = 4000;
const MAX_TYPE_LEN = 80;
const MAX_CADENCE_LEN = 120;
const MAX_URL_LEN = 1000;
const MAX_FILE_PATH_LEN = 1000;

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

function buildObligationActionEnvelope(input: {
  outcome?: V10MutationResponse["outcome"];
  message: string;
  obligationId?: string | null;
  contractId?: string | null;
  auditEventId?: string | null;
  nextDestinationHref?: string | null;
}): V10MutationResponse {
  return buildV10MutationResponse({
    outcome: input.outcome ?? "success",
    message: input.message,
    changedObjectType: "obligation",
    changedObjectId: input.obligationId ?? null,
    nextDestinationHref:
      input.nextDestinationHref ??
      (input.contractId ? `/contracts/${input.contractId}?tab=obligations` : "/contracts/obligations"),
    auditEventId: input.auditEventId,
    retryEligible: false,
  });
}

async function recordV10ObligationMutation(
  admin: Admin,
  input: {
    organizationId: string;
    actorUserId: string;
    action: string;
    obligationId: string;
    contractId: string;
    beforeStateHash?: string | null;
    afterStateHash?: string | null;
    safeMetadata?: Record<string, string | number | boolean | null>;
  }
) {
  const auditEventId = await recordV10AuditEvent(admin, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: "obligation",
    targetId: input.obligationId,
    contractId: input.contractId,
    outcome: "success",
    beforeStateHash: input.beforeStateHash,
    afterStateHash: input.afterStateHash,
    safeMetadata: input.safeMetadata,
  });
  await refreshV10ReadModelsForOrganization(admin, input.organizationId, {
    reason: input.action,
    refreshScope: "incremental",
  });
  return auditEventId;
}

type ObligationRecurrenceType =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom_days";

const RECURRENCE_TYPES: ObligationRecurrenceType[] = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "custom_days",
];

function isObligationStatus(v: string): v is ContractObligationStatus {
  return OBLIGATION_STATUSES.includes(v as ContractObligationStatus);
}

async function ensureOwnerMember(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orgId: string,
  ownerId: string | null
): Promise<boolean> {
  if (!ownerId) return true;
  const { data } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", ownerId)
    .maybeSingle();
  return !!data;
}

function isRecurrenceType(v: string): v is ObligationRecurrenceType {
  return RECURRENCE_TYPES.includes(v as ObligationRecurrenceType);
}

function computeNextDueDate(
  recurrenceType: ObligationRecurrenceType,
  recurrenceIntervalDays: number | null,
  baseDate: Date
): string | null {
  const next = new Date(baseDate);
  if (recurrenceType === "none") return null;
  if (recurrenceType === "daily") next.setDate(next.getDate() + 1);
  else if (recurrenceType === "weekly") next.setDate(next.getDate() + 7);
  else if (recurrenceType === "monthly") next.setMonth(next.getMonth() + 1);
  else if (recurrenceType === "quarterly") next.setMonth(next.getMonth() + 3);
  else if (recurrenceType === "yearly") next.setFullYear(next.getFullYear() + 1);
  else if (recurrenceType === "custom_days") {
    if (!recurrenceIntervalDays || recurrenceIntervalDays < 1) return null;
    next.setDate(next.getDate() + recurrenceIntervalDays);
  }
  return Number.isNaN(next.getTime()) ? null : next.toISOString().slice(0, 10);
}

async function appendObligationEvent(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: {
    organizationId: string;
    contractId: string;
    obligationId: string;
    actorId: string | null;
    eventType: "created" | "updated" | "status_changed" | "evidence_added" | "escalated" | "recurrence_generated";
    details?: Record<string, unknown>;
  }
) {
  await admin.from("contract_obligation_events").insert({
    organization_id: input.organizationId,
    contract_id: input.contractId,
    obligation_id: input.obligationId,
    actor_id: input.actorId,
    event_type: input.eventType,
    details: input.details ?? {},
  });
}

export async function createContractObligation(input: {
  contractId: string;
  title: string;
  details?: string | null;
  obligationType?: string | null;
  cadence?: string | null;
  recurrenceType?: ObligationRecurrenceType;
  recurrenceIntervalDays?: number | null;
  escalationDueAt?: string | null;
  evidenceFilePath?: string | null;
  evidenceUrl?: string | null;
  dueDate?: string | null;
  ownerId?: string | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.contractId)) return { error: "Invalid contract" };

  const title = input.title.trim();
  const details = input.details?.trim() ?? "";
  const obligationType = input.obligationType?.trim() || "general";
  const cadence = input.cadence?.trim() || null;
  const recurrenceType = input.recurrenceType ?? "none";
  const recurrenceIntervalDays =
    typeof input.recurrenceIntervalDays === "number" &&
    Number.isFinite(input.recurrenceIntervalDays) &&
    input.recurrenceIntervalDays > 0
      ? Math.min(Math.trunc(input.recurrenceIntervalDays), 3650)
      : null;
  const escalationDueAt = input.escalationDueAt?.trim() || null;
  const evidenceFilePath = input.evidenceFilePath?.trim() || null;
  const evidenceUrl = input.evidenceUrl?.trim() || null;
  const dueDate = input.dueDate?.trim() || null;
  const ownerId = input.ownerId?.trim() || null;

  if (!title) return { error: "Title is required" };
  if (title.length > MAX_TITLE_LEN) return { error: "Title is too long" };
  if (details.length > MAX_DETAILS_LEN) return { error: "Details are too long" };
  if (obligationType.length > MAX_TYPE_LEN) return { error: "Type is too long" };
  if (cadence && cadence.length > MAX_CADENCE_LEN) return { error: "Cadence is too long" };
  if (!isRecurrenceType(recurrenceType)) return { error: "Invalid recurrence type" };
  if (recurrenceType === "custom_days" && !recurrenceIntervalDays) {
    return { error: "Custom recurrence requires interval days" };
  }
  if (evidenceFilePath && evidenceFilePath.length > MAX_FILE_PATH_LEN) {
    return { error: "Evidence file path is too long" };
  }
  if (evidenceUrl && evidenceUrl.length > MAX_URL_LEN) {
    return { error: "Evidence URL is too long" };
  }
  if (evidenceUrl && !/^https?:\/\//i.test(evidenceUrl)) {
    return { error: "Evidence URL must use http or https" };
  }
  if (escalationDueAt && Number.isNaN(new Date(escalationDueAt).getTime())) {
    return { error: "Invalid escalation due date" };
  }
  if (ownerId && !isUuid(ownerId)) return { error: "Invalid owner" };
  if (dueDate && Number.isNaN(new Date(`${dueDate}T12:00:00`).getTime())) {
    return { error: "Invalid due date" };
  }

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", input.contractId)
    .maybeSingle();
  if (!contract) return { error: "Contract not found" };

  const role = await getOrgMemberRole(admin, user.id, contract.organization_id);
  if (!canEditContracts(role)) {
    return { error: "Viewers cannot create obligations." };
  }
  if (!(await ensureOwnerMember(admin, contract.organization_id, ownerId))) {
    return { error: "Owner must be a member of this organization." };
  }

  const { data: created, error } = await admin
    .from("contract_obligations")
    .insert({
      contract_id: contract.id,
      organization_id: contract.organization_id,
      created_by: user.id,
      owner_id: ownerId,
      title,
      details: details || null,
      obligation_type: obligationType,
      cadence,
      recurrence_type: recurrenceType,
      recurrence_interval_days: recurrenceIntervalDays,
      next_due_date:
        recurrenceType !== "none" && dueDate
          ? computeNextDueDate(recurrenceType, recurrenceIntervalDays, new Date(`${dueDate}T12:00:00`))
          : null,
      escalation_due_at: escalationDueAt,
      escalation_status: escalationDueAt ? "pending" : "none",
      evidence_file_path: evidenceFilePath,
      evidence_url: evidenceUrl,
      due_date: dueDate,
      status: "open",
    })
    .select("id")
    .single();
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contract.id,
    user_id: user.id,
    action: "obligation.created",
    details: {
      obligation_id: created.id,
      title,
      obligation_type: obligationType,
      due_date: dueDate,
      recurrence_type: recurrenceType,
      recurrence_interval_days: recurrenceIntervalDays,
    },
  });
  await appendObligationEvent(admin, {
    organizationId: contract.organization_id,
    contractId: contract.id,
    obligationId: created.id,
    actorId: user.id,
    eventType: "created",
    details: {
      due_date: dueDate,
      recurrence_type: recurrenceType,
      escalation_due_at: escalationDueAt,
    },
  });
  await recomputeContractSignals(admin, contract.id);
  const auditEventId = await recordV10ObligationMutation(admin, {
    organizationId: contract.organization_id,
    actorUserId: user.id,
    action: "obligation.created",
    obligationId: created.id,
    contractId: contract.id,
    afterStateHash: "open",
    safeMetadata: {
      obligation_type: obligationType,
      owner_assigned: Boolean(ownerId),
      due_date_state: dueDate ? "provided" : "missing",
      recurrence_type: recurrenceType,
    },
  });

  return {
    success: true as const,
    obligationId: created.id,
    v10: buildObligationActionEnvelope({
      message: "Obligation created.",
      obligationId: created.id,
      contractId: contract.id,
      auditEventId,
    }),
  };
}

export async function updateContractObligation(input: {
  obligationId: string;
  status?: ContractObligationStatus;
  ownerId?: string | null;
  dueDate?: string | null;
  evidenceNotes?: string | null;
  recurrenceType?: ObligationRecurrenceType;
  recurrenceIntervalDays?: number | null;
  escalationDueAt?: string | null;
  escalationStatus?: "none" | "pending" | "sent" | "acked";
  evidenceFilePath?: string | null;
  evidenceUrl?: string | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.obligationId)) return { error: "Invalid obligation" };

  const { data: obligation } = await admin
    .from("contract_obligations")
    .select("id, contract_id, organization_id, status, title, details, owner_id, recurrence_type, recurrence_interval_days, due_date, obligation_type, cadence")
    .eq("id", input.obligationId)
    .maybeSingle();
  if (!obligation) return { error: "Obligation not found" };

  const role = await getOrgMemberRole(admin, user.id, obligation.organization_id);
  if (!canEditContracts(role)) {
    return { error: "Viewers cannot update obligations." };
  }

  const patch: Record<string, unknown> = {};

  if (input.status !== undefined) {
    if (!isObligationStatus(input.status)) return { error: "Invalid status" };
    const currentStatus = obligation.status as ContractObligationStatus;
    if (!VALID_OBLIGATION_TRANSITIONS[currentStatus]?.includes(input.status)) {
      return { error: `Cannot transition from ${currentStatus} to ${input.status}` };
    }
    patch.status = input.status;
    patch.completed_at =
      input.status === "done" || input.status === "waived"
        ? new Date().toISOString()
        : null;
  }
  if (input.ownerId !== undefined) {
    const ownerId = input.ownerId?.trim() || null;
    if (ownerId && !isUuid(ownerId)) return { error: "Invalid owner" };
    if (!(await ensureOwnerMember(admin, obligation.organization_id, ownerId))) {
      return { error: "Owner must be a member of this organization." };
    }
    patch.owner_id = ownerId;
  }
  if (input.dueDate !== undefined) {
    const dueDate = input.dueDate?.trim() || null;
    if (dueDate && Number.isNaN(new Date(`${dueDate}T12:00:00`).getTime())) {
      return { error: "Invalid due date" };
    }
    patch.due_date = dueDate;
  }
  if (input.evidenceNotes !== undefined) {
    const evidence = input.evidenceNotes?.trim() || null;
    if (evidence && evidence.length > MAX_EVIDENCE_LEN) {
      return { error: "Evidence notes are too long" };
    }
    patch.evidence_notes = evidence;
  }
  if (input.recurrenceType !== undefined) {
    if (!isRecurrenceType(input.recurrenceType)) return { error: "Invalid recurrence type" };
    patch.recurrence_type = input.recurrenceType;
  }
  if (input.recurrenceIntervalDays !== undefined) {
    const interval =
      typeof input.recurrenceIntervalDays === "number" &&
      Number.isFinite(input.recurrenceIntervalDays) &&
      input.recurrenceIntervalDays > 0
        ? Math.min(Math.trunc(input.recurrenceIntervalDays), 3650)
        : null;
    patch.recurrence_interval_days = interval;
  }
  if (input.escalationDueAt !== undefined) {
    const escalationDueAt = input.escalationDueAt?.trim() || null;
    if (escalationDueAt && Number.isNaN(new Date(escalationDueAt).getTime())) {
      return { error: "Invalid escalation due date" };
    }
    patch.escalation_due_at = escalationDueAt;
  }
  if (input.escalationStatus !== undefined) {
    if (!["none", "pending", "sent", "acked"].includes(input.escalationStatus)) {
      return { error: "Invalid escalation status" };
    }
    patch.escalation_status = input.escalationStatus;
  }
  if (input.evidenceFilePath !== undefined) {
    const path = input.evidenceFilePath?.trim() || null;
    if (path && path.length > MAX_FILE_PATH_LEN) return { error: "Evidence file path is too long" };
    patch.evidence_file_path = path;
  }
  if (input.evidenceUrl !== undefined) {
    const url = input.evidenceUrl?.trim() || null;
    if (url && url.length > MAX_URL_LEN) return { error: "Evidence URL is too long" };
    if (url && !/^https?:\/\//i.test(url)) {
      return { error: "Evidence URL must use http or https" };
    }
    patch.evidence_url = url;
  }

  if (Object.keys(patch).length === 0) {
    return {
      success: true as const,
      v10: buildObligationActionEnvelope({
        outcome: "no_action",
        message: "No action was needed for this obligation.",
        obligationId: input.obligationId,
        contractId: obligation.contract_id,
      }),
    };
  }

  if (input.status !== undefined) {
    await emitWorkActionTelemetry(
      admin,
      {
        organizationId: obligation.organization_id,
        userId: user.id,
        contractId: obligation.contract_id,
      },
      "obligation",
      "update_status",
      "attempted"
    );
  }

  const { error } = await admin
    .from("contract_obligations")
    .update(patch)
    .eq("id", input.obligationId);
  if (error) {
    await emitVisibleMutationErrorTelemetry(admin, {
      organizationId: obligation.organization_id,
      userId: user.id,
      contractId: obligation.contract_id,
      surface: "work",
      mutation: "updateContractObligation",
      code: mapDataSourceError(error.message),
    });
    if (input.status !== undefined) {
      await emitWorkActionTelemetry(
        admin,
        {
          organizationId: obligation.organization_id,
          userId: user.id,
          contractId: obligation.contract_id,
        },
        "obligation",
        "update_status",
        "failed"
      );
    }
    return { error: mapDataSourceError(error.message) };
  }

  await admin.from("audit_events").insert({
    organization_id: obligation.organization_id,
    contract_id: obligation.contract_id,
    user_id: user.id,
    action: "obligation.updated",
    details: { obligation_id: input.obligationId, ...patch },
  });
  await appendObligationEvent(admin, {
    organizationId: obligation.organization_id,
    contractId: obligation.contract_id,
    obligationId: input.obligationId,
    actorId: user.id,
    eventType:
      input.status !== undefined
        ? "status_changed"
        : input.evidenceNotes !== undefined || input.evidenceFilePath !== undefined || input.evidenceUrl !== undefined
          ? "evidence_added"
          : "updated",
    details: patch,
  });
  let generatedRecurringObligation = false;

  if (input.status === "done") {
    const recurrenceType =
      (patch.recurrence_type as ObligationRecurrenceType | undefined) ??
      (obligation.recurrence_type as ObligationRecurrenceType | undefined) ??
      "none";
    const recurrenceIntervalDays =
      (patch.recurrence_interval_days as number | null | undefined) ??
      (obligation.recurrence_interval_days as number | null | undefined) ??
      null;
    const baseDue =
      (patch.due_date as string | null | undefined) ??
      (obligation.due_date as string | null | undefined) ??
      new Date().toISOString().slice(0, 10);
    const nextDueDate = computeNextDueDate(
      recurrenceType,
      recurrenceIntervalDays,
      new Date(`${baseDue}T12:00:00`)
    );
    if (recurrenceType !== "none" && nextDueDate) {
      const { data: generated, error: generationError } = await admin
        .from("contract_obligations")
        .insert({
          contract_id: obligation.contract_id,
          organization_id: obligation.organization_id,
          created_by: user.id,
          owner_id: obligation.owner_id,
          title: obligation.title,
          details: obligation.details,
          obligation_type: obligation.obligation_type,
          cadence: obligation.cadence,
          due_date: nextDueDate,
          next_due_date: nextDueDate,
          recurrence_type: recurrenceType,
          recurrence_interval_days: recurrenceIntervalDays,
          status: "open",
        })
        .select("id")
        .single();
      if (generationError) {
        console.error("[obligations] recurrence insert failed", generationError.message);
      } else if (generated?.id) {
        generatedRecurringObligation = true;
        await appendObligationEvent(admin, {
          organizationId: obligation.organization_id,
          contractId: obligation.contract_id,
          obligationId: generated.id,
          actorId: user.id,
          eventType: "recurrence_generated",
          details: { from_obligation_id: input.obligationId, due_date: nextDueDate },
        });
      }
    }
  }
  await recomputeContractSignals(admin, obligation.contract_id);

  if (input.status !== undefined) {
    await emitWorkActionTelemetry(
      admin,
      {
        organizationId: obligation.organization_id,
        userId: user.id,
        contractId: obligation.contract_id,
      },
      "obligation",
      "update_status",
      "succeeded"
    );
  }
  const auditEventId = await recordV10ObligationMutation(admin, {
    organizationId: obligation.organization_id,
    actorUserId: user.id,
    action: input.status !== undefined ? "obligation.status_changed" : "obligation.updated",
    obligationId: input.obligationId,
    contractId: obligation.contract_id,
    beforeStateHash: String(obligation.status ?? "open"),
    afterStateHash: String(input.status ?? patch.status ?? "updated"),
    safeMetadata: {
      status_changed: input.status !== undefined,
      owner_changed: input.ownerId !== undefined,
      due_date_changed: input.dueDate !== undefined,
      evidence_changed:
        input.evidenceNotes !== undefined || input.evidenceFilePath !== undefined || input.evidenceUrl !== undefined,
      generated_recurring_obligation: generatedRecurringObligation,
    },
  });
  if (input.status === "done" || input.status === "waived") {
    await emitProductTelemetryEvent(admin, {
      organizationId: obligation.organization_id,
      userId: user.id,
      contractId: obligation.contract_id,
      action: "product.v10.work_item_completed",
      details: {
        source_type: "obligation",
        completion_state: input.status,
        generated_recurring_obligation: generatedRecurringObligation,
      },
    });
  }

  return {
    success: true as const,
    generatedRecurringObligation,
    v10: buildObligationActionEnvelope({
      message: input.status !== undefined ? "Obligation status updated." : "Obligation updated.",
      obligationId: input.obligationId,
      contractId: obligation.contract_id,
      auditEventId,
    }),
  };
}

export async function deleteContractObligation(obligationId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(obligationId)) return { error: "Invalid obligation" };

  const { data: obligation } = await admin
    .from("contract_obligations")
    .select("id, contract_id, organization_id")
    .eq("id", obligationId)
    .maybeSingle();
  if (!obligation) return { error: "Obligation not found" };

  const role = await getOrgMemberRole(admin, user.id, obligation.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot delete obligations." };

  const { error } = await admin
    .from("contract_obligations")
    .delete()
    .eq("id", obligationId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: obligation.organization_id,
    contract_id: obligation.contract_id,
    user_id: user.id,
    action: "obligation.deleted",
    details: { obligation_id: obligationId },
  });
  await appendObligationEvent(admin, {
    organizationId: obligation.organization_id,
    contractId: obligation.contract_id,
    obligationId,
    actorId: user.id,
    eventType: "updated",
    details: { deleted: true },
  });
  await recomputeContractSignals(admin, obligation.contract_id);
  const auditEventId = await recordV10ObligationMutation(admin, {
    organizationId: obligation.organization_id,
    actorUserId: user.id,
    action: "obligation.deleted",
    obligationId,
    contractId: obligation.contract_id,
    beforeStateHash: "visible",
    afterStateHash: "deleted",
  });

  return {
    success: true as const,
    v10: buildObligationActionEnvelope({
      message: "Obligation deleted.",
      obligationId,
      contractId: obligation.contract_id,
      auditEventId,
      nextDestinationHref: `/contracts/${obligation.contract_id}?tab=obligations`,
    }),
  };
}

export async function createObligationTemplate(input: {
  contractType: string;
  title: string;
  details?: string | null;
  obligationType?: string | null;
  cadence?: string | null;
  dueOffsetDays?: number | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const contractType = input.contractType.trim();
  const title = input.title.trim();
  if (!contractType) return { error: "Contract type is required" };
  if (!title) return { error: "Template title is required" };
  if (contractType.length > MAX_TYPE_LEN) return { error: "Contract type is too long" };
  if (title.length > MAX_TITLE_LEN) return { error: "Template title is too long" };

  const membership = await getOrEnsureDeterministicMembership(admin, user);
  if (!membership || !canEditContracts(membership.role)) {
    return { error: "Access denied" };
  }

  const { error } = await admin.from("obligation_templates").insert({
    organization_id: membership.organization_id,
    contract_type: contractType,
    title,
    details: input.details?.trim() || null,
    obligation_type: input.obligationType?.trim() || "general",
    cadence: input.cadence?.trim() || null,
    due_offset_days:
      typeof input.dueOffsetDays === "number" && Number.isFinite(input.dueOffsetDays)
        ? Math.max(0, Math.trunc(input.dueOffsetDays))
        : null,
    created_by: user.id,
  });
  if (error) return { error: mapDataSourceError(error.message) };

  return { success: true as const };
}

export async function createObligationTemplateForm(formData: FormData) {
  const contractType = String(formData.get("contractType") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const obligationType = String(formData.get("obligationType") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? "").trim();
  const dueOffsetRaw = String(formData.get("dueOffsetDays") ?? "").trim();
  const dueOffsetDays = dueOffsetRaw ? Number(dueOffsetRaw) : null;
  const res = await createObligationTemplate({
    contractType,
    title,
    details: details || null,
    obligationType: obligationType || null,
    cadence: cadence || null,
    dueOffsetDays:
      dueOffsetDays != null && Number.isFinite(dueOffsetDays) ? dueOffsetDays : null,
  });
  if (res && "error" in res && res.error) {
    return { error: res.error };
  }
  return { success: true as const };
}

export async function applyObligationTemplatesToContract(contractId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId)) return { error: "Invalid contract" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id, contract_type")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return { error: "Contract not found" };

  const role = await getOrgMemberRole(admin, user.id, contract.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot apply templates." };
  if (!contract.contract_type) return { error: "Contract type is required to apply templates." };

  const { data: templates } = await admin
    .from("obligation_templates")
    .select("title, details, obligation_type, cadence, due_offset_days")
    .eq("organization_id", contract.organization_id)
    .eq("contract_type", contract.contract_type)
    .eq("active", true);
  if (!templates || templates.length === 0) return { success: true as const, created: 0 };

  const baseDate = new Date();
  const rows = templates.map((t) => {
    const offset = typeof t.due_offset_days === "number" ? t.due_offset_days : null;
    const dueDate = offset == null ? null : new Date(baseDate.getTime() + offset * 24 * 60 * 60 * 1000);
    return {
      contract_id: contract.id,
      organization_id: contract.organization_id,
      created_by: user.id,
      owner_id: null,
      title: t.title,
      details: t.details,
      obligation_type: t.obligation_type,
      cadence: t.cadence,
      due_date: dueDate ? dueDate.toISOString().slice(0, 10) : null,
      status: "open" as const,
    };
  });

  const { error } = await admin.from("contract_obligations").insert(rows);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contract.id,
    user_id: user.id,
    action: "obligation.templates_applied",
    details: { count: rows.length, contract_type: contract.contract_type },
  });

  return { success: true as const, created: rows.length };
}

export async function applyObligationTemplatesToContractForm(contractId: string) {
  const res = await applyObligationTemplatesToContract(contractId);
  if (res && "error" in res && res.error) {
    return { error: res.error };
  }
  return { success: true as const };
}
