import Link from "next/link";
import { ChevronRight, ClipboardList, SlidersHorizontal, UserRound, Users } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCell } from "@/components/ui/stat-cell";
import { UiRadioGroup } from "@/components/ui/ui-radio-group";
import { UiToggle } from "@/components/ui/ui-toggle";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";
import { parseBusinessDateAtNoon } from "@/lib/business-dates";
import { STATUS_FILTERS } from "@/app/(dashboard)/contracts/tasks/tasks-page-config";
import { SavedTaskQueues } from "@/app/(dashboard)/contracts/tasks/tasks-saved-queues";
import { TasksLedger } from "@/app/(dashboard)/contracts/tasks/tasks-ledger";
import type {
  SavedTaskView,
  TaskStatusFilter,
  TaskViewRow,
} from "@/app/(dashboard)/contracts/tasks/tasks-page-types";

export const metadata = { title: "Tasks" };

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

  const tasks: TaskViewRow[] = (tasksData ?? []).flatMap((row) => {
    const rel = row.contracts as unknown;
    const contract = (Array.isArray(rel) ? rel[0] : rel) as
      | { id?: string; title?: string; organization_id?: string }
      | null;
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
  const savedViews: SavedTaskView[] = (savedViewsData ?? [])
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
    const due = parseBusinessDateAtNoon(task.dueDate);
    if (!due) return false;
    const diff = due.getTime() - new Date().getTime();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="ui-page-stack mx-auto w-full min-w-0 max-w-7xl">
      <DashboardPageHeader
        icon={<ClipboardList className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Execution"
        title="Task queue"
        lead="Team follow-up with ownership, urgency, and status."
        actions={
          <Link href="/contracts" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
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
          label="Needs input"
          display={String(blockedTasks)}
          isZero={blockedTasks === 0}
          tone="danger"
          context={blockedTasks === 0 ? "No tasks need input" : "Needs input"}
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
                <Link href="/contracts/tasks" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
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
              <UiRadioGroup name="status" defaultValue={status} ariaLabel="Task status" options={STATUS_FILTERS} />
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
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]" aria-hidden>
                  <Users className="h-4 w-4" strokeWidth={1.85} />
                </span>
                <input
                  aria-label="ops, legal, finance"
                  id="task-team"
                  name="team"
                  defaultValue={teamFilter}
                  placeholder="ops, legal, finance"
                  className="ui-input pl-10 text-[12.5px]"
                />
              </div>
              <button type="submit" className="ui-btn-primary inline-flex shrink-0 items-center gap-1.5 px-4 py-2 text-[12.5px]">
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                Apply filters
              </button>
            </div>
          </form>
        </div>
        <SavedTaskQueues
          onlyMine={onlyMine}
          orgId={orgId}
          savedViews={savedViews}
          status={status}
          teamFilter={teamFilter}
        />
      </section>
      <TasksLedger memberById={memberById} tasks={tasks} />
    </div>
  );
}
