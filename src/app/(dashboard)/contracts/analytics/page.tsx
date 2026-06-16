import { BarChart3 } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { normalizeAnalyticsScope } from "@/lib/analytics-scope";
import { parseBusinessDateAtNoon } from "@/lib/business-dates";
import { AnalyticsListCard } from "./analytics-list-card";
import { AnalyticsMetricSections, AnalyticsScopeForm } from "./analytics-page-sections";

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
      (parseBusinessDateAtNoon(String(o.due_date))?.getTime() ?? Number.POSITIVE_INFINITY) < now.getTime()
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
      <DashboardPageHeader
        icon={<BarChart3 className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Trends"
        title="Advanced analytics"
        lead="Contract velocity, task execution trendlines, and upcoming renewal concentration."
      />
      <AnalyticsScopeForm
        ownerFilter={ownerFilter}
        regionFilter={regionFilter}
        typeFilter={typeFilter}
        ownerOptions={ownerOptions}
        regionOptions={regionOptions}
        typeOptions={typeOptions}
      />

      <AnalyticsMetricSections
        overdueObligations={overdueObligations}
        pendingApprovals={pendingApprovals}
        avgApprovalDays={avgApprovalDays}
        avgCompleteness={avgCompleteness}
        unresolvedGaps={unresolvedGaps}
        weeklyOperators={behavior ? Number(behavior.weekly_active_operators ?? 0) : 0}
        reportRunsCount={reportRuns.length}
        failedReportRuns={failedReportRuns}
        recipientOpenRate={recipientOpenRate}
        deliveredRecipients={deliveredRecipients}
        roleCoverage={behavior ? Number(behavior.role_coverage_count ?? 0) : 0}
        tasksCompleted7d={behavior ? Number(behavior.tasks_completed_7d ?? 0) : 0}
        missedDatesPrevented7d={behavior ? Number(behavior.missed_dates_prevented_7d ?? 0) : 0}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <AnalyticsListCard eyebrow="Velocity" title="Contracts created by month" rows={contractRows} emptyLabel="No data yet." />
        <AnalyticsListCard eyebrow="Execution" title="Task completions by month" rows={taskRows} emptyLabel="No data yet." />
        <AnalyticsListCard eyebrow="Horizon" title="Renewal concentration (next 6m)" rows={renewalRows} emptyLabel="No upcoming renewals." />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <AnalyticsListCard eyebrow="Scoped trend" title={`Owner (${topOwner ?? "none"})`} rows={ownerTrendRows} emptyLabel="No trend data." />
        <AnalyticsListCard eyebrow="Scoped trend" title={`Region (${topRegion ?? "none"})`} rows={regionTrendRows} emptyLabel="No trend data." />
        <AnalyticsListCard eyebrow="Scoped trend" title={`Contract type (${topType ?? "none"})`} rows={typeTrendRows} emptyLabel="No trend data." />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <AnalyticsListCard eyebrow="Mix" title="Portfolio by owner" rows={ownerRows} emptyLabel="No data yet." truncateLabel />
        <AnalyticsListCard eyebrow="Mix" title="Portfolio by region" rows={regionRows} emptyLabel="No data yet." truncateLabel />
        <AnalyticsListCard eyebrow="Mix" title="Portfolio by contract type" rows={typeRows} emptyLabel="No data yet." truncateLabel />
      </div>
    </div>
  );
}
