import Link from "next/link";
import { format } from "date-fns";
import { getAuthContext } from "@/lib/supabase/server";
import {
  createSavedView,
  deleteSavedView,
  setSavedViewPinned,
  setSavedViewWeeklySummary,
} from "@/actions/saved-views";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";

type TaskStatusFilter = "" | "open" | "in_progress" | "blocked" | "done";
const STATUS_FILTERS: { value: TaskStatusFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

function statusTone(status: string): string {
  if (status === "done") return "text-emerald-700";
  if (status === "blocked") return "text-rose-700";
  if (status === "in_progress") return "text-blue-700";
  return "text-zinc-700";
}

export default async function ContractTasksPage(props: {
  searchParams: Promise<{ status?: string; mine?: string; team?: string }>;
}) {
  const { status: rawStatus, mine, team } = await props.searchParams;
  const status = (STATUS_FILTERS.find((f) => f.value === rawStatus)?.value ?? "") as TaskStatusFilter;
  const onlyMine = mine === "1";

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
  if (team?.trim()) query.eq("team_key", team.trim());

  const [{ data: tasksData }, { data: membersData }] = await Promise.all([
    query,
    admin
      .from("organization_members")
      .select("user_id, profiles(full_name, email)")
      .eq("organization_id", orgId),
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
    const profile = row.profiles as unknown as { full_name: string | null; email: string | null } | null;
    memberById.set(row.user_id, profile?.full_name || profile?.email || "Member");
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
  const savedViews = (savedViewsData ?? []).map((v) => {
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
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Execution</p>
          <h1 className="ui-display-title mt-2">Task queue</h1>
          <p className="ui-muted-tight mt-2 max-w-2xl">Team follow-up with ownership, urgency, and status.</p>
        </div>
        <Link href="/contracts" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
          Contract index
        </Link>
      </header>

      <div className="ui-panel md:p-6">
        <form className="flex flex-wrap items-end gap-4" action="/contracts/tasks" method="get">
          <div>
            <label htmlFor="task-status" className="ui-label-caps">Status</label>
            <select id="task-status" name="status" defaultValue={status} className="ui-input min-w-[12rem]">
              {STATUS_FILTERS.map((f) => (
                <option key={f.value || "all"} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="ui-label-caps">Assignee</span>
            <div className="flex min-h-10 items-center">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700">
                <input
                  type="checkbox"
                  name="mine"
                  value="1"
                  defaultChecked={onlyMine}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                Assigned to me
              </label>
            </div>
          </div>
          <div>
            <label htmlFor="task-team" className="ui-label-caps">Team queue</label>
            <input
              id="task-team"
              name="team"
              defaultValue={team ?? ""}
              placeholder="ops, legal, finance…"
              className="ui-input min-w-[12rem]"
            />
          </div>
          <button type="submit" className="ui-btn-primary px-5 py-2.5 text-[13px]">
            Apply
          </button>
        </form>
        <div className="mt-5 border-t border-zinc-100 pt-5">
          <form action={createSavedView} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="organizationId" value={orgId} />
            <input type="hidden" name="viewType" value="tasks" />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="mine" value={onlyMine ? "1" : ""} />
            <input type="hidden" name="team" value={team ?? ""} />
            <div>
              <label htmlFor="task-view-name" className="ui-label-caps">
                Save this queue view
              </label>
              <input id="task-view-name" name="name" required className="ui-input min-w-[14rem]" />
            </div>
            <button type="submit" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
              Save view
            </button>
          </form>
          {savedViews.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {savedViews.map((view) => (
                <div
                  key={view.id}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1"
                >
                  <Link href={view.href} className="px-2 py-0.5 text-[12px] font-semibold text-zinc-700">
                    {view.name}
                  </Link>
                  <form action={deleteSavedView.bind(null, view.id)}>
                    <button type="submit" className="rounded-full px-1.5 py-0.5 text-[11px] text-zinc-500">
                      ×
                    </button>
                  </form>
                  <form action={setSavedViewPinned.bind(null, view.id, !view.pinned)}>
                    <button
                      type="submit"
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        view.pinned ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {view.pinned ? "Pinned" : "Pin"}
                    </button>
                  </form>
                  <form action={setSavedViewWeeklySummary.bind(null, view.id, !view.weeklyActive)}>
                    <button
                      type="submit"
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        view.weeklyActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {view.weeklyActive ? "Weekly on" : "Weekly off"}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks in this queue"
          copy="Change filters or create tasks from a contract record."
        />
      ) : (
        <div className="ui-table-shell">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="ui-table-header">
              <tr>
                <th className="px-5 py-3">Task</th>
                <th className="px-5 py-3">Contract</th>
                <th className="px-5 py-3">Assignee</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3">SLA</th>
                <th className="px-5 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {tasks.map((task) => (
                <tr key={task.id} className="ui-table-row align-top">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-zinc-900">{task.title}</p>
                    {task.details && (
                      <p className="mt-1 line-clamp-2 max-w-xl text-zinc-500">{task.details}</p>
                    )}
                    <p className="mt-1 text-xs text-zinc-500">
                      Priority: <span className="font-medium">{task.priority}</span>
                    </p>
                    {task.blockedReason && task.status === "blocked" && (
                      <p className="mt-1 text-xs text-rose-700">Blocked: {task.blockedReason}</p>
                    )}
                    {task.recurrenceIntervalDays && task.recurrenceIntervalDays > 0 && (
                      <p className="mt-1 text-xs text-zinc-500">
                        Recurs every {task.recurrenceIntervalDays} day
                        {task.recurrenceIntervalDays === 1 ? "" : "s"}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <Link href={`/contracts/${task.contractId}`} className="ui-link">
                      {task.contractTitle}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-zinc-600">
                    {task.assigneeId ? memberById.get(task.assigneeId) ?? "Member" : "Unassigned"}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">
                    {task.createdVia ?? "manual"}
                    {task.teamKey ? ` · ${task.teamKey}` : ""}
                  </td>
                  <td className={`px-5 py-4 font-semibold ${statusTone(task.status)}`}>
                    {task.status.replace("_", " ")}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">
                    {task.dueDate
                      ? format(new Date(`${task.dueDate}T12:00:00`), "MMM d, yyyy")
                      : "—"}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">
                    {task.slaDueAt ? format(new Date(task.slaDueAt), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-5 py-4 text-zinc-500">
                    {format(new Date(task.updatedAt), "MMM d")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
