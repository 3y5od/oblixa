"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getContractAccessContext } from "@/lib/actions/access";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isIsoDateOnly, isUuid } from "@/lib/security/validation";
import type {
  ContractTaskPriority,
  ContractTaskStatus,
  OrgRole,
} from "@/lib/types";
import { recomputeContractSignals } from "@/lib/workflow-signals";
import {
  emitProductTelemetryEvent,
  emitProductTelemetryIfFirstForOrgUser,
  emitVisibleMutationErrorTelemetry,
  emitWorkActionTelemetry,
} from "@/lib/product-telemetry";
import { executeV10IdempotentMutation, recordV10AuditEvent } from "@/lib/v10-server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";
import { buildV10MutationResponse, type V10MutationResponse } from "@/lib/v10-mutation-envelope";
import { getV10CompatibleActionGroup } from "@/lib/v10-work-semantics";

const TASK_STATUSES: ContractTaskStatus[] = ["open", "in_progress", "blocked", "done"];
const TASK_PRIORITIES: ContractTaskPriority[] = ["low", "medium", "high"];
const MAX_TITLE_LEN = 240;
const MAX_DETAILS_LEN = 4000;
const MAX_TEAM_KEY_LEN = 80;
const MAX_BLOCKED_REASON_LEN = 400;
const MAX_TASK_COMMENT_LEN = 4000;
const MAX_CHECKLIST_ITEM_LEN = 240;
const MAX_ARTIFACT_LABEL_LEN = 240;
const MAX_ARTIFACT_URL_LEN = 2000;
const MAX_BULK_TASK_MUTATION_ITEMS = 50;

function resolveReplayedBulkTaskItemOutcomes<
  T extends { task: { id: string }; compatibleActionGroup: string; outcome: "success" | "no_action" | "validation_failed"; reason: string },
>(replayed: boolean, response: V10MutationResponse, itemOutcomes: T[]): T[] {
  const snaps = response.bulk_item_outcomes;
  if (!replayed || !snaps?.length) return itemOutcomes;
  return itemOutcomes.map((item) => {
    const snap = snaps.find((s) => s.target_id === item.task.id);
    if (!snap) return item;
    return {
      ...item,
      compatibleActionGroup: snap.compatible_action_group ?? item.compatibleActionGroup,
      outcome: snap.outcome,
      reason: snap.reason ?? item.reason,
    };
  });
}

const V10_TASK_REFRESH_MODEL_KEYS = [
  "work_items",
  "contract_health_snapshots",
  "contract_activity_events",
  "audit_events",
  "command_search_index",
] as const;

const VALID_TASK_TRANSITIONS: Record<ContractTaskStatus, ContractTaskStatus[]> = {
  open: ["in_progress", "blocked", "done"],
  in_progress: ["open", "blocked", "done"],
  blocked: ["open", "in_progress"],
  done: ["open"],
};

function isTaskStatus(v: string): v is ContractTaskStatus {
  return TASK_STATUSES.includes(v as ContractTaskStatus);
}

function isTaskPriority(v: string): v is ContractTaskPriority {
  return TASK_PRIORITIES.includes(v as ContractTaskPriority);
}

async function refreshV10TaskReadModels(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: { organizationId: string; contractId?: string | null; reason: string }
) {
  await refreshV10ReadModelsForOrganization(admin, input.organizationId, {
    refreshScope: input.contractId ? "one_contract" : "one_model",
    contractId: input.contractId ?? undefined,
    reason: input.reason,
    modelKeys: V10_TASK_REFRESH_MODEL_KEYS,
  });
}

type MembershipCtx = {
  userId: string;
  orgId: string;
  role: OrgRole | null;
};

function buildTaskMutationEnvelope(input: {
  outcome: "success" | "audit_write_failed";
  message: string;
  taskId: string;
  contractId: string;
  auditEventId: string | null;
}) {
  return buildV10MutationResponse({
    outcome: input.outcome,
    message: input.message,
    changedObjectType: "work_item",
    changedObjectId: input.taskId,
    nextDestinationHref: `/contracts/${input.contractId}?tab=tasks`,
    auditEventId: input.auditEventId,
    diagnosticId: input.outcome === "audit_write_failed" ? "v10_task_audit_missing" : null,
  });
}

type V10WorkMutationOptions = {
  idempotencyKey: string | null;
  expectedVersion?: string | number | null;
  clientRequestId?: string | null;
};

function buildWorkMutationError(input: {
  outcome: "unauthorized" | "forbidden" | "not_found" | "validation_failed" | "server_error";
  message: string;
  diagnosticId: string;
  changedObjectId?: string | null;
}) {
  return {
    error: input.message,
    v10: buildV10MutationResponse({
      outcome: input.outcome,
      message: input.message,
      changedObjectType: "work_item",
      changedObjectId: input.changedObjectId ?? null,
      nextDestinationHref: "/work",
      diagnosticId: input.diagnosticId,
    }),
  };
}

async function importTaskAutomation() {
  return await import("@/actions/tasks-automation");
}

async function getMembershipForContract(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  contractId: string
): Promise<{ ok: true; ctx: MembershipCtx } | { ok: false; error: string; status: number }> {
  return await getContractAccessContext(admin, userId, contractId);
}

async function ensureAssigneeMember(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orgId: string,
  assigneeId: string | null
): Promise<boolean> {
  if (!assigneeId) return true;
  const { data } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", assigneeId)
    .maybeSingle();
  return !!data;
}

async function appendTaskEvent(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: {
    organizationId: string;
    contractId: string;
    taskId: string;
    actorId: string;
    eventType: "created" | "status_changed" | "reassigned" | "deleted" | "clarification_requested";
    details?: Record<string, unknown>;
  }
) {
  const { error } = await admin.from("contract_task_events").insert({
    organization_id: input.organizationId,
    contract_id: input.contractId,
    task_id: input.taskId,
    actor_id: input.actorId,
    event_type: input.eventType,
    details: input.details ?? {},
  });
  if (error) console.error("[tasks] appendTaskEvent", error.message);
}

export async function autoTransitionTasksForApproval(
  input: Parameters<(typeof import("@/actions/tasks-automation"))["autoTransitionTasksForApproval"]>[0]
) {
  const { autoTransitionTasksForApproval } = await importTaskAutomation();
  return await autoTransitionTasksForApproval(input);
}

export async function autoTransitionTasksForField(
  input: Parameters<(typeof import("@/actions/tasks-automation"))["autoTransitionTasksForField"]>[0]
) {
  const { autoTransitionTasksForField } = await importTaskAutomation();
  return await autoTransitionTasksForField(input);
}

