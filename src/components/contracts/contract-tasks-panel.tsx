"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addContractTaskArtifact,
  addContractTaskChecklistItem,
  addContractTaskComment,
  addContractTaskDependency,
  createContractTask,
  deleteContractTask,
  deleteContractTaskArtifact,
  deleteContractTaskChecklistItem,
  deleteContractTaskComment,
  reorderContractTaskChecklistItem,
  toggleContractTaskChecklistItem,
  updateContractTaskChecklistItem,
  updateContractTaskComment,
  updateContractTaskStatus,
} from "@/actions/tasks";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import type { ContractTaskPriority, ContractTaskStatus } from "@/lib/types";
import { ContractTaskCard } from "./contract-task-card";
import { ContractTaskCreateForm } from "./contract-task-create-form";
import type {
  ContractTaskMutationHandlers,
  ContractTasksPanelProps,
} from "./contract-tasks-panel-types";

export function ContractTasksPanel({
  contractId,
  tasks,
  members,
  canEdit,
  taskEvents,
  taskChecklistItems,
  taskComments,
  taskDependencies,
  taskArtifacts,
  executionGraphEdges,
}: ContractTasksPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const memberById = useMemo(
    () => new Map(members.map((member) => [member.userId, member.label])),
    [members]
  );
  const taskTitleById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task.title])),
    [tasks]
  );
  const commentsByTaskId = useMemo(() => {
    const map = new Map<string, typeof taskComments>();
    for (const comment of taskComments) {
      const list = map.get(comment.task_id) ?? [];
      list.push(comment);
      map.set(comment.task_id, list);
    }
    return map;
  }, [taskComments]);

  function runTaskMutation(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      const mutationError = recoverableMutationError(result);
      if (mutationError) {
        setError(describeRecoverableMutationError(mutationError));
        return;
      }
      router.refresh();
    });
  }

  function onCreate(formData: FormData) {
    if (!canEdit || isPending) return;
    runTaskMutation(() => createContractTask({ contractId, ...taskPayloadFromFormData(formData) }));
  }

  function onStatusChange(taskId: string, status: ContractTaskStatus) {
    if (isPending) return;
    runTaskMutation(() => updateContractTaskStatus(taskId, status));
  }

  function onDelete(taskId: string) {
    if (isPending || !canEdit) return;
    runTaskMutation(() => deleteContractTask(taskId));
  }

  function onAddChecklistItem(taskId: string, formData: FormData) {
    if (!canEdit || isPending) return;
    const label = String(formData.get("label") ?? "").trim();
    if (!label) return;
    runTaskMutation(() => addContractTaskChecklistItem({ taskId, label }));
  }

  function onToggleChecklistItem(checklistItemId: string, done: boolean) {
    if (!canEdit || isPending) return;
    runTaskMutation(() => toggleContractTaskChecklistItem({ checklistItemId, done }));
  }

  function onAddComment(taskId: string, formData: FormData) {
    if (isPending) return;
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    const parentCommentId = String(formData.get("parentCommentId") ?? "").trim() || null;
    runTaskMutation(() => addContractTaskComment({ taskId, body, parentCommentId }));
  }

  function onUpdateComment(commentId: string, formData: FormData) {
    if (isPending) return;
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    runTaskMutation(() => updateContractTaskComment({ commentId, body }));
  }

  function onDeleteComment(commentId: string) {
    if (isPending) return;
    runTaskMutation(() => deleteContractTaskComment({ commentId }));
  }

  function onAddDependency(taskId: string, formData: FormData) {
    if (!canEdit || isPending) return;
    const dependsOnTaskId = String(formData.get("dependsOnTaskId") ?? "").trim();
    if (!dependsOnTaskId) return;
    runTaskMutation(() => addContractTaskDependency({ taskId, dependsOnTaskId }));
  }

  function onUpdateChecklistItem(checklistItemId: string, formData: FormData) {
    if (!canEdit || isPending) return;
    const label = String(formData.get("label") ?? "").trim();
    if (!label) return;
    runTaskMutation(() => updateContractTaskChecklistItem({ checklistItemId, label }));
  }

  function onDeleteChecklistItem(checklistItemId: string) {
    if (!canEdit || isPending) return;
    runTaskMutation(() => deleteContractTaskChecklistItem({ checklistItemId }));
  }

  function onMoveChecklistItem(checklistItemId: string, direction: "up" | "down") {
    if (!canEdit || isPending) return;
    runTaskMutation(() => reorderContractTaskChecklistItem({ checklistItemId, direction }));
  }

  function onAddArtifact(taskId: string, formData: FormData) {
    if (!canEdit || isPending) return;
    const label = String(formData.get("label") ?? "").trim();
    const url = String(formData.get("url") ?? "").trim();
    if (!label || !url) return;
    runTaskMutation(() => addContractTaskArtifact({ taskId, label, url }));
  }

  function onDeleteArtifact(artifactId: string) {
    if (!canEdit || isPending) return;
    runTaskMutation(() => deleteContractTaskArtifact({ artifactId }));
  }

  const handlers: ContractTaskMutationHandlers = {
    onStatusChange,
    onDelete,
    onAddChecklistItem,
    onToggleChecklistItem,
    onUpdateChecklistItem,
    onDeleteChecklistItem,
    onMoveChecklistItem,
    onAddComment,
    onUpdateComment,
    onDeleteComment,
    onAddDependency,
    onAddArtifact,
    onDeleteArtifact,
  };

  return (
    <div className="space-y-5">
      {canEdit ? <ContractTaskCreateForm members={members} isPending={isPending} onCreate={onCreate} /> : null}
      {error ? (
        <p className="ui-alert-error text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {tasks.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">
          No tasks yet. Add one to track ownership, follow-up, and renewal prep work.
        </p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <ContractTaskCard
              key={task.id}
              task={task}
              tasks={tasks}
              memberById={memberById}
              taskTitleById={taskTitleById}
              comments={commentsByTaskId.get(task.id) ?? []}
              taskEvents={taskEvents}
              taskChecklistItems={taskChecklistItems}
              taskDependencies={taskDependencies}
              taskArtifacts={taskArtifacts}
              executionGraphEdges={executionGraphEdges}
              canEdit={canEdit}
              isPending={isPending}
              handlers={handlers}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function taskPayloadFromFormData(formData: FormData) {
  const recurrenceIntervalDays = Number(
    String(formData.get("recurrenceIntervalDays") ?? "").trim() || "0"
  );

  return {
    title: String(formData.get("title") ?? "").trim(),
    details: String(formData.get("details") ?? "").trim(),
    priority: String(formData.get("priority") ?? "medium") as ContractTaskPriority,
    assigneeId: String(formData.get("assigneeId") ?? "").trim() || null,
    dueDate: String(formData.get("dueDate") ?? "").trim() || null,
    teamKey: String(formData.get("teamKey") ?? "").trim() || null,
    blockedReason: String(formData.get("blockedReason") ?? "").trim() || null,
    recurrenceIntervalDays:
      Number.isFinite(recurrenceIntervalDays) && recurrenceIntervalDays > 0
        ? recurrenceIntervalDays
        : null,
    slaDueAt: String(formData.get("slaDueAt") ?? "").trim() || null,
  };
}

function recoverableMutationError(result: unknown): string | null {
  if (!result || typeof result !== "object" || !("error" in result)) return null;
  const error = (result as { error?: unknown }).error;
  return error ? String(error) : null;
}
