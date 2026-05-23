import Link from "next/link";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  ClipboardList,
  Compass,
  Inbox,
  Pin,
  Save,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import {
  createSavedView,
  deleteSavedView,
  setSavedViewPinned,
  setSavedViewWeeklySummary,
} from "@/actions/saved-views";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { SamplePreviewCard } from "@/components/ui/sample-preview-card";
import { UiRadioGroup } from "@/components/ui/ui-radio-group";
import { UiToggle } from "@/components/ui/ui-toggle";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCell, type StatTone } from "@/components/ui/stat-cell";
import { StatusPill } from "@/components/ui/status-pill";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";

export const metadata = { title: "Tasks" };

type TaskStatusFilter = "" | "open" | "in_progress" | "blocked" | "done";
const STATUS_FILTERS: { value: TaskStatusFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

function taskStatusTone(status: string): StatTone {
  if (status === "done") return "success";
  if (status === "blocked") return "danger";
  if (status === "in_progress") return "neutral";
  if (status === "open") return "warning";
  return "neutral";
}

function taskStatusLabel(status: string): string {
  if (status === "in_progress") return "In progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function ContractTasksPage(props: {
  searchParams: Promise<{ status?: string; mine?: string; team?: string }>;
}) {
  const { status: rawStatus, mine, team } = await props.searchParams;
  const status = (STATUS_FILTERS.find((f) => f.value === rawStatus)?.value ?? "") as TaskStatusFilter;
  const onlyMine = mine === "1";
  const teamFilter = team?.trim() ?? "";
  const hasFilters = Boolean(status) || onlyMine || Boolean(teamFilter);

  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const { admin, orgId, user } = ctx;
  const query = admin
    .from("contract_tasks")
    .select(
      "id, title, details, status, priority, created_via, team_key, blocked_reason, recurrence_interval_days, sla_due_at, due_date, assignee_id, updated_at, contracts!inner(id, title, organization_id)"
    )
    .eq("organization_id", orgId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (status) query.eq("status", status);
  if (onlyMine) query.eq("assignee_id", user.id);
  if (teamFilter) query.eq("team_key", teamFilter);

  const [{ data: tasksData }, membersData] = await Promise.all([
    query,
    loadOrgMemberProfileRows(admin, orgId),
  ]);

  const { data: savedViewsData } = await admin
    .from("saved_views")
    .select("id, name, query_json")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("view_type", "tasks")
    .order("created_at", { ascending: true });
  const savedViewIds = (savedViewsData ?? []).map((v) => v.id);
  const { data: subscriptionsData } =
    savedViewIds.length === 0
      ? { data: [] as Array<{ saved_view_id: string; active: boolean }> }
      : await admin
          .from("report_subscriptions")
          .select("saved_view_id, active")
          .eq("user_id", user.id)
          .eq("frequency", "weekly")
          .in("saved_view_id", savedViewIds);
  const weeklyByViewId = new Map((subscriptionsData ?? []).map((s) => [s.saved_view_id, Boolean(s.active)]));

  const memberById = new Map<string, string>();
  for (const row of membersData ?? []) {
    memberById.set(row.user_id, orgMemberProfileLabel(row.profiles));
  }

  const tasks = (tasksData ?? []).flatMap((row) => {
    const rel = row.contracts as unknown;
    const contract = (
      Array.isArray(rel) ? rel[0] : rel
    ) as { id?: string; title?: string; organization_id?: string } | null;
    if (!contract?.id || !contract?.title) return [];
    return [
      {
        id: row.id,
        title: row.title,
        details: row.details,
        status: row.status,
        priority: row.priority,
        dueDate: row.due_date as string | null,
        blockedReason: row.blocked_reason as string | null,
        recurrenceIntervalDays: row.recurrence_interval_days as number | null,
        slaDueAt: row.sla_due_at as string | null,
        assigneeId: row.assignee_id as string | null,
        updatedAt: row.updated_at,
        createdVia: row.created_via as string | null,
        teamKey: row.team_key as string | null,
        contractId: contract.id,
        contractTitle: contract.title,
      },
    ];
  });
  const savedViews = (savedViewsData ?? [])
    .map((v) => {
      const q = (v.query_json ?? {}) as Record<string, unknown>;
      const params = new URLSearchParams();
      if (typeof q.status === "string" && q.status) params.set("status", q.status);
      if (typeof q.mine === "string" && q.mine) params.set("mine", q.mine);
      const qs = params.toString();
      return {
        id: v.id,
        name: v.name,
        href: qs ? `/contracts/tasks?${qs}` : "/contracts/tasks",
        weeklyActive: weeklyByViewId.get(v.id) ?? false,
        pinned: q.pinned === "1" || q.pinned === true || q.pinned === "true",
      };
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const openTasks = tasks.filter((task) => task.status === "open").length;
  const blockedTasks = tasks.filter((task) => task.status === "blocked").length;
  const doneTasks = tasks.filter((task) => task.status === "done").length;
  const dueSoonTasks = tasks.filter((task) => {
    if (!task.dueDate) return false;
    const due = new Date(`${task.dueDate}T12:00:00`);
    const diff = due.getTime() - new Date().getTime();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="ui-page-stack mx-auto max-w-7xl">
      <DashboardPageHeader
        icon={<ClipboardList className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Execution"
        title="Task queue"
        lead="Team follow-up with ownership, urgency, and status."
        actions={
          <Link
            href="/contracts"
            className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
          >
            Contract index
            <ChevronRight className="h-3 w-3 opacity-60" aria-hidden />
          </Link>
        }
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Task summary">
        <StatCell
          label="Open tasks"
          display={String(openTasks)}
          isZero={openTasks === 0}
          tone="warning"
          context={openTasks === 0 ? "Backlog clear" : "Ready to move"}
        />
        <StatCell
          label="Due soon"
          display={String(dueSoonTasks)}
          isZero={dueSoonTasks === 0}
          tone="warning"
          context={dueSoonTasks === 0 ? "Nothing due in 7 days" : "Within 7 days"}
        />
        <StatCell
          label="Blocked"
          display={String(blockedTasks)}
          isZero={blockedTasks === 0}
          tone="danger"
          context={blockedTasks === 0 ? "Nothing waiting on an unblock" : "Need unblock path"}
        />
        <StatCell
          label="Completed"
          display={String(doneTasks)}
          isZero={doneTasks === 0}
          tone="success"
          context={doneTasks === 0 ? "Nothing closed yet" : "Closed in this view"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" aria-label="Task filters and saved queues">
        <div className="ui-card min-w-0 overflow-hidden p-0">
          <SectionHeader
            eyebrow="Filters"
            trailing={
              hasFilters ? (
                <Link
                  href="/contracts/tasks"
                  className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                  Clear filters
                </Link>
              ) : null
            }
          />
          <form action="/contracts/tasks" method="get" className="space-y-3 px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="min-w-[4.5rem] shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                Status
              </p>
              <UiRadioGroup
                name="status"
                defaultValue={status}
                ariaLabel="Task status"
                options={STATUS_FILTERS}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="min-w-[4.5rem] shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                Owner
              </p>
              <UiToggle
                name="mine"
                defaultChecked={onlyMine}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                    Assigned to me
                  </span>
                }
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <label
                htmlFor="task-team"
                className="min-w-[4.5rem] shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]"
              >
                Team lane
              </label>
              <div className="relative min-w-0 flex-1">
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
                  aria-hidden
                >
                  <Users className="h-4 w-4" strokeWidth={1.85} />
                </span>
                <input aria-label="ops, legal, finance" id="task-team"
                  name="team"
                  defaultValue={teamFilter}
                  placeholder="ops, legal, finance"
                  className="ui-input pl-10 text-[12.5px]"
                />
              </div>
              <button
                type="submit"
                className="ui-btn-primary inline-flex shrink-0 items-center gap-1.5 px-4 py-2 text-[12.5px]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                Apply filters
              </button>
            </div>
          </form>
        </div>

        <div className="ui-card min-w-0 overflow-hidden p-0">
          <SectionHeader
            eyebrow="Saved queues"
            trailing={
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                <Save className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                {savedViews.length} saved
              </span>
            }
          />
          <div className="space-y-4 px-5 py-4">
            <form action={createSavedView as never} className="space-y-2">
              <input type="hidden" name="organizationId" value={orgId} />
              <input type="hidden" name="viewType" value="tasks" />
              <input type="hidden" name="status" value={status} />
              <input type="hidden" name="mine" value={onlyMine ? "1" : ""} />
              <input type="hidden" name="team" value={teamFilter} />
              <label
                htmlFor="task-view-name"
                className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]"
              >
                Queue name
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <input aria-label="My open legal tasks" id="task-view-name"
                  name="name"
                  required
                  placeholder="My open legal tasks"
                  className="ui-input min-w-0 flex-1"
                />
                <button
                  type="submit"
                  className="ui-btn-secondary inline-flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-[12.5px]"
                >
                  <Save className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                  Save queue
                </button>
              </div>
            </form>
            {savedViews.length > 0 ? (
              <ul
                className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] border-y border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]"
                aria-label="Saved task queues"
              >
                {savedViews.map((view) => (
                  <li key={view.id} className="space-y-2 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={view.href} className="ui-link text-[12.5px] font-semibold">
                        {view.name}
                      </Link>
                      <div className="flex flex-wrap gap-1.5">
                        {view.pinned ? <StatusPill tone="success">Pinned</StatusPill> : null}
                        <StatusPill tone={view.weeklyActive ? "success" : "neutral"}>
                          {view.weeklyActive ? "Weekly on" : "Weekly off"}
                        </StatusPill>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <form action={setSavedViewPinned.bind(null, view.id, !view.pinned) as never}>
                        <button
                          type="submit"
                          className="ui-btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]"
                          aria-label={`${view.pinned ? "Unpin" : "Pin"} saved task queue ${view.name}`}
                        >
                          <Pin className="h-3 w-3" aria-hidden />
                          {view.pinned ? "Unpin" : "Pin"}
                        </button>
                      </form>
                      <form action={setSavedViewWeeklySummary.bind(null, view.id, !view.weeklyActive) as never}>
                        <button
                          type="submit"
                          className="ui-btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]"
                          aria-label={`${view.weeklyActive ? "Disable" : "Enable"} weekly summary for ${view.name}`}
                        >
                          {view.weeklyActive ? "Disable weekly" : "Enable weekly"}
                        </button>
                      </form>
                      <form action={deleteSavedView.bind(null, view.id) as never}>
                        <button
                          type="submit"
                          className="ui-btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-[var(--danger-ink)]"
                          aria-label={`Delete saved task queue ${view.name}`}
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_28%,transparent)] px-4 py-3">
                <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold tracking-tight text-[var(--text-primary)]">
                    No saved queues yet
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                    Bookmark the current filter set when it becomes a recurring view.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {tasks.length === 0 ? (
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
              copy="Adjust the filters above, clear the current queue, or review unified work for other action types."
              icon={<Compass className="h-7 w-7 text-[var(--accent-strong)]" strokeWidth={1.65} aria-hidden />}
              className="lg:items-start lg:text-left"
              action={
                <>
                  <Link
                    href="/work"
                    className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]"
                  >
                    <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                    Review unified work
                  </Link>
                  {hasFilters ? (
                    <Link
                      href="/contracts/tasks"
                      className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]"
                    >
                      Clear filters
                    </Link>
                  ) : (
                    <Link
                      href="/contracts"
                      className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]"
                    >
                      Browse contracts
                    </Link>
                  )}
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
      ) : (
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
                Ownership, due state, and source — without losing contract context.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              <ClipboardList className="h-3 w-3" strokeWidth={1.85} aria-hidden />
              {tasks.length} {tasks.length === 1 ? "row" : "rows"}
            </span>
          </header>
          <div className="overflow-x-auto">
            <table aria-label="Tasks in this queue" className="min-w-full divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Task
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Contract
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Assignee
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Source
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Status
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Due
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    SLA
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
                {tasks.map((task) => {
                  const isOverdue =
                    Boolean(task.dueDate) &&
                    task.status !== "done" &&
                    new Date(`${task.dueDate}T12:00:00`).getTime() < new Date().getTime();
                  return (
                    <tr key={task.id} className="align-top">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[var(--text-primary)]">{task.title}</p>
                        {task.details ? (
                          <p className="mt-1 line-clamp-2 max-w-xl text-[12.5px] text-[var(--text-tertiary)]">
                            {task.details}
                          </p>
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
                            <span>Blocked · {task.blockedReason}</span>
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/contracts/${task.contractId}`}
                          className="ui-link text-[12.5px] font-semibold"
                        >
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
                          <span className="text-[var(--text-secondary)]">
                            {memberById.get(task.assigneeId) ?? "Member"}
                          </span>
                        ) : (
                          <span className="font-medium text-[var(--warning-ink)]">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[12.5px] text-[var(--text-secondary)]">
                        {task.createdVia ?? "manual"}
                        {task.teamKey ? ` · ${task.teamKey}` : ""}
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill tone={taskStatusTone(task.status)}>
                          {taskStatusLabel(task.status)}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-4 font-mono text-[12.5px] tabular-nums">
                        {task.dueDate ? (
                          <span className={isOverdue ? "text-[var(--danger-ink)]" : "text-[var(--text-secondary)]"}>
                            {format(new Date(`${task.dueDate}T12:00:00`), "MMM d, yyyy")}
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
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