export async function createContractTask(input: {
  contractId: string;
  title: string;
  details?: string | null;
  assigneeId?: string | null;
  dueDate?: string | null;
  priority?: ContractTaskPriority;
  teamKey?: string | null;
  linkedFieldId?: string | null;
  linkedReminderId?: string | null;
  linkedObligationId?: string | null;
  linkedCheckpointId?: string | null;
  createdVia?: "manual" | "rule" | "clarification" | "integration";
  dependsOnTaskIds?: string[];
  blockedByTaskId?: string | null;
  blockedReason?: string | null;
  recurrenceIntervalDays?: number | null;
  recurrenceAnchorDate?: string | null;
  slaDueAt?: string | null;
  checklistItems?: string[];
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
  const assigneeId = input.assigneeId?.trim() || null;
  const dueDate = input.dueDate?.trim() || null;
  const priority = input.priority ?? "medium";
  const teamKey = input.teamKey?.trim() || null;
  const createdVia = input.createdVia ?? "manual";
  const blockedByTaskId = input.blockedByTaskId?.trim() || null;
  const blockedReason = input.blockedReason?.trim() || null;
  const recurrenceIntervalDays =
    typeof input.recurrenceIntervalDays === "number" &&
    Number.isFinite(input.recurrenceIntervalDays) &&
    input.recurrenceIntervalDays > 0
      ? Math.min(Math.trunc(input.recurrenceIntervalDays), 3650)
      : null;
  const recurrenceAnchorDate = input.recurrenceAnchorDate?.trim() || null;
  const slaDueAt = input.slaDueAt?.trim() || null;
  const checklistItems = (input.checklistItems ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
  const dependsOnTaskIds = Array.from(
    new Set((input.dependsOnTaskIds ?? []).map((id) => id.trim()).filter(Boolean))
  );

  if (!title) return { error: "Task title is required" };
  if (title.length > MAX_TITLE_LEN) return { error: "Task title is too long" };
  if (details.length > MAX_DETAILS_LEN) return { error: "Task details are too long" };
  if (assigneeId && !isUuid(assigneeId)) return { error: "Invalid assignee" };
  if (dueDate && !isIsoDateOnly(dueDate)) {
    return { error: "Invalid due date" };
  }
  if (!isTaskPriority(priority)) return { error: "Invalid task priority" };
  if (teamKey && teamKey.length > MAX_TEAM_KEY_LEN) return { error: "Team key is too long" };
  if (blockedByTaskId && !isUuid(blockedByTaskId)) return { error: "Invalid blocked-by task" };
  if (blockedReason && blockedReason.length > MAX_BLOCKED_REASON_LEN) {
    return { error: "Blocked reason is too long" };
  }
  if (recurrenceAnchorDate && !isIsoDateOnly(recurrenceAnchorDate)) {
    return { error: "Invalid recurrence anchor date" };
  }
  if (slaDueAt && Number.isNaN(new Date(slaDueAt).getTime())) {
    return { error: "Invalid SLA due date" };
  }
  if (checklistItems.some((item) => item.length > MAX_CHECKLIST_ITEM_LEN)) {
    return { error: "Checklist item is too long" };
  }
  if (dependsOnTaskIds.some((id) => !isUuid(id))) return { error: "Invalid dependency task id" };
  if (
    createdVia !== "manual" &&
    createdVia !== "rule" &&
    createdVia !== "clarification" &&
    createdVia !== "integration"
  ) {
    return { error: "Invalid task source" };
  }

  const membership = await getMembershipForContract(admin, user.id, input.contractId);
  if (!membership.ok) return { error: membership.error };
  if (!canEditContracts(membership.ctx.role)) {
    return { error: "Viewers cannot create tasks." };
  }

  if (!(await ensureAssigneeMember(admin, membership.ctx.orgId, assigneeId))) {
    return { error: "Assignee must be a member of this organization." };
  }

  if (input.linkedFieldId && !isUuid(input.linkedFieldId)) return { error: "Invalid linked field" };
  if (input.linkedReminderId && !isUuid(input.linkedReminderId)) return { error: "Invalid linked reminder" };
  if (input.linkedObligationId && !isUuid(input.linkedObligationId)) return { error: "Invalid linked obligation" };
  if (input.linkedCheckpointId && !isUuid(input.linkedCheckpointId)) return { error: "Invalid linked checkpoint" };

  const { data: task, error } = await admin
    .from("contract_tasks")
    .insert({
      contract_id: input.contractId,
      organization_id: membership.ctx.orgId,
      created_by: user.id,
      assignee_id: assigneeId,
      title,
      details: details || null,
      status: "open",
      priority,
      created_via: createdVia,
      team_key: teamKey,
      linked_field_id: input.linkedFieldId ?? null,
      linked_reminder_id: input.linkedReminderId ?? null,
      linked_obligation_id: input.linkedObligationId ?? null,
      linked_checkpoint_id: input.linkedCheckpointId ?? null,
      blocked_by_task_id: blockedByTaskId,
      blocked_reason: blockedReason,
      recurrence_rule: recurrenceIntervalDays ? "interval_days" : null,
      recurrence_interval_days: recurrenceIntervalDays,
      recurrence_anchor_date: recurrenceAnchorDate ?? dueDate,
      next_run_date: recurrenceIntervalDays ? recurrenceAnchorDate ?? dueDate : null,
      sla_due_at: slaDueAt,
      due_date: dueDate,
    })
    .select("id")
    .single();

  if (error) return { error: mapDataSourceError(error.message) };

  if (dependsOnTaskIds.length > 0) {
    const { data: dependencyRows } = await admin
      .from("contract_tasks")
      .select("id")
      .in("id", dependsOnTaskIds)
      .eq("organization_id", membership.ctx.orgId);
    const validDependencyIds = new Set((dependencyRows ?? []).map((row) => row.id));
    const rows = dependsOnTaskIds
      .filter((id) => id !== task.id && validDependencyIds.has(id))
      .map((dependsOnTaskId) => ({
        organization_id: membership.ctx.orgId,
        contract_id: input.contractId,
        task_id: task.id,
        depends_on_task_id: dependsOnTaskId,
        created_by: user.id,
      }));
    if (rows.length > 0) {
      await admin.from("contract_task_dependencies").insert(rows);
    }
  }

  if (checklistItems.length > 0) {
    await admin.from("contract_task_checklist_items").insert(
      checklistItems.map((label, index) => ({
        organization_id: membership.ctx.orgId,
        contract_id: input.contractId,
        task_id: task.id,
        label,
        sort_order: index,
        created_by: user.id,
      }))
    );
  }

  await admin.from("audit_events").insert({
    organization_id: membership.ctx.orgId,
    contract_id: input.contractId,
    user_id: user.id,
    action: "task.created",
    details: { task_id: task.id, title, priority, due_date: dueDate },
  });
  const v10AuditEventId = await recordV10AuditEvent(admin, {
    organizationId: membership.ctx.orgId,
    actorUserId: user.id,
    action: "work_item.created",
    targetType: "contract",
    targetId: task.id,
    contractId: input.contractId,
    outcome: "success",
    safeMetadata: { type: "contract_task", priority, has_due_date: Boolean(dueDate), assigned: Boolean(assigneeId) },
  });
  await appendTaskEvent(admin, {
    organizationId: membership.ctx.orgId,
    contractId: input.contractId,
    taskId: task.id,
    actorId: user.id,
    eventType: createdVia === "clarification" ? "clarification_requested" : "created",
    details: { title, status: "open", priority },
  });
  await recomputeContractSignals(admin, input.contractId);
  await refreshV10TaskReadModels(admin, {
    organizationId: membership.ctx.orgId,
    contractId: input.contractId,
    reason: "task_create_mutation",
  });

  if (assigneeId === user.id) {
    await emitProductTelemetryIfFirstForOrgUser(admin, {
      organizationId: membership.ctx.orgId,
      userId: user.id,
      contractId: input.contractId,
      action: "product.v9.first_visible_work_item",
      details: { surface: "work", taskId: task.id },
    });
  }

  return {
    success: true as const,
    taskId: task.id,
    v10AuditEventId,
    v10: buildTaskMutationEnvelope({
      outcome: v10AuditEventId ? "success" : "audit_write_failed",
      message: v10AuditEventId ? "Task created." : "Task created, but audit confirmation is missing.",
      taskId: task.id,
      contractId: input.contractId,
      auditEventId: v10AuditEventId,
    }),
  };
}

export async function createClarificationTask(input: {
  contractId: string;
  fieldId?: string | null;
  obligationId?: string | null;
  checkpointId?: string | null;
  requesterNote: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  teamKey?: string | null;
}) {
  const title = "Clarification requested";
  const details = input.requesterNote.trim();
  if (!details) return { error: "Clarification note is required." };
  return createContractTask({
    contractId: input.contractId,
    title,
    details,
    assigneeId: input.assigneeId,
    dueDate: input.dueDate,
    priority: "medium",
    createdVia: "clarification",
    linkedFieldId: input.fieldId ?? null,
    linkedObligationId: input.obligationId ?? null,
    linkedCheckpointId: input.checkpointId ?? null,
    teamKey: input.teamKey ?? "ops",
  });
}

export async function createClarificationTaskForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const fieldId = String(formData.get("fieldId") ?? "").trim();
  const obligationId = String(formData.get("obligationId") ?? "").trim();
  const checkpointId = String(formData.get("checkpointId") ?? "").trim();
  const requesterNote = String(formData.get("requesterNote") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const teamKey = String(formData.get("teamKey") ?? "").trim();
  const res = await createClarificationTask({
    contractId,
    fieldId: fieldId || null,
    obligationId: obligationId || null,
    checkpointId: checkpointId || null,
    requesterNote,
    assigneeId: assigneeId || null,
    dueDate: dueDate || null,
    teamKey: teamKey || null,
  });
  if (res && "error" in res && res.error) {
    return { error: res.error };
  }
  return { success: true as const };
}

export async function createObligationClarificationTaskForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const obligationId = String(formData.get("obligationId") ?? "").trim();
  const requesterNote = String(formData.get("requesterNote") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const res = await createClarificationTask({
    contractId,
    obligationId: obligationId || null,
    requesterNote,
    assigneeId: assigneeId || null,
    dueDate: dueDate || null,
    teamKey: "obligations",
  });
  if (res && "error" in res && res.error) {
    return { error: res.error };
  }
  return { success: true as const };
}

export async function createCheckpointClarificationTaskForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const checkpointId = String(formData.get("checkpointId") ?? "").trim();
  const requesterNote = String(formData.get("requesterNote") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  return createCheckpointClarificationTask({
    contractId,
    checkpointId,
    requesterNote,
    assigneeId: assigneeId || null,
    dueDate: dueDate || null,
  });
}

export async function createCheckpointClarificationTask(input: {
  contractId: string;
  checkpointId: string;
  requesterNote: string;
  assigneeId?: string | null;
  dueDate?: string | null;
}) {
  const contractId = input.contractId.trim();
  const checkpointId = input.checkpointId.trim();
  if (!isUuid(contractId)) return { error: "Invalid contract" };
  if (!isUuid(checkpointId)) return { error: "Invalid checkpoint" };

  const res = await createClarificationTask({
    contractId,
    checkpointId,
    requesterNote: input.requesterNote,
    assigneeId: input.assigneeId?.trim() || null,
    dueDate: input.dueDate?.trim() || null,
    teamKey: "renewals",
  });
  if (res && "error" in res && res.error) {
    return { error: res.error };
  }
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/contracts/renewals");
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/work");
  return {
    success: true as const,
    taskId: "taskId" in res ? (res.taskId as string) : undefined,
  };
}

export async function createRuleGeneratedTask(input: {
  contractId: string;
  title: string;
  details?: string | null;
  assigneeId?: string | null;
  dueDate?: string | null;
  priority?: ContractTaskPriority;
  teamKey?: string | null;
}) {
  return createContractTask({
    ...input,
    createdVia: "rule",
  });
}

export async function assignWorkItemOwner(input: {
  taskId: string;
  ownerUserId: string;
  expectedCompatibleActionGroup?: string | null;
} & V10WorkMutationOptions) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return buildWorkMutationError({
      outcome: "unauthorized",
      message: "Not authenticated",
      diagnosticId: "v10_work_owner_unauthenticated",
    });
  }

  const taskId = input.taskId.trim();
  const ownerUserId = input.ownerUserId.trim();
  if (!isUuid(taskId) || !isUuid(ownerUserId)) {
    return buildWorkMutationError({
      outcome: "validation_failed",
      message: "A valid work item and owner are required.",
      diagnosticId: "v10_work_owner_invalid_input",
      changedObjectId: isUuid(taskId) ? taskId : null,
    });
  }

  const { data: task } = await admin
    .from("contract_tasks")
    .select("id, contract_id, organization_id, status, assignee_id, priority, updated_at")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) {
    return buildWorkMutationError({
      outcome: "not_found",
      message: "Work item not found.",
      diagnosticId: "v10_work_owner_task_not_found",
      changedObjectId: taskId,
    });
  }

  const role = await getOrgMemberRole(admin, user.id, task.organization_id);
  if (!role) {
    return buildWorkMutationError({
      outcome: "forbidden",
      message: "Access denied.",
      diagnosticId: "v10_work_owner_membership_missing",
      changedObjectId: taskId,
    });
  }

  const selfAssignAllowed = !task.assignee_id && ownerUserId === user.id;
  if (!canEditContracts(role) && !selfAssignAllowed) {
    return buildWorkMutationError({
      outcome: "forbidden",
      message: "You cannot assign this work item.",
      diagnosticId: "v10_work_owner_role_forbidden",
      changedObjectId: taskId,
    });
  }

  if (!(await ensureAssigneeMember(admin, task.organization_id, ownerUserId))) {
    return buildWorkMutationError({
      outcome: "validation_failed",
      message: "Owner must be an active member of this workspace.",
      diagnosticId: "v10_work_owner_not_member",
      changedObjectId: taskId,
    });
  }

  const compatibleActionGroup = getV10CompatibleActionGroup({
    id: task.id,
    type: "contract_task",
    status: task.status,
    ownerUserId: task.assignee_id,
    updatedAt: task.updated_at,
  });
  const expectedCompatibleActionGroup = input.expectedCompatibleActionGroup?.trim() || null;
  if (expectedCompatibleActionGroup && compatibleActionGroup !== expectedCompatibleActionGroup) {
    return {
      error: "This work item is no longer compatible with the selected bulk action.",
      v10: buildV10MutationResponse({
        outcome: "validation_failed",
        message: "This work item is no longer compatible with the selected action.",
        changedObjectType: "work_item",
        changedObjectId: taskId,
        currentVersion: task.updated_at,
        nextDestinationHref: "/work",
        diagnosticId: "v10_work_owner_incompatible_action_group",
        validationFailures: [
          {
            field: taskId,
            code: "incompatible_action_group",
            user_visible_message: "Refresh the Work queue and select compatible items again.",
            self_fixable: true,
          },
        ],
      }),
    };
  }

  const { response, replayed } = await executeV10IdempotentMutation(
    admin,
    {
      organizationId: task.organization_id,
      actorUserId: user.id,
      mutationName: "assign_work_item_owner",
      targetType: "work_item",
      targetId: taskId,
      idempotencyKey: input.idempotencyKey,
      clientRequestId: input.clientRequestId,
      expectedVersion: input.expectedVersion,
      currentVersion: task.updated_at,
      payload: { taskId, ownerUserId, expectedCompatibleActionGroup },
    },
    async () => {
      if (task.assignee_id === ownerUserId) {
        return buildV10MutationResponse({
          outcome: "no_action",
          message: "This work item is already assigned to that owner.",
          changedObjectType: "work_item",
          changedObjectId: taskId,
          currentVersion: task.updated_at,
          nextDestinationHref: "/work",
        });
      }

      const { error } = await admin
        .from("contract_tasks")
        .update({ assignee_id: ownerUserId })
        .eq("id", taskId)
        .eq("organization_id", task.organization_id);
      if (error) {
        return buildV10MutationResponse({
          outcome: "server_error",
          message: mapDataSourceError(error.message),
          changedObjectType: "work_item",
          changedObjectId: taskId,
          currentVersion: task.updated_at,
          nextDestinationHref: "/work",
          diagnosticId: "v10_work_owner_update_failed",
        });
      }

      const auditEventId = await recordV10AuditEvent(admin, {
        organizationId: task.organization_id,
        actorUserId: user.id,
        action: "work_item.owner_changed",
        targetType: "work_item",
        targetId: taskId,
        contractId: task.contract_id,
        outcome: "success",
        beforeStateHash: task.assignee_id ?? "unassigned",
        afterStateHash: ownerUserId,
        safeMetadata: {
          type: "contract_task",
          self_assign: selfAssignAllowed,
          prior_owner_assigned: Boolean(task.assignee_id),
        },
      });
      if (!auditEventId) {
        await admin
          .from("contract_tasks")
          .update({ assignee_id: task.assignee_id })
          .eq("id", taskId)
          .eq("organization_id", task.organization_id);
        return buildV10MutationResponse({
          outcome: "audit_write_failed",
          message: "Work item owner was not changed because audit evidence could not be recorded.",
          changedObjectType: "work_item",
          changedObjectId: taskId,
          currentVersion: task.updated_at,
          nextDestinationHref: "/work",
          diagnosticId: "v10_work_owner_audit_missing",
        });
      }

      await appendTaskEvent(admin, {
        organizationId: task.organization_id,
        contractId: task.contract_id,
        taskId,
        actorId: user.id,
        eventType: "reassigned",
        details: { assignee_id: ownerUserId, reason: "v10_work_owner_changed" },
      });
      await recomputeContractSignals(admin, task.contract_id);
      await refreshV10TaskReadModels(admin, {
        organizationId: task.organization_id,
        contractId: task.contract_id,
        reason: "task_owner_mutation",
      });
      return buildV10MutationResponse({
        outcome: "success",
        message: "Work item owner updated.",
        changedObjectType: "work_item",
        changedObjectId: taskId,
        currentVersion: task.updated_at,
        nextDestinationHref: "/work",
        auditEventId,
      });
    }
  );

  return {
    success: response.outcome === "success" || response.outcome === "no_action",
    replayed,
    taskId,
    ownerUserId,
    v10: response,
  };
}

