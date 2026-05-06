import { getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import {
  isHrefEligibleForProductSurface,
  loadProductSurfaceContext,
  resolveWorkflowDestination,
} from "@/lib/product-surface";
import { ContractTable } from "@/components/contracts/contract-table";
import { ContractPagination } from "@/components/contracts/contract-pagination";
import { V10RecoverableState } from "@/components/ui/v10-recoverable-state";
import { attachOwnerProfiles, STATUS_LABELS } from "@/lib/contracts";
import { fetchContractsPage, CONTRACTS_PAGE_SIZE } from "@/lib/contract-list";
import { getReviewStatsForContractIds } from "@/lib/contract-review-stats";
import {
  deleteSavedView,
  setSavedViewMonthlySummary,
  setSavedViewWeeklyRecipients,
  setSavedViewWeeklySummary,
} from "@/actions/saved-views";
import { ContractsSavedViewCreateForm } from "@/components/contracts/contracts-saved-view-create-form";
import {
  getContractIdsForDeadlinePreset,
  getContractIdsMatchingFieldSearch,
  type DeadlinePreset,
  DEADLINE_PRESET_VALUES,
} from "@/lib/contract-filters";
import Link from "next/link";
import { CheckCircle2, Download, Eye, Files } from "lucide-react";
import { redirect } from "next/navigation";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { surfaceTestIds } from "@/lib/qa/test-ids";
import {
  combineContractListIntersectIds,
  parseContractListSort,
  resolveAuxiliaryContractListIntersectIds,
} from "@/lib/contract-list-id-filters";
import { getContractListRowSignalsMap } from "@/lib/contract-list-row-signals";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import type { OrgRole } from "@/lib/types";
import { getExportJobDetail, getExportJobHeadline, getExportJobTone } from "@/lib/export-job-visibility";
import {
  buildContractsListHref,
  normalizeContractsSearchQuery,
} from "@/lib/contracts-search-url";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";

export const metadata = { title: "Contracts" };

const DEADLINE_OPTIONS: { value: DeadlinePreset; label: string }[] = [
  { value: "", label: "Any date" },
  { value: "renewal_30", label: "Renewal ≤30d" },
  { value: "renewal_90", label: "Renewal ≤90d" },
  { value: "renewal_180", label: "Renewal ≤180d" },
  { value: "renewal_365", label: "Renewal ≤365d" },
  { value: "end_30", label: "End date ≤30d" },
  { value: "end_90", label: "End date ≤90d" },
  { value: "end_180", label: "End date ≤180d" },
  { value: "end_365", label: "End date ≤365d" },
  {
    value: "notice_deadline_30",
    label: "Notice deadline ≤30d",
  },
  {
    value: "notice_deadline_90",
    label: "Notice deadline ≤90d",
  },
  {
    value: "notice_deadline_180",
    label: "Notice deadline ≤180d",
  },
  {
    value: "notice_deadline_365",
    label: "Notice deadline ≤365d",
  },
];

function isDeadlinePreset(v: string | undefined): v is DeadlinePreset {
  return DEADLINE_PRESET_VALUES.includes(v as DeadlinePreset);
}

function parseExceptionsFilter(v: string | undefined): "" | "open" {
  return v === "open" ? "open" : "";
}

function parseReviewFilter(v: string | undefined): "" | "pending" {
  return v === "pending" ? "pending" : "";
}

function parseDataQualityFilter(v: string | undefined): "" | "missing_critical" {
  return v === "missing_critical" ? "missing_critical" : "";
}

function parseEvidenceFilter(v: string | undefined): "" | "outstanding" {
  return v === "outstanding" || v === "attention" ? "outstanding" : "";
}

function parseHealthFilter(v: string | undefined): "" | "watch" {
  return v === "watch" ? "watch" : "";
}

const FILTER_PILL_IDLE_CLASS = "ui-filter-pill";
const FILTER_PILL_ACTIVE_CLASS = "ui-filter-pill ui-filter-pill-active";
const SAVED_VIEW_TOGGLE_IDLE_CLASS = "ui-filter-pill";
const SAVED_VIEW_TOGGLE_WEEKLY_ACTIVE_CLASS =
  "ui-filter-pill bg-[var(--success-soft)] text-[var(--success-ink)] hover:brightness-95";
const SAVED_VIEW_TOGGLE_MONTHLY_ACTIVE_CLASS =
  "ui-filter-pill bg-[var(--info-soft)] text-[var(--info-ink)] hover:brightness-95";

export default async function ContractsPage(props: {
  searchParams: Promise<{
    status?: string;
    search?: string;
    owner?: string;
    region?: string;
    deadline?: string;
    sort?: string;
    exceptions?: string;
    review?: string;
    data_quality?: string;
    evidence?: string;
    health?: string;
    page?: string;
  }>;
}) {
  // product-surface policy §20.3 — this `search` query filters the contracts table only (not cmd-K / global discovery).
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const { orgId, admin } = ctx;
  const productSurface = await loadProductSurfaceContext(admin, orgId, ctx.role as WorkspaceRole);
  const contractsDestination = resolveWorkflowDestination(productSurface, "contracts");
  const contractsCopy = contractsDestination?.visible ? contractsDestination.copy : null;
  const moreActionLinks: { href: string; label: string }[] = [
    { href: "/api/export/calendar/feed", label: "Calendar feed token" },
    { href: "/contracts/intake", label: "Intake" },
    { href: "/contracts/approvals", label: "Approvals" },
    { href: "/contracts/renewals", label: "Renewals" },
    { href: "/contracts/tasks", label: "Tasks" },
    { href: "/contracts/obligations", label: "Obligations" },
    { href: "/contracts/exceptions", label: "Exceptions" },
    { href: "/contracts/review-cadence", label: "Review cadence" },
    { href: "/contracts/analytics", label: "Analytics" },
    { href: "/contracts/maintenance", label: "Maintenance" },
  ];
  const visibleMoreActionLinks = moreActionLinks.filter((row) =>
    isHrefEligibleForProductSurface(productSurface, row.href)
  );

  const parsedPage = parseInt(searchParams.page ?? "1", 10);
  const page =
    Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const deadlineParam = searchParams.deadline;
  const deadline: DeadlinePreset =
    deadlineParam && isDeadlinePreset(deadlineParam) ? deadlineParam : "";
  const sanitizedSearch = searchParams.search
    ? normalizeContractsSearchQuery(searchParams.search)
    : "";

  const exceptionsFilter = parseExceptionsFilter(searchParams.exceptions);
  const reviewFilter = parseReviewFilter(searchParams.review);
  const dataQualityFilter = parseDataQualityFilter(searchParams.data_quality);
  const evidenceFilter = parseEvidenceFilter(searchParams.evidence);
  const healthFilter = parseHealthFilter(searchParams.health);
  const sortKey = parseContractListSort(searchParams.sort);

  const [deadlineIds, fieldSearchIds, auxIntersect] = await Promise.all([
    deadline
      ? getContractIdsForDeadlinePreset(admin, orgId, deadline)
      : Promise.resolve<string[] | null>(null),
    sanitizedSearch
      ? getContractIdsMatchingFieldSearch(admin, orgId, sanitizedSearch)
      : Promise.resolve<string[]>([]),
    resolveAuxiliaryContractListIntersectIds(admin, orgId, {
      exceptions: exceptionsFilter || undefined,
      review: reviewFilter || undefined,
      data_quality: dataQualityFilter || undefined,
      evidence: evidenceFilter || undefined,
      health: healthFilter || undefined,
    }),
  ]);

  const intersectIds = combineContractListIntersectIds([deadlineIds, auxIntersect]);

  const membersPromise = loadOrgMemberProfileRows(admin, orgId, {
    orderByCreatedAt: true,
  });
  const savedViewsPromise = admin
    .from("saved_views")
    .select("id, name, query_json")
    .eq("organization_id", orgId)
    .eq("user_id", ctx.user.id)
    .eq("view_type", "contracts")
    .order("created_at", { ascending: true });
  const exportJobsPromise = admin
    .from("contract_export_jobs")
    .select("id, status, selected_contract_count, exported_rows, truncated, error_message, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(3);
  const contractsPagePromise = fetchContractsPage(
    admin,
    {
      orgId,
      status: searchParams.status,
      owner: searchParams.owner,
      region: searchParams.region,
      intersectIds,
      sanitizedSearch,
      fieldSearchIds,
      sort: sortKey === "created" ? "created" : "activity",
    },
    page
  );
  const [
    membersData,
    { data: savedViewsData },
    { data: exportJobsData },
    { contracts: contractsData, total: contractTotal, error: contractsPageError },
    role,
  ] = await Promise.all([
    membersPromise,
    savedViewsPromise,
    exportJobsPromise,
    contractsPagePromise,
    getOrgMemberRole(admin, ctx.user.id, orgId),
  ]);

  const canEdit = canEditContracts(role as OrgRole);

  const listTotalPages =
    contractTotal > 0
      ? Math.max(1, Math.ceil(contractTotal / CONTRACTS_PAGE_SIZE))
      : 1;
  if (page > listTotalPages && contractTotal > 0) {
    redirect(
      buildContractsListHref({
        search: searchParams.search,
        status: searchParams.status,
        owner: searchParams.owner,
        region: searchParams.region,
        deadline: searchParams.deadline,
        sort: searchParams.sort,
        exceptions: searchParams.exceptions,
        review: searchParams.review,
        data_quality: searchParams.data_quality,
        evidence: searchParams.evidence,
        health: searchParams.health,
        page: String(listTotalPages),
      })
    );
  }

  const savedViewIds = (savedViewsData ?? []).map((v) => v.id);
  const { data: subscriptionsData } =
    savedViewIds.length === 0
      ? {
          data: [] as Array<{
            saved_view_id: string;
            frequency: "weekly" | "monthly";
            active: boolean;
            recipient_emails: string[] | null;
          }>,
        }
      : await admin
          .from("report_subscriptions")
          .select("saved_view_id, frequency, active, recipient_emails")
          .eq("user_id", ctx.user.id)
          .in("frequency", ["weekly", "monthly"])
          .in("saved_view_id", savedViewIds);
  const weeklyByViewId = new Map<string, boolean>();
  const monthlyByViewId = new Map<string, boolean>();
  for (const row of subscriptionsData ?? []) {
    if (row.frequency === "weekly") weeklyByViewId.set(row.saved_view_id, Boolean(row.active));
    if (row.frequency === "monthly") monthlyByViewId.set(row.saved_view_id, Boolean(row.active));
  }
  const recipientsByViewId = new Map(
    (subscriptionsData ?? []).map((s) => [s.saved_view_id, (s.recipient_emails ?? []).join(", ")])
  );

  const members = (membersData ?? []).map((m) => {
    return {
      id: m.user_id,
      label: orgMemberProfileLabel(m.profiles, "Unknown"),
    };
  });

  const [contracts, reviewStats, rowSignals] = await Promise.all([
    attachOwnerProfiles(admin, orgId, contractsData),
    getReviewStatsForContractIds(
      admin,
      contractsData.map((c) => c.id)
    ),
    getContractListRowSignalsMap(
      admin,
      orgId,
      contractsData.map((c) => c.id)
    ),
  ]);

  const savedViews = (savedViewsData ?? []).map((v) => {
    const q = (v.query_json ?? {}) as Record<string, string | null | undefined>;
    return {
      id: v.id,
      name: v.name,
      href: buildContractsListHref({
        search: q.search,
        status: q.status,
        owner: q.owner,
        region: q.region,
        deadline: q.deadline,
        sort: q.sort,
        exceptions: q.exceptions,
        review: q.review,
        data_quality: q.data_quality,
        evidence: q.evidence,
      }),
      weeklyActive: weeklyByViewId.get(v.id) ?? false,
      monthlyActive: monthlyByViewId.get(v.id) ?? false,
      recipientsCsv: recipientsByViewId.get(v.id) ?? "",
    };
  });

  const statuses = [
    { value: "", label: "All" },
    { value: "pending_review", label: STATUS_LABELS.pending_review },
    { value: "active", label: STATUS_LABELS.active },
    { value: "expired", label: STATUS_LABELS.expired },
    { value: "terminated", label: STATUS_LABELS.terminated },
    { value: "draft", label: STATUS_LABELS.draft },
  ];
  const activeStatusLabel = searchParams.status
    ? (STATUS_LABELS[searchParams.status as keyof typeof STATUS_LABELS] ??
      searchParams.status.replace(/_/g, " "))
    : null;

  const baseParams = {
    search: searchParams.search,
    owner: searchParams.owner,
    region: searchParams.region,
    deadline: searchParams.deadline,
    sort: searchParams.sort,
    exceptions: searchParams.exceptions,
    review: searchParams.review,
    data_quality: searchParams.data_quality,
    evidence: searchParams.evidence,
    health: searchParams.health,
  };

  const paginationQuery: Record<string, string | undefined> = {
    ...baseParams,
    status: searchParams.status,
    region: searchParams.region,
  };

  const filterFingerprint = JSON.stringify({
    status: searchParams.status ?? "",
    owner: searchParams.owner ?? "",
    region: searchParams.region ?? "",
    deadline: searchParams.deadline ?? "",
    search: searchParams.search ?? "",
    sort: searchParams.sort ?? "",
    exceptions: searchParams.exceptions ?? "",
    review: searchParams.review ?? "",
    data_quality: searchParams.data_quality ?? "",
    evidence: searchParams.evidence ?? "",
  });

  const pagePendingReview = contracts.filter((c) => c.status === "pending_review").length;
  const pageActive = contracts.filter((c) => c.status === "active").length;
  const latestExportJob = exportJobsData?.[0] ?? null;
  const latestExportTone = latestExportJob ? getExportJobTone(latestExportJob) : "neutral";
  const activeFilters = [
    searchParams.search ? `Search: ${searchParams.search}` : null,
    activeStatusLabel ? `Status: ${activeStatusLabel}` : null,
    searchParams.owner ? `Owner: filtered` : null,
    searchParams.region ? `Region: ${searchParams.region}` : null,
    searchParams.deadline ? `Date: ${searchParams.deadline}` : null,
    searchParams.sort === "created" ? "Sort: created" : null,
    searchParams.exceptions ? `Exceptions: ${searchParams.exceptions}` : null,
    searchParams.review ? `Review: ${searchParams.review}` : null,
    searchParams.data_quality ? `Data: ${searchParams.data_quality}` : null,
    searchParams.evidence ? `Evidence: ${searchParams.evidence}` : null,
  ].filter((value): value is string => value != null);

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div className="min-w-0 flex-1">
          <h1 className="ui-display-title">Contracts</h1>
          <p className="ui-page-lead mt-2">
            {contractsCopy?.headerLead ??
              "Contract records, queue states, ownership filters, and saved operating views."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <div className="ui-metric-chip grid min-w-[8rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2">
              <span className="ui-meta leading-none">In scope</span>
              <span className="text-base font-semibold tabular-nums text-[var(--text-primary)]">{contractTotal}</span>
            </div>
            <div className="ui-metric-chip grid min-w-[10.5rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2">
              <span className="ui-meta leading-none">Pending review</span>
              <span className="text-base font-semibold tabular-nums text-[var(--text-primary)]">{pagePendingReview}</span>
            </div>
            <div className="ui-metric-chip grid min-w-[7rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2">
              <span className="ui-meta leading-none">Active</span>
              <span className="text-base font-semibold tabular-nums text-[var(--text-primary)]">{pageActive}</span>
            </div>
          </div>
        </div>
        <div className="ui-page-actions">
          <Link href="/contracts/new" className="ui-btn-primary px-5 py-2.5">
            Upload contract
          </Link>
          <Link href="/contracts/bulk" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
            Bulk import
          </Link>
          <a
            href={`/api/export/contracts?orgId=${encodeURIComponent(orgId)}`}
            className="ui-btn-secondary px-4 py-2.5 text-[13px]"
          >
            Export CSV
          </a>
          <a href="/api/export/calendar" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
            Export calendar
          </a>
          {visibleMoreActionLinks.length > 0 ? (
            <details className="relative">
              <summary className="ui-btn-secondary cursor-pointer list-none px-4 py-2.5 text-[13px] [&::-webkit-details-marker]:hidden">
                More actions
              </summary>
              <div className="absolute left-0 top-[calc(100%+0.4rem)] z-20 w-64 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-2)] sm:left-auto sm:right-0">
                <ul className="divide-y divide-[var(--border-subtle)] text-sm">
                  {visibleMoreActionLinks.map((row) => (
                    <li key={row.href}>
                      <Link href={row.href} className="block px-4 py-2.5 hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--canvas))]">
                        {row.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ) : null}
        </div>
      </header>

      <section data-testid={surfaceTestIds.contractsPageSnapshot} className="ui-page-shell space-y-4">
        <div>
          <p className="ui-eyebrow">Table</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Page snapshot</h2>
          <p className="ui-section-lead mt-2">
            Filtered portfolio volume, review pressure, and live agreements on the current page.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
          <OperationalSummaryCard
            eyebrow="Filtered"
            headline="In scope"
            tone="neutral"
            icon={Files}
            primaryValue={contractTotal}
            primaryUnit="on this page"
            action={{ href: "/contracts", label: "Refresh filters" }}
            variant="compact"
            className="lg:col-span-2"
          />
          <OperationalSummaryCard
            eyebrow="Inbox"
            headline="Pending review"
            tone={pagePendingReview > 0 ? "attention" : "healthy"}
            icon={Eye}
            primaryValue={pagePendingReview}
            primaryUnit="on this page"
            action={{ href: "/contracts?status=pending_review", label: "Review pending contracts" }}
            variant="compact"
            className="lg:col-span-2"
          />
          <OperationalSummaryCard
            eyebrow="Live"
            headline="Active"
            tone="neutral"
            icon={CheckCircle2}
            primaryValue={pageActive}
            primaryUnit="on this page"
            action={{ href: "/contracts?status=active", label: "Review active" }}
            variant="compact"
            className="lg:col-span-2"
          />
          <OperationalSummaryCard
            eyebrow="Exports"
            headline="Latest export"
            tone={latestExportTone}
            icon={Download}
            primaryValue={latestExportJob ? latestExportJob.exported_rows ?? 0 : null}
            primaryFallback="None"
            primaryUnit={
              latestExportJob ? getExportJobHeadline(latestExportJob).replace(/^Export /, "") : "recent export jobs"
            }
            secondaryLine={latestExportJob ? getExportJobDetail(latestExportJob) : "No recent exports in this workspace."}
            action={{
              href: latestExportJob ? `/api/export/contracts/${latestExportJob.id}` : `/api/export/contracts?orgId=${encodeURIComponent(orgId)}`,
              label: latestExportJob ? "View export status" : "Run export",
              external: !latestExportJob,
            }}
            variant="compact"
            className="lg:col-span-2"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 md:gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-6 xl:sticky xl:top-6 xl:h-fit">
          <div className="ui-page-shell p-4 md:p-5">
            <div className="mb-4 space-y-1.5">
              <p className="ui-eyebrow">Filters</p>
              <h2 className="ui-section-title">Refine the list</h2>
              <p className="ui-support-copy">Search by contract context, then narrow the visible queue with date, owner, region, and operational flags.</p>
            </div>
            <form className="space-y-3.5 md:space-y-4" action="/contracts" method="get">
              <div>
                <label htmlFor="contract-search" className="ui-label-caps">
                  Search
                </label>
                <input
                  id="contract-search"
                  name="search"
                  type="search"
                  placeholder="Title, counterparty, type, dates..."
                  defaultValue={searchParams.search || ""}
                  className="ui-input-compact w-full"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="contract-deadline-filter" className="ui-label-caps">
                  Date preset
                </label>
                <select
                  id="contract-deadline-filter"
                  name="deadline"
                  defaultValue={deadline}
                  className="ui-input-compact w-full"
                >
                  {DEADLINE_OPTIONS.map((o) => (
                    <option key={o.value || "any"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="contract-sort" className="ui-label-caps">
                  Sort
                </label>
                <select
                  id="contract-sort"
                  name="sort"
                  defaultValue={searchParams.sort === "created" ? "created" : "activity"}
                  className="ui-input-compact w-full"
                >
                  <option value="activity">Recent activity</option>
                  <option value="created">Recently created</option>
                </select>
              </div>
              {searchParams.status && (
                <input type="hidden" name="status" value={searchParams.status} />
              )}
              {searchParams.owner && (
                <input type="hidden" name="owner" value={searchParams.owner} />
              )}
              {searchParams.region && (
                <input type="hidden" name="region" value={searchParams.region} />
              )}
              {searchParams.exceptions ? (
                <input type="hidden" name="exceptions" value={searchParams.exceptions} />
              ) : null}
              {searchParams.review ? (
                <input type="hidden" name="review" value={searchParams.review} />
              ) : null}
              {searchParams.data_quality ? (
                <input type="hidden" name="data_quality" value={searchParams.data_quality} />
              ) : null}
              {searchParams.evidence ? (
                <input type="hidden" name="evidence" value={searchParams.evidence} />
              ) : null}
              <input type="hidden" name="page" value="1" />
              <button type="submit" className="ui-btn-primary w-full">
                Apply filters
              </button>
            </form>

            <div className="mt-4 border-t border-[var(--border-subtle)] pt-3.5 md:mt-5 md:pt-4">
              <p className="ui-label-caps mb-2">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {statuses.map((s) => (
                  <Link
                    key={s.value}
                    href={buildContractsListHref({
                      ...baseParams,
                      status: s.value || undefined,
                    })}
                    className={(searchParams.status || "") === s.value ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-4 border-t border-[var(--border-subtle)] pt-3.5 md:mt-5 md:pt-4">
              <p className="ui-label-caps mb-2">Region</p>
              <div className="flex flex-wrap gap-1.5">
                {["", "NA", "EMEA", "APAC", "LATAM"].map((region) => (
                  <Link
                    key={region || "all"}
                    href={buildContractsListHref({
                      ...baseParams,
                      status: searchParams.status,
                      region: region || undefined,
                    })}
                    className={(searchParams.region || "") === region ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                  >
                    {region || "All"}
                  </Link>
                ))}
              </div>
            </div>

            {members.length > 1 && (
              <div className="mt-4 border-t border-[var(--border-subtle)] pt-3.5 md:mt-5 md:pt-4">
                <p className="ui-label-caps mb-2">Owner</p>
                <div className="flex flex-wrap gap-1.5">
                  <Link
                    href={buildContractsListHref({
                      ...baseParams,
                      status: searchParams.status,
                    })}
                    className={!searchParams.owner ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                  >
                    All
                  </Link>
                  {members.map((m) => (
                    <Link
                      key={m.id}
                      href={buildContractsListHref({
                        ...baseParams,
                        status: searchParams.status,
                        owner: m.id,
                      })}
                      className={searchParams.owner === m.id ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                    >
                      {m.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 border-t border-[var(--border-subtle)] pt-3.5 md:mt-5 md:pt-4">
              <p className="ui-label-caps mb-2">Operational filters</p>
              <div className="flex flex-wrap gap-1.5">
                <Link
                  href={buildContractsListHref({
                    ...baseParams,
                    status: searchParams.status,
                    exceptions: exceptionsFilter === "open" ? undefined : "open",
                  })}
                  className={exceptionsFilter === "open" ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                >
                  Open exceptions
                </Link>
                <Link
                  href={buildContractsListHref({
                    ...baseParams,
                    status: searchParams.status,
                    review: reviewFilter === "pending" ? undefined : "pending",
                  })}
                  className={reviewFilter === "pending" ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                >
                  Needs review
                </Link>
                <Link
                  href={buildContractsListHref({
                    ...baseParams,
                    status: searchParams.status,
                    data_quality:
                      dataQualityFilter === "missing_critical" ? undefined : "missing_critical",
                  })}
                  className={dataQualityFilter === "missing_critical" ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                >
                  Missing critical dates
                </Link>
                <Link
                  href={buildContractsListHref({
                    ...baseParams,
                    status: searchParams.status,
                    evidence: evidenceFilter === "outstanding" ? undefined : "outstanding",
                  })}
                  className={evidenceFilter === "outstanding" ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                >
                  Evidence outstanding
                </Link>
                <Link
                  href={buildContractsListHref({
                    ...baseParams,
                    status: searchParams.status,
                    health: healthFilter === "watch" ? undefined : "watch",
                  })}
                  className={healthFilter === "watch" ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                >
                  Health watch
                </Link>
              </div>
            </div>
          </div>

          <div className="ui-page-shell p-4 md:p-5">
            <div className="mb-4 space-y-1.5">
              <p className="ui-eyebrow">Saved views</p>
              <h2 className="ui-section-title">Repeatable queue cuts</h2>
              <p className="ui-support-copy">Capture the current filter state, then turn on weekly or monthly summaries for the views you revisit.</p>
            </div>
            <ContractsSavedViewCreateForm
              organizationId={orgId}
              canEdit={canEdit}
              defaults={{
                search: searchParams.search || "",
                status: searchParams.status || "",
                owner: searchParams.owner || "",
                region: searchParams.region || "",
                deadline: searchParams.deadline || "",
                sort: searchParams.sort || "",
                exceptions: searchParams.exceptions || "",
                review: searchParams.review || "",
                data_quality: searchParams.data_quality || "",
                evidence: searchParams.evidence || "",
              }}
            />
            {savedViews.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-[var(--border-subtle)] pt-3.5 md:pt-4">
                {savedViews.map((view) => (
                  <div key={view.id} className="ui-soft-details p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={view.href} className="truncate text-[12px] font-semibold text-[var(--text-primary)] hover:text-[var(--accent-strong)]">
                        {view.name}
                      </Link>
                      <form action={deleteSavedView.bind(null, view.id) as never}>
                        <button
                          type="submit"
                          aria-label={`Delete saved view ${view.name}`}
                          className="ui-icon-button min-h-7 min-w-7 rounded-full px-1.5 py-0.5 text-[11px]"
                        >
                          x
                        </button>
                      </form>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <form action={setSavedViewWeeklySummary.bind(null, view.id, !view.weeklyActive) as never}>
                        <button
                          type="submit"
                          className={
                            view.weeklyActive ? SAVED_VIEW_TOGGLE_WEEKLY_ACTIVE_CLASS : SAVED_VIEW_TOGGLE_IDLE_CLASS
                          }
                        >
                          {view.weeklyActive ? "Weekly on" : "Weekly off"}
                        </button>
                      </form>
                      <form action={setSavedViewMonthlySummary.bind(null, view.id, !view.monthlyActive) as never}>
                        <button
                          type="submit"
                          className={
                            view.monthlyActive ? SAVED_VIEW_TOGGLE_MONTHLY_ACTIVE_CLASS : SAVED_VIEW_TOGGLE_IDLE_CLASS
                          }
                        >
                          {view.monthlyActive ? "Monthly on" : "Monthly off"}
                        </button>
                      </form>
                    </div>
                    {(view.weeklyActive || view.monthlyActive) && (
                      <form action={setSavedViewWeeklyRecipients.bind(null, view.id) as never} className="mt-2 flex gap-1.5">
                        <input
                          name="recipientsCsv"
                          defaultValue={view.recipientsCsv}
                          placeholder="extra@company.com"
                          className="ui-input-compact h-7 text-[11px]"
                        />
                        <button type="submit" className="ui-btn-secondary rounded-full px-2 py-0.5 text-[11px]">
                          Save
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="space-y-3.5 md:space-y-4">
          <div className="ui-toolbar-strong p-3.5 md:p-4">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] md:gap-2 md:text-[12px]">
              <span className="ui-chip">Rows: {contractTotal}</span>
              <span className="ui-chip">Page {page}</span>
              {activeStatusLabel ? <span className="ui-chip">Status: {activeStatusLabel}</span> : null}
              {searchParams.deadline ? <span className="ui-chip">Date: {searchParams.deadline}</span> : null}
              {activeFilters.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeFilters.map((filter) => (
                    <span key={filter} className="ui-chip">
                      {filter}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="ui-chip">No active filters</span>
              )}
              <Link href="/contracts/review" className="ui-link text-[11px] md:ml-auto md:text-[12px]">
                Continue review queue
              </Link>
            </div>
          </div>
          {contractsPageError ? (
            <V10RecoverableState
              state="failed"
              title="Contracts could not be loaded"
              reason="The contract list query failed, so this is not being shown as an empty portfolio."
              accessibleName="Contracts list failed state"
              nextActionLabel="Retry contracts"
              nextAction={
                <Link href="/contracts" className="ui-link">
                  Retry contracts
                </Link>
              }
            />
          ) : null}
          {!contractsPageError ? (
            <ContractTable
              contracts={contracts}
              reviewStats={reviewStats}
              rowSignals={rowSignals}
              filterFingerprint={filterFingerprint}
              emptyState={
                activeFilters.length > 0 || sanitizedSearch
                  ? {
                      title: "No contracts match these filters",
                      copy: "Clear the filters or search terms to return to the full contract list.",
                      actionHref: "/contracts",
                      actionLabel: "Clear filters",
                    }
                  : undefined
              }
              bulkActions={{
                canEdit,
                orgId,
                members,
              }}
              footer={
                <ContractPagination
                  total={contractTotal}
                  page={page}
                  pageSize={CONTRACTS_PAGE_SIZE}
                  basePath="/contracts"
                  queryParams={paginationQuery}
                />
              }
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}
