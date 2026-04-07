"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import {
  createContractTask,
  deleteContractTask,
  updateContractTaskStatus,
} from "@/actions/tasks";
import type { ContractTask, ContractTaskPriority, ContractTaskStatus } from "@/lib/types";

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
  if (priority === "high") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "low") return "border-zinc-200 bg-zinc-50 text-zinc-600";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function statusBadge(status: ContractTaskStatus): string {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "blocked") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "in_progress") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

export function ContractTasksPanel({
  contractId,
  tasks,
  members,
  canEdit,
  taskEvents,
}: {
  contractId: string;
  tasks: ContractTaskListItem[];
  members: MemberOption[];
  canEdit: boolean;
  taskEvents: Array<{
    id: string;
    task_id: string;
    event_type: string;
    details: Record<string, unknown> | null;
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

  function onCreate(formData: FormData) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const title = String(formData.get("title") ?? "").trim();
      const details = String(formData.get("details") ?? "").trim();
      const priority = String(formData.get("priority") ?? "medium") as ContractTaskPriority;
      const assigneeId = String(formData.get("assigneeId") ?? "").trim() || null;
      const dueDate = String(formData.get("dueDate") ?? "").trim() || null;

      const res = await createContractTask({
        contractId,
        title,
        details,
        priority,
        assigneeId,
        dueDate,
      });
      if ("error" in res && res.error) {
        setError(res.error);
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
        setError(res.error);
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
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {canEdit && (
        <form action={onCreate} className="grid gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/40 p-4">
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
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">Tasks attach execution work to this contract.</p>
            <button type="submit" disabled={isPending} className="ui-btn-primary px-4 py-2 text-[13px]">
              {isPending ? "Saving..." : "Add task"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-rose-700">{error}</p>}

      {tasks.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No tasks yet. Add one to track ownership, follow-up, and renewal prep work.
        </p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-xl border border-zinc-200/80 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{task.title}</p>
                  {task.details && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{task.details}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${priorityBadge(task.priority)}`}>
                      {task.priority}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${statusBadge(task.status)}`}>
                      {task.status.replace("_", " ")}
                    </span>
                    {task.assignee_id && (
                      <span className="text-zinc-500">
                        Assigned to {memberById.get(task.assignee_id) ?? "Member"}
                      </span>
                    )}
                    {task.due_date && (
                      <span className="text-zinc-500">
                        Due {format(new Date(`${task.due_date}T12:00:00`), "MMM d, yyyy")}
                      </span>
                    )}
                    {task.completed_at && (
                      <span className="text-emerald-700">
                        Completed {format(new Date(task.completed_at), "MMM d, yyyy")}
                      </span>
                    )}
                    {task.created_via && (
                      <span className="text-zinc-500">
                        Source: {task.created_via}
                        {task.team_key ? ` · queue ${task.team_key}` : ""}
                      </span>
                    )}
                  </div>
                {taskEvents.filter((e) => e.task_id === task.id).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {taskEvents
                      .filter((e) => e.task_id === task.id)
                      .slice(0, 3)
                      .map((event) => (
                        <li key={event.id} className="text-[11px] text-zinc-500">
                          {event.event_type.replace(/_/g, " ")} ·{" "}
                          {format(new Date(event.created_at), "MMM d, h:mm a")}
                          {(event.details?.reason as string | undefined)
                            ? ` · ${String(event.details?.reason)}`
                            : ""}
                        </li>
                      ))}
                  </ul>
                )}
                </div>
                <div className="flex items-center gap-2">
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
