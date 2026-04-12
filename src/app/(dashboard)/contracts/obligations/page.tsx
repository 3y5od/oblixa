import Link from "next/link";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { format } from "date-fns";
import { getAuthContext } from "@/lib/supabase/server";
import {
  createSavedView,
  deleteSavedView,
  setSavedViewPinned,
  setSavedViewWeeklySummary,
} from "@/actions/saved-views";
import { createObligationClarificationTaskForm } from "@/actions/tasks";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";

type ObligationStatusFilter = "" | "open" | "in_progress" | "done" | "waived";
const STATUS_FILTERS: { value: ObligationStatusFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "waived", label: "Waived" },
];

function statusTone(status: string): string {
  if (status === "done") return "text-emerald-700";
  if (status === "waived") return "text-zinc-600";
  if (status === "in_progress") return "text-blue-700";
  return "text-amber-800";
}

export default async function ContractObligationsPage(props: {
  searchParams: Promise<{ status?: string; mine?: string }>;
}) {
  const { status: rawStatus, mine } = await props.searchParams;
  const status = (STATUS_FILTERS.find((f) => f.value === rawStatus)?.value ??
    "") as ObligationStatusFilter;
  const onlyMine = mine === "1";

  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const { admin, orgId, user } = ctx;

  const query = admin
    .from("contract_obligations")
    .select(
      "id, title, obligation_type, cadence, recurrence_type, recurrence_interval_days, next_due_date, escalation_due_at, escalation_status, due_date, status, owner_id, updated_at, contracts!inner(id, title, organization_id)"
    )
    .eq("organization_id", orgId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (status) query.eq("status", status);
  if (onlyMine) query.eq("owner_id", user.id);

  const [{ data: rows }, { data: membersData }] = await Promise.all([
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
    .eq("view_type", "obligations")
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

  const ownerById = new Map<string, string>();
  for (const row of membersData ?? []) {
    const profile = row.profiles as unknown as { full_name: string | null; email: string | null } | null;
    ownerById.set(row.user_id, profile?.full_name || profile?.email || "Member");
  }

  const obligations = (rows ?? []).flatMap((row) => {
    const rel = row.contracts as unknown;
    const contract = (
      Array.isArray(rel) ? rel[0] : rel
    ) as { id?: string; title?: string } | null;
    if (!contract?.id || !contract?.title) return [];
    return [
      {
        id: row.id,
        title: row.title,
        obligationType: row.obligation_type,
        cadence: row.cadence as string | null,
        recurrenceType: row.recurrence_type as string | null,
        recurrenceIntervalDays: row.recurrence_interval_days as number | null,
        nextDueDate: row.next_due_date as string | null,
        escalationDueAt: row.escalation_due_at as string | null,
        escalationStatus: row.escalation_status as string | null,
        dueDate: row.due_date as string | null,
        status: row.status as string,
        ownerId: row.owner_id as string | null,
        updatedAt: row.updated_at,
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
      href: qs ? `/contracts/obligations?${qs}` : "/contracts/obligations",
      weeklyActive: weeklyByViewId.get(v.id) ?? false,
      pinned: q.pinned === true || q.pinned === "1" || q.pinned === "true",
    };
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Portfolio commitments</p>
          <h1 className="ui-display-title mt-2">Obligations queue</h1>
          <p className="ui-muted-tight mt-2 max-w-2xl">Operational commitments and due-state execution.</p>
        </div>
        <Link href="/contracts" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
          Contract index
        </Link>
      </header>

      <div className="ui-panel md:p-6">
        <form className="flex flex-wrap items-end gap-4" action="/contracts/obligations" method="get">
          <div>
            <label htmlFor="obligation-status" className="ui-label-caps">Status</label>
            <select id="obligation-status" name="status" defaultValue={status} className="ui-input min-w-[12rem]">
              {STATUS_FILTERS.map((f) => (
                <option key={f.value || "all"} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="ui-label-caps">Owner</span>
            <div className="flex min-h-10 items-center">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700">
                <input
                  type="checkbox"
                  name="mine"
                  value="1"
                  defaultChecked={onlyMine}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                Owned by me
              </label>
            </div>
          </div>
          <button type="submit" className="ui-btn-primary px-5 py-2.5 text-[13px]">
            Apply
          </button>
        </form>
        <div className="mt-5 border-t border-zinc-100 pt-5">
          <form action={createSavedView} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="organizationId" value={orgId} />
            <input type="hidden" name="viewType" value="obligations" />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="mine" value={onlyMine ? "1" : ""} />
            <div>
              <label htmlFor="obligation-view-name" className="ui-label-caps">
                Save this queue view
              </label>
              <input id="obligation-view-name" name="name" required className="ui-input min-w-[14rem]" />
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

      {obligations.length === 0 ? (
        <EmptyState
          title="No obligations in this queue"
          copy="Create obligations from contract records, then apply filters."
        />
      ) : (
        <div className="ui-table-shell">
          <table className="min-w-full divide-y divide-[var(--border-subtle)] text-sm">
            <thead className="ui-table-header">
              <tr>
                <th className="px-5 py-3">Obligation</th>
                <th className="px-5 py-3">Contract</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3">Next due</th>
                <th className="px-5 py-3">Escalation</th>
                <th className="px-5 py-3">Updated</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {obligations.map((ob) => (
                <tr key={ob.id} className="ui-table-row">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-zinc-900">{ob.title}</p>
                    <p className="mt-0.5 text-[13px] text-zinc-500">
                      {ob.obligationType}
                      {ob.cadence && (
                        <>
                          <span className="text-zinc-300"> · </span>
                          {ob.cadence}
                        </>
                      )}
                      {ob.recurrenceType && ob.recurrenceType !== "none" && (
                        <>
                          <span className="text-zinc-300"> · </span>
                          {ob.recurrenceType}
                          {ob.recurrenceType === "custom_days" && ob.recurrenceIntervalDays
                            ? ` (${ob.recurrenceIntervalDays}d)`
                            : ""}
                        </>
                      )}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <Link href={`/contracts/${ob.contractId}`} className="ui-link">
                      {ob.contractTitle}
                    </Link>
                    <ContractContinuityLinks contractId={ob.contractId} omit={["obligations"]} />
                  </td>
                  <td className="px-5 py-4 text-zinc-600">
                    {ob.ownerId ? ownerById.get(ob.ownerId) ?? "Member" : "Unassigned"}
                  </td>
                  <td className={`px-5 py-4 font-semibold ${statusTone(ob.status)}`}>
                    {ob.status.replace("_", " ")}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">
                    {ob.dueDate
                      ? format(new Date(`${ob.dueDate}T12:00:00`), "MMM d, yyyy")
                      : "—"}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">
                    {ob.nextDueDate
                      ? format(new Date(`${ob.nextDueDate}T12:00:00`), "MMM d, yyyy")
                      : "—"}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">
                    {ob.escalationDueAt
                      ? `${format(new Date(ob.escalationDueAt), "MMM d, yyyy")} (${ob.escalationStatus ?? "pending"})`
                      : "—"}
                  </td>
                  <td className="px-5 py-4 text-zinc-500">
                    {format(new Date(ob.updatedAt), "MMM d")}
                  </td>
                  <td className="px-5 py-4">
                    <form action={createObligationClarificationTaskForm} className="space-y-1">
                      <input type="hidden" name="contractId" value={ob.contractId} />
                      <input type="hidden" name="obligationId" value={ob.id} />
                      <input
                        name="requesterNote"
                        placeholder="Clarification task note"
                        className="ui-input h-7 text-[11px]"
                      />
                      <button type="submit" className="ui-btn-secondary px-2 py-1 text-[11px]">
                        Clarification task
                      </button>
                    </form>
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
