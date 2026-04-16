import { createAdminClient } from "@/lib/supabase/server";

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