export async function bulkAssignCompatibleContractTasks(input: {
  taskIds: string[];
  ownerUserId: string;
  expectedCompatibleActionGroup: string;
  idempotencyKey: string | null;
  expectedVersion?: string | number | null;
  clientRequestId?: string | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };
  const taskIds = [...new Set(input.taskIds.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_BULK_TASK_MUTATION_ITEMS);
  const ownerUserId = input.ownerUserId.trim();
  const expectedCompatibleActionGroup = input.expectedCompatibleActionGroup.trim();
  if (taskIds.length === 0 || taskIds.some((id) => !isUuid(id))) return { error: "Invalid tasks" };
  if (!isUuid(ownerUserId)) return { error: "Invalid owner" };
  if (!expectedCompatibleActionGroup) return { error: "Compatible action group is required" };

  const { data: tasks } = await admin
    .from("contract_tasks")
    .select("id, contract_id, organization_id, status, assignee_id, priority, updated_at")
    .in("id", taskIds);
  const taskRows = tasks ?? [];
  if (taskRows.length !== taskIds.length) return { error: "One or more tasks were not found." };
  const organizationIds = [...new Set(taskRows.map((task) => task.organization_id))];
  if (organizationIds.length !== 1) return { error: "Bulk work must belong to one organization." };
  const organizationId = organizationIds[0];
  const role = await getOrgMemberRole(admin, user.id, organizationId);
  if (!canEditContracts(role)) return { error: "Viewers cannot bulk-assign work." };
  if (!(await ensureAssigneeMember(admin, organizationId, ownerUserId))) {
    return { error: "Owner must be an active member of this workspace." };
  }

  const itemOutcomes = taskRows.map((task) => {
    const compatibleActionGroup = getV10CompatibleActionGroup({
      id: task.id,
      type: "contract_task",
      status: task.status,
      ownerUserId: task.assignee_id,
      updatedAt: task.updated_at,
    });
    const compatible = compatibleActionGroup === expectedCompatibleActionGroup;
    return {
      task,
      compatibleActionGroup,
      outcome: task.assignee_id === ownerUserId ? "no_action" as const : compatible ? "success" as const : "validation_failed" as const,
      reason: task.assignee_id === ownerUserId ? "already_assigned" : compatible ? "assigned" : "incompatible_action_group",
    };
  });
  const eligibleTaskIds = itemOutcomes
    .filter((item) => item.outcome === "success")
    .map((item) => item.task.id);

  const { response, replayed } = await executeV10IdempotentMutation(
    admin,
    {
      organizationId,
      actorUserId: user.id,
      mutationName: "bulk_assign_compatible_work_items",
      targetType: "work_item",
      targetId: `bulk:${taskIds.length}`,
      idempotencyKey: input.idempotencyKey,
      clientRequestId: input.clientRequestId,
      expectedVersion: input.expectedVersion,
      currentVersion: `bulk:${taskRows.map((task) => task.updated_at).sort().join("|")}`,
      payload: { taskIds, ownerUserId, expectedCompatibleActionGroup },
    },
    async () => {
      if (eligibleTaskIds.length > 0) {
        const { error } = await admin
          .from("contract_tasks")
          .update({ assignee_id: ownerUserId })
          .in("id", eligibleTaskIds)
          .eq("organization_id", organizationId);
        if (error) {
          return buildV10MutationResponse({
            outcome: "server_error",
            message: mapDataSourceError(error.message),
            diagnosticId: "v10_bulk_task_assign_failed",
            nextDestinationHref: "/work",
          });
        }
      }

      const auditEventId = await recordV10AuditEvent(admin, {
        organizationId,
        actorUserId: user.id,
        action: "work_item.bulk_owner_changed",
        targetType: "work_item",
        targetId: `bulk:${taskIds.length}`,
        outcome: eligibleTaskIds.length === taskIds.length ? "success" : eligibleTaskIds.length > 0 ? "dependency_blocked" : "validation_failed",
        safeMetadata: {
          requested_count: taskIds.length,
          assigned_count: eligibleTaskIds.length,
          compatible_group_match_count: itemOutcomes.filter((item) => item.compatibleActionGroup === expectedCompatibleActionGroup).length,
          already_assigned_count: itemOutcomes.filter((item) => item.reason === "already_assigned").length,
        },
      });
      if (!auditEventId && eligibleTaskIds.length > 0) {
        for (const item of itemOutcomes.filter((row) => row.outcome === "success")) {
          await admin
            .from("contract_tasks")
            .update({ assignee_id: item.task.assignee_id })
            .eq("id", item.task.id)
            .eq("organization_id", organizationId);
        }
        return buildV10MutationResponse({
          outcome: "audit_write_failed",
          message: "Bulk work assignment was rolled back because audit evidence could not be recorded.",
          changedObjectType: "work_item",
          changedObjectId: `bulk:${taskIds.length}`,
          nextDestinationHref: "/work",
          diagnosticId: "v10_bulk_task_assign_audit_missing",
        });
      }

      if (eligibleTaskIds.length > 0) {
        await admin.from("contract_task_events").insert(
          itemOutcomes
            .filter((item) => item.outcome === "success")
            .map((item) => ({
              organization_id: organizationId,
              contract_id: item.task.contract_id,
              task_id: item.task.id,
              actor_id: user.id,
              event_type: "reassigned",
              details: { assignee_id: ownerUserId, reason: "v10_bulk_work_owner_changed" },
            }))
        );
        for (const contractId of [...new Set(taskRows.map((task) => task.contract_id).filter(Boolean))]) {
          await recomputeContractSignals(admin, contractId);
        }
        await refreshV10TaskReadModels(admin, {
          organizationId,
          reason: "bulk_task_owner_mutation",
        });
      }

      return buildV10MutationResponse({
        outcome: eligibleTaskIds.length === taskIds.length ? "success" : eligibleTaskIds.length > 0 ? "dependency_blocked" : "validation_failed",
        message:
          eligibleTaskIds.length === taskIds.length
            ? "Bulk-compatible work assigned."
            : eligibleTaskIds.length > 0
              ? "Some compatible work was assigned; review item outcomes for blocked rows."
              : "No compatible work could be assigned.",
        changedObjectType: "work_item",
        changedObjectId: `bulk:${taskIds.length}`,
        nextDestinationHref: "/work",
        auditEventId,
        diagnosticId: auditEventId ? null : "v10_bulk_task_assign_audit_missing",
        validationFailures: itemOutcomes
          .filter((item) => item.outcome === "validation_failed")
          .map((item) => ({
            field: item.task.id,
            code: item.reason,
            user_visible_message: "This task is not eligible for the selected bulk assignment.",
            self_fixable: item.reason === "incompatible_action_group",
          })),
        bulkItemOutcomes: itemOutcomes.map((item) => ({
          target_id: item.task.id,
          outcome: item.outcome,
          reason: item.reason,
          compatible_action_group: item.compatibleActionGroup,
        })),
      });
    }
  );

  const resolvedAssignOutcomes = resolveReplayedBulkTaskItemOutcomes(replayed, response, itemOutcomes);

  return {
    success: response.outcome === "success" || response.outcome === "dependency_blocked",
    replayed,
    assignedTaskIds: eligibleTaskIds,
    itemOutcomes: resolvedAssignOutcomes.map(({ task, compatibleActionGroup, outcome, reason }) => ({
      taskId: task.id,
      compatibleActionGroup,
      outcome,
      reason,
    })),
    v10: response,
  };
}

export async function completeWorkItem(input: {
  taskId: string;
  completionNote?: string | null;
} & V10WorkMutationOptions) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return buildWorkMutationError({
      outcome: "unauthorized",
      message: "Not authenticated",
      diagnosticId: "v10_work_complete_unauthenticated",
    });
  }

  const taskId = input.taskId.trim();
  if (!isUuid(taskId)) {
    return buildWorkMutationError({
      outcome: "validation_failed",
      message: "A valid work item is required.",
      diagnosticId: "v10_work_complete_invalid_task",
      changedObjectId: null,
    });
  }

  const completionNote = input.completionNote?.trim() ?? "";
  if (completionNote.length > MAX_TASK_COMMENT_LEN) {
    return buildWorkMutationError({
      outcome: "validation_failed",
      message: "Completion note is too long.",
      diagnosticId: "v10_work_complete_note_too_long",
      changedObjectId: taskId,
    });
  }

  const { data: task } = await admin
    .from("contract_tasks")
    .select("id, contract_id, organization_id, status, assignee_id, recurrence_interval_days, recurrence_anchor_date, title, details, priority, team_key, updated_at")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) {
    return buildWorkMutationError({
      outcome: "not_found",
      message: "Work item not found.",
      diagnosticId: "v10_work_complete_task_not_found",
      changedObjectId: taskId,
    });
  }

  const role = await getOrgMemberRole(admin, user.id, task.organization_id);
  if (!role) {
    return buildWorkMutationError({
      outcome: "forbidden",
      message: "Access denied.",
      diagnosticId: "v10_work_complete_membership_missing",
      changedObjectId: taskId,
    });
  }
  const assignedOwnerAllowed = task.assignee_id === user.id;
  if (!assignedOwnerAllowed && !canEditContracts(role)) {
    return buildWorkMutationError({
      outcome: "forbidden",
      message: "Only the assigned owner or workspace editors can complete this work item.",
      diagnosticId: "v10_work_complete_role_forbidden",
      changedObjectId: taskId,
    });
  }

  const currentStatus = task.status as ContractTaskStatus;
  if (currentStatus === "done") {
    return {
      success: true as const,
      replayed: false,
      taskId,
      v10: buildV10MutationResponse({
        outcome: "no_action",
        message: "This work item is already complete.",
        changedObjectType: "work_item",
        changedObjectId: taskId,
        currentVersion: task.updated_at,
        nextDestinationHref: "/work",
      }),
    };
  }
  if (!VALID_TASK_TRANSITIONS[currentStatus]?.includes("done")) {
    return {
      error: "This work item cannot be completed from its current state.",
      v10: buildV10MutationResponse({
        outcome: "validation_failed",
        message: "This work item cannot be completed from its current state.",
        changedObjectType: "work_item",
        changedObjectId: taskId,
        currentVersion: task.updated_at,
        nextDestinationHref: "/work",
        diagnosticId: "v10_work_complete_transition_invalid",
        validationFailures: [
          {
            field: "status",
            code: "transition_not_allowed",
            user_visible_message: "Resolve blockers or reopen the item before completing it.",
            self_fixable: true,
          },
        ],
      }),
    };
  }

  const { response, replayed } = await executeV10IdempotentMutation(
    admin,
    {
      organizationId: task.organization_id,
      actorUserId: user.id,
      mutationName: "complete_work_item",
      targetType: "work_item",
      targetId: taskId,
      idempotencyKey: input.idempotencyKey,
      clientRequestId: input.clientRequestId,
      expectedVersion: input.expectedVersion,
      currentVersion: task.updated_at,
      payload: { taskId, completionNote },
    },
    async () => {
      const completedAt = new Date().toISOString();
      const { error } = await admin
        .from("contract_tasks")
        .update({
          status: "done",
          completed_at: completedAt,
          blocked_reason: null,
          last_auto_transition_at: completedAt,
        })
        .eq("id", taskId)
        .eq("organization_id", task.organization_id);
      if (error) {
        return buildV10MutationResponse({
          outcome: "server_error",
          message: mapDataSourceError(error.message),
          changedObjectType: "work_item",
          changedObjectId: taskId,
          currentVersion: task.updated_at,
          nextDestinationHref: "/work",
          diagnosticId: "v10_work_complete_update_failed",
        });
      }

      const auditEventId = await recordV10AuditEvent(admin, {
        organizationId: task.organization_id,
        actorUserId: user.id,
        action: "work_item.completed",
        targetType: "work_item",
        targetId: taskId,
        contractId: task.contract_id,
        outcome: "success",
        beforeStateHash: currentStatus,
        afterStateHash: "done",
        safeMetadata: {
          type: "contract_task",
          note_provided: completionNote.length > 0,
        },
      });
      if (!auditEventId) {
        await admin
          .from("contract_tasks")
          .update({
            status: currentStatus,
            completed_at: null,
            last_auto_transition_at: null,
          })
          .eq("id", taskId)
          .eq("organization_id", task.organization_id);
        return buildV10MutationResponse({
          outcome: "audit_write_failed",
          message: "Work item was not completed because audit evidence could not be recorded.",
          changedObjectType: "work_item",
          changedObjectId: taskId,
          currentVersion: task.updated_at,
          nextDestinationHref: "/work",
          diagnosticId: "v10_work_complete_audit_missing",
        });
      }

      await appendTaskEvent(admin, {
        organizationId: task.organization_id,
        contractId: task.contract_id,
        taskId,
        actorId: user.id,
        eventType: "status_changed",
        details: { status: "done", note_provided: completionNote.length > 0 },
      });
      await recomputeContractSignals(admin, task.contract_id);
      await refreshV10TaskReadModels(admin, {
        organizationId: task.organization_id,
        contractId: task.contract_id,
        reason: "task_completion_mutation",
      });
      await emitProductTelemetryEvent(admin, {
        organizationId: task.organization_id,
        userId: user.id,
        contractId: task.contract_id,
        action: "product.v10.work_item_completed",
        details: {
          source_type: "contract_task",
          completion_state: "done",
          note_provided: completionNote.length > 0,
        },
      });
      return buildV10MutationResponse({
        outcome: "success",
        message: "Work item completed.",
        changedObjectType: "work_item",
        changedObjectId: taskId,
        currentVersion: task.updated_at,
        nextDestinationHref: "/work",
        auditEventId,
      });
    }
  );

  return {
    success: response.outcome === "success" || response.outcome === "no_action",
    replayed,
    taskId,
    v10: response,
  };
}

