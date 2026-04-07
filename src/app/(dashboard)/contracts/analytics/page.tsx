import { getAuthContext } from "@/lib/supabase/server";

function monthKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export default async function ContractAnalyticsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { admin, orgId } = ctx;
  const now = new Date();
  const oneYearAgoIso = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const sixMonthsOut = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  const [contractsRes, tasksRes, renewalsRes] = await Promise.all([
    admin
      .from("contracts")
      .select("id, created_at, status, intake_status")
      .eq("organization_id", orgId)
      .gte("created_at", oneYearAgoIso),
    admin
      .from("contract_tasks")
      .select("id, created_at, completed_at, status")
      .eq("organization_id", orgId)
      .gte("created_at", oneYearAgoIso),
    admin
      .from("contract_renewal_checkpoints")
      .select("id, due_date, status")
      .eq("organization_id", orgId)
      .gte("due_date", now.toISOString().slice(0, 10))
      .lte("due_date", sixMonthsOut.toISOString().slice(0, 10)),
  ]);
  const [obligationsRes, approvalsRes] = await Promise.all([
    admin
      .from("contract_obligations")
      .select("id, status, due_date")
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress", "done", "waived"]),
    admin
      .from("contract_approvals")
      .select("id, status, created_at, resolved_at")
      .eq("organization_id", orgId)
      .gte("created_at", oneYearAgoIso),
  ]);

  const monthlyContracts = new Map<string, number>();
  for (const row of contractsRes.data ?? []) {
    const key = monthKey(row.created_at);
    monthlyContracts.set(key, (monthlyContracts.get(key) ?? 0) + 1);
  }

  const monthlyTaskCompletion = new Map<string, number>();
  for (const row of tasksRes.data ?? []) {
    if (!row.completed_at) continue;
    const key = monthKey(row.completed_at);
    monthlyTaskCompletion.set(key, (monthlyTaskCompletion.get(key) ?? 0) + 1);
  }

  const renewalByMonth = new Map<string, number>();
  for (const row of renewalsRes.data ?? []) {
    const key = row.due_date.slice(0, 7);
    renewalByMonth.set(key, (renewalByMonth.get(key) ?? 0) + 1);
  }

  const contractRows = [...monthlyContracts.entries()].sort(([a], [b]) => a.localeCompare(b));
  const taskRows = [...monthlyTaskCompletion.entries()].sort(([a], [b]) => a.localeCompare(b));
  const renewalRows = [...renewalByMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
  const obligations = obligationsRes.data ?? [];
  const overdueObligations = obligations.filter(
    (o) =>
      (o.status === "open" || o.status === "in_progress") &&
      o.due_date &&
      new Date(`${o.due_date}T12:00:00`).getTime() < now.getTime()
  ).length;
  const pendingApprovals = (approvalsRes.data ?? []).filter((a) => a.status === "pending").length;
  const resolvedApprovals = (approvalsRes.data ?? []).filter(
    (a) => a.status !== "pending" && !!a.resolved_at
  );
  const avgApprovalDays =
    resolvedApprovals.length === 0
      ? 0
      : resolvedApprovals.reduce((sum, row) => {
          const created = new Date(row.created_at).getTime();
          const resolved = new Date(String(row.resolved_at)).getTime();
          return sum + Math.max(0, (resolved - created) / (1000 * 60 * 60 * 24));
        }, 0) / resolvedApprovals.length;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Trends</p>
        <h1 className="ui-display-title">Advanced analytics</h1>
        <p className="max-w-2xl text-[15px] text-zinc-500">
          Contract velocity, task execution trendlines, and upcoming renewal concentration.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="ui-card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Overdue obligations</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{overdueObligations}</p>
        </section>
        <section className="ui-card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Pending approvals</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{pendingApprovals}</p>
        </section>
        <section className="ui-card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Avg approval cycle</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {avgApprovalDays.toFixed(1)}d
          </p>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="ui-card overflow-hidden">
          <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-800">Contracts created by month</h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {contractRows.length === 0 ? (
              <li className="px-5 py-4 text-sm text-zinc-500">No data yet.</li>
            ) : (
              contractRows.map(([month, count]) => (
                <li key={month} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-zinc-600">{month}</span>
                  <span className="font-semibold text-zinc-900">{count}</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="ui-card overflow-hidden">
          <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-800">Task completions by month</h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {taskRows.length === 0 ? (
              <li className="px-5 py-4 text-sm text-zinc-500">No data yet.</li>
            ) : (
              taskRows.map(([month, count]) => (
                <li key={month} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-zinc-600">{month}</span>
                  <span className="font-semibold text-zinc-900">{count}</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="ui-card overflow-hidden">
          <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-800">Renewal concentration (next 6m)</h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {renewalRows.length === 0 ? (
              <li className="px-5 py-4 text-sm text-zinc-500">No upcoming renewals.</li>
            ) : (
              renewalRows.map(([month, count]) => (
                <li key={month} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-zinc-600">{month}</span>
                  <span className="font-semibold text-zinc-900">{count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
