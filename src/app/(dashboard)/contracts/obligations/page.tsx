import Link from "next/link";
import { format } from "date-fns";
import { getAuthContext } from "@/lib/supabase/server";
import { createSavedView, deleteSavedView, setSavedViewWeeklySummary } from "@/actions/saved-views";
import { createObligationClarificationTaskForm } from "@/actions/tasks";

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
  if (!ctx) return null;
  const { admin, orgId, user } = ctx;

  const query = admin
    .from("contract_obligations")
    .select(
      "id, title, obligation_type, cadence, due_date, status, owner_id, updated_at, contracts!inner(id, title, organization_id)"
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
    const q = (v.query_json ?? {}) as Record<string, string | undefined>;
    const params = new URLSearchParams();
    if (q.status) params.set("status", q.status);
    if (q.mine) params.set("mine", q.mine);
    const qs = params.toString();
    return {
      id: v.id,
      name: v.name,
      href: qs ? `/contracts/obligations?${qs}` : "/contracts/obligations",
      weeklyActive: weeklyByViewId.get(v.id) ?? false,
    };
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-zinc-200/60 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ui-eyebrow">Portfolio commitments</p>
          <h1 className="ui-display-title mt-2">Obligations queue</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
            Operational commitments that are not just reminder dates.
          </p>
        </div>
        <Link href="/contracts" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
          Back to contracts
        </Link>
      </header>

      <div className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] md:p-6">
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
          <label className="inline-flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              name="mine"
              value="1"
              defaultChecked={onlyMine}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Owned by me
          </label>
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
        <div className="ui-card px-8 py-14 text-center">
          <h2 className="ui-section-title text-base">No obligations match this view</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Create obligations from contract detail pages and use filters to track execution.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50/70 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              <tr>
                <th className="px-5 py-3">Obligation</th>
                <th className="px-5 py-3">Contract</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3">Updated</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {obligations.map((ob) => (
                <tr key={ob.id}>
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
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <Link href={`/contracts/${ob.contractId}`} className="ui-link">
                      {ob.contractTitle}
                    </Link>
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
