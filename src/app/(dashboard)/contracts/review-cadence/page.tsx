import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import { getContractsMissingCriticalFields } from "@/lib/missing-critical-fields";

export default async function ReviewCadencePage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { admin, orgId } = ctx;
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const { data: workflowSettings } = await admin
    .from("organization_workflow_settings")
    .select("weekly_intake_lookback_days, renewal_horizon_days")
    .eq("organization_id", orgId)
    .maybeSingle();
  const intakeLookbackDays = Math.max(
    1,
    Number(workflowSettings?.weekly_intake_lookback_days ?? 7)
  );
  const renewalHorizonDays = Math.max(
    30,
    Number(workflowSettings?.renewal_horizon_days ?? 90)
  );
  const intakeLookbackIso = new Date(
    now.getTime() - intakeLookbackDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const renewalHorizonIso = new Date(
    now.getTime() + renewalHorizonDays * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const [newIntake, exceptions, upcoming, pendingDecisions] = await Promise.all([
    admin
      .from("contracts")
      .select("id, title, intake_status, created_at")
      .eq("organization_id", orgId)
      .gte("created_at", intakeLookbackIso)
      .order("created_at", { ascending: false })
      .limit(20)
      .then((r) => r.data ?? []),
    getContractsMissingCriticalFields(admin, orgId),
    admin
      .from("contract_renewal_checkpoints")
      .select("id, contract_id, label, due_date, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .gte("due_date", todayIso)
      .lte("due_date", renewalHorizonIso)
      .order("due_date", { ascending: true })
      .limit(30)
      .then((r) => r.data ?? []),
    admin
      .from("contract_approvals")
      .select("id, contract_id, approval_type, created_at, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(30)
      .then((r) => r.data ?? []),
  ]);

  const monthly = {
    intake: (newIntake ?? []).filter((c) => new Date(c.created_at) >= firstOfMonth).length,
    exceptions: exceptions.length,
    pendingApprovals: pendingDecisions.length,
    renewals90d: upcoming.length,
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Management ritual</p>
        <h1 className="ui-display-title">Weekly and monthly review mode</h1>
        <p className="max-w-2xl text-[15px] text-zinc-500">
          Centralized cadence view for intake movement, unresolved exceptions, near-term renewals, and pending decisions.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <a href="/api/export/review-packet" className="ui-btn-secondary px-4 py-2 text-[13px]">
          Export review packet
        </a>
        <Link href="/contracts/analytics" className="ui-btn-secondary px-4 py-2 text-[13px]">
          Open analytics
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="ui-card p-4">
          <p className="ui-label-caps">Monthly intake</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{monthly.intake}</p>
        </div>
        <div className="ui-card p-4">
          <p className="ui-label-caps">Open exceptions</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{monthly.exceptions}</p>
        </div>
        <div className="ui-card p-4">
          <p className="ui-label-caps">Pending approvals</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{monthly.pendingApprovals}</p>
        </div>
        <div className="ui-card p-4">
          <p className="ui-label-caps">Renewals ({renewalHorizonDays}d)</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{monthly.renewals90d}</p>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-800">Weekly intake and decisions</h2>
        </div>
        <ul className="divide-y divide-zinc-100">
          {(newIntake ?? []).slice(0, 10).map((row) => (
            <li key={`intake-${row.id}`} className="px-5 py-3 text-sm">
              <Link href={`/contracts/${row.id}`} className="ui-link">
                {row.title}
              </Link>
              <span className="text-zinc-500"> · {row.intake_status}</span>
            </li>
          ))}
          {(pendingDecisions ?? []).slice(0, 10).map((row) => {
            const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
              | { id: string; title: string }
              | undefined;
            return (
              <li key={`approval-${row.id}`} className="px-5 py-3 text-sm">
                <Link href={`/contracts/${contract?.id ?? row.contract_id}`} className="ui-link">
                  {contract?.title ?? "Contract"}
                </Link>
                <span className="text-zinc-500"> · pending {row.approval_type.replace(/_/g, " ")}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
