import { format } from "date-fns";
import { graphLinksForEntity, type ExecutionGraphEdgeRow } from "@/lib/contract-operations/graph-edge-labels";
import { formatBusinessDateAtNoon } from "@/lib/business-dates";
import { priorityBadge, statusBadge, taskStatusLabel } from "@/components/contracts/contract-tasks-panel-options";
import type {
  ContractTaskDependency,
  ContractTaskEvent,
  ContractTaskListItem,
} from "./contract-tasks-panel-types";

export function ContractTaskSummary({
  task,
  memberById,
  taskTitleById,
  taskEvents,
  taskDependencies,
  executionGraphEdges,
}: {
  task: ContractTaskListItem;
  memberById: ReadonlyMap<string, string>;
  taskTitleById: ReadonlyMap<string, string>;
  taskEvents: ContractTaskEvent[];
  taskDependencies: ContractTaskDependency[];
  executionGraphEdges?: ExecutionGraphEdgeRow[];
}) {
  const events = taskEvents.filter((event) => event.task_id === task.id);
  const dependencies = taskDependencies.filter((dependency) => dependency.task_id === task.id);

  return (
    <>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{task.title}</p>
      {task.details ? (
        <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{task.details}</p>
      ) : null}
      <TaskMetadata task={task} memberById={memberById} />
      <TaskGraphLabels task={task} executionGraphEdges={executionGraphEdges} />
      {events.length > 0 ? <TaskEvents events={events} /> : null}
      {dependencies.length > 0 ? (
        <TaskDependencies dependencies={dependencies} taskTitleById={taskTitleById} />
      ) : null}
    </>
  );
}

function TaskMetadata({
  task,
  memberById,
}: {
  task: ContractTaskListItem;
  memberById: ReadonlyMap<string, string>;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className={`rounded-full border px-2 py-0.5 font-medium ${priorityBadge(task.priority)}`}>
        {task.priority}
      </span>
      <span className={`rounded-full border px-2 py-0.5 font-medium ${statusBadge(task.status)}`}>
        {taskStatusLabel(task.status)}
      </span>
      {task.assignee_id ? (
        <span className="text-[var(--text-tertiary)]">
          Assigned to {memberById.get(task.assignee_id) ?? "Member"}
        </span>
      ) : null}
      {task.due_date ? (
        <span className="text-[var(--text-tertiary)]">
          Due {formatBusinessDateAtNoon(task.due_date)}
        </span>
      ) : null}
      {task.completed_at ? (
        <span className="text-[var(--success-ink)]">
          Completed {format(new Date(task.completed_at), "MMM d, yyyy")}
        </span>
      ) : null}
      {task.created_via ? (
        <span className="text-[var(--text-tertiary)]">
          Source: {task.created_via}
          {task.team_key ? ` - queue ${task.team_key}` : ""}
        </span>
      ) : null}
      {task.blocked_reason && task.status === "blocked" ? (
        <span className="font-medium text-[var(--danger)]">Input needed: {task.blocked_reason}</span>
      ) : null}
      {task.recurrence_interval_days && task.recurrence_interval_days > 0 ? (
        <span className="text-[var(--text-tertiary)]">
          Recurs every {task.recurrence_interval_days} day
          {task.recurrence_interval_days === 1 ? "" : "s"}
        </span>
      ) : null}
      {task.sla_due_at ? (
        <span className="text-[var(--text-tertiary)]">
          SLA {format(new Date(task.sla_due_at), "MMM d, yyyy")}
        </span>
      ) : null}
    </div>
  );
}

function TaskGraphLabels({
  task,
  executionGraphEdges,
}: {
  task: ContractTaskListItem;
  executionGraphEdges?: ExecutionGraphEdgeRow[];
}) {
  const { blockedBy, unblocks } = graphLinksForEntity(executionGraphEdges, "task", task.id);
  if (blockedBy.length === 0 && unblocks.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {blockedBy.map((label) => (
        <span key={`b-${task.id}-${label}`} className="rounded border border-[color:color-mix(in_oklab,var(--warning)_42%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning)_12%,var(--surface))] px-2 py-0.5 text-[11px] text-[var(--warning-ink)]">
          Input needed: {label}
        </span>
      ))}
      {unblocks.map((label) => (
        <span key={`u-${task.id}-${label}`} className="rounded border border-sky-200 bg-sky-50/80 px-2 py-0.5 text-[11px] text-sky-900">
          {label}
        </span>
      ))}
    </div>
  );
}

function TaskEvents({ events }: { events: ContractTaskEvent[] }) {
  return (
    <ul className="mt-2 space-y-1">
      {events.slice(0, 3).map((event) => (
        <li key={event.id} className="text-[11px] text-[var(--text-tertiary)]">
          {event.event_type.replace(/_/g, " ")} - {format(new Date(event.created_at), "MMM d, h:mm a")}
          {(event.details?.reason as string | undefined) ? ` - ${String(event.details?.reason)}` : ""}
        </li>
      ))}
    </ul>
  );
}

function TaskDependencies({
  dependencies,
  taskTitleById,
}: {
  dependencies: ContractTaskDependency[];
  taskTitleById: ReadonlyMap<string, string>;
}) {
  return (
    <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">
      Depends on:{" "}
      {dependencies
        .map((dep) => taskTitleById.get(dep.depends_on_task_id) ?? dep.depends_on_task_id.slice(0, 8))
        .join(", ")}
    </div>
  );
}
