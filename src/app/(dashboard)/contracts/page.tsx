import { getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import {
  isHrefEligibleForProductSurface,
  loadProductSurfaceContext,
} from "@/lib/product-surface";
import { ContractTable } from "@/components/contracts/contract-table";
import { ContractPagination } from "@/components/contracts/contract-pagination";
import { V10RecoverableState } from "@/components/ui/v10-recoverable-state";
import { attachOwnerProfiles, STATUS_LABELS } from "@/lib/contracts";
import { fetchContractsPage, CONTRACTS_PAGE_SIZE } from "@/lib/contract-list";
import { getReviewStatsForContractIds } from "@/lib/contract-review-stats";
import { deleteSavedView } from "@/actions/saved-views";
import { ContractsSavedViewCreateForm } from "@/components/contracts/contracts-saved-view-create-form";
import {
  getContractIdsForDeadlinePreset,
  getContractIdsMatchingFieldSearch,
  getContractIdsMatchingOwnerOrTagSearch,
  type DeadlinePreset,
  DEADLINE_PRESET_VALUES,
} from "@/lib/contract-filters";
import Link from "next/link";
import {
  ChevronDown,
  Download,
  Eye,
  Files,
  SlidersHorizontal,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { redirect } from "next/navigation";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { UiSelect } from "@/components/ui/ui-select";
import { surfaceTestIds } from "@/lib/qa/test-ids";
import {
  combineContractListIntersectIds,
  parseContractListSort,
  resolveAuxiliaryContractListIntersectIds,
} from "@/lib/contract-list-id-filters";
import { getContractListRowSignalsMap } from "@/lib/contract-list-row-signals";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import type { OrgRole } from "@/lib/types";
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

function parseWorkFilter(v: string | undefined): "" | "open" {
  return v === "open" ? "open" : "";
}

function parseHealthFilter(v: string | undefined): "" | "watch" {
  return v === "watch" ? "watch" : "";
}

const FILTER_PILL_IDLE_CLASS = "ui-filter-pill";
const FILTER_PILL_ACTIVE_CLASS = "ui-filter-pill ui-filter-pill-active";

export default async function ContractsPage(props: {
  searchParams: Promise<{
    status?: string;
    search?: string;
    owner?: string;
    region?: string;
    deadline?: string;
    sort?: string;
    counterparty?: string;
    contract_type?: string;
    exceptions?: string;
    review?: string;
    data_quality?: string;
    evidence?: string;
    work?: string;
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
  const workFilter = parseWorkFilter(searchParams.work);
  const healthFilter = parseHealthFilter(searchParams.health);
  const sortKey = parseContractListSort(searchParams.sort);

  const [deadlineIds, fieldSearchIds, ownerOrTagSearchIds, auxIntersect] = await Promise.all([
    deadline
      ? getContractIdsForDeadlinePreset(admin, orgId, deadline)
      : Promise.resolve<string[] | null>(null),
    sanitizedSearch
      ? getContractIdsMatchingFieldSearch(admin, orgId, sanitizedSearch)
      : Promise.resolve<string[]>([]),
    sanitizedSearch
      ? getContractIdsMatchingOwnerOrTagSearch(admin, orgId, sanitizedSearch)
      : Promise.resolve<string[]>([]),
    resolveAuxiliaryContractListIntersectIds(admin, orgId, {
      exceptions: exceptionsFilter || undefined,
      review: reviewFilter || undefined,
      data_quality: dataQualityFilter || undefined,
      evidence: evidenceFilter || undefined,
      work: workFilter || undefined,
      health: healthFilter || undefined,
      viewer: { role: ctx.role, workspaceMode: productSurface.mode },
    }),
  ]);

  const intersectIds = combineContractListIntersectIds([deadlineIds, auxIntersect]);
  const searchMatchIds = [...new Set([...fieldSearchIds, ...ownerOrTagSearchIds])];

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
  const filterOptionsPromise = admin
    .from("contracts")
    .select("counterparty, contract_type")
    .eq("organization_id", orgId)
    .limit(1000);
  const contractsPagePromise = fetchContractsPage(
    admin,
    {
      orgId,
      status: searchParams.status,
      owner: searchParams.owner,
      counterparty: searchParams.counterparty,
      contractType: searchParams.contract_type,
      region: searchParams.region,
      intersectIds,
      sanitizedSearch,
      fieldSearchIds: searchMatchIds,
      sort: sortKey === "created" ? "created" : "activity",
    },
    page
  );
  const [
    membersData,
    { data: savedViewsData },
    { data: exportJobsData },
    { data: filterOptionsData },
    { contracts: contractsData, total: contractTotal, error: contractsPageError },
    role,
  ] = await Promise.all([
    membersPromise,
    savedViewsPromise,
    exportJobsPromise,
    filterOptionsPromise,
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
        counterparty: searchParams.counterparty,
        contract_type: searchParams.contract_type,
        region: searchParams.region,
        deadline: searchParams.deadline,
        sort: searchParams.sort,
        exceptions: searchParams.exceptions,
        review: searchParams.review,
        data_quality: searchParams.data_quality,
        evidence: searchParams.evidence,
        work: searchParams.work,
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
  const counterpartyOptions = [
    ...new Set(
      (filterOptionsData ?? [])
        .map((row) => String(row.counterparty ?? "").trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));
  const contractTypeOptions = [
    ...new Set(
      (filterOptionsData ?? [])
        .map((row) => String(row.contract_type ?? "").trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));

  const [contracts, reviewStats, rowSignals] = await Promise.all([
    attachOwnerProfiles(admin, orgId, contractsData),
    getReviewStatsForContractIds(
      admin,
      contractsData.map((c) => c.id)
    ),
    getContractListRowSignalsMap(
      admin,
      orgId,
      contractsData.map((c) => c.id),
      { role: ctx.role, workspaceMode: productSurface.mode }
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
        counterparty: q.counterparty,
        contract_type: q.contract_type,
        region: q.region,
        deadline: q.deadline,
        sort: q.sort,
        exceptions: q.exceptions,
        review: q.review,
        data_quality: q.data_quality,
        evidence: q.evidence,
        work: q.work,
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
    counterparty: searchParams.counterparty,
    contract_type: searchParams.contract_type,
    region: searchParams.region,
    deadline: searchParams.deadline,
    sort: searchParams.sort,
    exceptions: searchParams.exceptions,
    review: searchParams.review,
    data_quality: searchParams.data_quality,
    evidence: searchParams.evidence,
    work: searchParams.work,
    health: searchParams.health,
  };

  const paginationQuery: Record<string, string | undefined> = {
    ...baseParams,
    status: searchParams.status,
    region: searchParams.region,
    counterparty: searchParams.counterparty,
    contract_type: searchParams.contract_type,
  };

  const filterFingerprint = JSON.stringify({
    status: searchParams.status ?? "",
    owner: searchParams.owner ?? "",
    counterparty: searchParams.counterparty ?? "",
    contract_type: searchParams.contract_type ?? "",
    region: searchParams.region ?? "",
    deadline: searchParams.deadline ?? "",
    search: searchParams.search ?? "",
    sort: searchParams.sort ?? "",
    exceptions: searchParams.exceptions ?? "",
    review: searchParams.review ?? "",
    data_quality: searchParams.data_quality ?? "",
    evidence: searchParams.evidence ?? "",
    work: searchParams.work ?? "",
  });

  const pagePendingReview = contracts.filter((c) => c.status === "pending_review").length;
  const pageActive = contracts.filter((c) => c.status === "active").length;
  const latestExportJob = exportJobsData?.[0] ?? null;
  // v14 — page-level signal counts feed the quick-filter chips above the table
  // and the operational signals tiles below it.
  const signalCounts = Object.values(rowSignals).reduce(
    (acc, sig) => {
      if (!sig) return acc;
      if ((sig.openExceptionCount ?? 0) > 0) acc.openExceptions += 1;
      if (sig.missingCriticalDates) acc.missingDates += 1;
      if (
        sig.nextHorizonDays != null &&
        sig.nextHorizonDays >= 0 &&
        sig.nextHorizonDays <= 90
      ) acc.renewingSoon += 1;
      if ((sig.outstandingEvidenceCount ?? 0) > 0) acc.evidenceDue += 1;
      if ((sig.openWorkCount ?? 0) > 0) acc.openWork += 1;
      return acc;
    },
    { openExceptions: 0, missingDates: 0, renewingSoon: 0, evidenceDue: 0, openWork: 0 }
  );
  const activeFilters = [
    searchParams.search ? `Search: ${searchParams.search}` : null,
    activeStatusLabel ? `Status: ${activeStatusLabel}` : null,
    searchParams.owner ? `Owner: filtered` : null,
    searchParams.counterparty ? `Counterparty: ${searchParams.counterparty}` : null,
    searchParams.contract_type ? `Type: ${searchParams.contract_type}` : null,
    searchParams.region ? `Region: ${searchParams.region}` : null,
    searchParams.deadline ? `Date: ${searchParams.deadline}` : null,
    searchParams.sort === "created" ? "Sort: created" : null,
    searchParams.exceptions ? `Exceptions: ${searchParams.exceptions}` : null,
    searchParams.review ? `Review: ${searchParams.review}` : null,
    searchParams.data_quality ? `Data: ${searchParams.data_quality}` : null,
    searchParams.evidence ? `Evidence: ${searchParams.evidence}` : null,
    searchParams.work ? `Work: ${searchParams.work}` : null,
  ].filter((value): value is string => value != null);

  const activeFilterCount = activeFilters.length;
  const exportItems: { href: string; label: string }[] = [
    { href: `/api/export/contracts?orgId=${encodeURIComponent(orgId)}`, label: "Export CSV" },
    { href: "/api/export/calendar", label: "Export calendar" },
    ...visibleMoreActionLinks,
  ];
  const latestExportSummary = latestExportJob
    ? `Latest export: ${latestExportJob.exported_rows ?? 0} rows`
    : null;

  const activeSavedView = savedViews.find((v) => {
    try {
      const viewParams = new URL(v.href, "http://x").searchParams;
      const viewKeys = [
        "search",
        "status",
        "owner",
        "counterparty",
        "contract_type",
        "region",
        "deadline",
        "sort",
        "exceptions",
        "review",
        "data_quality",
        "evidence",
        "work",
      ];
      return viewKeys.every((key) => (viewParams.get(key) ?? "") === ((searchParams as Record<string, string | undefined>)[key] ?? ""));
    } catch {
      return false;
    }
  });

  return (
    <div className="ui-page-stack">
      <DashboardPageHeader
        icon={<Files className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Contract inventory"
        title="Contracts"
        lead={
          contractTotal === 0 ? (
            "Upload your first signed agreement to start tracking review, dates, owners, work, evidence, and reports."
          ) : (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <Link
                href="/contracts?status=pending_review"
                className="ui-hero-metric-chip ui-hero-metric-chip-tone-warning"
              >
                <strong>{pagePendingReview}</strong> Pending
              </Link>
              <Link
                href="/contracts?status=active"
                className="ui-hero-metric-chip ui-hero-metric-chip-tone-success"
              >
                <strong>{pageActive}</strong> Active
              </Link>
              <span className="ui-hero-metric-chip">
                <strong>{contractTotal}</strong> Total
              </span>
            </span>
          )
        }
        actions={
          <>
            <Link
              href="/contracts/new"
              className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
            >
              <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              Upload contract
            </Link>
            <Link
              href="/contracts/bulk"
              className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
            >
              <Upload className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              Import CSV
            </Link>
            <details className="relative">
              <summary className="ui-btn-ghost inline-flex cursor-pointer list-none items-center gap-1.5 px-3 py-1.5 text-[12.5px] [&::-webkit-details-marker]:hidden">
                <Download className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                Export
                <ChevronDown className="popover-caret h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              </summary>
              <div className="ui-popover right-0 left-auto w-64 max-w-[calc(100vw-3rem)] p-0">
                <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] text-[12.5px]">
                  {exportItems.map((row) => (
                    <li key={row.href}>
                      <Link
                        href={row.href}
                        className="block px-4 py-2 text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_7%,transparent)] hover:text-[var(--accent-strong)]"
                      >
                        {row.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                {latestExportSummary ? (
                  <p className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] px-4 py-2 text-[10.5px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    {latestExportSummary}
                  </p>
                ) : null}
              </div>
            </details>
          </>
        }
      />

      {contractTotal === 0 ? (
        <section
          data-testid={surfaceTestIds.contractsPageSnapshot}
          className="ui-card-raised flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-6"
        >
          <div className="min-w-0">
            <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
              <span className="landing-eyebrow-dot" aria-hidden />
              Get started
            </p>
            <p className="mt-2 text-[14px] font-semibold text-[var(--text-primary)]">
              No contracts in scope yet
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
              Upload your first signed agreement.
            </p>
          </div>
          <Link
            href="/contracts/new"
            className="ui-btn-primary inline-flex shrink-0 items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
          >
            <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            Upload contract
          </Link>
        </section>
      ) : null}

      {/* v13 toolbar: slim single row — search + date + sort + Filters popover + Saved views popover + Save view.
          NB: the toolbar wrapper is a <div>; the <form> for SEARCH/DATE/SORT renders with className="contents"
          so children flex inline with the popover triggers without nesting <form> elements (the popovers
          contain their own action forms — delete view, create view — which cannot legally nest). */}
      <section aria-label="Filters" className="space-y-2">
        <div className="ui-filter-toolbar">
          <form action="/contracts" method="get" className="contents">
            <input
              aria-label="Search contracts by name, counterparty, owner, or tag"
              id="contract-search"
              name="search"
              type="search"
              placeholder="Search name, counterparty, owner, tag…"
              defaultValue={searchParams.search || ""}
              className="ui-input-compact h-9 min-w-0 flex-1 lg:max-w-md"
              autoComplete="off"
            />
            <UiSelect
              name="deadline"
              defaultValue={deadline}
              ariaLabel="Date preset"
              placeholder="Any date"
              buttonClassName="h-9 min-w-[10rem] text-[12.5px]"
              options={DEADLINE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <UiSelect
              name="sort"
              defaultValue={searchParams.sort === "created" ? "created" : "activity"}
              ariaLabel="Sort"
              buttonClassName="h-9 min-w-[10rem] text-[12.5px]"
              options={[
                { value: "activity", label: "Recent activity" },
                { value: "created", label: "Recently created" },
              ]}
            />
            {searchParams.status ? <input type="hidden" name="status" value={searchParams.status} /> : null}
            {searchParams.owner ? <input type="hidden" name="owner" value={searchParams.owner} /> : null}
            {searchParams.counterparty ? <input type="hidden" name="counterparty" value={searchParams.counterparty} /> : null}
            {searchParams.contract_type ? <input type="hidden" name="contract_type" value={searchParams.contract_type} /> : null}
            {searchParams.region ? <input type="hidden" name="region" value={searchParams.region} /> : null}
            {searchParams.exceptions ? <input type="hidden" name="exceptions" value={searchParams.exceptions} /> : null}
            {searchParams.review ? <input type="hidden" name="review" value={searchParams.review} /> : null}
            {searchParams.data_quality ? <input type="hidden" name="data_quality" value={searchParams.data_quality} /> : null}
            {searchParams.evidence ? <input type="hidden" name="evidence" value={searchParams.evidence} /> : null}
            {searchParams.work ? <input type="hidden" name="work" value={searchParams.work} /> : null}
            <input type="hidden" name="page" value="1" />
            <button
              type="submit"
              aria-label="Apply search, date, and sort"
              className="ui-btn-secondary inline-flex h-9 items-center px-3 text-[12.5px] font-semibold"
              title="Apply (or press Enter)"
            >
              Apply
            </button>
          </form>

          {/* Filters popover */}
          <details className="relative">
            <summary className="ui-toolbar-dropdown" aria-haspopup="dialog">
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              Filters
              {activeFilterCount > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--accent)_22%,var(--surface-raised))] px-1.5 text-[10.5px] font-bold tabular-nums text-[var(--accent-strong)]">
                  {activeFilterCount}
                </span>
              ) : null}
              <ChevronDown className="popover-caret h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            </summary>
            <div className="ui-popover left-0 right-auto w-[22rem] max-w-[calc(100vw-3rem)]" role="dialog" aria-label="Filter contracts">
              <div className="ui-popover-section">
                <p className="ui-popover-section-heading">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {statuses.map((s) => (
                    <Link
                      key={`status-${s.value}`}
                      href={buildContractsListHref({ ...baseParams, status: s.value || undefined })}
                      className={(searchParams.status || "") === s.value ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              </div>
              {counterpartyOptions.length > 0 ? (
                <div className="ui-popover-section">
                  <p className="ui-popover-section-heading">Counterparty</p>
                  <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
                    <Link
                      href={buildContractsListHref({ ...baseParams, status: searchParams.status, counterparty: undefined })}
                      className={!searchParams.counterparty ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                    >
                      All
                    </Link>
                    {counterpartyOptions.slice(0, 24).map((counterparty) => (
                      <Link
                        key={`counterparty-${counterparty}`}
                        href={buildContractsListHref({ ...baseParams, status: searchParams.status, counterparty })}
                        className={searchParams.counterparty === counterparty ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                      >
                        {counterparty}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
              {contractTypeOptions.length > 0 ? (
                <div className="ui-popover-section">
                  <p className="ui-popover-section-heading">Contract type</p>
                  <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
                    <Link
                      href={buildContractsListHref({ ...baseParams, status: searchParams.status, contract_type: undefined })}
                      className={!searchParams.contract_type ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                    >
                      All
                    </Link>
                    {contractTypeOptions.slice(0, 24).map((contractType) => (
                      <Link
                        key={`contract-type-${contractType}`}
                        href={buildContractsListHref({ ...baseParams, status: searchParams.status, contract_type: contractType })}
                        className={searchParams.contract_type === contractType ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                      >
                        {contractType}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="ui-popover-section">
                <p className="ui-popover-section-heading">Region</p>
                <div className="flex flex-wrap gap-1.5">
                  {["", "NA", "EMEA", "APAC", "LATAM"].map((region) => (
                    <Link
                      key={`region-${region || "all"}`}
                      href={buildContractsListHref({ ...baseParams, status: searchParams.status, region: region || undefined })}
                      className={(searchParams.region || "") === region ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                    >
                      {region || "All"}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="ui-popover-section">
                <p className="ui-popover-section-heading">Operational</p>
                <div className="flex flex-wrap gap-1.5">
                  <Link
                    href={buildContractsListHref({ ...baseParams, status: searchParams.status, exceptions: exceptionsFilter === "open" ? undefined : "open" })}
                    className={exceptionsFilter === "open" ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                  >
                    Open exceptions
                  </Link>
                  <Link
                    href={buildContractsListHref({ ...baseParams, status: searchParams.status, review: reviewFilter === "pending" ? undefined : "pending" })}
                    className={reviewFilter === "pending" ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                  >
                    Needs review
                  </Link>
                  <Link
                    href={buildContractsListHref({ ...baseParams, status: searchParams.status, data_quality: dataQualityFilter === "missing_critical" ? undefined : "missing_critical" })}
                    className={dataQualityFilter === "missing_critical" ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                  >
                    Missing dates
                  </Link>
                  <Link
                    href={buildContractsListHref({ ...baseParams, status: searchParams.status, evidence: evidenceFilter === "outstanding" ? undefined : "outstanding" })}
                    className={evidenceFilter === "outstanding" ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                  >
                    Evidence due
                  </Link>
                  <Link
                    href={buildContractsListHref({ ...baseParams, status: searchParams.status, work: workFilter === "open" ? undefined : "open" })}
                    className={workFilter === "open" ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                  >
                    Open work
                  </Link>
                </div>
              </div>
              {members.length > 1 ? (
                <div className="ui-popover-section">
                  <p className="ui-popover-section-heading">Owner</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Link
                      href={buildContractsListHref({ ...baseParams, status: searchParams.status })}
                      className={!searchParams.owner ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                    >
                      All
                    </Link>
                    {members.map((m) => (
                      <Link
                        key={m.id}
                        href={buildContractsListHref({ ...baseParams, status: searchParams.status, owner: m.id })}
                        className={searchParams.owner === m.id ? FILTER_PILL_ACTIVE_CLASS : FILTER_PILL_IDLE_CLASS}
                      >
                        {m.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
              {activeFilterCount > 0 ? (
                <div className="mt-3 flex items-center justify-between border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-2.5">
                  <Link href="/contracts" className="ui-link text-[12px]">
                    Clear all filters
                  </Link>
                  <span className="text-[11px] text-[var(--text-tertiary)]">{activeFilterCount} active</span>
                </div>
              ) : null}
            </div>
          </details>

          {/* Saved views popover */}
          <details className="relative">
            <summary className="ui-toolbar-dropdown" aria-haspopup="dialog">
              <Eye className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              <span className="max-w-[10rem] truncate">{activeSavedView?.name ?? "Views"}</span>
              <ChevronDown className="popover-caret h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            </summary>
            <div className="ui-popover left-0 right-auto w-[22rem] max-w-[calc(100vw-3rem)]" role="dialog" aria-label="Saved views">
              <ul className="space-y-1">
                <li>
                  <Link
                    href="/contracts"
                    className={`flex items-center justify-between rounded-md px-2 py-1.5 text-[12.5px] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_7%,transparent)] ${!activeSavedView ? "bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-strong)]" : "text-[var(--text-secondary)]"}`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Eye className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                      All contracts
                    </span>
                  </Link>
                </li>
                {savedViews.map((view) => (
                  <li key={view.id} className="group flex items-center gap-1">
                    <Link
                      href={view.href}
                      className={`flex flex-1 items-center justify-between rounded-md px-2 py-1.5 text-[12.5px] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_7%,transparent)] ${activeSavedView?.id === view.id ? "bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-strong)]" : "text-[var(--text-secondary)]"}`}
                    >
                      <span className="truncate">{view.name}</span>
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                        {view.weeklyActive ? <span title="Weekly summary on">W</span> : null}
                        {view.monthlyActive ? <span title="Monthly summary on">M</span> : null}
                      </span>
                    </Link>
                    <form
                      action={deleteSavedView.bind(null, view.id) as never}
                    >
                      <button
                        type="submit"
                        aria-label={`Delete saved view ${view.name}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-tertiary)] opacity-0 transition-all group-hover:opacity-100 hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_14%,transparent)] hover:text-[var(--danger-ink)]"
                      >
                        <Trash2 className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-2.5">
                <p className="ui-popover-section-heading">Save current view</p>
                <ContractsSavedViewCreateForm
                  organizationId={orgId}
                  canEdit={canEdit}
                  defaults={{
                    search: searchParams.search || "",
                    status: searchParams.status || "",
                    owner: searchParams.owner || "",
                    counterparty: searchParams.counterparty || "",
                    contract_type: searchParams.contract_type || "",
                    region: searchParams.region || "",
                    deadline: searchParams.deadline || "",
                    sort: searchParams.sort || "",
                    exceptions: searchParams.exceptions || "",
                    review: searchParams.review || "",
                    data_quality: searchParams.data_quality || "",
                    evidence: searchParams.evidence || "",
                    work: searchParams.work || "",
                  }}
                />
              </div>
            </div>
          </details>
        </div>

        {/* Active filter chips — renders only when filters are applied. */}
        {activeFilterCount > 0 ? (
          <div
            role="group"
            aria-label="Active filters"
            className="flex flex-wrap items-center gap-1.5 px-1"
          >
            {searchParams.search ? (
              <Link
                href={buildContractsListHref({ ...baseParams, search: undefined, status: searchParams.status })}
                className="ui-active-filter-chip"
                aria-label={`Remove filter: Search ${searchParams.search}`}
              >
                Search: {searchParams.search}
                <span className="ui-active-filter-chip-remove" aria-hidden>
                  <X className="h-3 w-3" strokeWidth={2} />
                </span>
              </Link>
            ) : null}
            {activeStatusLabel ? (
              <Link
                href={buildContractsListHref({ ...baseParams, status: undefined })}
                className="ui-active-filter-chip"
                aria-label={`Remove filter: Status ${activeStatusLabel}`}
              >
                Status: {activeStatusLabel}
                <span className="ui-active-filter-chip-remove" aria-hidden>
                  <X className="h-3 w-3" strokeWidth={2} />
                </span>
              </Link>
            ) : null}
            {searchParams.region ? (
              <Link
                href={buildContractsListHref({ ...baseParams, status: searchParams.status, region: undefined })}
                className="ui-active-filter-chip"
                aria-label={`Remove filter: Region ${searchParams.region}`}
              >
                Region: {searchParams.region}
                <span className="ui-active-filter-chip-remove" aria-hidden>
                  <X className="h-3 w-3" strokeWidth={2} />
                </span>
              </Link>
            ) : null}
            {searchParams.owner ? (
              <Link
                href={buildContractsListHref({ ...baseParams, status: searchParams.status, owner: undefined })}
                className="ui-active-filter-chip"
                aria-label="Remove filter: Owner"
              >
                Owner: {members.find((m) => m.id === searchParams.owner)?.label ?? "Selected"}
                <span className="ui-active-filter-chip-remove" aria-hidden>
                  <X className="h-3 w-3" strokeWidth={2} />
                </span>
              </Link>
            ) : null}
            {searchParams.counterparty ? (
              <Link
                href={buildContractsListHref({ ...baseParams, status: searchParams.status, counterparty: undefined })}
                className="ui-active-filter-chip"
                aria-label={`Remove filter: Counterparty ${searchParams.counterparty}`}
              >
                Counterparty: {searchParams.counterparty}
                <span className="ui-active-filter-chip-remove" aria-hidden>
                  <X className="h-3 w-3" strokeWidth={2} />
                </span>
              </Link>
            ) : null}
            {searchParams.contract_type ? (
              <Link
                href={buildContractsListHref({ ...baseParams, status: searchParams.status, contract_type: undefined })}
                className="ui-active-filter-chip"
                aria-label={`Remove filter: Contract type ${searchParams.contract_type}`}
              >
                Type: {searchParams.contract_type}
                <span className="ui-active-filter-chip-remove" aria-hidden>
                  <X className="h-3 w-3" strokeWidth={2} />
                </span>
              </Link>
            ) : null}
            {searchParams.deadline ? (
              <Link
                href={buildContractsListHref({ ...baseParams, status: searchParams.status, deadline: undefined })}
                className="ui-active-filter-chip"
                aria-label={`Remove filter: Date ${searchParams.deadline}`}
              >
                Date: {searchParams.deadline.replace(/_/g, " ")}
                <span className="ui-active-filter-chip-remove" aria-hidden>
                  <X className="h-3 w-3" strokeWidth={2} />
                </span>
              </Link>
            ) : null}
            {searchParams.sort === "created" ? (
              <Link
                href={buildContractsListHref({ ...baseParams, status: searchParams.status, sort: undefined })}
                className="ui-active-filter-chip"
                aria-label="Remove filter: Sort by recently created"
              >
                Sort: created
                <span className="ui-active-filter-chip-remove" aria-hidden>
                  <X className="h-3 w-3" strokeWidth={2} />
                </span>
              </Link>
            ) : null}
            {searchParams.exceptions ? (
              <Link
                href={buildContractsListHref({ ...baseParams, status: searchParams.status, exceptions: undefined })}
                className="ui-active-filter-chip"
                aria-label="Remove filter: Open exceptions"
              >
                Open exceptions
                <span className="ui-active-filter-chip-remove" aria-hidden>
                  <X className="h-3 w-3" strokeWidth={2} />
                </span>
              </Link>
            ) : null}
            {searchParams.review ? (
              <Link
                href={buildContractsListHref({ ...baseParams, status: searchParams.status, review: undefined })}
                className="ui-active-filter-chip"
                aria-label="Remove filter: Needs review"
              >
                Needs review
                <span className="ui-active-filter-chip-remove" aria-hidden>
                  <X className="h-3 w-3" strokeWidth={2} />
                </span>
              </Link>
            ) : null}
            {searchParams.data_quality ? (
              <Link
                href={buildContractsListHref({ ...baseParams, status: searchParams.status, data_quality: undefined })}
                className="ui-active-filter-chip"
                aria-label="Remove filter: Missing dates"
              >
                Missing dates
                <span className="ui-active-filter-chip-remove" aria-hidden>
                  <X className="h-3 w-3" strokeWidth={2} />
                </span>
              </Link>
            ) : null}
            {searchParams.evidence ? (
              <Link
                href={buildContractsListHref({ ...baseParams, status: searchParams.status, evidence: undefined })}
                className="ui-active-filter-chip"
                aria-label="Remove filter: Evidence due"
              >
                Evidence due
                <span className="ui-active-filter-chip-remove" aria-hidden>
                  <X className="h-3 w-3" strokeWidth={2} />
                </span>
              </Link>
            ) : null}
            {searchParams.work ? (
              <Link
                href={buildContractsListHref({ ...baseParams, status: searchParams.status, work: undefined })}
                className="ui-active-filter-chip"
                aria-label="Remove filter: Open work"
              >
                Open work
                <span className="ui-active-filter-chip-remove" aria-hidden>
                  <X className="h-3 w-3" strokeWidth={2} />
                </span>
              </Link>
            ) : null}
            {activeFilterCount >= 2 ? (
              <Link href="/contracts" className="ui-link ml-1 text-[11px]">
                Clear all
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* v14/v15 — Quick-filter strip above the table. Renders only when no filters are
          already applied AND the workspace has at least one contract.
          v15: eyebrow demoted to caps-3, renamed "Common filters", separated to its own line. */}
      {activeFilterCount === 0 && contractTotal > 0 ? (
        <nav aria-label="Common filters" className="space-y-1.5 px-1">
          <p className="ui-caps-3 inline-flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
            <span className="landing-eyebrow-dot" aria-hidden />
            Common filters
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
          {pagePendingReview > 0 ? (
            <Link
              href="/contracts?status=pending_review"
              className="ui-quick-chip ui-quick-chip-tone-warning"
            >
              Pending review
              <span className="ui-quick-chip-count">{pagePendingReview}</span>
            </Link>
          ) : null}
          {signalCounts.openExceptions > 0 ? (
            <Link
              href="/contracts?exceptions=open"
              className="ui-quick-chip ui-quick-chip-tone-danger"
            >
              Open exceptions
              <span className="ui-quick-chip-count">{signalCounts.openExceptions}</span>
            </Link>
          ) : null}
          {signalCounts.missingDates > 0 ? (
            <Link
              href="/contracts?data_quality=missing_critical"
              className="ui-quick-chip ui-quick-chip-tone-warning"
            >
              Missing dates
              <span className="ui-quick-chip-count">{signalCounts.missingDates}</span>
            </Link>
          ) : null}
          {signalCounts.evidenceDue > 0 ? (
            <Link
              href="/contracts?evidence=outstanding"
              className="ui-quick-chip ui-quick-chip-tone-warning"
            >
              Evidence due
              <span className="ui-quick-chip-count">{signalCounts.evidenceDue}</span>
            </Link>
          ) : null}
          {signalCounts.openWork > 0 ? (
            <Link
              href="/contracts?work=open"
              className="ui-quick-chip"
            >
              Open work
              <span className="ui-quick-chip-count">{signalCounts.openWork}</span>
            </Link>
          ) : null}
          <Link href="/contracts?deadline=renewal_90" className="ui-quick-chip">
            Renewing in 90d
          </Link>
          {pageActive > 0 ? (
            <Link
              href="/contracts?status=active"
              className="ui-quick-chip ui-quick-chip-tone-success"
            >
              Active
              <span className="ui-quick-chip-count">{pageActive}</span>
            </Link>
          ) : null}
          </div>
        </nav>
      ) : null}

      <section>
        {contractsPageError ? (
          <V10RecoverableState
            state="failed"
            title="Contracts could not be loaded"
            reason="The contract list query failed, so this is not being shown as an empty contract list."
            accessibleName="Contracts list failed state"
            nextActionLabel="Retry contracts"
            nextAction={
              <Link href="/contracts" className="ui-link">
                Retry contracts
              </Link>
            }
          />
        ) : (
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
        )}
      </section>

    </div>
  );
}
