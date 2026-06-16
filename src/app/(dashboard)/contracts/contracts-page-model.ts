import type { getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface";
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
import {
  combineContractListIntersectIds,
  parseContractListSort,
  resolveAuxiliaryContractListIntersectIds,
} from "@/lib/contract-list-id-filters";
import { getContractListRowSignalsMap } from "@/lib/contract-list-row-signals";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import type { Contract, OrgRole } from "@/lib/types";
import { buildContractsListHref, normalizeContractsSearchQuery } from "@/lib/contracts-search-url";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";

type AuthContext = NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;

export type ContractsSearchParams = {
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
};

export const DEADLINE_OPTIONS: { value: DeadlinePreset; label: string }[] = [
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
const CONTRACT_TYPE_FALLBACK_TOKENS = new Set(["other", "unknown", "unclassified", "n/a"]);
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

export type ContractsPageModel = {
  orgId: string;
  canEdit: boolean;
  searchParams: ContractsSearchParams;
  page: number;
  deadline: DeadlinePreset;
  exceptionsFilter: "" | "open";
  reviewFilter: "" | "pending";
  dataQualityFilter: "" | "missing_critical";
  evidenceFilter: "" | "outstanding";
  workFilter: "" | "open";
  healthFilter: "" | "watch";
  sanitizedSearch: string;
  contractTotal: number;
  listTotalPages: number;
  contractsPageError: unknown;
  contracts: Contract[];
  reviewStats: Awaited<ReturnType<typeof getReviewStatsForContractIds>>;
  rowSignals: Awaited<ReturnType<typeof getContractListRowSignalsMap>>;
  members: { id: string; label: string }[];
  counterpartyOptions: string[];
  contractTypeOptions: string[];
  savedViews: {
    id: string;
    name: string;
    href: string;
    weeklyActive: boolean;
    monthlyActive: boolean;
    recipientsCsv: string;
  }[];
  activeSavedView:
    | {
        id: string;
        name: string;
        href: string;
        weeklyActive: boolean;
        monthlyActive: boolean;
        recipientsCsv: string;
      }
    | undefined;
  statuses: { value: string; label: string }[];
  activeStatusLabel: string | null;
  baseParams: Record<string, string | undefined>;
  paginationQuery: Record<string, string | undefined>;
  filterFingerprint: string;
  activeFilterCount: number;
  shouldShowShortcutStrip: boolean;
  shortcutCounts: typeof EMPTY_CONTRACT_SHORTCUT_COUNTS;
  latestExportSummary: string | null;
};

export async function loadContractsPageModel(
  ctx: AuthContext,
  searchParams: ContractsSearchParams
): Promise<{ redirectHref: string } | { model: ContractsPageModel }> {
  const { orgId, admin } = ctx;
  const productSurface = await loadProductSurfaceContext(admin, orgId, ctx.role as WorkspaceRole);
  const parsedPage = parseInt(searchParams.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const deadline: DeadlinePreset =
    searchParams.deadline && isDeadlinePreset(searchParams.deadline) ? searchParams.deadline : "";
  const sanitizedSearch = searchParams.search ? normalizeContractsSearchQuery(searchParams.search) : "";
  const exceptionsFilter = parseExceptionsFilter(searchParams.exceptions);
  const reviewFilter = parseReviewFilter(searchParams.review);
  const dataQualityFilter = parseDataQualityFilter(searchParams.data_quality);
  const evidenceFilter = parseEvidenceFilter(searchParams.evidence);
  const workFilter = parseWorkFilter(searchParams.work);
  const healthFilter = parseHealthFilter(searchParams.health);
  const sortKey = parseContractListSort(searchParams.sort);

  const [deadlineIds, fieldSearchIds, ownerOrTagSearchIds, auxIntersect] = await Promise.all([
    deadline ? getContractIdsForDeadlinePreset(admin, orgId, deadline) : Promise.resolve<string[] | null>(null),
    sanitizedSearch ? getContractIdsMatchingFieldSearch(admin, orgId, sanitizedSearch) : Promise.resolve<string[]>([]),
    sanitizedSearch ? getContractIdsMatchingOwnerOrTagSearch(admin, orgId, sanitizedSearch) : Promise.resolve<string[]>([]),
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
  const membersPromise = loadOrgMemberProfileRows(admin, orgId, { orderByCreatedAt: true });
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

  const listTotalPages = contractTotal > 0 ? Math.max(1, Math.ceil(contractTotal / CONTRACTS_PAGE_SIZE)) : 1;
  if (page > listTotalPages && contractTotal > 0) {
    return {
      redirectHref: buildContractsListHref({
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
      }),
    };
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
  const recipientsByViewId = new Map((subscriptionsData ?? []).map((s) => [s.saved_view_id, (s.recipient_emails ?? []).join(", ")]));
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
  const counterpartyOptions = [
    ...new Set((filterOptionsData ?? []).map((row) => String(row.counterparty ?? "").trim()).filter(Boolean)),
  ].sort((a, b) => {
    const aFallback = COUNTERPARTY_FALLBACK_TOKENS.has(a.toLowerCase());
    const bFallback = COUNTERPARTY_FALLBACK_TOKENS.has(b.toLowerCase());
    if (aFallback !== bFallback) return aFallback ? 1 : -1;
    return a.localeCompare(b);
  });
  const contractTypeOptions = [
    ...new Set((filterOptionsData ?? []).map((row) => String(row.contract_type ?? "").trim()).filter(Boolean)),
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
    ? (STATUS_LABELS[searchParams.status as keyof typeof STATUS_LABELS] ?? searchParams.status.replace(/_/g, " "))
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
  const activeFilters = [
    searchParams.search ? `Search: ${searchParams.search}` : null,
    activeStatusLabel ? `Status: ${activeStatusLabel}` : null,
    searchParams.owner ? "Owner: filtered" : null,
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
          resolveAuxiliaryContractListIntersectIds(admin, orgId, { exceptions: "open", viewer }),
          resolveAuxiliaryContractListIntersectIds(admin, orgId, { review: "pending", viewer }),
          resolveAuxiliaryContractListIntersectIds(admin, orgId, { data_quality: "missing_critical", viewer }),
          resolveAuxiliaryContractListIntersectIds(admin, orgId, { evidence: "outstanding", viewer }),
          resolveAuxiliaryContractListIntersectIds(admin, orgId, { work: "open", viewer }),
          getContractIdsForDeadlinePreset(admin, orgId, "renewal_90"),
        ]);
        const [openProblems, detailsToReview, missingDates, evidenceDue, openTasks, renewalWithin90Days, active] =
          await Promise.all([
            countContractsForShortcut({ intersectIds: openProblemIds }),
            countContractsForShortcut({ intersectIds: detailReviewIds }),
            countContractsForShortcut({ intersectIds: missingDateIds }),
            countContractsForShortcut({ intersectIds: evidenceDueIds }),
            countContractsForShortcut({ intersectIds: openTaskIds }),
            countContractsForShortcut({ intersectIds: renewalWithin90DayIds }),
            countContractsForShortcut({ status: "active" }),
          ]);
        return { openProblems, detailsToReview, missingDates, evidenceDue, openTasks, renewalWithin90Days, active };
      })()
    : EMPTY_CONTRACT_SHORTCUT_COUNTS;
  const latestExportJob = exportJobsData?.[0] ?? null;
  const latestExportSummary = latestExportJob ? `Latest export: ${latestExportJob.exported_rows ?? 0} rows` : null;
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

  return {
    model: {
      orgId,
      canEdit: canEditContracts(role as OrgRole),
      searchParams,
      page,
      deadline,
      exceptionsFilter,
      reviewFilter,
      dataQualityFilter,
      evidenceFilter,
      workFilter,
      healthFilter,
      sanitizedSearch,
      contractTotal,
      listTotalPages,
      contractsPageError,
      contracts: contracts as Contract[],
      reviewStats,
      rowSignals,
      members,
      counterpartyOptions,
      contractTypeOptions,
      savedViews,
      activeSavedView,
      statuses,
      activeStatusLabel,
      baseParams,
      paginationQuery,
      filterFingerprint,
      activeFilterCount,
      shouldShowShortcutStrip,
      shortcutCounts,
      latestExportSummary,
    },
  };
}
