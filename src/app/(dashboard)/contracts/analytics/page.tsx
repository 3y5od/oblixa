import {
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  Database,
  Eye,
  ListChecks,
  Percent,
  Shield,
  Stamp,
  Timer,
  Users,
} from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { normalizeAnalyticsScope } from "@/lib/analytics-scope";

function monthKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export default async function ContractAnalyticsPage(props: {
  searchParams: Promise<{ owner?: string; region?: string; type?: string }>;
}) {
  const { owner: ownerFilterRaw, region: regionFilterRaw, type: typeFilterRaw } = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { admin, orgId } = ctx;
  const now = new Date();
  const oneYearAgoIso = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const sixMonthsOut = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  const [contractsRes, tasksRes, renewalsRes] = await Promise.all([
    admin
      .from("contracts")
      .select("id, created_at, status, intake_status, owner_id, region, contract_type, health_status")
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
  const [obligationsRes, approvalsRes, reportRunsRes, reportRecipientsRes, qualityRes, behaviorRes] = await Promise.all([
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
    admin
      .from("report_runs")
      .select("id, report_mode, status, started_at, finished_at, metrics_json")
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false })
      .limit(50),
    admin
      .from("report_run_recipients")
      .select("id, delivery_status, opened_at, clicked_at, report_runs!inner(organization_id)")
      .eq("report_runs.organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("contract_data_quality_snapshots")
      .select("completeness_score, unresolved_gap_count:missing_critical_count")
      .eq("organization_id", orgId)
      .order("generated_at", { ascending: false })
      .limit(200),
    admin
      .from("org_behavior_metrics")
      .select(
        "metrics_date, weekly_active_operators, weekly_active_managers, report_opens, report_clicks, dashboard_revisits, role_coverage_count, tasks_completed_7d, approvals_resolved_7d, missed_dates_prevented_7d"
      )
      .eq("organization_id", orgId)
      .order("metrics_date", { ascending: false })
      .limit(1),
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
  const reportRuns = reportRunsRes.data ?? [];
  const failedReportRuns = reportRuns.filter((run) => run.status === "failed").length;
  const recipientEvents = reportRecipientsRes.data ?? [];
  const deliveredRecipients = recipientEvents.filter((row) =>
    ["delivered", "opened", "clicked"].includes(String(row.delivery_status))
  ).length;
  const openedRecipients = recipientEvents.filter((row) => !!row.opened_at).length;
  const recipientOpenRate = deliveredRecipients === 0 ? 0 : (openedRecipients / deliveredRecipients) * 100;
  const qualityRows = qualityRes.data ?? [];
  const avgCompleteness =
    qualityRows.length === 0
      ? 0
      : qualityRows.reduce((sum, row) => sum + Number(row.completeness_score ?? 0), 0) / qualityRows.length;
  const unresolvedGaps = qualityRows.reduce(
    (sum, row) => sum + Number(row.unresolved_gap_count ?? 0),
    0
  );
  const behavior = behaviorRes.data?.[0] ?? null;
  const contracts = contractsRes.data ?? [];
  const ownerOptions = [...new Set(contracts.map((r) => r.owner_id ?? "unassigned"))].sort((a, b) =>
    a.localeCompare(b)
  );
  const regionOptions = [...new Set(contracts.map((r) => r.region ?? "unspecified"))].sort((a, b) =>
    a.localeCompare(b)
  );
  const typeOptions = [...new Set(contracts.map((r) => r.contract_type ?? "unspecified"))].sort((a, b) =>
    a.localeCompare(b)
  );
  const { ownerFilter, regionFilter, typeFilter } = normalizeAnalyticsScope({
    ownerRaw: ownerFilterRaw,
    regionRaw: regionFilterRaw,
    typeRaw: typeFilterRaw,
    ownerOptions,
    regionOptions,
    typeOptions,
  });
  const scopedContracts = contracts.filter((row) => {
    const ownerMatches = ownerFilter === "all" || (row.owner_id ?? "unassigned") === ownerFilter;
    const regionMatches = regionFilter === "all" || (row.region ?? "unspecified") === regionFilter;
    const typeMatches = typeFilter === "all" || (row.contract_type ?? "unspecified") === typeFilter;
    return ownerMatches && regionMatches && typeMatches;
  });
  const byOwner = new Map<string, number>();
  const byRegion = new Map<string, number>();
  const byType = new Map<string, number>();
  for (const row of scopedContracts) {
    const ownerKey = row.owner_id ?? "unassigned";
    byOwner.set(ownerKey, (byOwner.get(ownerKey) ?? 0) + 1);
    const regionKey = row.region ?? "unspecified";
    byRegion.set(regionKey, (byRegion.get(regionKey) ?? 0) + 1);
    const typeKey = row.contract_type ?? "unspecified";
    byType.set(typeKey, (byType.get(typeKey) ?? 0) + 1);
  }
  const ownerRows = [...byOwner.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const regionRows = [...byRegion.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const typeRows = [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topOwner = ownerRows[0]?.[0] ?? null;
  const topRegion = regionRows[0]?.[0] ?? null;
  const topType = typeRows[0]?.[0] ?? null;
  const ownerTrend = new Map<string, number>();
  const regionTrend = new Map<string, number>();
  const typeTrend = new Map<string, number>();
  for (const row of scopedContracts) {
    const month = monthKey(row.created_at);
    if (topOwner && (row.owner_id ?? "unassigned") === topOwner) {
      ownerTrend.set(month, (ownerTrend.get(month) ?? 0) + 1);
    }
    if (topRegion && (row.region ?? "unspecified") === topRegion) {
      regionTrend.set(month, (regionTrend.get(month) ?? 0) + 1);
    }
    if (topType && (row.contract_type ?? "unspecified") === topType) {
      typeTrend.set(month, (typeTrend.get(month) ?? 0) + 1);
    }
  }
  const ownerTrendRows = [...ownerTrend.entries()].sort(([a], [b]) => a.localeCompare(b));
  const regionTrendRows = [...regionTrend.entries()].sort(([a], [b]) => a.localeCompare(b));
  const typeTrendRows = [...typeTrend.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Trends</p>
        <h1 className="ui-display-title">Advanced analytics</h1>
        <p className="max-w-2xl text-[15px] text-zinc-500">
          Contract velocity, task execution trendlines, and upcoming renewal concentration.
        </p>
      </header>
      <section className="ui-card p-4">
        <form action="/contracts/analytics" method="get" className="grid gap-2 sm:grid-cols-3">
          <select name="owner" defaultValue={ownerFilter} className="ui-input">
            <option value="all">Owner: all</option>
            {ownerOptions.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
          <select name="region" defaultValue={regionFilter} className="ui-input">
            <option value="all">Region: all</option>
            {regionOptions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
          <select name="type" defaultValue={typeFilter} className="ui-input">
            <option value="all">Type: all</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <button type="submit" className="ui-btn-secondary px-4 py-2 text-xs sm:col-span-3">
            Apply trend scope
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Execution</p>
          <h2 className="ui-section-title mt-2 text-xl">Workflow pressure</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <OperationalSummaryCard
            eyebrow="Obligations"
            headline="Overdue"
            tone={overdueObligations > 0 ? "risk" : "healthy"}
            icon={ListChecks}
            primaryValue={overdueObligations}
            primaryUnit="open or in progress"
            action={{ href: "/contracts/obligations", label: "View obligations" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Approvals"
            headline="Pending"
            tone={pendingApprovals > 0 ? "attention" : "healthy"}
            icon={Stamp}
            primaryValue={pendingApprovals}
            primaryUnit="awaiting resolution"
            action={{ href: "/contracts/approvals", label: "View approvals" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Cycle time"
            headline="Avg approval duration"
            tone="neutral"
            icon={Timer}
            primaryValue={`${avgApprovalDays.toFixed(1)}d`}
            primaryUnit="resolved samples"
            action={{ href: "/contracts/approvals", label: "Review queue" }}
            variant="compact"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Quality</p>
          <h2 className="ui-section-title mt-2 text-xl">Data and adoption</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <OperationalSummaryCard
            eyebrow="Snapshots"
            headline="Avg completeness"
            tone={avgCompleteness < 70 ? "attention" : "healthy"}
            icon={Percent}
            primaryValue={`${avgCompleteness.toFixed(1)}%`}
            primaryUnit="latest samples"
            action={{ href: "/contracts/data-quality", label: "Open data quality" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Gaps"
            headline="Unresolved gaps"
            tone={unresolvedGaps > 0 ? "attention" : "healthy"}
            icon={Database}
            primaryValue={unresolvedGaps}
            primaryUnit="across snapshots"
            action={{ href: "/contracts/data-quality", label: "Review gaps" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Adoption"
            headline="Weekly operators"
            tone="neutral"
            icon={Users}
            primaryValue={behavior ? Number(behavior.weekly_active_operators ?? 0) : 0}
            primaryUnit="from behavior feed"
            action={{ href: "/reports", label: "View reports hub" }}
            variant="compact"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Reporting</p>
          <h2 className="ui-section-title mt-2 text-xl">Digest health</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <OperationalSummaryCard
            eyebrow="Runs"
            headline="Digest executions"
            tone="neutral"
            icon={CalendarClock}
            primaryValue={reportRuns.length}
            primaryUnit="recent sample"
            action={{ href: "/contracts/reports", label: "Open report history" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Reliability"
            headline="Failed runs"
            tone={failedReportRuns > 0 ? "attention" : "healthy"}
            icon={AlertTriangle}
            primaryValue={failedReportRuns}
            primaryUnit="in sample"
            action={{ href: "/contracts/reports", label: "Inspect failures" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Engagement"
            headline="Open rate"
            tone={recipientOpenRate < 40 && deliveredRecipients > 0 ? "attention" : "neutral"}
            icon={Eye}
            primaryValue={`${recipientOpenRate.toFixed(1)}%`}
            primaryUnit="opens / delivered"
            action={{ href: "/contracts/reports", label: "Review recipients" }}
            variant="compact"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Outcomes</p>
          <h2 className="ui-section-title mt-2 text-xl">Weekly operating metrics</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <OperationalSummaryCard
            eyebrow="Coverage"
            headline="Role coverage"
            tone="neutral"
            icon={Shield}
            primaryValue={behavior ? Number(behavior.role_coverage_count ?? 0) : 0}
            primaryUnit="tracked seats"
            action={{ href: "/settings/operations", label: "Workspace operations" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Throughput"
            headline="Tasks completed"
            tone="healthy"
            icon={CheckSquare}
            primaryValue={behavior ? Number(behavior.tasks_completed_7d ?? 0) : 0}
            primaryUnit="last 7 days"
            action={{ href: "/contracts/tasks", label: "View tasks" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Prevention"
            headline="Missed dates prevented"
            tone="healthy"
            icon={CalendarClock}
            primaryValue={behavior ? Number(behavior.missed_dates_prevented_7d ?? 0) : 0}
            primaryUnit="last 7 days"
            action={{ href: "/contracts/renewals", label: "View renewals" }}
            variant="compact"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="ui-card overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] bg-zinc-50/60 px-5 py-3">
            <p className="ui-eyebrow">Velocity</p>
            <h2 className="ui-section-title mt-1 text-base">Contracts created by month</h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
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
          <div className="border-b border-[var(--border-subtle)] bg-zinc-50/60 px-5 py-3">
            <p className="ui-eyebrow">Execution</p>
            <h2 className="ui-section-title mt-1 text-base">Task completions by month</h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
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
          <div className="border-b border-[var(--border-subtle)] bg-zinc-50/60 px-5 py-3">
            <p className="ui-eyebrow">Horizon</p>
            <h2 className="ui-section-title mt-1 text-base">Renewal concentration (next 6m)</h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
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

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="ui-card overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] bg-zinc-50/60 px-5 py-3">
            <p className="ui-eyebrow">Scoped trend</p>
            <h2 className="ui-section-title mt-1 text-base">Owner ({topOwner ?? "none"})</h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {ownerTrendRows.length === 0 ? (
              <li className="px-5 py-4 text-sm text-zinc-500">No trend data.</li>
            ) : (
              ownerTrendRows.map(([month, count]) => (
                <li key={month} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-zinc-600">{month}</span>
                  <span className="font-semibold text-zinc-900">{count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="ui-card overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] bg-zinc-50/60 px-5 py-3">
            <p className="ui-eyebrow">Scoped trend</p>
            <h2 className="ui-section-title mt-1 text-base">Region ({topRegion ?? "none"})</h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {regionTrendRows.length === 0 ? (
              <li className="px-5 py-4 text-sm text-zinc-500">No trend data.</li>
            ) : (
              regionTrendRows.map(([month, count]) => (
                <li key={month} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-zinc-600">{month}</span>
                  <span className="font-semibold text-zinc-900">{count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="ui-card overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] bg-zinc-50/60 px-5 py-3">
            <p className="ui-eyebrow">Scoped trend</p>
            <h2 className="ui-section-title mt-1 text-base">Contract type ({topType ?? "none"})</h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {typeTrendRows.length === 0 ? (
              <li className="px-5 py-4 text-sm text-zinc-500">No trend data.</li>
            ) : (
              typeTrendRows.map(([month, count]) => (
                <li key={month} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-zinc-600">{month}</span>
                  <span className="font-semibold text-zinc-900">{count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="ui-card overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] bg-zinc-50/60 px-5 py-3">
            <p className="ui-eyebrow">Mix</p>
            <h2 className="ui-section-title mt-1 text-base">Portfolio by owner</h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {ownerRows.length === 0 ? (
              <li className="px-5 py-4 text-sm text-zinc-500">No data yet.</li>
            ) : (
              ownerRows.map(([owner, count]) => (
                <li key={owner} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="truncate text-zinc-600">{owner}</span>
                  <span className="font-semibold text-zinc-900">{count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="ui-card overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] bg-zinc-50/60 px-5 py-3">
            <p className="ui-eyebrow">Mix</p>
            <h2 className="ui-section-title mt-1 text-base">Portfolio by region</h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {regionRows.length === 0 ? (
              <li className="px-5 py-4 text-sm text-zinc-500">No data yet.</li>
            ) : (
              regionRows.map(([region, count]) => (
                <li key={region} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="truncate text-zinc-600">{region}</span>
                  <span className="font-semibold text-zinc-900">{count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="ui-card overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] bg-zinc-50/60 px-5 py-3">
            <p className="ui-eyebrow">Mix</p>
            <h2 className="ui-section-title mt-1 text-base">Portfolio by contract type</h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {typeRows.length === 0 ? (
              <li className="px-5 py-4 text-sm text-zinc-500">No data yet.</li>
            ) : (
              typeRows.map(([type, count]) => (
                <li key={type} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="truncate text-zinc-600">{type}</span>
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
