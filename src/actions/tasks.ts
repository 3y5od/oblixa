"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isUuid } from "@/lib/security/validation";
import type {
  ContractTaskPriority,
  ContractTaskStatus,
  OrgRole,
} from "@/lib/types";
import { recomputeContractSignals } from "@/lib/workflow-signals";

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

function isTaskStatus(v: string): v is ContractTaskStatus {
  return TASK_STATUSES.includes(v as ContractTaskStatus);
}

function isTaskPriority(v: string): v is ContractTaskPriority {
  return TASK_PRIORITIES.includes(v as ContractTaskPriority);
}

type MembershipCtx = {
  userId: string;
  orgId: string;
  role: OrgRole | null;
};

async function getMembershipForContract(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  contractId: string
): Promise<{ ok: true; ctx: MembershipCtx } | { ok: false; error: string; status: number }> {
  const { data: contract, error } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", contractId)
    .maybeSingle();

  if (error) return { ok: false, error: mapDataSourceError(error.message), status: 500 };
  if (!contract) return { ok: false, error: "Contract not found", status: 404 };

  const role = await getOrgMemberRole(admin, userId, contract.organization_id);
  if (!role) return { ok: false, error: "Access denied", status: 403 };

  return {
    ok: true,
    ctx: {
      userId,
      orgId: contract.organization_id,
      role,
    },
  };
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
  await admin.from("contract_task_events").insert({
    organization_id: input.organizationId,
    contract_id: input.contractId,
    task_id: input.taskId,
    actor_id: input.actorId,
    event_type: input.eventType,
    details: input.details ?? {},
  });
}

