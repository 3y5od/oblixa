import Link from "next/link";
import { AlertTriangle, CalendarDays, Inbox, Stamp } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
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
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <p className="ui-eyebrow">Management ritual</p>
        <h1 className="ui-display-title">Weekly and monthly review mode</h1>
        <p className="ui-page-lead max-w-2xl">
          Centralized cadence view for intake movement, unresolved exceptions, near-term renewals, and pending decisions.
        </p>
      </header>

      <div className="ui-toolbar w-full items-stretch gap-3 sm:w-auto sm:items-center">
        <a href="/api/export/review-packet" className="ui-btn-secondary px-4 py-2 text-[13px]">
          Export review packet
        </a>
        <Link href="/contracts/analytics" className="ui-btn-secondary px-4 py-2 text-[13px]">
          Review analytics
        </Link>
      </div>
      <p className="ui-support-copy max-w-2xl text-[13px]">
        The CSV summarizes pending approvals, renewal checkpoints, and data gaps for cadence reviews.
      </p>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Cadence</p>
          <h2 className="ui-section-title mt-2 text-xl">Review posture</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <OperationalSummaryCard
            eyebrow="Intake"
            headline="New this month"
            tone="neutral"
            icon={Inbox}
            primaryValue={monthly.intake}
            primaryUnit="from weekly window"
            action={{ href: "/contracts/intake", label: "Start intake" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Exceptions"
            headline="Critical gaps"
            tone={monthly.exceptions > 0 ? "attention" : "healthy"}
            icon={AlertTriangle}
            primaryValue={monthly.exceptions}
            primaryUnit="contracts"
            action={{ href: "/contracts/exceptions", label: "Triage exceptions" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Approvals"
            headline="Pending approvals"
            tone={monthly.pendingApprovals > 0 ? "attention" : "healthy"}
            icon={Stamp}
            primaryValue={monthly.pendingApprovals}
            primaryUnit="in queue"
            action={{ href: "/contracts/approvals", label: "Review approvals" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Renewals"
            headline="Upcoming checkpoints"
            tone={monthly.renewals90d > 0 ? "neutral" : "healthy"}
            icon={CalendarDays}
            primaryValue={monthly.renewals90d}
            primaryUnit={`within ${renewalHorizonDays}d`}
            action={{ href: "/contracts/renewals", label: "Review renewals" }}
            variant="compact"
          />
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-5 py-3">
          <p className="ui-eyebrow">Agenda</p>
          <h2 className="ui-section-title mt-1 text-base">Weekly intake and decisions</h2>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {(newIntake ?? []).slice(0, 10).map((row) => (
            <li key={`intake-${row.id}`} className="px-5 py-3 text-sm">
              <Link href={`/contracts/${row.id}`} className="ui-link">
                {row.title}
              </Link>
              <span className="text-[var(--text-tertiary)]"> · {row.intake_status}</span>
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
                <span className="text-[var(--text-tertiary)]"> · pending {row.approval_type.replace(/_/g, " ")}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
