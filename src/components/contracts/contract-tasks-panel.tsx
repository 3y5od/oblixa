"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { ExternalLink } from "@/components/ui/external-link";
import {
  addContractTaskChecklistItem,
  addContractTaskArtifact,
  addContractTaskComment,
  addContractTaskDependency,
  createContractTask,
  deleteContractTaskArtifact,
  deleteContractTaskChecklistItem,
  deleteContractTaskComment,
  deleteContractTask,
  reorderContractTaskChecklistItem,
  toggleContractTaskChecklistItem,
  updateContractTaskChecklistItem,
  updateContractTaskComment,
  updateContractTaskStatus,
} from "@/actions/tasks";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import type { ContractTask, ContractTaskPriority, ContractTaskStatus } from "@/lib/types";
import { graphLinksForEntity, type ExecutionGraphEdgeRow } from "@/lib/v4/graph-edge-labels";

type MemberOption = {
  userId: string;
  label: string;
};

type ContractTaskListItem = Pick<
  ContractTask,
  | "id"
  | "title"
  | "details"
  | "status"
  | "priority"
  | "due_date"
  | "assignee_id"
  | "completed_at"
  | "created_via"
  | "team_key"
  | "blocked_reason"
  | "recurrence_interval_days"
  | "sla_due_at"
>;

