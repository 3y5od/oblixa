import Link from "next/link";
import { format, differenceInDays } from "date-fns";
import { getAuthContext } from "@/lib/supabase/server";
import { seedRenewalPlaybook } from "@/actions/renewal-playbook";
import { createCheckpointClarificationTaskForm } from "@/actions/tasks";
import { createSavedView, deleteSavedView, setSavedViewWeeklySummary } from "@/actions/saved-views";
import {
  getContractIdsForDeadlinePreset,
  type DeadlinePreset,
} from "@/lib/contract-filters";

const HORIZON_OPTIONS: { value: DeadlinePreset; label: string }[] = [
  { value: "renewal_30", label: "Renewal <= 30d" },
  { value: "renewal_90", label: "Renewal <= 90d" },
  { value: "renewal_180", label: "Renewal <= 180d" },
  { value: "renewal_365", label: "Renewal <= 365d" },
  { value: "end_30", label: "End date <= 30d" },
  { value: "end_90", label: "End date <= 90d" },
  { value: "end_180", label: "End date <= 180d" },
  { value: "end_365", label: "End date <= 365d" },
  { value: "notice_deadline_30", label: "Notice deadline <= 30d" },
  { value: "notice_deadline_90", label: "Notice deadline <= 90d" },
  { value: "notice_deadline_180", label: "Notice deadline <= 180d" },
  { value: "notice_deadline_365", label: "Notice deadline <= 365d" },
];

function urgency(days: number): string {
  if (days <= 7) return "text-rose-700";
  if (days <= 30) return "text-amber-700";
  return "text-zinc-600";
}

