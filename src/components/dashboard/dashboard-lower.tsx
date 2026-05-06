/**
 * product-surface policy §8.1–§8.2 (Core home): “blocked / missing / recent / owned” via My tasks & obligations,
 * upcoming actions, missing fields, usage/evidence, recent contracts table, and review-oriented queues.
 */
import Link from "next/link";
import { differenceInDays, isValid } from "date-fns";
import { ContractTable } from "@/components/contracts/contract-table";
import { MissingFieldsSection } from "@/components/dashboard/missing-fields-section";
import { UsageSection } from "@/components/dashboard/usage-section";
import { MyTasks } from "@/components/dashboard/my-tasks";
import { MyObligations } from "@/components/dashboard/my-obligations";
import { UpcomingActions } from "@/components/dashboard/upcoming-actions";
import { CONTRACT_LIST_ROW_COLUMNS } from "@/lib/contract-list";
import { getReviewStatsForContractIds } from "@/lib/contract-review-stats";
import { getContractListRowSignalsMap } from "@/lib/contract-list-row-signals";
import { attachOwnerProfiles } from "@/lib/contracts";
import {
  getDashboardAdminClientCached,
  getDashboardDateFieldsCached,
  getDashboardMissingCriticalCached,
  getDashboardOrgMetricsCached,
  getDashboardUsageStatsCached,
  getDashboardWorkflowSettingsCached,
} from "@/lib/dashboard-data";
import type { Contract } from "@/lib/types";
import { setDashboardQueuePinForm } from "@/actions/dashboard";
import { CommandCenterRoleMetrics } from "@/components/v4/command-center-role-metrics";
import { DetailsOpenOnHash } from "@/components/ui/details-open-on-hash";
import {
  OperationalMetricChip,
  OperationalQueueRow,
} from "@/components/ui/operational-summary-card";
import type { WorkspaceRole } from "@/lib/navigation";
import type { ProductSurfaceContext } from "@/lib/product-surface/context";
import { isHrefEligibleForProductSurface } from "@/lib/product-surface/href-eligibility";

type DashboardDeadlineField = {
  id: string;
  field_name: string;
  field_value: string | null;
  contracts: { id: string; title: string; organization_id: string };
};