export async function updateContractTaskStatus(
  taskId: string,
  status: ContractTaskStatus
) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };
  if (!isUuid(taskId)) return { error: "Invalid task" };
  if (!isTaskStatus(status)) return { error: "Invalid status" };

  const { data: task } = await admin
    .from("contract_tasks")
    .select("id, contract_id, organization_id, status, recurrence_interval_days, recurrence_anchor_date, title, details, priority, team_key, assignee_id")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) return { error: "Task not found" };
  const role = await getOrgMemberRole(admin, user.id, task.organization_id);
  if (!role) return { error: "Access denied" };
  if (!canEditContracts(role)) return { error: "Viewers cannot update task status." };

  const currentStatus = task.status as ContractTaskStatus;
  if (!VALID_TASK_TRANSITIONS[currentStatus]?.includes(status)) {
    return { error: `Cannot transition from "${currentStatus}" to "${status}".` };
  }

  await emitWorkActionTelemetry(
    admin,
    {
      organizationId: task.organization_id,
      userId: user.id,
      contractId: task.contract_id,
    },
    "task",
    "update_status",
    "attempted"
  );

  const completedAt = status === "done" ? new Date().toISOString() : null;
  const { error } = await admin
    .from("contract_tasks")
    .update({
      status,
      completed_at: completedAt,
      blocked_reason: status === "blocked" ? "Blocked by workflow dependency" : null,
      last_auto_transition_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    await emitWorkActionTelemetry(
      admin,
      {
        organizationId: task.organization_id,
        userId: user.id,
        contractId: task.contract_id,
      },
      "task",
      "update_status",
      "failed"
    );
    await emitVisibleMutationErrorTelemetry(admin, {
      organizationId: task.organization_id,
      userId: user.id,
      contractId: task.contract_id,
      surface: "work",
      mutation: "updateContractTaskStatus",
      code: mapDataSourceError(error.message),
    });
    return { error: mapDataSourceError(error.message) };
  }

  await admin.from("audit_events").insert({
    organization_id: task.organization_id,
    contract_id: task.contract_id,
    user_id: user.id,
    action: "task.status_updated",
    details: { task_id: taskId, status },
  });
  const v10AuditEventId = await recordV10AuditEvent(admin, {
    organizationId: task.organization_id,
    actorUserId: user.id,
    action: status === "done" ? "work_item.completed" : "work_item.status_changed",
    targetType: "work_item",
    targetId: taskId,
    contractId: task.contract_id,
    outcome: "success",
    beforeStateHash: currentStatus,
    afterStateHash: status,
    safeMetadata: { type: "contract_task", status },
  });
  await appendTaskEvent(admin, {
    organizationId: task.organization_id,
    contractId: task.contract_id,
    taskId,
    actorId: user.id,
    eventType: "status_changed",
    details: { status },
  });

  let reopenedDependencyCount = 0;
  let generatedRecurringTask = false;

  if (status === "done") {
    const { data: dependentLinks } = await admin
      .from("contract_task_dependencies")
      .select("task_id")
      .eq("depends_on_task_id", taskId)
      .eq("organization_id", task.organization_id);
    const dependentTaskIds = [...new Set((dependentLinks ?? []).map((row) => row.task_id))];
    if (dependentTaskIds.length > 0) {
      for (const dependentTaskId of dependentTaskIds) {
        const { data: dependencyRows } = await admin
          .from("contract_task_dependencies")
          .select("depends_on_task_id")
          .eq("task_id", dependentTaskId)
          .eq("organization_id", task.organization_id);
        const dependsOnIds = [...new Set((dependencyRows ?? []).map((row) => row.depends_on_task_id))];
        if (dependsOnIds.length === 0) continue;
        const { data: unresolved } = await admin
          .from("contract_tasks")
          .select("id")
          .in("id", dependsOnIds)
          .neq("status", "done")
          .limit(1);
        if ((unresolved?.length ?? 0) === 0) {
          const { data: reopenedRows } = await admin
            .from("contract_tasks")
            .update({
              status: "open",
              blocked_reason: null,
              blocked_by_task_id: null,
              last_auto_transition_at: new Date().toISOString(),
            })
            .eq("id", dependentTaskId)
            .eq("status", "blocked")
            .select("id");
          reopenedDependencyCount += reopenedRows?.length ?? 0;
          await appendTaskEvent(admin, {
            organizationId: task.organization_id,
            contractId: task.contract_id,
            taskId: dependentTaskId,
            actorId: user.id,
            eventType: "status_changed",
            details: { status: "open", reason: "dependencies_resolved" },
          });
        }
      }
    }
    if (
      typeof task.recurrence_interval_days === "number" &&
      task.recurrence_interval_days > 0
    ) {
      const anchor = task.recurrence_anchor_date ?? new Date().toISOString().slice(0, 10);
      if (isIsoDateOnly(anchor)) {
        const anchorTs = new Date(`${anchor}T12:00:00`).getTime();
        const nextTs = anchorTs + task.recurrence_interval_days * 24 * 60 * 60 * 1000;
        if (Number.isFinite(nextTs)) {
          const nextDate = new Date(nextTs).toISOString().slice(0, 10);
          const { data: nextTask, error: recurrenceError } = await admin
            .from("contract_tasks")
            .insert({
              contract_id: task.contract_id,
              organization_id: task.organization_id,
              created_by: user.id,
              assignee_id: task.assignee_id,
              title: task.title,
              details: task.details,
              status: "open",
              priority: task.priority,
              team_key: task.team_key,
              created_via: "rule",
              due_date: nextDate,
              recurrence_rule: "interval_days",
              recurrence_interval_days: task.recurrence_interval_days,
              recurrence_anchor_date: nextDate,
              next_run_date: nextDate,
            })
            .select("id")
            .single();
          if (!recurrenceError && nextTask?.id) {
            generatedRecurringTask = true;
            await appendTaskEvent(admin, {
              organizationId: task.organization_id,
              contractId: task.contract_id,
              taskId: nextTask.id,
              actorId: user.id,
              eventType: "created",
              details: { created_via: "rule", reason: "recurrence_generated" },
            });
          }
        }
      }
    }
  }
  await recomputeContractSignals(admin, task.contract_id);
  await refreshV10TaskReadModels(admin, {
    organizationId: task.organization_id,
    contractId: task.contract_id,
    reason: "task_status_mutation",
  });

  await emitWorkActionTelemetry(
    admin,
    {
      organizationId: task.organization_id,
      userId: user.id,
      contractId: task.contract_id,
    },
    "task",
    "update_status",
    "succeeded"
  );
  if (task.assignee_id === user.id) {
    await emitProductTelemetryIfFirstForOrgUser(admin, {
      organizationId: task.organization_id,
      userId: user.id,
      contractId: task.contract_id,
      action: "product.v9.first_visible_work_item",
      details: { surface: "work", taskId },
    });
  }

  return {
    success: true as const,
    reopenedDependencyCount,
    generatedRecurringTask,
    v10AuditEventId,
    v10: buildTaskMutationEnvelope({
      outcome: v10AuditEventId ? "success" : "audit_write_failed",
      message: v10AuditEventId ? "Task status updated." : "Task status updated, but audit confirmation is missing.",
      taskId,
      contractId: task.contract_id,
      auditEventId: v10AuditEventId,
    }),
  };
}