export async function autoTransitionTasksForApproval(input: {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  organizationId: string;
  contractId: string;
  actorId: string;
  approvalStatus: "pending" | "approved" | "rejected";
  approvalDueAt?: string | null;
}) {
  const { admin, organizationId, contractId, actorId, approvalStatus, approvalDueAt } = input;
  const { data: tasks } = await admin
    .from("contract_tasks")
    .select("id, status, title, details")
    .eq("organization_id", organizationId)
    .eq("contract_id", contractId)
    .in("status", ["open", "in_progress", "blocked"]);
  const approvalLinked = (tasks ?? []).filter((task) => {
    const text = `${task.title ?? ""} ${task.details ?? ""}`.toLowerCase();
    return text.includes("approval");
  });
  if (approvalLinked.length === 0) return;

  if (approvalStatus === "pending") {
    const dueDate =
      approvalDueAt && !Number.isNaN(new Date(approvalDueAt).getTime())
        ? new Date(approvalDueAt).toISOString().slice(0, 10)
        : null;
    for (const task of approvalLinked) {
      if (task.status === "blocked") continue;
      await admin
        .from("contract_tasks")
        .update({
          status: "blocked",
          blocked_reason: "Waiting on approval decision",
          due_date: dueDate ?? undefined,
          last_auto_transition_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      await appendTaskEvent(admin, {
        organizationId,
        contractId,
        taskId: task.id,
        actorId,
        eventType: "status_changed",
        details: { status: "blocked", reason: "approval_pending_sync" },
      });
    }
    return;
  }

  for (const task of approvalLinked) {
    if (task.status !== "blocked") continue;
    await admin
      .from("contract_tasks")
      .update({
        status: "open",
        blocked_reason: null,
        blocked_by_task_id: null,
        last_auto_transition_at: new Date().toISOString(),
      })
      .eq("id", task.id);
    await appendTaskEvent(admin, {
      organizationId,
      contractId,
      taskId: task.id,
      actorId,
      eventType: "status_changed",
      details: { status: "open", reason: `approval_${approvalStatus}_sync` },
    });
  }
}

export async function autoTransitionTasksForField(input: {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  organizationId: string;
  contractId: string;
  actorId: string;
  fieldId: string;
  fieldStatus: "approved" | "edited" | "rejected";
  fieldDateValue?: string | null;
}) {
  const { admin, organizationId, contractId, actorId, fieldId, fieldStatus, fieldDateValue } = input;
  const { data: tasks } = await admin
    .from("contract_tasks")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("contract_id", contractId)
    .eq("linked_field_id", fieldId)
    .in("status", ["open", "in_progress", "blocked"]);
  if (!tasks || tasks.length === 0) return;
  const dueDate =
    fieldDateValue && !Number.isNaN(new Date(`${fieldDateValue}T12:00:00`).getTime())
      ? fieldDateValue.slice(0, 10)
      : null;

  for (const task of tasks) {
    if (fieldStatus === "rejected") {
      if (task.status === "blocked") continue;
      await admin
        .from("contract_tasks")
        .update({
          status: "blocked",
          blocked_reason: "Blocked until linked field is approved",
          last_auto_transition_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      await appendTaskEvent(admin, {
        organizationId,
        contractId,
        taskId: task.id,
        actorId,
        eventType: "status_changed",
        details: { status: "blocked", reason: "linked_field_rejected_sync" },
      });
      continue;
    }

    await admin
      .from("contract_tasks")
      .update({
        status: task.status === "blocked" ? "open" : task.status,
        blocked_reason: task.status === "blocked" ? null : undefined,
        blocked_by_task_id: task.status === "blocked" ? null : undefined,
        due_date: dueDate ?? undefined,
        last_auto_transition_at: new Date().toISOString(),
      })
      .eq("id", task.id);
    await appendTaskEvent(admin, {
      organizationId,
      contractId,
      taskId: task.id,
      actorId,
      eventType: "status_changed",
      details: {
        status: task.status === "blocked" ? "open" : task.status,
        reason: "linked_field_sync",
        due_date: dueDate,
      },
    });
  }
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
  if (dueDate && Number.isNaN(new Date(`${dueDate}T12:00:00`).getTime())) {
    return { error: "Invalid due date" };
  }
  if (!isTaskPriority(priority)) return { error: "Invalid task priority" };
  if (teamKey && teamKey.length > MAX_TEAM_KEY_LEN) return { error: "Team key is too long" };
  if (blockedByTaskId && !isUuid(blockedByTaskId)) return { error: "Invalid blocked-by task" };
  if (blockedReason && blockedReason.length > MAX_BLOCKED_REASON_LEN) {
    return { error: "Blocked reason is too long" };
  }
  if (recurrenceAnchorDate && Number.isNaN(new Date(`${recurrenceAnchorDate}T12:00:00`).getTime())) {
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
  await appendTaskEvent(admin, {
    organizationId: membership.ctx.orgId,
    contractId: input.contractId,
    taskId: task.id,
    actorId: user.id,
    eventType: createdVia === "clarification" ? "clarification_requested" : "created",
    details: { title, status: "open", priority },
  });
  await recomputeContractSignals(admin, input.contractId);

  return { success: true as const, taskId: task.id };
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
    console.error("[tasks] createClarificationTaskForm", res.error);
  }
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
    console.error("[tasks] createObligationClarificationTaskForm", res.error);
  }
}

export async function createCheckpointClarificationTaskForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const checkpointId = String(formData.get("checkpointId") ?? "").trim();
  const requesterNote = String(formData.get("requesterNote") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const res = await createClarificationTask({
    contractId,
    checkpointId: checkpointId || null,
    requesterNote,
    assigneeId: assigneeId || null,
    dueDate: dueDate || null,
    teamKey: "renewals",
  });
  if (res && "error" in res && res.error) {
    console.error("[tasks] createCheckpointClarificationTaskForm", res.error);
  }
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
    .select("id, contract_id, organization_id, recurrence_interval_days, recurrence_anchor_date, title, details, priority, team_key, assignee_id")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) return { error: "Task not found" };
  const role = await getOrgMemberRole(admin, user.id, task.organization_id);
  if (!role) return { error: "Access denied" };

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

  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: task.organization_id,
    contract_id: task.contract_id,
    user_id: user.id,
    action: "task.status_updated",
    details: { task_id: taskId, status },
  });
  await appendTaskEvent(admin, {
    organizationId: task.organization_id,
    contractId: task.contract_id,
    taskId,
    actorId: user.id,
    eventType: "status_changed",
    details: { status },
  });

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
          await admin
            .from("contract_tasks")
            .update({
              status: "open",
              blocked_reason: null,
              blocked_by_task_id: null,
              last_auto_transition_at: new Date().toISOString(),
            })
            .eq("id", dependentTaskId)
            .eq("status", "blocked");
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
  await recomputeContractSignals(admin, task.contract_id);

  return { success: true as const };
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
