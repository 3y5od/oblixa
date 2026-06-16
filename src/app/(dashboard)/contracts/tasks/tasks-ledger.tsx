import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, ArrowRight, ClipboardList, Compass } from "lucide-react";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { EmptyState } from "@/components/ui/empty-state";
import { SamplePreviewCard } from "@/components/ui/sample-preview-card";
import { StatusPill } from "@/components/ui/status-pill";
import { formatBusinessDateAtNoon, parseBusinessDateAtNoon } from "@/lib/business-dates";
import {
  taskStatusLabel,
  taskStatusTone,
} from "@/app/(dashboard)/contracts/tasks/tasks-page-config";
import type { TaskViewRow } from "@/app/(dashboard)/contracts/tasks/tasks-page-types";

export function TasksLedger({
  memberById,
  tasks,
}: {
  memberById: Map<string, string>;
  tasks: TaskViewRow[];
}) {
  if (tasks.length === 0) return <TasksEmptyState />;
  return <TasksTable memberById={memberById} tasks={tasks} />;
}

function TasksEmptyState() {
  return (
    <section
      className="ui-card-raised relative overflow-hidden rounded-2xl border p-5 sm:p-6 lg:p-7"
      data-v10-state="empty"
    >
      <div
        aria-hidden
        className="landing-corner-ring"
        style={{ top: "-2.25rem", right: "-2.25rem", width: "7rem", height: "7rem" }}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-8">
        <EmptyState
          eyebrow="Queue status"
          title="No tasks match this queue"
          copy="Adjust the filters above, clear the current queue, or review tasks for other action types."
          icon={<Compass className="h-7 w-7 text-[var(--accent-strong)]" strokeWidth={1.65} aria-hidden />}
          className="lg:items-start lg:text-left"
          action={
            <>
              <Link href="/work" className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]">
                <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                Review tasks
              </Link>
              <Link href="/contracts/tasks" className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]">
                Clear filters
              </Link>
            </>
          }
        />
        <SamplePreviewCard
          eyebrow="Sample task"
          title="Review change order pricing"
          description="Compare uplift against renewal envelope."
          status={<StatusPill tone="warning">Open</StatusPill>}
          rows={[
            { label: "Contract", value: "Acme Corp MSA 2025" },
            { label: "Assignee", value: "Sarah K." },
            { label: "Due", value: "Mar 18, 2026" },
            { label: "Source", value: "Manual · legal" },
          ]}
          footerEyebrow="Priority P2"
          footerValue="Move to in progress"
        />
      </div>
    </section>
  );
}

function TasksTable({ memberById, tasks }: { memberById: Map<string, string>; tasks: TaskViewRow[] }) {
  return (
    <section className="ui-card overflow-hidden p-0">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            Rows
          </p>
          <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
            Task ledger
          </h2>
          <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            Ownership, due state, and source - without losing contract context.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          <ClipboardList className="h-3 w-3" strokeWidth={1.85} aria-hidden />
          {tasks.length} {tasks.length === 1 ? "row" : "rows"}
        </span>
      </header>
      <div className="overflow-x-auto">
        <table aria-label="Tasks in this queue" className="min-w-full divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] text-sm">
          <TasksTableHead />
          <tbody className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
            {tasks.map((task) => (
              <TaskRow key={task.id} memberById={memberById} task={task} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TasksTableHead() {
  const labels = ["Task", "Contract", "Assignee", "Source", "Status", "Due", "SLA", "Updated"];
  return (
    <thead>
      <tr className="text-left">
        {labels.map((label) => (
          <th
            key={label}
            className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
          >
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TaskRow({ memberById, task }: { memberById: Map<string, string>; task: TaskViewRow }) {
  const isOverdue =
    Boolean(task.dueDate) &&
    task.status !== "done" &&
    (parseBusinessDateAtNoon(task.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY) < new Date().getTime();
  return (
    <tr className="align-top">
      <td className="px-5 py-4">
        <p className="font-semibold text-[var(--text-primary)]">{task.title}</p>
        {task.details ? (
          <p className="mt-1 line-clamp-2 max-w-xl text-[12.5px] text-[var(--text-tertiary)]">{task.details}</p>
        ) : null}
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
          Priority · {task.priority}
          {task.recurrenceIntervalDays && task.recurrenceIntervalDays > 0
            ? ` · Recurs every ${task.recurrenceIntervalDays}d`
            : ""}
        </p>
        {task.blockedReason && task.status === "blocked" ? (
          <p className="mt-2 inline-flex items-start gap-1.5 text-[12.5px] text-[var(--danger-ink)]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
            <span>Input needed · {task.blockedReason}</span>
          </p>
        ) : null}
      </td>
      <td className="px-5 py-4">
        <Link href={`/contracts/${task.contractId}`} className="ui-link text-[12.5px] font-semibold">
          {task.contractTitle}
        </Link>
        <ContractContinuityLinks
          contractId={task.contractId}
          omit={["tasks"]}
          className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[var(--text-tertiary)]"
        />
      </td>
      <td className="px-5 py-4 text-[12.5px]">
        {task.assigneeId ? (
          <span className="text-[var(--text-secondary)]">{memberById.get(task.assigneeId) ?? "Member"}</span>
        ) : (
          <span className="font-medium text-[var(--warning-ink)]">Unassigned</span>
        )}
      </td>
      <td className="px-5 py-4 text-[12.5px] text-[var(--text-secondary)]">
        {task.createdVia ?? "manual"}
        {task.teamKey ? ` · ${task.teamKey}` : ""}
      </td>
      <td className="px-5 py-4">
        <StatusPill tone={taskStatusTone(task.status)}>{taskStatusLabel(task.status)}</StatusPill>
      </td>
      <td className="px-5 py-4 font-mono text-[12.5px] tabular-nums">
        {task.dueDate ? (
          <span className={isOverdue ? "text-[var(--danger-ink)]" : "text-[var(--text-secondary)]"}>
            {formatBusinessDateAtNoon(task.dueDate)}
          </span>
        ) : (
          <span className="text-[var(--text-tertiary)]">—</span>
        )}
      </td>
      <td className="px-5 py-4 font-mono text-[12.5px] tabular-nums text-[var(--text-secondary)]">
        {task.slaDueAt ? format(new Date(task.slaDueAt), "MMM d, yyyy") : "—"}
      </td>
      <td className="px-5 py-4 font-mono text-[11px] text-[var(--text-tertiary)]">
        {format(new Date(task.updatedAt), "MMM d")}
      </td>
    </tr>
  );
}
