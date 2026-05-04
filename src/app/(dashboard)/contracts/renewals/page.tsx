import Link from "next/link";
import { differenceInDays } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  DollarSign,
  GitBranch,
  Inbox,
  ListFilter,
  MessageSquare,
  Pin,
  Save,
  ShieldAlert,
} from "lucide-react";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { getAuthContext } from "@/lib/supabase/server";
import { SlackRenewalSummaryForm } from "@/components/v4/slack-renewal-summary-form";
import { RenewalRowChecklistActions } from "@/components/contracts/renewal-row-checklist-actions";
import { OperationalMetricChip, OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import {
  createSavedView,
  deleteSavedView,
  setSavedViewPinned,
  setSavedViewWeeklySummary,
} from "@/actions/saved-views";
import {
  getContractIdsForDeadlinePreset,
  type DeadlinePreset,
} from "@/lib/contract-filters";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import type { WorkspaceRole } from "@/lib/navigation";
import {
  isAdvancedModuleHidden,
  loadProductSurfaceContext,
  resolveWorkflowDestination,
} from "@/lib/product-surface";
import { compareRenewalQueueRows, getRenewalNextAction } from "@/lib/renewal-next-action";
import { EVIDENCE_GAP_STATUSES } from "@/lib/evidence-status";
import { v9DisplayOrUnknown } from "@/lib/v9-sparse-records";
import { attachOwnerProfiles, STATUS_LABELS } from "@/lib/contracts";
import { formatBusinessDateAtNoon } from "@/lib/v9-business-dates";
import type { OperationalTone } from "@/lib/ui/operational-surface";

export const metadata = { title: "Renewals" };

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
  return "text-[var(--text-secondary)]";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatCountdown(daysUntil: number | null): string {
  if (daysUntil == null) return "No approved date";
  if (daysUntil <= 0) return "Due now";
  return pluralize(daysUntil, "day");
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status.replace(/_/g, " ");
}

function workspaceLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function workspaceStatus(status: string): SemanticStatus {
  if (status === "approved" || status === "completed" || status === "ready") return "healthy";
  if (status === "blocked") return "blocked";
  if (status === "in_review" || status === "decision_pending") return "in_review";
  if (status === "not_started") return "empty";
  return "info";
}

function metricTone(value: number, warningAt: number, riskAt: number): OperationalTone {
  if (value >= riskAt) return "risk";
  if (value >= warningAt) return "attention";
  return "healthy";
}

function checklistTone(coverage: number, contractsWithoutChecklist: number): OperationalTone {
  if (contractsWithoutChecklist > 0 || coverage < 50) return "risk";
  if (coverage < 80) return "attention";
  return "healthy";
}

export default async function RenewalsWorkspacePage(props: { searchParams: Promise<{ horizon?: string }> }) {
  const { horizon: horizonRaw } = await props.searchParams;
  const horizon = (HORIZON_OPTIONS.find((o) => o.value === horizonRaw)?.value ??
    "renewal_90") as DeadlinePreset;

  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const { admin, orgId } = ctx;

  const productSurface = await loadProductSurfaceContext(
    admin,
    orgId,
    ctx.role as WorkspaceRole
  );
  const renewalsDestination = resolveWorkflowDestination(productSurface, "renewals");
  const renewalsCopy = renewalsDestination?.visible ? renewalsDestination.copy : null;
  const showDecisionsCta =
    (productSurface.mode === "advanced" || productSurface.mode === "assurance") &&
    !isAdvancedModuleHidden(productSurface, "decisions");
  const showSlackRenewalSummary =
    productSurface.mode === "advanced" || productSurface.mode === "assurance";

  const candidateIds = (await getContractIdsForDeadlinePreset(admin, orgId, horizon)) ?? [];
  const { data: contractsData } =
    candidateIds.length === 0
      ? { data: [] as Array<Record<string, unknown>> }
      : await admin
          .from("contracts")
          .select("id, title, counterparty, status, annual_value, owner_id")
          .eq("organization_id", orgId)
          .in("id", candidateIds);
  const contractsWithOwners =
    contractsData && contractsData.length > 0
      ? await attachOwnerProfiles(
          admin,
          orgId,
          contractsData as Array<{
            id: string;
            title: string;
            counterparty: string | null;
            status: string;
            annual_value: number | null;
            owner_id: string | null;
          }>
        )
      : [];

  const { data: fieldsData } =
    candidateIds.length === 0
      ? { data: [] as Array<{ contract_id: string; field_name: string; field_value: string | null }> }
      : await admin
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
  const weeklyByViewId = new Map(
    (subscriptionsData ?? []).map((s) => [s.saved_view_id, Boolean(s.active)])
  );

  const today = new Date();
  const { data: checkpointStatsData } =
    candidateIds.length === 0
      ? { data: [] as Array<Record<string, unknown>> }
      : await admin
          .from("contract_renewal_checkpoints")
          .select("id, contract_id, status, due_date")
          .in("contract_id", candidateIds);
  const { data: scenariosData } =
    candidateIds.length === 0
      ? { data: [] as Array<Record<string, unknown>> }
      : await admin
          .from("contract_renewal_scenarios")
          .select(
            "id, contract_id, workspace_status, target_decision_date, escalation_date, scenario_confidence, blocker"
          )
          .in("contract_id", candidateIds);
  const [{ data: exceptionRows }, { data: evidenceRows }] =
    candidateIds.length === 0
      ? [
          { data: [] as Array<Record<string, unknown>> },
          { data: [] as Array<Record<string, unknown>> },
        ]
      : await Promise.all([
          admin
            .from("exceptions")
            .select("contract_id, status")
            .eq("organization_id", orgId)
            .in("contract_id", candidateIds)
            .in("status", ["open", "in_progress"]),
          admin
            .from("evidence_requirements")
            .select("contract_id, status")
            .eq("organization_id", orgId)
            .in("contract_id", candidateIds)
            .in("status", [...EVIDENCE_GAP_STATUSES]),
        ]);
  const scenarioByContract = new Map(
    (scenariosData ?? []).map((row) => [row.contract_id as string, row] as const)
  );
  const openExceptionsByContract = new Map<string, number>();
  for (const row of exceptionRows ?? []) {
    const contractId = String(row.contract_id);
    openExceptionsByContract.set(contractId, (openExceptionsByContract.get(contractId) ?? 0) + 1);
  }
  const evidenceByContract = new Map<string, number>();
  for (const row of evidenceRows ?? []) {
    const contractId = String(row.contract_id);
    evidenceByContract.set(contractId, (evidenceByContract.get(contractId) ?? 0) + 1);
  }

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

  const rows = contractsWithOwners
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
      const openExceptions = openExceptionsByContract.get(row.id as string) ?? 0;
      const outstandingEvidence = evidenceByContract.get(row.id as string) ?? 0;
      const scenario = scenarioByContract.get(row.id as string) as
        | {
            workspace_status?: string;
            target_decision_date?: string | null;
            escalation_date?: string | null;
            scenario_confidence?: number | null;
            blocker?: string | null;
          }
        | undefined;
      const nextAction = getRenewalNextAction({
        contractId: row.id as string,
        ownerAssigned: Boolean(row.owner_id),
        openExceptions,
        outstandingEvidence,
        blocker: scenario?.blocker ?? null,
      });
      return {
        id: row.id as string,
        title: row.title as string,
        counterparty: (row.counterparty as string | null) ?? "",
        status: row.status as string,
        annualValue: (row.annual_value as number | null) ?? null,
        ownerLabel: row.owner?.full_name || row.owner?.email || null,
        keyDateRaw,
        daysUntil,
        checkpointTotal: stats.total,
        checkpointCompleted: stats.completed,
        pendingCheckpointId: stats.pendingCheckpointId,
        openExceptions,
        outstandingEvidence,
        workspaceStatus: scenario?.workspace_status ?? "not_started",
        targetDecisionDate: scenario?.target_decision_date ?? null,
        escalationDate: scenario?.escalation_date ?? null,
        scenarioConfidence: scenario?.scenario_confidence ?? null,
        blocker: scenario?.blocker ?? null,
        playbookRecommendation:
          stats.total === 0
            ? "Seed a baseline checklist"
            : daysUntil != null && daysUntil <= 30
              ? "Escalate final approvals and send action"
              : stats.completed / Math.max(1, stats.total) < 0.5
                ? "Complete strategic checkpoints"
                : "Drive remaining checkpoints to completion",
        nextActionHref: nextAction.href,
        nextActionLabel: nextAction.label,
      };
    })
    .sort((a, b) =>
      compareRenewalQueueRows(
        {
          title: a.title,
          ownerLabel: a.ownerLabel,
          openExceptions: a.openExceptions,
          outstandingEvidence: a.outstandingEvidence,
          blocker: a.blocker,
          checkpointTotal: a.checkpointTotal,
          daysUntil: a.daysUntil,
          annualValue: a.annualValue,
        },
        {
          title: b.title,
          ownerLabel: b.ownerLabel,
          openExceptions: b.openExceptions,
          outstandingEvidence: b.outstandingEvidence,
          blocker: b.blocker,
          checkpointTotal: b.checkpointTotal,
          daysUntil: b.daysUntil,
          annualValue: b.annualValue,
        }
      )
    );
  const totalExposure = rows.reduce((sum, row) => sum + (row.annualValue ?? 0), 0);
  const savedViews = (savedViewsData ?? []).map((v) => {
    const q = (v.query_json ?? {}) as Record<string, unknown>;
    const params = new URLSearchParams();
    if (typeof q.deadline === "string" && q.deadline) params.set("horizon", q.deadline);
    const qs = params.toString();
    return {
      id: v.id,
      name: v.name,
      href: qs ? `/contracts/renewals?${qs}` : "/contracts/renewals",
      weeklyActive: weeklyByViewId.get(v.id) ?? false,
      pinned: q.pinned === true || q.pinned === "1" || q.pinned === "true",
    };
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned));

  const { data: signalRows } = await admin
    .from("contract_renewal_checkpoints")
    .select("status, due_date, renewal_state")
    .eq("organization_id", orgId)
    .limit(2000);
  const todayStr = new Date().toISOString().slice(0, 10);
  const renewalSignals = {
    total: signalRows?.length ?? 0,
    overdue: (signalRows ?? []).filter((r) => r.status !== "completed" && r.due_date && r.due_date < todayStr)
      .length,
    decisionPending: (signalRows ?? []).filter((r) => r.renewal_state === "decision_pending").length,
  };
  const rowCount = rows.length;
  const dueNowCount = rows.filter((row) => row.daysUntil != null && row.daysUntil <= 0).length;
  const dueWithin30Count = rows.filter((row) => row.daysUntil != null && row.daysUntil <= 30).length;
  const missingDateCount = rows.filter((row) => !row.keyDateRaw).length;
  const totalCheckpoints = rows.reduce((sum, row) => sum + row.checkpointTotal, 0);
  const completedCheckpoints = rows.reduce((sum, row) => sum + row.checkpointCompleted, 0);
  const checkpointCoverage = totalCheckpoints === 0 ? 0 : (completedCheckpoints / totalCheckpoints) * 100;
  const contractsWithoutChecklist = rows.filter((row) => row.checkpointTotal === 0).length;
  const blockerCount = rows.filter(
    (row) => row.openExceptions > 0 || row.outstandingEvidence > 0 || Boolean(row.blocker)
  ).length;
  const exceptionCount = rows.reduce((sum, row) => sum + row.openExceptions, 0);
  const evidenceGapCount = rows.reduce((sum, row) => sum + row.outstandingEvidence, 0);
  const ownerGapCount = rows.filter((row) => !row.ownerLabel).length;
  const escalationCount = rows.filter((row) => Boolean(row.escalationDate)).length;
  const confidenceCoverage = rows.filter((row) => row.scenarioConfidence != null).length;
  const pinnedViewCount = savedViews.filter((view) => view.pinned).length;
  const weeklyViewCount = savedViews.filter((view) => view.weeklyActive).length;
  const currentHorizonLabel = HORIZON_OPTIONS.find((option) => option.value === horizon)?.label ?? "Renewal <= 90d";
  const queueTone = rowCount === 0 ? "neutral" : metricTone(dueWithin30Count, 1, 4);
  const blockerTone = blockerCount === 0 && ownerGapCount === 0 ? "healthy" : metricTone(blockerCount + ownerGapCount, 1, 4);
  const checkpointTone = checklistTone(checkpointCoverage, contractsWithoutChecklist);
  const slackStatus: SemanticStatus = showSlackRenewalSummary ? "healthy" : "disabled";

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div className="min-w-0">
          <p className="ui-eyebrow">Renewal preparation</p>
          <h1 className="ui-display-title mt-2">Renewals workspace</h1>
          <p className="ui-page-lead mt-2 max-w-3xl">
            {renewalsCopy?.headerLead ??
              "Run horizon-based renewal work with checkpoint coverage, blockers, owners, and next actions visible in one operational surface."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Current renewal queue context">
            <StatusBadge status="info">{currentHorizonLabel}</StatusBadge>
            <StatusBadge status={rowCount > 0 ? "in_review" : "empty"}>
              {pluralize(rowCount, "contract")} in queue
            </StatusBadge>
            <StatusBadge status={slackStatus}>
              Slack {showSlackRenewalSummary ? "available" : "disabled"}
            </StatusBadge>
          </div>
        </div>
        <div className="ui-page-actions">
          <Link href="/contracts/tasks" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
            Open task queue
          </Link>
          <Link
            href="/api/renewals/portfolio-signals"
            className="ui-btn-secondary px-4 py-2.5 text-[13px]"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open portfolio signals
          </Link>
          {showDecisionsCta ? (
            <Link href="/decisions" prefetch={false} className="ui-btn-primary px-4 py-2.5 text-[13px]">
              Review decisions
            </Link>
          ) : null}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Renewal operations summary">
        <OperationalSummaryCard
          eyebrow="Horizon queue"
          headline="Contracts in view"
          tone={queueTone}
          icon={CalendarClock}
          primaryValue={rowCount}
          primaryUnit={currentHorizonLabel}
          breakdown={[
            { label: "Due now", value: String(dueNowCount) },
            { label: "<= 30d", value: String(dueWithin30Count) },
            { label: "No date", value: String(missingDateCount) },
          ]}
          action={{ href: "#renewal-queue", label: "Review queue" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Exposure"
          headline="Value in horizon"
          tone={totalExposure > 0 ? "neutral" : "healthy"}
          icon={DollarSign}
          primaryValue={formatCurrency(totalExposure)}
          primaryUnit="annual value"
          breakdown={[
            { label: "Rows", value: String(rowCount) },
            { label: "Owner gaps", value: String(ownerGapCount) },
          ]}
          action={{ href: "#renewal-filters", label: "Shape horizon" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Checklist coverage"
          headline="Checkpoint progress"
          tone={checkpointTone}
          icon={ClipboardCheck}
          primaryValue={formatPercent(checkpointCoverage)}
          primaryUnit={`${completedCheckpoints}/${totalCheckpoints} checkpoints complete`}
          breakdown={[
            { label: "No checklist", value: String(contractsWithoutChecklist) },
            { label: "Overdue", value: String(renewalSignals.overdue) },
          ]}
          action={{ href: "#renewal-queue", label: "Open row actions" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Blockers"
          headline="Intervention needed"
          tone={blockerTone}
          icon={ShieldAlert}
          primaryValue={blockerCount + ownerGapCount}
          primaryUnit="contracts with blockers or owner gaps"
          breakdown={[
            { label: "Exceptions", value: String(exceptionCount) },
            { label: "Evidence", value: String(evidenceGapCount) },
            { label: "Escalations", value: String(escalationCount) },
          ]}
          action={{ href: "#renewal-queue", label: "Inspect blockers" }}
          variant="compact"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]" aria-label="Renewal workspace controls">
        <div className="ui-page-shell min-w-0 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="ui-eyebrow">Workspace model</p>
              <h2 className="ui-section-title">Structured renewal command center</h2>
              <p className="ui-support-copy max-w-2xl">
                Checkpoints, scenario confidence, commercial exposure, blockers, and next actions stay attached to each contract while the queue stays scoped to the selected horizon.
              </p>
            </div>
            <StatusBadge status={showDecisionsCta ? "healthy" : "disabled"}>
              Decisions {showDecisionsCta ? "enabled" : "unavailable"}
            </StatusBadge>
          </div>
          <div className="mt-5 flex flex-wrap gap-2" role="list" aria-label="Workspace model signals">
            <OperationalMetricChip label="Portfolio checkpoints" value={String(renewalSignals.total)} />
            <OperationalMetricChip label="Decision pending" value={String(renewalSignals.decisionPending)} />
            <OperationalMetricChip label="Confidence tracked" value={String(confidenceCoverage)} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/api/renewals/portfolio-signals"
              className="ui-btn-secondary px-4 py-2 text-[13px]"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open portfolio signals JSON
            </Link>
            {showDecisionsCta ? (
              <Link href="/decisions" prefetch={false} className="ui-btn-secondary px-4 py-2 text-[13px]">
                Compare decisions
              </Link>
            ) : null}
          </div>
        </div>
        <div className="min-w-0">
          {showSlackRenewalSummary ? (
            <SlackRenewalSummaryForm />
          ) : (
            <div className="ui-status-panel ui-status-panel-info h-full">
              <div className="flex items-start gap-3">
                <span className="ui-icon-tile-compact shrink-0">
                  <MessageSquare className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="ui-label-caps">Slack renewal summary</p>
                    <StatusBadge status="disabled">Disabled</StatusBadge>
                  </div>
                  <h2 className="ui-section-title mt-2 text-base">Workspace mode does not include Slack digests</h2>
                  <p className="ui-support-copy mt-2">
                    Renewal summaries stay in the queue for this workspace. Advanced and assurance workspaces can post the same outcome summary to Slack.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div id="renewal-filters" className="ui-page-shell md:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section aria-labelledby="renewal-horizon-heading" className="min-w-0">
            <div className="mb-4 flex items-start gap-3">
              <span className="ui-icon-tile-compact shrink-0">
                <ListFilter className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="ui-eyebrow">Horizon</p>
                <h2 id="renewal-horizon-heading" className="ui-section-title mt-1">
                  Shape the horizon
                </h2>
                <p className="ui-support-copy mt-1">
                  Pick the renewal, end-date, or notice window you want to run.
                </p>
              </div>
            </div>
            <form className="flex flex-wrap items-end gap-3" action="/contracts/renewals" method="get">
              <div className="min-w-[min(100%,16rem)] flex-1">
                <label htmlFor="renewal-horizon" className="ui-label-caps">
                  Horizon
                </label>
                <select
                  id="renewal-horizon"
                  name="horizon"
                  defaultValue={horizon}
                  className="ui-input w-full min-w-0"
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
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Queue exposure">
              <OperationalMetricChip label="Queue exposure" value={formatCurrency(totalExposure)} />
              <OperationalMetricChip label="Rows" value={String(rowCount)} />
              <OperationalMetricChip label="Due now" value={String(dueNowCount)} />
            </div>
          </section>

          <section aria-labelledby="saved-renewal-views-heading" className="min-w-0 border-t border-[var(--border-subtle)] pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="mb-4 flex items-start gap-3">
              <span className="ui-icon-tile-compact shrink-0">
                <Save className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="ui-eyebrow">Saved renewal views</p>
                <h2 id="saved-renewal-views-heading" className="ui-section-title mt-1">
                  Reusable review windows
                </h2>
                <p className="ui-support-copy mt-1">
                  Save this horizon, pin high-priority views, or turn on weekly summaries.
                </p>
              </div>
            </div>
            <form action={createSavedView as never} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="organizationId" value={orgId} />
              <input type="hidden" name="viewType" value="renewals" />
              <input type="hidden" name="deadline" value={horizon} />
              <div className="min-w-[min(100%,14rem)] flex-1">
                <label htmlFor="renewal-view-name" className="ui-label-caps">
                  Save renewal view
                </label>
                <input id="renewal-view-name" name="name" required className="ui-input w-full min-w-0" />
              </div>
              <button type="submit" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
                Save view
              </button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Saved view state">
              <OperationalMetricChip label="Saved" value={String(savedViews.length)} />
              <OperationalMetricChip label="Pinned" value={String(pinnedViewCount)} />
              <OperationalMetricChip label="Weekly" value={String(weeklyViewCount)} />
            </div>
            {savedViews.length > 0 ? (
              <div className="mt-4 grid gap-2" role="list" aria-label="Saved renewal views">
                {savedViews.map((view) => (
                  <div
                    key={view.id}
                    role="listitem"
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--canvas))] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={view.href} className="ui-link font-semibold">
                        {view.name}
                      </Link>
                      <div className="flex flex-wrap gap-1.5">
                        {view.pinned ? <StatusBadge status="healthy">Pinned</StatusBadge> : null}
                        <StatusBadge status={view.weeklyActive ? "healthy" : "empty"}>
                          {view.weeklyActive ? "Weekly on" : "Weekly off"}
                        </StatusBadge>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={setSavedViewPinned.bind(null, view.id, !view.pinned) as never}>
                        <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-[12px]" aria-label={`${view.pinned ? "Unpin" : "Pin"} saved renewal view ${view.name}`}>
                          <Pin className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
                          {view.pinned ? "Unpin" : "Pin"}
                        </button>
                      </form>
                      <form action={setSavedViewWeeklySummary.bind(null, view.id, !view.weeklyActive) as never}>
                        <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-[12px]" aria-label={`${view.weeklyActive ? "Disable" : "Enable"} weekly summary for ${view.name}`}>
                          {view.weeklyActive ? "Disable weekly" : "Enable weekly"}
                        </button>
                      </form>
                      <form action={deleteSavedView.bind(null, view.id) as never}>
                        <button type="submit" className="ui-btn-ghost px-3 py-1.5 text-[12px]" aria-label={`Delete saved renewal view ${view.name}`}>
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_42%,transparent)] p-4">
                <p className="font-semibold text-[var(--text-primary)]">No saved renewal views yet</p>
                <p className="ui-support-copy mt-1">
                  Save the current horizon when it becomes a recurring renewal review window.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          eyebrow="Renewal queue"
          icon={<Inbox className="h-7 w-7 text-[var(--text-tertiary)]" strokeWidth={1.55} aria-hidden />}
          title="No contracts in this horizon"
          copy="Widen the horizon, approve renewal/end-date fields, or open Contracts to fill the missing dates."
          action={
            <>
              <Link href="/contracts/renewals?horizon=renewal_365" className="ui-btn-primary px-4 py-2 text-[13px]">
                Widen to 365 days
              </Link>
              <Link href="/contracts" className="ui-btn-secondary px-4 py-2 text-[13px]">
                Open contracts
              </Link>
            </>
          }
        />
      ) : (
        <section id="renewal-queue" className="ui-page-shell md:p-6" aria-labelledby="renewal-queue-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <p className="ui-eyebrow">Rows</p>
              <h2 id="renewal-queue-heading" className="ui-section-title">
                Renewal ledger
              </h2>
              <p className="ui-support-copy max-w-3xl">
                Keep key dates, blockers, checklist coverage, and the next decision step visible without compressing the work into tiny table text.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="info">{currentHorizonLabel}</StatusBadge>
              <StatusBadge status={blockerCount > 0 ? "warning" : "healthy"}>
                {blockerCount > 0 ? `${blockerCount} blocker${blockerCount === 1 ? "" : "s"}` : "No explicit blockers"}
              </StatusBadge>
            </div>
          </div>

          <div className="overflow-x-auto" aria-label="Renewal row overflow guard">
          <div className="mt-5 grid gap-4">
            {rows.map((row) => {
              const rowHasBlockers =
                row.openExceptions > 0 || row.outstandingEvidence > 0 || Boolean(row.blocker) || !row.ownerLabel;
              const rowToneClass = rowHasBlockers
                ? "border-l-[0.35rem] border-l-[color:var(--warning-ink)]"
                : "border-l-[0.35rem] border-l-[color:var(--success-ink)]";
              return (
                <article
                  key={row.id}
                  className={`ui-card min-w-0 overflow-hidden p-0 ${rowToneClass}`}
                  aria-labelledby={`renewal-row-${row.id}`}
                >
                  <div className="ui-surface-tint px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="ui-kicker">Contract</p>
                        <h3 id={`renewal-row-${row.id}`} className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                          <Link href={`/contracts/${row.id}`} className="ui-link">
                            {row.title}
                          </Link>
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                          <span>{v9DisplayOrUnknown(row.counterparty, "Unknown counterparty")}</span>
                          <span aria-hidden>·</span>
                          <span>{statusLabel(row.status)}</span>
                          <span aria-hidden>·</span>
                          <span>{row.annualValue == null ? "No annual value" : formatCurrency(row.annualValue)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge status={row.daysUntil != null && row.daysUntil <= 30 ? "warning" : "info"}>
                          {formatCountdown(row.daysUntil)}
                        </StatusBadge>
                        <StatusBadge status={rowHasBlockers ? "warning" : "healthy"}>
                          {rowHasBlockers ? "Needs follow-up" : "Clear"}
                        </StatusBadge>
                      </div>
                    </div>
                    <div className="mt-3">
                      <ContractContinuityLinks contractId={row.id} omit={["renewals"]} />
                    </div>
                  </div>

                  <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(280px,0.8fr)]">
                    <section aria-labelledby={`renewal-timing-${row.id}`} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                      <div className="flex items-start gap-3">
                        <span className="ui-icon-tile-compact shrink-0">
                          <Clock3 className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="ui-label-caps" id={`renewal-timing-${row.id}`}>
                            Timing
                          </p>
                          <dl className="mt-3 grid gap-3 text-sm">
                            <div>
                              <dt className="ui-kicker">Key date</dt>
                              <dd className="mt-1 font-semibold text-[var(--text-primary)]">
                                {formatBusinessDateAtNoon(row.keyDateRaw)}
                              </dd>
                            </div>
                            <div>
                              <dt className="ui-kicker">Countdown</dt>
                              <dd className={`mt-1 font-semibold ${row.daysUntil == null ? "text-[var(--text-tertiary)]" : urgency(row.daysUntil)}`}>
                                {formatCountdown(row.daysUntil)}
                              </dd>
                            </div>
                            <div>
                              <dt className="ui-kicker">Owner</dt>
                              <dd className={row.ownerLabel ? "mt-1 text-[var(--text-secondary)]" : "mt-1 font-semibold text-amber-700"}>
                                {row.ownerLabel || "Assign owner"}
                              </dd>
                            </div>
                            <div>
                              <dt className="ui-kicker">Status</dt>
                              <dd className="mt-1 text-[var(--text-secondary)]">{statusLabel(row.status)}</dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    </section>

                    <section aria-labelledby={`renewal-blockers-${row.id}`} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                      <div className="flex items-start gap-3">
                        <span className="ui-icon-tile-compact shrink-0">
                          {rowHasBlockers ? (
                            <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="ui-label-caps" id={`renewal-blockers-${row.id}`}>
                              Blockers
                            </p>
                            <StatusBadge status={rowHasBlockers ? "warning" : "healthy"}>
                              {rowHasBlockers ? "Watch" : "Clear"}
                            </StatusBadge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <OperationalMetricChip label="Open exceptions" value={String(row.openExceptions)} />
                            <OperationalMetricChip label="Evidence items" value={String(row.outstandingEvidence)} />
                            <OperationalMetricChip label="Owner gap" value={row.ownerLabel ? "No" : "Yes"} />
                          </div>
                          <div className="mt-3 space-y-1.5 text-sm text-[var(--text-secondary)]">
                            {row.openExceptions > 0 ? (
                              <p className="font-medium text-rose-700">
                                {pluralize(row.openExceptions, "open exception")}
                              </p>
                            ) : null}
                            {row.outstandingEvidence > 0 ? (
                              <p className="font-medium text-amber-700">
                                {pluralize(row.outstandingEvidence, "evidence item")} outstanding
                              </p>
                            ) : null}
                            {row.blocker ? <p className="text-amber-700">Scenario blocker: {row.blocker}</p> : null}
                            {!row.ownerLabel ? (
                              <p className="font-medium text-amber-700">No owner assigned for renewal follow-up</p>
                            ) : null}
                            {!rowHasBlockers ? (
                              <p className="text-[var(--text-tertiary)]">No explicit blockers recorded</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </section>

                    <section aria-labelledby={`renewal-workspace-${row.id}`} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                      <div className="flex items-start gap-3">
                        <span className="ui-icon-tile-compact shrink-0">
                          <GitBranch className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="ui-label-caps" id={`renewal-workspace-${row.id}`}>
                              Workspace
                            </p>
                            <StatusBadge status={workspaceStatus(row.workspaceStatus)}>
                              {workspaceLabel(row.workspaceStatus)}
                            </StatusBadge>
                          </div>
                          <dl className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                            <div>
                              <dt className="ui-kicker">Target</dt>
                              <dd>{row.targetDecisionDate ? formatBusinessDateAtNoon(row.targetDecisionDate) : "No target decision date"}</dd>
                            </div>
                            <div>
                              <dt className="ui-kicker">Escalate</dt>
                              <dd className={row.escalationDate ? "text-amber-700" : ""}>
                                {row.escalationDate ? formatBusinessDateAtNoon(row.escalationDate) : "No escalation date"}
                              </dd>
                            </div>
                            <div>
                              <dt className="ui-kicker">Confidence</dt>
                              <dd>{row.scenarioConfidence != null ? `${row.scenarioConfidence}%` : "Not scored"}</dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="grid gap-4 border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_36%,transparent)] p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.55fr)]">
                    <section aria-labelledby={`renewal-checklist-${row.id}`} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="ui-label-caps" id={`renewal-checklist-${row.id}`}>
                          Checklist
                        </p>
                        <StatusBadge status={row.checkpointTotal === 0 ? "empty" : row.checkpointCompleted === row.checkpointTotal ? "healthy" : "in_review"}>
                          {row.checkpointCompleted}/{row.checkpointTotal} complete
                        </StatusBadge>
                      </div>
                      <RenewalRowChecklistActions
                        contractId={row.id}
                        pendingCheckpointId={row.pendingCheckpointId}
                        checkpointTotal={row.checkpointTotal}
                        checkpointCompleted={row.checkpointCompleted}
                        playbookRecommendation={row.playbookRecommendation}
                      />
                    </section>

                    <section aria-labelledby={`renewal-next-action-${row.id}`} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                      <p className="ui-label-caps" id={`renewal-next-action-${row.id}`}>
                        Next action
                      </p>
                      <Link href={row.nextActionHref} className="ui-operational-action mt-3 inline-flex">
                        {row.nextActionLabel}
                        <span aria-hidden>→</span>
                      </Link>
                    </section>
                  </div>
                </article>
              );
            })}
          </div>
          </div>
        </section>
      )}
    </div>
  );
}