const STATUS_OPTIONS: { value: ContractTaskStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS: { value: ContractTaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function priorityBadge(priority: ContractTaskPriority): string {
  if (priority === "high") return "border-[color:color-mix(in_oklab,var(--danger)_38%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-[var(--danger)]";
  if (priority === "low") return "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] text-[var(--text-secondary)]";
  return "border-[color:color-mix(in_oklab,var(--warning)_42%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning)_12%,var(--surface))] text-[var(--warning-ink)]";
}

function statusBadge(status: ContractTaskStatus): string {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "blocked") return "border-[color:color-mix(in_oklab,var(--danger)_38%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-[var(--danger)]";
  if (status === "in_progress") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] text-[var(--text-secondary)]";
}

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
}: {
  contractId: string;
  tasks: ContractTaskListItem[];
  members: MemberOption[];
  canEdit: boolean;
  executionGraphEdges?: ExecutionGraphEdgeRow[];
  taskEvents: Array<{
    id: string;
    task_id: string;
    event_type: string;
    details: Record<string, unknown> | null;
    created_at: string;
  }>;
  taskChecklistItems: Array<{
    id: string;
    task_id: string;
    label: string;
    is_done: boolean;
    sort_order: number;
  }>;
  taskComments: Array<{
    id: string;
    task_id: string;
    body: string;
    parent_comment_id: string | null;
    edited_at: string | null;
    deleted_at: string | null;
    created_at: string;
  }>;
  taskDependencies: Array<{
    id: string;
    task_id: string;
    depends_on_task_id: string;
  }>;
  taskArtifacts: Array<{
    id: string;
    task_id: string;
    label: string;
    url: string;
    created_at: string;
  }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const memberById = useMemo(
    () => new Map(members.map((m) => [m.userId, m.label])),
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

  function onCreate(formData: FormData) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const title = String(formData.get("title") ?? "").trim();
      const details = String(formData.get("details") ?? "").trim();
      const priority = String(formData.get("priority") ?? "medium") as ContractTaskPriority;
      const assigneeId = String(formData.get("assigneeId") ?? "").trim() || null;
      const dueDate = String(formData.get("dueDate") ?? "").trim() || null;
      const teamKey = String(formData.get("teamKey") ?? "").trim() || null;
      const blockedReason = String(formData.get("blockedReason") ?? "").trim() || null;
      const recurrenceIntervalDays = Number(
        String(formData.get("recurrenceIntervalDays") ?? "").trim() || "0"
      );
      const slaDueAt = String(formData.get("slaDueAt") ?? "").trim() || null;

      const res = await createContractTask({
        contractId,
        title,
        details,
        priority,
        assigneeId,
        dueDate,
        teamKey,
        blockedReason,
        recurrenceIntervalDays:
          Number.isFinite(recurrenceIntervalDays) && recurrenceIntervalDays > 0
            ? recurrenceIntervalDays
            : null,
        slaDueAt,
      });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onStatusChange(taskId: string, status: ContractTaskStatus) {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await updateContractTaskStatus(taskId, status);
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onDelete(taskId: string) {
    if (isPending || !canEdit) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteContractTask(taskId);
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onAddChecklistItem(taskId: string, formData: FormData) {
    if (!canEdit || isPending) return;
    const label = String(formData.get("label") ?? "").trim();
    if (!label) return;
    setError(null);
    startTransition(async () => {
      const res = await addContractTaskChecklistItem({ taskId, label });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onToggleChecklistItem(checklistItemId: string, done: boolean) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await toggleContractTaskChecklistItem({ checklistItemId, done });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onAddComment(taskId: string, formData: FormData) {
    if (isPending) return;
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const parentCommentId = String(formData.get("parentCommentId") ?? "").trim() || null;
      const res = await addContractTaskComment({ taskId, body, parentCommentId });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onUpdateComment(commentId: string, formData: FormData) {
    if (isPending) return;
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const res = await updateContractTaskComment({ commentId, body });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onDeleteComment(commentId: string) {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteContractTaskComment({ commentId });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onAddDependency(taskId: string, formData: FormData) {
    if (!canEdit || isPending) return;
    const dependsOnTaskId = String(formData.get("dependsOnTaskId") ?? "").trim();
    if (!dependsOnTaskId) return;
    setError(null);
    startTransition(async () => {
      const res = await addContractTaskDependency({ taskId, dependsOnTaskId });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onUpdateChecklistItem(checklistItemId: string, formData: FormData) {
    if (!canEdit || isPending) return;
    const label = String(formData.get("label") ?? "").trim();
    if (!label) return;
    setError(null);
    startTransition(async () => {
      const res = await updateContractTaskChecklistItem({ checklistItemId, label });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onDeleteChecklistItem(checklistItemId: string) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteContractTaskChecklistItem({ checklistItemId });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onMoveChecklistItem(checklistItemId: string, direction: "up" | "down") {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await reorderContractTaskChecklistItem({ checklistItemId, direction });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onAddArtifact(taskId: string, formData: FormData) {
    if (!canEdit || isPending) return;
    const label = String(formData.get("label") ?? "").trim();
    const url = String(formData.get("url") ?? "").trim();
    if (!label || !url) return;
    setError(null);
    startTransition(async () => {
      const res = await addContractTaskArtifact({ taskId, label, url });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onDeleteArtifact(artifactId: string) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteContractTaskArtifact({ artifactId });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {canEdit && (
        <form action={onCreate} className="grid gap-3 rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-4">
          <div>
            <label className="ui-label-caps">Task title</label>
            <input
              name="title"
              required
              maxLength={240}
              placeholder="Follow up on renewal terms"
              className="ui-input w-full"
            />
          </div>
          <div>
            <label className="ui-label-caps">Details (optional)</label>
            <textarea
              name="details"
              rows={2}
              maxLength={4000}
              placeholder="Add context, expected outcome, and blockers."
              className="ui-input w-full resize-y"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="ui-label-caps">Priority</label>
              <select name="priority" defaultValue="medium" className="ui-input w-full">
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ui-label-caps">Assignee</label>
              <select name="assigneeId" defaultValue="" className="ui-input w-full">
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ui-label-caps">Due date</label>
              <input name="dueDate" type="date" className="ui-input w-full" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="ui-label-caps">Team queue</label>
              <input
                name="teamKey"
                maxLength={80}
                placeholder="ops / legal / finance"
                className="ui-input w-full"
              />
            </div>
            <div>
              <label className="ui-label-caps">Recurrence (days)</label>
              <input
                name="recurrenceIntervalDays"
                type="number"
                min={1}
                max={3650}
                placeholder="e.g. 30"
                className="ui-input w-full"
              />
            </div>
            <div>
              <label className="ui-label-caps">SLA due at</label>
              <input name="slaDueAt" type="datetime-local" className="ui-input w-full" />
            </div>
          </div>
          <div>
            <label className="ui-label-caps">Blocked reason (optional)</label>
            <input
              name="blockedReason"
              maxLength={400}
              placeholder="Waiting on dependency / external response"
              className="ui-input w-full"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-tertiary)]">Tasks attach execution work to this contract.</p>
            <button type="submit" disabled={isPending} className="ui-btn-primary px-4 py-2 text-[13px]">
              {isPending ? "Saving..." : "Add task"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="ui-alert-error text-sm" role="alert">
          {error}
        </p>
      )}

      {tasks.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">
          No tasks yet. Add one to track ownership, follow-up, and renewal prep work.
        </p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-xl border border-[var(--border-subtle)] bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{task.title}</p>
                  {task.details && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{task.details}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${priorityBadge(task.priority)}`}>
                      {task.priority}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${statusBadge(task.status)}`}>
                      {task.status.replace("_", " ")}
                    </span>
                    {task.assignee_id && (
                      <span className="text-[var(--text-tertiary)]">
                        Assigned to {memberById.get(task.assignee_id) ?? "Member"}
                      </span>
                    )}
                    {task.due_date && (
                      <span className="text-[var(--text-tertiary)]">
                        Due {format(new Date(`${task.due_date}T12:00:00`), "MMM d, yyyy")}
                      </span>
                    )}
                    {task.completed_at && (
                      <span className="text-emerald-700">
                        Completed {format(new Date(task.completed_at), "MMM d, yyyy")}
                      </span>
                    )}
                    {task.created_via && (
                      <span className="text-[var(--text-tertiary)]">
                        Source: {task.created_via}
                        {task.team_key ? ` · queue ${task.team_key}` : ""}
                      </span>
                    )}
                    {task.blocked_reason && task.status === "blocked" && (
                      <span className="font-medium text-[var(--danger)]">Blocked: {task.blocked_reason}</span>
                    )}
                    {task.recurrence_interval_days && task.recurrence_interval_days > 0 && (
                      <span className="text-[var(--text-tertiary)]">
                        Recurs every {task.recurrence_interval_days} day
                        {task.recurrence_interval_days === 1 ? "" : "s"}
                      </span>
                    )}
                    {task.sla_due_at && (
                      <span className="text-[var(--text-tertiary)]">
                        SLA {format(new Date(task.sla_due_at), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const { blockedBy, unblocks } = graphLinksForEntity(
                      executionGraphEdges,
                      "task",
                      task.id
                    );
                    if (blockedBy.length === 0 && unblocks.length === 0) return null;
                    return (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {blockedBy.map((label) => (
                          <span
                            key={`b-${task.id}-${label}`}
                            className="rounded border border-[color:color-mix(in_oklab,var(--warning)_42%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning)_12%,var(--surface))] px-2 py-0.5 text-[10px] text-[var(--warning-ink)]"
                          >
                            Blocked by {label}
                          </span>
                        ))}
                        {unblocks.map((label) => (
                          <span
                            key={`u-${task.id}-${label}`}
                            className="rounded border border-sky-200 bg-sky-50/80 px-2 py-0.5 text-[10px] text-sky-900"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                {taskEvents.filter((e) => e.task_id === task.id).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {taskEvents
                      .filter((e) => e.task_id === task.id)
                      .slice(0, 3)
                      .map((event) => (
                        <li key={event.id} className="text-[11px] text-[var(--text-tertiary)]">
                          {event.event_type.replace(/_/g, " ")} ·{" "}
                          {format(new Date(event.created_at), "MMM d, h:mm a")}
                          {(event.details?.reason as string | undefined)
                            ? ` · ${String(event.details?.reason)}`
                            : ""}
                        </li>
                      ))}
                  </ul>
                )}
                {taskDependencies.some((dep) => dep.task_id === task.id) && (
                  <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                    Depends on:{" "}
                    {taskDependencies
                      .filter((dep) => dep.task_id === task.id)
                      .map((dep) => taskTitleById.get(dep.depends_on_task_id) ?? dep.depends_on_task_id.slice(0, 8))
                      .join(", ")}
                  </div>
                )}
                <div className="mt-3 space-y-2 rounded-lg border border-[var(--border-subtle)]/70 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                    Checklist
                  </p>
                  <ul className="space-y-1">
                    {taskChecklistItems
                      .filter((item) => item.task_id === task.id)
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((item) => (
                        <li key={item.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={item.is_done}
                            disabled={isPending || !canEdit}
                            onChange={(e) => onToggleChecklistItem(item.id, e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-[var(--border-strong)]"
                          />
                          <span className={item.is_done ? "text-[var(--text-tertiary)] line-through" : "text-[var(--text-secondary)]"}>
                            {item.label}
                          </span>
                          {canEdit && (
                            <>
                              <form action={onUpdateChecklistItem.bind(null, item.id)} className="ml-auto flex items-center gap-1">
                                <input
                                  name="label"
                                  defaultValue={item.label}
                                  className="ui-input h-6 w-40 text-[11px]"
                                />
                                <button type="submit" className="ui-btn-secondary px-1.5 py-0.5 text-[10px]">
                                  Save
                                </button>
                              </form>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => onMoveChecklistItem(item.id, "up")}
                                className="ui-btn-secondary px-1.5 py-0.5 text-[10px]"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => onMoveChecklistItem(item.id, "down")}
                                className="ui-btn-secondary px-1.5 py-0.5 text-[10px]"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => onDeleteChecklistItem(item.id)}
                                className="ui-btn-secondary px-1.5 py-0.5 text-[10px]"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </li>
                      ))}
                  </ul>
                  {canEdit && (
                    <form action={onAddChecklistItem.bind(null, task.id)} className="flex items-center gap-2">
                      <input
                        name="label"
                        placeholder="Add checklist item"
                        className="ui-input h-7 flex-1 text-[11px]"
                      />
                      <button type="submit" className="ui-btn-secondary px-2 py-1 text-[11px]">
                        Add
                      </button>
                    </form>
                  )}
                </div>
                <div className="mt-2 space-y-2 rounded-lg border border-[var(--border-subtle)]/70 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                    Comments
                  </p>
                  <ul className="space-y-1">
                    {(commentsByTaskId.get(task.id) ?? [])
                      .slice()
                      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .slice(0, 8)
                      .map((comment) => (
                        <li
                          key={comment.id}
                          className={`text-xs text-[var(--text-secondary)] ${
                            comment.parent_comment_id ? "ml-4 border-l border-[var(--border-subtle)] pl-2" : ""
                          }`}
                        >
                          <p>{comment.body}</p>
                          {comment.edited_at && <p className="text-[10px] text-[var(--text-tertiary)]">edited</p>}
                          <div className="mt-1 flex items-center gap-1">
                            <form action={onUpdateComment.bind(null, comment.id)} className="flex items-center gap-1">
                              <input
                                name="body"
                                defaultValue={comment.deleted_at ? "" : comment.body}
                                placeholder="Edit comment"
                                className="ui-input h-6 w-44 text-[10px]"
                              />
                              <button type="submit" className="ui-btn-secondary px-1.5 py-0.5 text-[10px]">
                                Save
                              </button>
                            </form>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => onDeleteComment(comment.id)}
                              className="ui-btn-secondary px-1.5 py-0.5 text-[10px]"
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                  </ul>
                  <form action={onAddComment.bind(null, task.id)} className="flex items-center gap-2">
                    <input
                      name="body"
                      placeholder="Add comment"
                      className="ui-input h-7 flex-1 text-[11px]"
                    />
                    <select name="parentCommentId" defaultValue="" className="ui-input h-7 w-40 text-[11px]">
                      <option value="">Top-level</option>
                      {(commentsByTaskId.get(task.id) ?? [])
                        .filter((comment) => !comment.parent_comment_id)
                        .map((comment) => (
                          <option key={comment.id} value={comment.id}>
                            Reply to {comment.body.slice(0, 20)}
                          </option>
                        ))}
                    </select>
                    <button type="submit" className="ui-btn-secondary px-2 py-1 text-[11px]">
                      Add
                    </button>
                  </form>
                </div>
                <div className="mt-2 space-y-2 rounded-lg border border-[var(--border-subtle)]/70 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                    Artifacts
                  </p>
                  <ul className="space-y-1">
                    {taskArtifacts
                      .filter((artifact) => artifact.task_id === task.id)
                      .map((artifact) => (
                        <li key={artifact.id} className="flex items-center justify-between gap-2 text-xs">
                          <ExternalLink
                            href={artifact.url}
                            className="truncate text-blue-700 hover:underline"
                          >
                            {artifact.label}
                          </ExternalLink>
                          {canEdit && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => onDeleteArtifact(artifact.id)}
                              className="ui-btn-secondary px-1.5 py-0.5 text-[10px]"
                            >
                              Remove
                            </button>
                          )}
                        </li>
                      ))}
                  </ul>
                  {canEdit && (
                    <form action={onAddArtifact.bind(null, task.id)} className="grid gap-1 sm:grid-cols-3">
                      <input name="label" placeholder="Artifact label" className="ui-input h-7 text-[11px]" />
                      <input name="url" placeholder="https://..." className="ui-input h-7 text-[11px] sm:col-span-2" />
                      <button type="submit" className="ui-btn-secondary px-2 py-1 text-[11px] sm:col-span-3">
                        Add artifact
                      </button>
                    </form>
                  )}
                </div>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <form action={onAddDependency.bind(null, task.id)} className="flex items-center gap-1">
                      <select
                        name="dependsOnTaskId"
                        defaultValue=""
                        className="ui-input min-w-[8rem] py-1.5 text-xs"
                      >
                        <option value="">Add dependency...</option>
                        {tasks
                          .filter((candidate) => candidate.id !== task.id)
                          .map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.title}
                            </option>
                          ))}
                      </select>
                      <button type="submit" className="ui-btn-secondary px-2 py-1.5 text-xs">
                        Link
                      </button>
                    </form>
                  )}
                  <select
                    value={task.status}
                    disabled={isPending}
                    onChange={(e) => onStatusChange(task.id, e.target.value as ContractTaskStatus)}
                    className="ui-input min-w-[8.5rem] py-1.5 text-xs"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onDelete(task.id)}
                      disabled={isPending}
                      className="ui-btn-secondary px-3 py-1.5 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