export async function bulkCompleteCompatibleContractTasks(input: {
  taskIds: string[];
  expectedCompatibleActionGroup: string;
  idempotencyKey: string | null;
  expectedVersion?: string | number | null;
  clientRequestId?: string | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };
  const taskIds = [...new Set(input.taskIds.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_BULK_TASK_MUTATION_ITEMS);
  if (taskIds.length === 0 || taskIds.some((id) => !isUuid(id))) return { error: "Invalid tasks" };
  if (!input.expectedCompatibleActionGroup.trim()) return { error: "Compatible action group is required" };

  const { data: tasks } = await admin
    .from("contract_tasks")
    .select("id, contract_id, organization_id, status, assignee_id, priority, updated_at")
    .in("id", taskIds);
  const taskRows = tasks ?? [];
  if (taskRows.length !== taskIds.length) return { error: "One or more tasks were not found." };
  const organizationIds = [...new Set(taskRows.map((task) => task.organization_id))];
  if (organizationIds.length !== 1) return { error: "Bulk work must belong to one organization." };
  const organizationId = organizationIds[0];
  const role = await getOrgMemberRole(admin, user.id, organizationId);
  if (!canEditContracts(role)) return { error: "Viewers cannot bulk-complete work." };

  const itemOutcomes = taskRows.map((task) => {
    const compatibleActionGroup = getV10CompatibleActionGroup({
      id: task.id,
      type: "contract_task",
      status: task.status,
      ownerUserId: task.assignee_id,
      updatedAt: task.updated_at,
    });
    const transitionAllowed = VALID_TASK_TRANSITIONS[task.status as ContractTaskStatus]?.includes("done") ?? false;
    const compatible = compatibleActionGroup === input.expectedCompatibleActionGroup;
    const outcome: "success" | "no_action" | "validation_failed" =
      task.status === "done" ? "no_action" : compatible && transitionAllowed ? "success" : "validation_failed";
    return {
      task,
      compatibleActionGroup,
      outcome,
      reason: task.status === "done" ? "already_done" : compatible ? "transition_not_allowed" : "incompatible_action_group",
    };
  });
  const eligibleTaskIds = itemOutcomes
    .filter((item) => item.outcome === "success")
    .map((item) => item.task.id);

  const { response, replayed } = await executeV10IdempotentMutation(
    admin,
    {
      organizationId,
      actorUserId: user.id,
      mutationName: "bulkCompleteCompatibleContractTasks",
      targetType: "work_item",
      targetId: `bulk:${taskIds.length}`,
      idempotencyKey: input.idempotencyKey,
      clientRequestId: input.clientRequestId,
      expectedVersion: input.expectedVersion,
      currentVersion: `bulk:${taskRows.map((task) => task.updated_at).sort().join("|")}`,
      payload: { taskIds, expectedCompatibleActionGroup: input.expectedCompatibleActionGroup },
    },
    async () => {
      if (eligibleTaskIds.length > 0) {
        const { error } = await admin
          .from("contract_tasks")
          .update({
            status: "done",
            completed_at: new Date().toISOString(),
            last_auto_transition_at: new Date().toISOString(),
          })
          .in("id", eligibleTaskIds)
          .eq("organization_id", organizationId);
        if (error) {
          return buildV10MutationResponse({
            outcome: "server_error",
            message: mapDataSourceError(error.message),
            diagnosticId: "v10_bulk_task_update_failed",
            nextDestinationHref: "/work",
          });
        }
      }
      const auditEventId = await recordV10AuditEvent(admin, {
        organizationId,
        actorUserId: user.id,
        action: "work_item.bulk_completed",
        targetType: "work_item",
        targetId: `bulk:${taskIds.length}`,
        outcome: eligibleTaskIds.length === taskIds.length ? "success" : eligibleTaskIds.length > 0 ? "dependency_blocked" : "validation_failed",
        safeMetadata: {
          requested_count: taskIds.length,
          completed_count: eligibleTaskIds.length,
          compatible_group_match_count: itemOutcomes.filter((item) => item.compatibleActionGroup === input.expectedCompatibleActionGroup).length,
        },
      });
      for (const contractId of [...new Set(taskRows.map((task) => task.contract_id).filter(Boolean))]) {
        await recomputeContractSignals(admin, contractId);
      }
      await refreshV10TaskReadModels(admin, {
        organizationId,
        reason: "bulk_task_completion_mutation",
      });
      return buildV10MutationResponse({
        outcome: eligibleTaskIds.length === taskIds.length ? "success" : eligibleTaskIds.length > 0 ? "dependency_blocked" : "validation_failed",
        message:
          eligibleTaskIds.length === taskIds.length
            ? "Bulk-compatible work completed."
            : eligibleTaskIds.length > 0
              ? "Some compatible work was completed; review item outcomes for blocked rows."
              : "No compatible work could be completed.",
        changedObjectType: "work_item",
        changedObjectId: `bulk:${taskIds.length}`,
        nextDestinationHref: "/work",
        auditEventId,
        diagnosticId: auditEventId ? null : "v10_bulk_task_audit_missing",
        validationFailures: itemOutcomes
          .filter((item) => item.outcome === "validation_failed")
          .map((item) => ({
            field: item.task.id,
            code: item.reason,
            user_visible_message: "This task is not eligible for the selected bulk action.",
            self_fixable: item.reason === "incompatible_action_group",
          })),
        bulkItemOutcomes: itemOutcomes.map((item) => ({
          target_id: item.task.id,
          outcome: item.outcome,
          reason: item.reason,
          compatible_action_group: item.compatibleActionGroup,
        })),
      });
    }
  );

  const resolvedCompleteOutcomes = resolveReplayedBulkTaskItemOutcomes(replayed, response, itemOutcomes);

  return {
    success: response.outcome === "success" || response.outcome === "dependency_blocked",
    replayed,
    completedTaskIds: eligibleTaskIds,
    itemOutcomes: resolvedCompleteOutcomes.map(({ task, compatibleActionGroup, outcome, reason }) => ({
      taskId: task.id,
      compatibleActionGroup,
      outcome,
      reason,
    })),
    v10: response,
  };
}

export async function addContractTaskComment(input: {
  taskId: string;
  body: string;
  parentCommentId?: string | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.taskId)) return { error: "Invalid task" };
  const body = input.body.trim();
  if (!body) return { error: "Comment is required" };
  if (body.length > MAX_TASK_COMMENT_LEN) return { error: "Comment is too long" };
  const parentCommentId = input.parentCommentId?.trim() || null;
  if (parentCommentId && !isUuid(parentCommentId)) return { error: "Invalid parent comment" };

  const { data: task } = await admin
    .from("contract_tasks")
    .select("id, contract_id, organization_id")
    .eq("id", input.taskId)
    .maybeSingle();
  if (!task) return { error: "Task not found" };
  const role = await getOrgMemberRole(admin, user.id, task.organization_id);
  if (!role) return { error: "Access denied" };
  if (!canEditContracts(role)) return { error: "Viewers cannot add task comments." };

  if (parentCommentId) {
    const { data: parentComment } = await admin
      .from("contract_task_comments")
      .select("id, task_id")
      .eq("id", parentCommentId)
      .maybeSingle();
    if (!parentComment) return { error: "Parent comment not found" };
    if (parentComment.task_id !== task.id) return { error: "Parent comment does not belong to this task." };
  }

  const { error } = await admin.from("contract_task_comments").insert({
    organization_id: task.organization_id,
    contract_id: task.contract_id,
    task_id: task.id,
    author_id: user.id,
    body,
    parent_comment_id: parentCommentId,
  });
  if (error) return { error: mapDataSourceError(error.message) };
  await appendTaskEvent(admin, {
    organizationId: task.organization_id,
    contractId: task.contract_id,
    taskId: task.id,
    actorId: user.id,
    eventType: "status_changed",
    details: { reason: "comment_added" },
  });
  return { success: true as const };
}

