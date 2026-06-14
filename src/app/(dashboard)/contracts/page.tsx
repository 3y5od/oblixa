import { getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface";
import { ContractTable } from "@/components/contracts/contract-table";
import { ContractsFilterBar } from "@/components/contracts/contracts-filter-bar";
import { ContractsSavedViewsControl } from "@/components/contracts/contracts-saved-views-control";
import { DataFooter } from "@/components/ui/data-footer";
import { DataSurfaceShell, DataSurfaceCard } from "@/components/ui/data-surface-shell";
import { PortaledPopover } from "@/components/contracts/portaled-popover";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { attachOwnerProfiles, STATUS_LABELS } from "@/lib/contracts";
import { fetchContractsPage, CONTRACTS_PAGE_SIZE } from "@/lib/contract-list";
import { getReviewStatsForContractIds } from "@/lib/contract-review-stats";
import {
  getContractIdsForDeadlinePreset,
  getContractIdsMatchingFieldSearch,
  getContractIdsMatchingOwnerOrTagSearch,
  type DeadlinePreset,
  DEADLINE_PRESET_VALUES,
} from "@/lib/contract-filters";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  ClipboardCheck,
  Download,
  Files,
  FileText,
  Hourglass,
  Link2,
  ListChecks,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { redirect } from "next/navigation";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
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
  { value: "renewal_30", label: "Renewal in 30d" },
  { value: "renewal_90", label: "Renewal in 90d" },
  { value: "renewal_180", label: "Renewal in 180d" },
  { value: "renewal_365", label: "Renewal in 365d" },
  { value: "end_30", label: "End date in 30d" },
  { value: "end_90", label: "End date in 90d" },
  { value: "end_180", label: "End date in 180d" },
  { value: "end_365", label: "End date in 365d" },
  { value: "notice_deadline_30", label: "Notice in 30d" },
  { value: "notice_deadline_90", label: "Notice in 90d" },
  { value: "notice_deadline_180", label: "Notice in 180d" },
  { value: "notice_deadline_365", label: "Notice in 365d" },
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

// Filter pills no longer differentiate data-quality fallback values
// ("Tenants", "Other", email-only owners) — the earlier italic + brown
// treatment created visual noise without an actionable distinction at
// the filter level. Title attributes on the link still explain the
// fallback context on hover.

// Mirrors the data-quality token sets in `contract-table.tsx` so the
// filter dropdown applies the same flagging the row chips use.
const COUNTERPARTY_FALLBACK_TOKENS = new Set([
  "tenants",
  "tenant",
  "vendor",
  "counterparty",
  "supplier",
  "customer",
  "party",
  "other",
]);
const CONTRACT_TYPE_FALLBACK_TOKENS = new Set([
  "other",
  "unknown",
  "unclassified",
  "n/a",
]);
const OWNER_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_CONTRACT_SHORTCUT_COUNTS = {
  openProblems: 0,
  detailsToReview: 0,
  missingDates: 0,
  evidenceDue: 0,
  openTasks: 0,
  renewalWithin90Days: 0,
  active: 0,
};

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
  // The Export dropdown was previously a hybrid "Export + Navigation"
  // menu — it spread Approvals / Renewals / Tasks / Obligations /
  // Exceptions (duplicate sidebar nav) AND non-Core surfaces (Analytics
  // + Maintenance are Advanced-only per release-state §Product Modes;
  // Review cadence isn't in the Core spec at all). Those destinations
  // are reachable via the sidebar + cmd-K palette + their dedicated
  // routes; the dropdown now surfaces only real export actions.

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

  // Members are sorted so email-only fallbacks (members without a
  // `full_name`) appear after named members — same pattern as the
  // counterparty + contract-type fallback ordering.
  const members = (membersData ?? [])
    .map((m) => ({
      id: m.user_id,
      label: orgMemberProfileLabel(m.profiles, "Unknown"),
    }))
    .sort((a, b) => {
      const aFallback = OWNER_EMAIL_RE.test(a.label);
      const bFallback = OWNER_EMAIL_RE.test(b.label);
      if (aFallback !== bFallback) return aFallback ? 1 : -1;
      return a.label.localeCompare(b.label);
    });
  // Fallback values sort to the bottom of the list so real counterparties
  // / contract types appear first. The sort puts non-fallback values in
  // alphabetical order, then fallback values in alphabetical order — the
  // user's eye lands on actionable filter targets first, with the
  // data-quality flags grouped at the end.
  const counterpartyOptions = [
    ...new Set(
      (filterOptionsData ?? [])
        .map((row) => String(row.counterparty ?? "").trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => {
    const aFallback = COUNTERPARTY_FALLBACK_TOKENS.has(a.toLowerCase());
    const bFallback = COUNTERPARTY_FALLBACK_TOKENS.has(b.toLowerCase());
    if (aFallback !== bFallback) return aFallback ? 1 : -1;
    return a.localeCompare(b);
  });
  const contractTypeOptions = [
    ...new Set(
      (filterOptionsData ?? [])
        .map((row) => String(row.contract_type ?? "").trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => {
    const aFallback = CONTRACT_TYPE_FALLBACK_TOKENS.has(a.toLowerCase());
    const bFallback = CONTRACT_TYPE_FALLBACK_TOKENS.has(b.toLowerCase());
    if (aFallback !== bFallback) return aFallback ? 1 : -1;
    return a.localeCompare(b);
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

  const latestExportJob = exportJobsData?.[0] ?? null;
  const activeFilters = [
    searchParams.search ? `Search: ${searchParams.search}` : null,
    activeStatusLabel ? `Status: ${activeStatusLabel}` : null,
    searchParams.owner ? `Owner: filtered` : null,
    searchParams.counterparty ? `Counterparty: ${searchParams.counterparty}` : null,
    searchParams.contract_type ? `Type: ${searchParams.contract_type}` : null,
    searchParams.region ? `Region: ${searchParams.region}` : null,
    searchParams.deadline ? `Date: ${searchParams.deadline}` : null,
    searchParams.sort === "created" ? "Sort: created" : null,
    searchParams.exceptions ? `Problems: ${searchParams.exceptions}` : null,
    searchParams.review ? `Details: ${searchParams.review}` : null,
    searchParams.data_quality ? `Data: ${searchParams.data_quality}` : null,
    searchParams.evidence ? `Evidence: ${searchParams.evidence}` : null,
    searchParams.work ? `Tasks: ${searchParams.work}` : null,
  ].filter((value): value is string => value != null);

  const activeFilterCount = activeFilters.length;
  const shouldShowShortcutStrip = activeFilterCount === 0 && contractTotal > 0;
  const countContractsForShortcut = async ({
    status,
    intersectIds,
  }: {
    status?: string;
    intersectIds?: string[] | null;
  }) =>
    (
      await fetchContractsPage(
        admin,
        {
          orgId,
          status,
          intersectIds: intersectIds ?? null,
          sanitizedSearch: "",
          fieldSearchIds: [],
          sort: "activity",
        },
        1
      )
    ).total;
  const shortcutCounts = shouldShowShortcutStrip
    ? await (async () => {
        const viewer = { role: ctx.role, workspaceMode: productSurface.mode };
        const [
          openProblemIds,
          detailReviewIds,
          missingDateIds,
          evidenceDueIds,
          openTaskIds,
          renewalWithin90DayIds,
        ] = await Promise.all([
          resolveAuxiliaryContractListIntersectIds(admin, orgId, {
            exceptions: "open",
            viewer,
          }),
          resolveAuxiliaryContractListIntersectIds(admin, orgId, {
            review: "pending",
            viewer,
          }),
          resolveAuxiliaryContractListIntersectIds(admin, orgId, {
            data_quality: "missing_critical",
            viewer,
          }),
          resolveAuxiliaryContractListIntersectIds(admin, orgId, {
            evidence: "outstanding",
            viewer,
          }),
          resolveAuxiliaryContractListIntersectIds(admin, orgId, {
            work: "open",
            viewer,
          }),
          getContractIdsForDeadlinePreset(admin, orgId, "renewal_90"),
        ]);
        const [
          openProblems,
          detailsToReview,
          missingDates,
          evidenceDue,
          openTasks,
          renewalWithin90Days,
          active,
        ] = await Promise.all([
          countContractsForShortcut({ intersectIds: openProblemIds }),
          countContractsForShortcut({ intersectIds: detailReviewIds }),
          countContractsForShortcut({ intersectIds: missingDateIds }),
          countContractsForShortcut({ intersectIds: evidenceDueIds }),
          countContractsForShortcut({ intersectIds: openTaskIds }),
          countContractsForShortcut({ intersectIds: renewalWithin90DayIds }),
          countContractsForShortcut({ status: "active" }),
        ]);
        return {
          openProblems,
          detailsToReview,
          missingDates,
          evidenceDue,
          openTasks,
          renewalWithin90Days,
          active,
        };
      })()
    : EMPTY_CONTRACT_SHORTCUT_COUNTS;
  // Export dropdown surfaces *only* real export actions. The prior list
  // merged in navigation links (Approvals, Renewals, Tasks, Analytics,
  // Maintenance, Review cadence, etc.) under a button labeled "Export" —
  // which (a) mislabels the items as exports, and (b) leaked non-Core
  // surfaces (Analytics + Maintenance are Advanced-only per
  // release-state §Product Modes; Review cadence isn't in the Core spec
  // at all). Navigation to those surfaces is already available via the
  // sidebar + cmd-K palette + their dedicated routes.
  const exportItems: { href: string; label: string; icon: LucideIcon }[] = [
    {
      href: `/api/export/contracts?orgId=${encodeURIComponent(orgId)}`,
      label: "Export CSV",
      icon: FileText,
    },
    {
      href: "/api/export/calendar",
      label: "Export calendar",
      icon: CalendarDays,
    },
    {
      href: "/api/export/calendar/feed",
      label: "Calendar feed URL",
      icon: Link2,
    },
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
    <DataSurfaceShell
      width="wide"
      header={
        <DashboardPageHeader
        icon={<Files className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Contract tracking"
        density="compact"
        title="Contracts"
        lead={
          contractTotal === 0
            ? "Upload your first signed agreement to start confirming details, dates, owners, tasks, evidence, and reports."
            : "Track signed contracts, owners, dates, requirements, tasks, and evidence."
        }
        // Workspace-total count — accurate across all pages (the pagination
        // footer only renders on multi-page sets, so on a single page this
        // is the only place the inventory size is shown). Page-scoped signal
        // counts live in the quick-filter strip below, not here.
        metaStrip={
          contractTotal > 0 ? (
            <div className="inline-flex items-center">
              <dt className="sr-only">Contracts in workspace</dt>
              {/* Structured count chip — a bordered pill anchored to the
                  header cluster instead of a bare floating number. */}
              <dd className="inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] px-2.5 py-1 shadow-[var(--shadow-1)]">
                <span className="font-mono text-[12.5px] font-semibold tabular-nums text-[var(--text-primary)]">
                  {contractTotal}
                </span>
                <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">
                  {contractTotal === 1 ? "Contract" : "Contracts"}
                </span>
              </dd>
            </div>
          ) : undefined
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
              // Outlined secondary — sits between the filled primary
              // (`Upload contract`) and the ghost dropdown (`Export ▾`).
              // The earlier ghost styling read identically to Export so
              // the visual hierarchy collapsed.
              className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
            >
              <Upload className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              Import contracts
            </Link>
            <PortaledPopover
              ariaLabel="Export options"
              align="right"
              widthClassName="w-[15rem]"
              scrollClassName="py-1"
              triggerClassName="ui-btn-ghost inline-flex cursor-pointer items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
              triggerContent={
                <>
                  <Download className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                  Export
                  <ChevronDown className="popover-caret h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                </>
              }
            >
                <ul className="text-[12.5px]">
                  {exportItems.map((row) => {
                    const Icon = row.icon;
                    return (
                      <li key={row.href}>
                        <Link
                          href={row.href}
                          className="flex items-center gap-2.5 px-3 py-2 text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_7%,transparent)] hover:text-[var(--accent-strong)]"
                        >
                          <Icon
                            className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]"
                            strokeWidth={1.85}
                            aria-hidden
                          />
                          {row.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {latestExportSummary ? (
                  <p className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] px-4 py-2 text-[10.5px] uppercase tracking-[0.14em] tabular-nums text-[var(--text-tertiary)]">
                    {latestExportSummary}
                  </p>
                ) : null}
            </PortaledPopover>
          </>
        }
      />
      }
    >

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
      <DataSurfaceCard>
      <section aria-label="Filters" className="min-w-0 space-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-4 py-3">
        <ContractsFilterBar
          values={{
            search: searchParams.search ?? "",
            status: searchParams.status ?? "",
            owner: searchParams.owner ?? "",
            counterparty: searchParams.counterparty ?? "",
            contract_type: searchParams.contract_type ?? "",
            region: searchParams.region ?? "",
            deadline,
            sort: searchParams.sort === "created" ? "created" : "activity",
            exceptions: exceptionsFilter,
            review: reviewFilter,
            data_quality: dataQualityFilter,
            evidence: evidenceFilter,
            work: workFilter,
            health: healthFilter,
          }}
          statusOptions={statuses}
          ownerOptions={members.map((m) => ({ value: m.id, label: m.label }))}
          counterpartyOptions={counterpartyOptions.map((c) => ({ value: c, label: c }))}
          contractTypeOptions={contractTypeOptions.map((c) => ({ value: c, label: c }))}
          deadlineOptions={DEADLINE_OPTIONS}
          activeFilterCount={activeFilterCount}
          savedViewsSlot={
            <ContractsSavedViewsControl
              savedViews={savedViews}
              activeSavedView={activeSavedView}
              orgId={orgId}
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
          }
        />

        {/* Active filter chips — renders only when filters are applied. */}
        {activeFilterCount > 0 ? (
          <div
            role="group"
            aria-label="Active filters"
            className="flex flex-wrap items-center gap-1.5"
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
                aria-label="Remove filter: Open problems"
              >
                Open problems
                <span className="ui-active-filter-chip-remove" aria-hidden>
                  <X className="h-3 w-3" strokeWidth={2} />
                </span>
              </Link>
            ) : null}
            {searchParams.review ? (
              <Link
                href={buildContractsListHref({ ...baseParams, status: searchParams.status, review: undefined })}
                className="ui-active-filter-chip"
                aria-label="Remove filter: Details to review"
              >
                Details to review
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
                aria-label="Remove filter: Open tasks"
              >
                Open tasks
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
      {shouldShowShortcutStrip ? (
        <nav aria-label="Contract shortcuts" className="min-w-0 space-y-1.5 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-4 py-3">
          {/* Dot decoration dropped: the caps-tracked "Common filters" text
              already reads as an eyebrow. The leading dot was decorative
              chrome that competed with the filter chip row below. */}
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="ui-caps-3 inline-flex items-center text-[10px] text-[var(--text-tertiary)]">
              Contract shortcuts
            </p>
            <p className="text-[11px] leading-snug text-[var(--text-tertiary)]">
              Each count is a contract count. Selecting a shortcut filters the table to contracts with that condition.
            </p>
          </div>
          <ul className="grid min-w-0 gap-x-4 gap-y-1 text-[11px] leading-snug text-[var(--text-tertiary)] sm:grid-cols-2 xl:grid-cols-4">
            <li>
              <span className="font-medium text-[var(--text-secondary)]">Open problems:</span> unresolved problems linked to the contract.
            </li>
            <li>
              <span className="font-medium text-[var(--text-secondary)]">Details to review:</span> suggested dates, owners, or terms awaiting confirmation.
            </li>
            <li>
              <span className="font-medium text-[var(--text-secondary)]">Missing dates:</span> required renewal, notice, end, or effective dates are absent.
            </li>
            <li>
              <span className="font-medium text-[var(--text-secondary)]">Evidence due:</span> open evidence request linked to the contract.
            </li>
            <li>
              <span className="font-medium text-[var(--text-secondary)]">Open tasks:</span> active follow-up tasks linked to the contract.
            </li>
            <li>
              <span className="font-medium text-[var(--text-secondary)]">Renewal within 90 days:</span> renewal date inside the next 90 days.
            </li>
            <li>
              <span className="font-medium text-[var(--text-secondary)]">Active:</span> contract status is active.
            </li>
          </ul>
          {/* Chip order follows the tone gradient — danger → warning →
              info → success — so the user's eye lands on critical
              attention items first, operational work in the middle, and
              current-state filters at the end. */}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {/* Every chip carries a leading icon slot + a tone tint for its
              category — danger (exceptions) / warning (review, dates,
              evidence) / accent (work, renewals) / success (active) — so the
              strip reads as one consistent shortcut family. Icons give
              non-color reinforcement (§7.7) so no signal is tone-only. */}
          {shortcutCounts.openProblems > 0 ? (
            <Link
              href="/contracts?exceptions=open"
              className="ui-quick-chip ui-quick-chip-tone-danger"
              aria-label={`${shortcutCounts.openProblems} contracts with open problems`}
              title={`${shortcutCounts.openProblems} matching contracts`}
            >
              <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              Open problems
              <span className="ui-quick-chip-count">{shortcutCounts.openProblems}</span>
            </Link>
          ) : null}
          {shortcutCounts.detailsToReview > 0 ? (
            <Link
              href="/contracts?review=pending"
              className="ui-quick-chip ui-quick-chip-tone-warning"
              aria-label={`${shortcutCounts.detailsToReview} contracts with details to review`}
              title={`${shortcutCounts.detailsToReview} matching contracts`}
            >
              <Hourglass className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              Details to review
              <span className="ui-quick-chip-count">{shortcutCounts.detailsToReview}</span>
            </Link>
          ) : null}
          {shortcutCounts.missingDates > 0 ? (
            <Link
              href="/contracts?data_quality=missing_critical"
              className="ui-quick-chip ui-quick-chip-tone-warning"
              aria-label={`${shortcutCounts.missingDates} contracts with missing dates`}
              title={`${shortcutCounts.missingDates} matching contracts`}
            >
              <CalendarDays className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              Missing dates
              <span className="ui-quick-chip-count">{shortcutCounts.missingDates}</span>
            </Link>
          ) : null}
          {shortcutCounts.evidenceDue > 0 ? (
            <Link
              href="/contracts?evidence=outstanding"
              className="ui-quick-chip ui-quick-chip-tone-warning"
              aria-label={`${shortcutCounts.evidenceDue} contracts with evidence due`}
              title={`${shortcutCounts.evidenceDue} matching contracts`}
            >
              <ClipboardCheck className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              Evidence due
              <span className="ui-quick-chip-count">{shortcutCounts.evidenceDue}</span>
            </Link>
          ) : null}
          {shortcutCounts.openTasks > 0 ? (
            <Link
              href="/contracts?work=open"
              className="ui-quick-chip ui-quick-chip-tone-info"
              aria-label={`${shortcutCounts.openTasks} contracts with open tasks`}
              title={`${shortcutCounts.openTasks} matching contracts`}
            >
              <ListChecks className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              Open tasks
              <span className="ui-quick-chip-count">{shortcutCounts.openTasks}</span>
            </Link>
          ) : null}
          {shortcutCounts.renewalWithin90Days > 0 ? (
            <Link
              href="/contracts?deadline=renewal_90"
              className="ui-quick-chip ui-quick-chip-tone-info"
              aria-label={`${shortcutCounts.renewalWithin90Days} contracts renewing within 90 days`}
              title={`${shortcutCounts.renewalWithin90Days} matching contracts`}
            >
              <CalendarClock className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              Renewal within 90 days
              <span className="ui-quick-chip-count">{shortcutCounts.renewalWithin90Days}</span>
            </Link>
          ) : null}
          {shortcutCounts.active > 0 ? (
            <Link
              href="/contracts?status=active"
              className="ui-quick-chip ui-quick-chip-tone-success"
              aria-label={`${shortcutCounts.active} active contracts`}
              title={`${shortcutCounts.active} matching contracts`}
            >
              <CircleCheck className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              Active
              <span className="ui-quick-chip-count">{shortcutCounts.active}</span>
            </Link>
          ) : null}
          </div>
        </nav>
      ) : null}

      <section className="min-w-0">
        {contractsPageError ? (
          <RecoverableState
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
              contractTotal > 0 ? (
                // Shared dense-surface footer (now with First/Last) — the same
                // recipe as Work/Renewals/Evidence, replacing the bespoke
                // ContractPagination on the list. The component is retained for
                // /contracts/review, which still imports it.
                <DataFooter
                  shown={contracts.length}
                  total={contractTotal}
                  countLabel="Shown"
                  pagination={{
                    page,
                    totalPages: listTotalPages,
                    hrefFor: (p) =>
                      buildContractsListHref({
                        ...paginationQuery,
                        page: p > 1 ? String(p) : undefined,
                      }),
                    showFirstLast: listTotalPages > 2,
                  }}
                />
              ) : undefined
            }
          />
        )}
      </section>
      </DataSurfaceCard>
    </DataSurfaceShell>
  );
}