export async function DashboardLower(props: {
  orgId: string;
  userId: string;
  role: WorkspaceRole;
  view: "personal" | "team" | "portfolio";
  quickFilter: "all" | "approvals" | "deadlines" | "data_gaps";
  productSurfaceContext: ProductSurfaceContext;
}) {
  const { orgId, userId, role, view, quickFilter, productSurfaceContext } = props;
  const isHrefEligible = (href: string) =>
    isHrefEligibleForProductSurface(productSurfaceContext, href);
  const admin = await getDashboardAdminClientCached();

  /** §12.1 — viewers stay on assigned/due scope; team/portfolio URLs do not broaden data. */
  const narrowPersonal =
    role === "viewer" || role === "legal_reviewer" || role === "finance_reviewer";
  const effectiveView = narrowPersonal ? "personal" : view;

  const obligationPromise =
    effectiveView === "personal"
      ? admin
          .from("contract_obligations")
          .select(
            "id, title, status, due_date, obligation_type, contracts!inner(id, title, organization_id)"
          )
          .eq("organization_id", orgId)
          .eq("owner_id", userId)
          .in("status", ["open", "in_progress"])
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(8)
      : Promise.resolve({ data: [] as unknown[] });

  const pendingPromise =
    effectiveView === "team"
      ? admin
          .from("contracts")
          .select("id, title, counterparty")
          .eq("organization_id", orgId)
          .eq("status", "pending_review")
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as { id: string; title: string; counterparty: string | null }[] });

  const [
    metrics,
    missingCritical,
    dateFieldsData,
    workflowSettings,
    { data: myTasksData },
    { data: myObligationsData },
    { data: pendingContractsData },
    { data: recentContractsData },
    usageStats,
    { count: evidenceRequiredRaw },
  ] = await Promise.all([
    getDashboardOrgMetricsCached(orgId),
    getDashboardMissingCriticalCached(orgId),
    getDashboardDateFieldsCached(orgId),
    getDashboardWorkflowSettingsCached(orgId),
    admin
      .from("contract_tasks")
      .select(
        "id, title, status, priority, due_date, contracts!inner(id, title, organization_id)"
      )
      .eq("organization_id", orgId)
      .eq("assignee_id", userId)
      .in("status", ["open", "in_progress", "blocked"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    obligationPromise,
    pendingPromise,
    admin
      .from("contracts")
      .select(CONTRACT_LIST_ROW_COLUMNS)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5),
    getDashboardUsageStatsCached(orgId),
    admin
      .from("evidence_requirements")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "required"),
  ]);

  const evidenceRequiredCount = evidenceRequiredRaw ?? 0;

  const recentContracts = await attachOwnerProfiles(admin, orgId, recentContractsData ?? []);
  const recentContractIds = recentContracts.map((contract) => contract.id);
  const [recentReviewStats, recentRowSignals] = await Promise.all([
    getReviewStatsForContractIds(admin, recentContractIds),
    getContractListRowSignalsMap(admin, orgId, recentContractIds),
  ]);
  const pendingContracts = pendingContractsData ?? [];
  const dateFields = dateFieldsData as unknown as DashboardDeadlineField[];

  const today = new Date();
  const nowTs = today.getTime();
  const upcomingActions = dateFields
    .filter((field) => field.field_value)
    .map((field) => {
      const dateValue = new Date(field.field_value as string);
      if (!isValid(dateValue)) return null;
      const daysUntil = differenceInDays(dateValue, today);
      if (Number.isNaN(daysUntil)) return null;
      return {
        contract: field.contracts,
        field: {
          id: field.id,
          field_name: field.field_name,
          field_value: field.field_value,
        },
        daysUntil,
      };
    })
    .filter(
      (a): a is NonNullable<typeof a> =>
        a != null && a.daysUntil >= 0 && a.daysUntil <= 90
    )
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 10);

  const soonActions = upcomingActions.filter((a) => a.daysUntil <= 14);
  const riskContracts = missingCritical.slice(0, 6);
  const dashboardPins = ((workflowSettings?.dashboard_pins_json as Record<string, unknown> | null) ??
    {}) as Record<string, boolean>;
  const nowPinned = dashboardPins.now === true;
  const nextPinned = dashboardPins.next === true;
  const riskPinned = dashboardPins.risk === true;
  const filteredSoonActions =
    quickFilter === "all" || quickFilter === "deadlines" ? soonActions : [];
  const filteredRiskContracts =
    quickFilter === "all" || quickFilter === "data_gaps" ? riskContracts : [];
  const filteredPendingContracts =
    quickFilter === "all" || quickFilter === "approvals" ? pendingContracts : [];

  const myTasks = (myTasksData ?? []).flatMap((row) => {
    const rel = (row as { contracts: unknown }).contracts;
    const contract = (
      Array.isArray(rel) ? rel[0] : rel
    ) as { id?: string; title?: string; organization_id?: string } | null;
    if (!contract?.id || !contract?.title || !contract?.organization_id) {
      return [];
    }
    return [
      {
        id: String((row as { id: unknown }).id),
        title: String((row as { title: unknown }).title),
        status: (row as { status: "open" | "in_progress" | "blocked" | "done" }).status,
        priority: (row as { priority: "low" | "medium" | "high" }).priority,
        due_date: (row as { due_date: string | null }).due_date,
        contracts: {
          id: contract.id,
          title: contract.title,
          organization_id: contract.organization_id,
        },
      },
    ];
  });
  const myObligations = (myObligationsData ?? []).flatMap((row) => {
    const rel = (row as { contracts: unknown }).contracts;
    const contract = (
      Array.isArray(rel) ? rel[0] : rel
    ) as { id?: string; title?: string; organization_id?: string } | null;
    if (!contract?.id || !contract?.title || !contract?.organization_id) {
      return [];
    }
    return [
      {
        id: String((row as { id: unknown }).id),
        title: String((row as { title: unknown }).title),
        status: (row as { status: "open" | "in_progress" | "done" | "waived" }).status,
        due_date: (row as { due_date: string | null }).due_date,
        obligation_type: String((row as { obligation_type: unknown }).obligation_type),
        contracts: {
          id: contract.id,
          title: contract.title,
          organization_id: contract.organization_id,
        },
      },
    ];
  });
  const overduePersonalTasks = myTasks.filter((task) => {
    if (!task.due_date) return false;
    return new Date(task.due_date).getTime() < nowTs;
  });

  return (
    <>
      <CommandCenterRoleMetrics orgId={orgId} role={role} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="ui-card-hero overflow-hidden xl:col-span-1">
          <div className="ui-surface-tint px-4 py-3.5 md:px-5 md:py-4">
            <p className="ui-eyebrow">Queue</p>
            <h2 className="ui-page-title mt-2 text-[1.55rem]">Now</h2>
            <p className="ui-section-lead mt-2">
              Immediate actions requiring attention today.
            </p>
            <div className="mt-2">
              <form action={setDashboardQueuePinForm as never}>
                <input type="hidden" name="queueKey" value="now" />
                <input type="hidden" name="pinned" value={nowPinned ? "0" : "1"} />
                <button type="submit" className="ui-filter-pill">
                  {nowPinned ? "Unpin queue" : "Pin queue"}
                </button>
              </form>
            </div>
          </div>
          <div className="space-y-4 px-4 py-4 md:space-y-5 md:px-5 md:py-5">
            {effectiveView === "personal" ? (
              <MyTasks tasks={myTasks.slice(0, 5)} />
            ) : effectiveView === "team" ? (
              <div>
                <p className="ui-kicker">Review</p>
                <ul className="mt-2 space-y-2">
                  {filteredPendingContracts.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <OperationalQueueRow
                        href={`/contracts/${c.id}`}
                        eyebrow="Pending review"
                        title={c.title}
                        hint={c.counterparty || "No counterparty"}
                        chips={[{ label: "Status", value: "Needs triage" }]}
                        actionLabel="Inspect contract"
                        tone="attention"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="ui-kicker">Portfolio</p>
                <div className="flex flex-wrap gap-2" role="list">
                  <OperationalMetricChip label="Open tasks" value={String(metrics.teamOpenTasks)} />
                  <OperationalMetricChip label="Open obligations" value={String(metrics.teamOpenObligations)} />
                  <OperationalMetricChip label="At-risk contracts" value={String(metrics.atRiskContracts)} />
                </div>
                {isHrefEligible("/work") ? (
                  <Link href="/work?lens=due_soon" className="ui-operational-action text-[12px]">
                    View due-soon work
                    <span aria-hidden>→</span>
                  </Link>
                ) : null}
              </div>
            )}
            {overduePersonalTasks.length > 0 && (
              <p className="ui-alert-warning">
                {overduePersonalTasks.length} overdue personal task
                {overduePersonalTasks.length === 1 ? "" : "s"}.
              </p>
            )}
          </div>
        </section>

        <section className="ui-card overflow-hidden xl:col-span-1">
          <div className="ui-surface-tint px-4 py-3.5 md:px-5 md:py-4">
            <p className="ui-eyebrow">Horizon</p>
            <h2 className="ui-page-title mt-2 text-[1.55rem]">Next</h2>
            <p className="ui-section-lead mt-2">
              Upcoming deadlines and obligations in the next two weeks.
            </p>
            <div className="mt-2">
              <form action={setDashboardQueuePinForm as never}>
                <input type="hidden" name="queueKey" value="next" />
                <input type="hidden" name="pinned" value={nextPinned ? "0" : "1"} />
                <button type="submit" className="ui-filter-pill">
                  {nextPinned ? "Unpin queue" : "Pin queue"}
                </button>
              </form>
            </div>
          </div>
          <div className="space-y-4 px-4 py-4 md:space-y-5 md:px-5 md:py-5">
            <UpcomingActions actions={filteredSoonActions} />
            {effectiveView === "personal" ? (
              <MyObligations obligations={myObligations.slice(0, 5)} />
            ) : effectiveView === "team" ? (
              <p className="ui-support-copy">
                Switch to Personal mode for your assigned obligations.
              </p>
            ) : (
              <p className="ui-support-copy">
                Portfolio mode emphasizes global pipeline and risk rather than individual
                ownership.
              </p>
            )}
          </div>
        </section>

        <section className="ui-card overflow-hidden xl:col-span-1">
          <div className="ui-surface-tint px-4 py-3.5 md:px-5 md:py-4">
            <p className="ui-eyebrow">Exposure</p>
            <h2 className="ui-page-title mt-2 text-[1.55rem]">Risk</h2>
            <p className="ui-section-lead mt-2">
              Exceptions, missing critical fields, and renewal risk signals.
            </p>
            <div className="mt-2">
              <form action={setDashboardQueuePinForm as never}>
                <input type="hidden" name="queueKey" value="risk" />
                <input type="hidden" name="pinned" value={riskPinned ? "0" : "1"} />
                <button type="submit" className="ui-filter-pill">
                  {riskPinned ? "Unpin queue" : "Pin queue"}
                </button>
              </form>
            </div>
          </div>
          <div className="space-y-3 px-4 py-4 md:px-5 md:py-5">
            {isHrefEligible("/contracts/exceptions") ? (
              <OperationalQueueRow
                href="/contracts/exceptions?status=open"
                eyebrow="Backlog"
                title="Exceptions"
                hint="Stale records and workflow gaps."
                chips={[{ label: "Focus", value: "Execution risk" }]}
                actionLabel="Triage exceptions"
                tone="attention"
              />
            ) : null}
            {isHrefEligible("/contracts/approvals") ? (
              <OperationalQueueRow
                href="/contracts/approvals?status=pending"
                eyebrow="SLA"
                title="Pending approvals"
                hint="Queued sign-offs and blockers."
                chips={[{ label: "Focus", value: "Downstream flow" }]}
                actionLabel="Review approvals"
                tone="attention"
              />
            ) : null}
            {isHrefEligible("/contracts/data-quality") ? (
              <OperationalQueueRow
                href="/contracts?data_quality=missing_critical"
                eyebrow="Data quality"
                title="Critical date gaps"
                hint="End, renewal, and notice fields need approved values."
                chips={[{ label: "Contracts", value: String(filteredRiskContracts.length) }]}
                actionLabel="Review gaps"
                tone={filteredRiskContracts.length > 0 ? "risk" : "healthy"}
              />
            ) : null}
            {isHrefEligible("/contracts/evidence-studio") ? (
              <OperationalQueueRow
                href="/contracts?evidence=outstanding"
                eyebrow="Evidence"
                title="Open evidence requests"
                hint="Submissions still required for gated work."
                chips={[{ label: "Required", value: String(evidenceRequiredCount) }]}
                actionLabel="Review evidence studio"
                tone={evidenceRequiredCount > 0 ? "attention" : "healthy"}
              />
            ) : null}
          </div>
        </section>
      </div>

      <section className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ui-eyebrow">Ledger</p>
            <h2 className="ui-page-title mt-2 text-[1.85rem]">Recent contracts</h2>
            <p className="ui-page-lead mt-2">
              Latest activity in your workspace
            </p>
          </div>
          <Link href="/contracts" className="ui-link text-[13px]">
            View all contracts
          </Link>
        </div>
        <ContractTable
          contracts={recentContracts as Contract[]}
          reviewStats={recentReviewStats}
          rowSignals={recentRowSignals}
          showContinuityLinks
        />
      </section>

      <DetailsOpenOnHash
        className="ui-card overflow-hidden"
        openForHashIds={["missing-critical"]}
        summary={
          <summary className="ui-surface-tint cursor-pointer list-none px-5 py-3.5 text-[13px] font-semibold tracking-tight text-[var(--text-secondary)] marker:hidden md:px-6 md:py-4 md:text-sm">
            Portfolio diagnostics and usage
          </summary>
        }
      >
        <div className="space-y-7 px-5 py-4 md:space-y-8 md:px-6 md:py-5">
          <UsageSection
            contractsCreated={usageStats.contractsCreated}
            extractionsRun={usageStats.extractionsRun}
            fieldsReviewed={usageStats.fieldsReviewed}
            periodLabel={usageStats.periodLabel}
          />
          <MissingFieldsSection contracts={missingCritical} />
        </div>
      </DetailsOpenOnHash>
    </>
  );
}