export async function updateContractTaskComment(input: {
  commentId: string;
  body: string;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.commentId)) return { error: "Invalid comment" };
  const body = input.body.trim();
  if (!body) return { error: "Comment is required" };
  if (body.length > MAX_TASK_COMMENT_LEN) return { error: "Comment is too long" };
  const { data: comment } = await admin
    .from("contract_task_comments")
    .select("id, organization_id, contract_id, task_id, author_id")
    .eq("id", input.commentId)
    .maybeSingle();
  if (!comment) return { error: "Comment not found" };
  const role = await getOrgMemberRole(admin, user.id, comment.organization_id);
  if (!role) return { error: "Access denied" };
  const canEdit = canEditContracts(role) || comment.author_id === user.id;
  if (!canEdit) return { error: "Only editors or the author can edit this comment." };
  const { error } = await admin
    .from("contract_task_comments")
    .update({ body, edited_at: new Date().toISOString(), deleted_at: null })
    .eq("id", comment.id);
  if (error) return { error: mapDataSourceError(error.message) };
  await appendTaskEvent(admin, {
    organizationId: comment.organization_id,
    contractId: comment.contract_id,
    taskId: comment.task_id,
    actorId: user.id,
    eventType: "status_changed",
    details: { reason: "comment_updated", comment_id: comment.id },
  });
  return { success: true as const };
}