export default async function RenewalsWorkspacePage(props: {
  searchParams: Promise<{ horizon?: string }>;
}) {
  const { horizon: horizonRaw } = await props.searchParams;
  const horizon = (HORIZON_OPTIONS.find((o) => o.value === horizonRaw)?.value ??
    "renewal_90") as DeadlinePreset;

  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { admin, orgId } = ctx;

  const candidateIds = (await getContractIdsForDeadlinePreset(admin, orgId, horizon)) ?? [];
  const { data: contractsData } =
    candidateIds.length === 0
      ? { data: [] as Array<Record<string, unknown>> }
      : await admin
          .from("contracts")
          .select("id, title, counterparty, status, annual_value")
          .eq("organization_id", orgId)
          .in("id", candidateIds);

  const { data: fieldsData } = await admin
    .from("extracted_fields")
    .select("contract_id, field_name, field_value")
    .eq("status", "approved")
    .in("contract_id", candidateIds)
    .in("field_name", ["renewal_date", "end_date"]);

  const byContract = new Map<string, { renewalDate?: string; endDate?: string }>();
  for (const row of fieldsData ?? []) {
    const cur = byContract.get(row.contract_id) ?? {};
    if (row.field_name === "renewal_date") cur.renewalDate = row.field_value ?? undefined;
    if (row.field_name === "end_date") cur.endDate = row.field_value ?? undefined;
    byContract.set(row.contract_id, cur);
  }
  const { data: savedViewsData } = await admin
    .from("saved_views")
    .select("id, name, query_json")
    .eq("organization_id", orgId)
    .eq("user_id", ctx.user.id)
    .eq("view_type", "renewals")
    .order("created_at", { ascending: true });
  const savedViewIds = (savedViewsData ?? []).map((v) => v.id);
  const { data: subscriptionsData } =
    savedViewIds.length === 0
      ? { data: [] as Array<{ saved_view_id: string; active: boolean }> }
      : await admin
          .from("report_subscriptions")
          .select("saved_view_id, active")
          .eq("user_id", ctx.user.id)
          .eq("frequency", "weekly")
          .in("saved_view_id", savedViewIds);
  const weeklyByViewId = new Map((subscriptionsData ?? []).map((s) => [s.saved_view_id, Boolean(s.active)]));

  const today = new Date();
  const { data: checkpointStatsData } =
    candidateIds.length === 0
      ? { data: [] as Array<Record<string, unknown>> }
      : await admin
          .from("contract_renewal_checkpoints")
          .select("id, contract_id, status, due_date")
          .in("contract_id", candidateIds);

  const checkpointStats = new Map<
    string,
    { total: number; completed: number; pendingCheckpointId: string | null; nextDue: string | null }
  >();
  for (const row of checkpointStatsData ?? []) {
    const cur = checkpointStats.get(row.contract_id as string) ?? {
      total: 0,
      completed: 0,
      pendingCheckpointId: null,
      nextDue: null,
    };
    cur.total += 1;
    if ((row.status as string) === "completed") cur.completed += 1;
    if ((row.status as string) === "pending") {
      if (!cur.nextDue || String(row.due_date) < cur.nextDue) {
        cur.nextDue = String(row.due_date);
        cur.pendingCheckpointId = String(row.id);
      }
    }
    checkpointStats.set(row.contract_id as string, cur);
  }

  const rows = (contractsData ?? [])
    .map((row) => {
      const dates = byContract.get(row.id as string) ?? {};
      const keyDateRaw = dates.renewalDate || dates.endDate;
      const keyDate = keyDateRaw ? new Date(`${keyDateRaw}T12:00:00`) : null;
      const daysUntil = keyDate ? differenceInDays(keyDate, today) : null;
      const stats = checkpointStats.get(row.id as string) ?? {
        total: 0,
        completed: 0,
        pendingCheckpointId: null,
        nextDue: null,
      };
      return {
        id: row.id as string,
        title: row.title as string,
        counterparty: (row.counterparty as string | null) ?? "",
        status: row.status as string,
        annualValue: (row.annual_value as number | null) ?? null,
        keyDateRaw,
        daysUntil,
        checkpointTotal: stats.total,
        checkpointCompleted: stats.completed,
        pendingCheckpointId: stats.pendingCheckpointId,
        playbookRecommendation:
          stats.total === 0
            ? "Seed a baseline playbook"
            : daysUntil != null && daysUntil <= 30
              ? "Escalate final approvals and send action"
              : stats.completed / Math.max(1, stats.total) < 0.5
                ? "Complete strategic checkpoints"
                : "Drive remaining checkpoints to completion",
      };
    })
    .sort((a, b) => {
      if (a.daysUntil == null && b.daysUntil == null) return 0;
      if (a.daysUntil == null) return 1;
      if (b.daysUntil == null) return -1;
      if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
      return (b.annualValue ?? 0) - (a.annualValue ?? 0);
    });
  const totalExposure = rows.reduce((sum, row) => sum + (row.annualValue ?? 0), 0);
  const savedViews = (savedViewsData ?? []).map((v) => {
    const q = (v.query_json ?? {}) as Record<string, string | undefined>;
    const params = new URLSearchParams();
    if (q.deadline) params.set("horizon", q.deadline);
    const qs = params.toString();
    return {
      id: v.id,
      name: v.name,
      href: qs ? `/contracts/renewals?${qs}` : "/contracts/renewals",
      weeklyActive: weeklyByViewId.get(v.id) ?? false,
    };
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-zinc-200/60 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ui-eyebrow">Renewal preparation</p>
          <h1 className="ui-display-title mt-2">Renewals workspace</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
            Plan renewals and notice decisions from a focused horizon-based queue.
          </p>
        </div>
        <Link href="/contracts/tasks" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
          Open task queue
        </Link>
      </header>

      <div className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] md:p-6">
        <p className="mb-4 text-xs text-zinc-500">
          Queue exposure in horizon:{" "}
          <span className="font-semibold text-zinc-800">${totalExposure.toLocaleString()}</span>
        </p>
        <form className="flex flex-wrap items-end gap-3" action="/contracts/renewals" method="get">
          <div>
            <label htmlFor="renewal-horizon" className="ui-label-caps">
              Horizon
            </label>
            <select
              id="renewal-horizon"
              name="horizon"
              defaultValue={horizon}
              className="ui-input min-w-[16rem]"
            >
              {HORIZON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="ui-btn-primary px-5 py-2.5 text-[13px]">
            Apply horizon
          </button>
        </form>
        <div className="mt-5 border-t border-zinc-100 pt-5">
          <form action={createSavedView} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="organizationId" value={orgId} />
            <input type="hidden" name="viewType" value="renewals" />
            <input type="hidden" name="deadline" value={horizon} />
            <div>
              <label htmlFor="renewal-view-name" className="ui-label-caps">
                Save renewal view
              </label>
              <input id="renewal-view-name" name="name" required className="ui-input min-w-[14rem]" />
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

      {rows.length === 0 ? (
        <div className="ui-card px-8 py-14 text-center">
          <h2 className="ui-section-title text-base">No contracts in this horizon</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Widen the horizon or approve more date fields to populate this workspace.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50/70 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              <tr>
                <th className="px-5 py-3">Contract</th>
                <th className="px-5 py-3">Counterparty</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Key date</th>
                <th className="px-5 py-3">Countdown</th>
                <th className="px-5 py-3">Annual value</th>
                <th className="px-5 py-3">Playbook</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-4 font-semibold text-zinc-900">
                    <Link href={`/contracts/${row.id}`} className="ui-link">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-zinc-600">{row.counterparty || "—"}</td>
                  <td className="px-5 py-4 text-zinc-600">{row.status}</td>
                  <td className="px-5 py-4 text-zinc-600">
                    {row.keyDateRaw
                      ? format(new Date(`${row.keyDateRaw}T12:00:00`), "MMM d, yyyy")
                      : "—"}
                  </td>
                  <td className={`px-5 py-4 font-semibold ${row.daysUntil == null ? "text-zinc-500" : urgency(row.daysUntil)}`}>
                    {row.daysUntil == null
                      ? "—"
                      : row.daysUntil <= 0
                        ? "Due now"
                        : `${row.daysUntil} days`}
                  </td>
                  <td className="px-5 py-4 text-zinc-700">
                    {row.annualValue == null ? "—" : `$${row.annualValue.toLocaleString()}`}
                  </td>
                  <td className="px-5 py-4">
                    {row.checkpointTotal > 0 ? (
                      <div className="space-y-2">
                        <div className="text-xs text-zinc-600">
                          {row.checkpointCompleted}/{row.checkpointTotal} complete
                        </div>
                        <p className="text-[11px] text-zinc-500">{row.playbookRecommendation}</p>
                        {row.pendingCheckpointId ? (
                          <form action={createCheckpointClarificationTaskForm} className="space-y-1">
                            <input type="hidden" name="contractId" value={row.id} />
                            <input
                              type="hidden"
                              name="checkpointId"
                              value={row.pendingCheckpointId}
                            />
                            <input
                              name="requesterNote"
                              placeholder="Clarification request"
                              className="ui-input h-7 text-[11px]"
                            />
                            <button type="submit" className="ui-btn-secondary px-2 py-1 text-[11px]">
                              Create clarification task
                            </button>
                          </form>
                        ) : (
                          <p className="text-[11px] text-zinc-500">No pending checkpoint</p>
                        )}
                      </div>
                    ) : (
                      <form action={seedRenewalPlaybook.bind(null, row.id)}>
                        <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                          Seed playbook
                        </button>
                      </form>
                    )}
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
