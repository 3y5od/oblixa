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

  if (!title) return { error: "Task title is required" };
  if (title.length > MAX_TITLE_LEN) return { error: "Task title is too long" };
  if (details.length > MAX_DETAILS_LEN) return { error: "Task details are too long" };
  if (assigneeId && !isUuid(assigneeId)) return { error: "Invalid assignee" };
  if (dueDate && Number.isNaN(new Date(`${dueDate}T12:00:00`).getTime())) {
    return { error: "Invalid due date" };
  }
  if (!isTaskPriority(priority)) return { error: "Invalid task priority" };
  if (teamKey && teamKey.length > MAX_TEAM_KEY_LEN) return { error: "Team key is too long" };
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
      due_date: dueDate,
    })
    .select("id")
    .single();

  if (error) return { error: mapDataSourceError(error.message) };

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
    .select("id, contract_id, organization_id")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) return { error: "Task not found" };
  const role = await getOrgMemberRole(admin, user.id, task.organization_id);
  if (!role) return { error: "Access denied" };

  const completedAt = status === "done" ? new Date().toISOString() : null;
  const { error } = await admin
    .from("contract_tasks")
    .update({ status, completed_at: completedAt })
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
  await recomputeContractSignals(admin, task.contract_id);

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