export async function deleteContractTaskComment(input: { commentId: string }) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.commentId)) return { error: "Invalid comment" };
  const { data: comment } = await admin
    .from("contract_task_comments")
    .select("id, organization_id, contract_id, task_id, author_id")
    .eq("id", input.commentId)
    .maybeSingle();
  if (!comment) return { error: "Comment not found" };
  const role = await getOrgMemberRole(admin, user.id, comment.organization_id);
  if (!role) return { error: "Access denied" };
  const canDelete = canEditContracts(role) || comment.author_id === user.id;
  if (!canDelete) return { error: "Only editors or the author can delete this comment." };
  const { error } = await admin
    .from("contract_task_comments")
    .update({ deleted_at: new Date().toISOString(), body: "[deleted]" })
    .eq("id", comment.id);
  if (error) return { error: mapDataSourceError(error.message) };
  await appendTaskEvent(admin, {
    organizationId: comment.organization_id,
    contractId: comment.contract_id,
    taskId: comment.task_id,
    actorId: user.id,
    eventType: "status_changed",
    details: { reason: "comment_deleted", comment_id: comment.id },
  });
  return { success: true as const };
}

export async function addContractTaskChecklistItem(input: {
  taskId: string;
  label: string;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.taskId)) return { error: "Invalid task" };
  const label = input.label.trim();
  if (!label) return { error: "Checklist item label is required" };
  if (label.length > MAX_CHECKLIST_ITEM_LEN) return { error: "Checklist item is too long" };

  const { data: task } = await admin
    .from("contract_tasks")
    .select("id, contract_id, organization_id")
    .eq("id", input.taskId)
    .maybeSingle();
  if (!task) return { error: "Task not found" };
  const role = await getOrgMemberRole(admin, user.id, task.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot edit checklist items." };

  const { data: existing } = await admin
    .from("contract_task_checklist_items")
    .select("id")
    .eq("task_id", task.id);
  const sortOrder = existing?.length ?? 0;
  const { error } = await admin.from("contract_task_checklist_items").insert({
    organization_id: task.organization_id,
    contract_id: task.contract_id,
    task_id: task.id,
    label,
    sort_order: sortOrder,
    created_by: user.id,
  });
  if (error) return { error: mapDataSourceError(error.message) };
  await appendTaskEvent(admin, {
    organizationId: task.organization_id,
    contractId: task.contract_id,
    taskId: task.id,
    actorId: user.id,
    eventType: "status_changed",
    details: { reason: "checklist_item_added", label },
  });
  return { success: true as const };
}

export async function addContractTaskDependency(input: {
  taskId: string;
  dependsOnTaskId: string;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.taskId) || !isUuid(input.dependsOnTaskId)) {
    return { error: "Invalid task dependency request" };
  }
  if (input.taskId === input.dependsOnTaskId) {
    return { error: "A task cannot depend on itself." };
  }
  const { data: task } = await admin
    .from("contract_tasks")
    .select("id, contract_id, organization_id")
    .eq("id", input.taskId)
    .maybeSingle();
  const { data: dependencyTask } = await admin
    .from("contract_tasks")
    .select("id, contract_id, organization_id, status")
    .eq("id", input.dependsOnTaskId)
    .maybeSingle();
  if (!task || !dependencyTask) return { error: "Task not found" };
  if (task.organization_id !== dependencyTask.organization_id) {
    return { error: "Tasks must belong to the same organization." };
  }
  if (task.contract_id !== dependencyTask.contract_id) {
    return { error: "Tasks must belong to the same contract." };
  }
  const role = await getOrgMemberRole(admin, user.id, task.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot edit task dependencies." };

  const { error } = await admin.from("contract_task_dependencies").upsert(
    {
      organization_id: task.organization_id,
      contract_id: task.contract_id,
      task_id: task.id,
      depends_on_task_id: dependencyTask.id,
      created_by: user.id,
    },
    { onConflict: "task_id,depends_on_task_id", ignoreDuplicates: false }
  );
  if (error) return { error: mapDataSourceError(error.message) };

  await admin
    .from("contract_tasks")
    .update({
      status: dependencyTask.status === "done" ? "open" : "blocked",
      blocked_by_task_id: dependencyTask.status === "done" ? null : dependencyTask.id,
      blocked_reason:
        dependencyTask.status === "done"
          ? null
          : `Waiting on task ${dependencyTask.id.slice(0, 8)}`,
      last_auto_transition_at: new Date().toISOString(),
    })
    .eq("id", task.id);

  await appendTaskEvent(admin, {
    organizationId: task.organization_id,
    contractId: task.contract_id,
    taskId: task.id,
    actorId: user.id,
    eventType: "status_changed",
    details: { reason: "dependency_added", depends_on_task_id: dependencyTask.id },
  });

  return { success: true as const };
}

export async function toggleContractTaskChecklistItem(input: {
  checklistItemId: string;
  done: boolean;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.checklistItemId)) return { error: "Invalid checklist item" };
  const { data: item } = await admin
    .from("contract_task_checklist_items")
    .select("id, organization_id, contract_id, task_id")
    .eq("id", input.checklistItemId)
    .maybeSingle();
  if (!item) return { error: "Checklist item not found" };
  const role = await getOrgMemberRole(admin, user.id, item.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot update checklist items." };
  const { error } = await admin
    .from("contract_task_checklist_items")
    .update({
      is_done: input.done,
      completed_at: input.done ? new Date().toISOString() : null,
    })
    .eq("id", item.id);
  if (error) return { error: mapDataSourceError(error.message) };
  await appendTaskEvent(admin, {
    organizationId: item.organization_id,
    contractId: item.contract_id,
    taskId: item.task_id,
    actorId: user.id,
    eventType: "status_changed",
    details: { reason: "checklist_updated", is_done: input.done },
  });
  return { success: true as const };
}

export async function updateContractTaskChecklistItem(input: {
  checklistItemId: string;
  label: string;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.checklistItemId)) return { error: "Invalid checklist item" };
  const label = input.label.trim();
  if (!label) return { error: "Checklist label is required" };
  if (label.length > MAX_CHECKLIST_ITEM_LEN) return { error: "Checklist item is too long" };
  const { data: item } = await admin
    .from("contract_task_checklist_items")
    .select("id, organization_id, contract_id, task_id")
    .eq("id", input.checklistItemId)
    .maybeSingle();
  if (!item) return { error: "Checklist item not found" };
  const role = await getOrgMemberRole(admin, user.id, item.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot edit checklist items." };
  const { error } = await admin
    .from("contract_task_checklist_items")
    .update({ label })
    .eq("id", item.id);
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true as const };
}

export async function deleteContractTaskChecklistItem(input: { checklistItemId: string }) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.checklistItemId)) return { error: "Invalid checklist item" };
  const { data: item } = await admin
    .from("contract_task_checklist_items")
    .select("id, organization_id")
    .eq("id", input.checklistItemId)
    .maybeSingle();
  if (!item) return { error: "Checklist item not found" };
  const role = await getOrgMemberRole(admin, user.id, item.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot edit checklist items." };
  const { error } = await admin.from("contract_task_checklist_items").delete().eq("id", item.id);
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true as const };
}

export async function reorderContractTaskChecklistItem(input: {
  checklistItemId: string;
  direction: "up" | "down";
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.checklistItemId)) return { error: "Invalid checklist item" };
  const { data: item } = await admin
    .from("contract_task_checklist_items")
    .select("id, organization_id, task_id, sort_order")
    .eq("id", input.checklistItemId)
    .maybeSingle();
  if (!item) return { error: "Checklist item not found" };
  const role = await getOrgMemberRole(admin, user.id, item.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot edit checklist items." };
  const { data: siblings } = await admin
    .from("contract_task_checklist_items")
    .select("id, sort_order")
    .eq("task_id", item.task_id)
    .order("sort_order", { ascending: true });
  const ordered = (siblings ?? []).sort((a, b) => a.sort_order - b.sort_order);
  const idx = ordered.findIndex((row) => row.id === item.id);
  if (idx < 0) return { error: "Checklist item not found" };
  const targetIdx = input.direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= ordered.length) return { success: true as const };
  const target = ordered[targetIdx];
  await admin
    .from("contract_task_checklist_items")
    .update({ sort_order: target.sort_order })
    .eq("id", item.id);
  await admin
    .from("contract_task_checklist_items")
    .update({ sort_order: item.sort_order })
    .eq("id", target.id);
  return { success: true as const };
}

export async function addContractTaskArtifact(input: {
  taskId: string;
  label: string;
  url: string;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.taskId)) return { error: "Invalid task" };
  const label = input.label.trim();
  const url = input.url.trim();
  if (!label || !url) return { error: "Artifact label and URL are required" };
  if (label.length > MAX_ARTIFACT_LABEL_LEN) return { error: "Artifact label is too long" };
  if (url.length > MAX_ARTIFACT_URL_LEN) return { error: "Artifact URL is too long" };
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return { error: "Invalid artifact URL" };
  } catch {
    return { error: "Invalid artifact URL" };
  }
  const { data: task } = await admin
    .from("contract_tasks")
    .select("id, contract_id, organization_id")
    .eq("id", input.taskId)
    .maybeSingle();
  if (!task) return { error: "Task not found" };
  const role = await getOrgMemberRole(admin, user.id, task.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot add task artifacts." };
  const { error } = await admin.from("contract_task_artifacts").insert({
    organization_id: task.organization_id,
    contract_id: task.contract_id,
    task_id: task.id,
    label,
    url,
    added_by: user.id,
  });
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true as const };
}

export async function deleteContractTaskArtifact(input: { artifactId: string }) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.artifactId)) return { error: "Invalid artifact" };
  const { data: artifact } = await admin
    .from("contract_task_artifacts")
    .select("id, organization_id")
    .eq("id", input.artifactId)
    .maybeSingle();
  if (!artifact) return { error: "Artifact not found" };
  const role = await getOrgMemberRole(admin, user.id, artifact.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot delete task artifacts." };
  const { error } = await admin.from("contract_task_artifacts").delete().eq("id", artifact.id);
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true as const };
}

export async function deleteContractTask(taskId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };
  if (!isUuid(taskId)) return { error: "Invalid task" };

  const { data: task } = await admin
    .from("contract_tasks")
    .select("id, contract_id, organization_id, assignee_id")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) return { error: "Task not found" };
  const role = await getOrgMemberRole(admin, user.id, task.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot delete tasks." };

  const { error } = await admin.from("contract_tasks").delete().eq("id", taskId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: task.organization_id,
    contract_id: task.contract_id,
    user_id: user.id,
    action: "task.deleted",
    details: { task_id: taskId },
  });
  await appendTaskEvent(admin, {
    organizationId: task.organization_id,
    contractId: task.contract_id,
    taskId,
    actorId: user.id,
    eventType: "deleted",
    details: { assignee_id: task.assignee_id },
  });
  await recomputeContractSignals(admin, task.contract_id);

  return { success: true as const };
}
