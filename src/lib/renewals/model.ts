import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfDay, subDays } from "date-fns";
import type { createAdminClient } from "@/lib/supabase/server";
import { formatBusinessDateAtNoon } from "@/lib/business-dates";
import { parseNoticeDays } from "@/lib/contract-filters";
import { loadOrgMemberProfileRows, orgMemberProfileLabel, type OrgMemberProfileRow } from "@/lib/org-member-profiles";
import { displayOrUnknown } from "@/lib/sparse-records";
import { applyV10ReadModelVisibility } from "@/lib/visibility";
import {
  RENEWAL_ACTION_LABELS,
  RENEWAL_CONSEQUENCE,
  RENEWAL_STATUS_LABELS,
  RENEWAL_WINDOW_LABELS,
  RENEWALS_EYEBROW,
  RENEWALS_PAGE_LEAD,
  RENEWALS_PAGE_TITLE,
  RENEWALS_PRIMARY_CTA,
} from "./spec-strings";
import type {
  RenewalConsequenceTone,
  RenewalDateReviewState,
  RenewalFilterState,
  RenewalGroupKey,
  RenewalOption,
  RenewalRow,
  RenewalSortKey,
  RenewalStatus,
  RenewalWindowKey,
  RenewalsModelLoadInput,
  RenewalsModelSearchInput,
  RenewalsPageModel,
} from "./types";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export const RENEWAL_WINDOW_ORDER = ["30", "60", "90", "180"] as const satisfies readonly RenewalWindowKey[];

export const RENEWAL_LEGACY_HORIZON_ALIASES: Record<string, RenewalWindowKey> = {
  renewal_30: "30",
  end_30: "30",
  notice_deadline_30: "30",
  renewal_60: "60",
  end_60: "60",
  notice_deadline_60: "60",
  renewal_90: "90",
  end_90: "90",
  notice_deadline_90: "90",
  renewal_180: "180",
  end_180: "180",
  notice_deadline_180: "180",
  renewal_365: "180",
  end_365: "180",
  notice_deadline_365: "180",
};

const RENEWAL_DATE_FIELDS = ["renewal_date", "renewal", "renewal_deadline"] as const;
const NOTICE_DATE_FIELDS = ["notice_date", "notice_deadline", "notice_deadline_date"] as const;
const NOTICE_WINDOW_FIELDS = ["notice_window", "notice_period", "notice_days"] as const;
const RENEWAL_FIELD_NAMES = [
  ...RENEWAL_DATE_FIELDS,
  ...NOTICE_DATE_FIELDS,
  ...NOTICE_WINDOW_FIELDS,
] as const;

const TERMINAL_CHECKPOINT_STATUSES = new Set(["completed", "skipped", "done", "closed", "resolved"]);
const ACTIVE_CHECKPOINT_STATUSES = new Set(["pending", "in_progress", "open", "blocked", "waiting"]);
const TERMINAL_WORK_STATUSES = new Set(["done", "completed", "closed", "resolved", "canceled", "cancelled"]);

export type RenewalContractRow = {
  id: string;
  title: string | null;
  counterparty?: string | null;
  status?: string | null;
  owner_id?: string | null;
  updated_at?: string | null;
};

export type RenewalFieldRow = {
  contract_id: string;
  field_name: string | null;
  field_value: string | null;
  status?: string | null;
  updated_at?: string | null;
};

export type RenewalCheckpointRow = {
  id: string;
  contract_id: string;
  status?: string | null;
  due_date?: string | null;
  updated_at?: string | null;
};

export type RenewalWorkItemRow = {
  id?: string | null;
  source_id?: string | null;
  source_table?: string | null;
  contract_id?: string | null;
  status?: string | null;
  type?: string | null;
  updated_at?: string | null;
  last_state_change_at?: string | null;
};

export type BuildRenewalsPageModelInput = RenewalsModelLoadInput & {
  contracts: RenewalContractRow[];
  fields: RenewalFieldRow[];
  checkpoints: RenewalCheckpointRow[];
  workItems: RenewalWorkItemRow[];
  members: OrgMemberProfileRow[];
  warnings?: string[];
  now?: Date;
};

export function normalizeRenewalWindow(input: { window?: string | null; horizon?: string | null }): RenewalWindowKey {
  const direct = normalizeToken(input.window);
  if (isRenewalWindowKey(direct)) return direct;
  const directDays = direct.match(/^(\d+)(?:_days?)?$/)?.[1] ?? "";
  if (isRenewalWindowKey(directDays)) return directDays;

  const legacy = normalizeToken(input.horizon);
  if (legacy && RENEWAL_LEGACY_HORIZON_ALIASES[legacy]) return RENEWAL_LEGACY_HORIZON_ALIASES[legacy];
  const legacyDays = legacy.match(/(\d+)/)?.[1] ?? "";
  if (isRenewalWindowKey(legacyDays)) return legacyDays;
  if (legacyDays === "365") return "180";
  return "90";
}

export function normalizeRenewalFilters(input: RenewalsModelSearchInput): RenewalFilterState {
  const status = normalizeToken(input.status);
  const review = normalizeToken(input.review);
  return {
    owner: stringValue(input.owner),
    counterparty: stringValue(input.counterparty),
    status: isRenewalStatus(status) ? status : "",
    review: isRenewalDateReviewState(review) ? review : "",
  };
}

// §53 — the sort key. The default ("urgent") preserves the historical
// status-weighted order and turns on §54 section grouping; every other key
// flattens the list into a single run sorted on that field.
export function normalizeRenewalSort(value: string | null | undefined): RenewalSortKey {
  const v = normalizeToken(value);
  if (v === "notice" || v === "renewal" || v === "owner" || v === "needs_confirmation") return v;
  return "urgent";
}

export function buildRenewalsHref(input: {
  window?: RenewalWindowKey;
  filters?: RenewalFilterState;
  sort?: RenewalSortKey;
  create?: boolean;
  contract?: string | null;
}) {
  const params = new URLSearchParams();
  if (input.window && input.window !== "90") params.set("window", input.window);
  const filters = input.filters;
  if (filters) {
    if (filters.owner) params.set("owner", filters.owner);
    if (filters.counterparty) params.set("counterparty", filters.counterparty);
    if (filters.status) params.set("status", filters.status);
    if (filters.review) params.set("review", filters.review);
  }
  // "urgent" is the default sort, so it stays out of the URL.
  if (input.sort && input.sort !== "urgent") params.set("sort", input.sort);
  if (input.create) params.set("create", "1");
  if (input.contract) params.set("contract", input.contract);
  const qs = params.toString();
  return qs ? `/renewals?${qs}` : "/renewals";
}

export function buildRenewalsExportHref(input: { window: RenewalWindowKey; filters: RenewalFilterState }) {
  const params = new URLSearchParams();
  params.set("window", input.window);
  if (input.filters.owner) params.set("owner", input.filters.owner);
  if (input.filters.counterparty) params.set("counterparty", input.filters.counterparty);
  if (input.filters.status) params.set("status", input.filters.status);
  if (input.filters.review) params.set("review", input.filters.review);
  return `/api/export/renewals?${params.toString()}`;
}

export function buildRenewalsPageModel(input: BuildRenewalsPageModelInput): RenewalsPageModel {
  const activeWindow = normalizeRenewalWindow(input);
  const filters = normalizeRenewalFilters(input);
  const activeSort = normalizeRenewalSort(input.sort);
  const today = startOfDay(input.now ?? new Date());
  const ownerLabelById = new Map(input.members.map((member) => [member.user_id, orgMemberProfileLabel(member.profiles)]));
  const fieldsByContract = groupBy(input.fields, (field) => field.contract_id);
  const checkpointsByContract = groupBy(input.checkpoints, (checkpoint) => checkpoint.contract_id);
  const workItemsByContract = groupBy(
    input.workItems.filter((item) => item.type === "renewal_checkpoint" || item.source_table === "contract_renewal_checkpoints"),
    (item) => item.contract_id ?? ""
  );

  const allRows = input.contracts.map((contract) =>
    shapeRenewalRow(contract, {
      activeWindow,
      today,
      fields: fieldsByContract.get(contract.id) ?? [],
      checkpoints: checkpointsByContract.get(contract.id) ?? [],
      workItems: workItemsByContract.get(contract.id) ?? [],
      ownerLabel: contract.owner_id ? ownerLabelById.get(contract.owner_id) ?? "Member" : "Unassigned",
      filters,
    })
  );

  const rowsInWindow = allRows.filter((row) => matchesWindow(row, activeWindow, today));
  const filteredRows = allRows
    .filter((row) => matchesFilters(row, filters))
    .filter((row) => {
      // A status or review filter is a cross-horizon triage view (e.g. find every
      // "missing"-date row), so it bypasses the window; otherwise scope to it.
      if (filters.status || filters.review) return true;
      return rowsInWindow.some((candidate) => candidate.id === row.id);
    })
    .sort(renewalComparator(activeSort));

  const windowBaseFilters: RenewalFilterState = { ...filters, status: "", review: "" };
  const windows = RENEWAL_WINDOW_ORDER.map((key) => ({
    key,
    label: RENEWAL_WINDOW_LABELS[key],
    count: allRows.filter((row) => matchesFilters(row, windowBaseFilters) && matchesWindow(row, key, today)).length,
    href: buildRenewalsHref({ window: key, filters }),
    active: key === activeWindow,
  }));

  const contractOptions = toContractOptions(input.contracts);
  const ownerOptions = toOwnerOptions(input.members);
  const counterpartyOptions = toCounterpartyOptions(input.contracts);

  return {
    title: RENEWALS_PAGE_TITLE,
    eyebrow: RENEWALS_EYEBROW,
    lead: RENEWALS_PAGE_LEAD,
    primaryCta: RENEWALS_PRIMARY_CTA,
    activeWindow,
    activeSort,
    grouped: activeSort === "urgent",
    filters,
    windows,
    rows: filteredRows,
    totalVisibleRows: filteredRows.length,
    summary: {
      visible: filteredRows.length,
      needsOwner: filteredRows.filter((row) => row.status === "needs_owner").length,
      needsReview: filteredRows.filter((row) => row.status === "needs_review").length,
      noticeWindowOpen: filteredRows.filter((row) => row.status === "notice_window_open").length,
      inProgress: filteredRows.filter((row) => row.status === "in_progress").length,
      hasAnyContracts: input.contracts.length > 0,
      // §45 — contracts carrying neither a renewal nor a notice date never match
      // any window, so they would be invisible without the dedicated affordance.
      missingDates: allRows.filter((row) => !row.renewalDate && !row.noticeDate).length,
    },
    filterOptions: {
      owners: [{ value: "", label: "Any owner" }, { value: "unassigned", label: "Unassigned" }, ...ownerOptions],
      counterparties: [{ value: "", label: "Any counterparty" }, ...counterpartyOptions],
      statuses: [
        { value: "", label: "Any status" },
        ...Object.entries(RENEWAL_STATUS_LABELS).map(([value, label]) => ({
          value,
          label,
          count: allRows.filter((row) => row.status === value).length,
        })),
      ],
      reviewStates: [
        { value: "", label: "Any date status" },
        { value: "reviewed", label: "Confirmed" },
        { value: "suggested", label: "Suggested" },
        { value: "computed", label: "Calculated" },
        { value: "missing", label: "Missing" },
      ],
    },
    create: {
      open: input.create === "1" || input.create === "true",
      contracts: contractOptions,
      ownerOptions,
      selectedContract: stringValue(input.contract),
    },
    exportHref: buildRenewalsExportHref({ window: activeWindow, filters }),
    warnings: input.warnings ?? [],
  };
}

export async function loadRenewalsPageModel(
  admin: AdminClient,
  orgId: string,
  input: RenewalsModelLoadInput
): Promise<RenewalsPageModel> {
  const warnings: string[] = [];
  const { data: contractsData, error: contractsError } = await admin
    .from("contracts")
    .select("id, title, counterparty, status, owner_id, updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(2000);
  if (contractsError) warnings.push("contracts");
  const contracts = (contractsData ?? []) as RenewalContractRow[];
  const contractIds = contracts.map((contract) => contract.id).filter(Boolean);

  let fields: RenewalFieldRow[] = [];
  if (contractIds.length > 0) {
    const { data, error } = await admin
      .from("extracted_fields")
      .select("contract_id, field_name, field_value, status, updated_at")
      .in("contract_id", contractIds)
      .in("field_name", [...RENEWAL_FIELD_NAMES]);
    if (error) warnings.push("fields");
    fields = (data ?? []) as RenewalFieldRow[];
  }

  let checkpoints: RenewalCheckpointRow[] = [];
  if (contractIds.length > 0) {
    const { data, error } = await admin
      .from("contract_renewal_checkpoints")
      .select("id, contract_id, status, due_date, updated_at")
      .eq("organization_id", orgId)
      .in("contract_id", contractIds);
    if (error) warnings.push("checkpoints");
    checkpoints = (data ?? []) as RenewalCheckpointRow[];
  }

  let workItems: RenewalWorkItemRow[] = [];
  if (contractIds.length > 0) {
    const { data, error } = await applyV10ReadModelVisibility(
      admin
        .from("v10_work_items")
        .select("id, source_id, source_table, contract_id, status, type, updated_at, last_state_change_at")
        .in("contract_id", contractIds)
        .eq("type", "renewal_checkpoint"),
      {
        organizationId: orgId,
        role: input.role,
        workspaceMode: input.workspaceMode ?? "core",
      }
    ).limit(2000);
    if (error) warnings.push("work_items");
    workItems = (data ?? []) as RenewalWorkItemRow[];
  }

  const members = await loadOrgMemberProfileRows(admin, orgId, {
    memberColumns: "user_id, role, created_at",
    orderByCreatedAt: true,
    limit: 500,
  });

  return buildRenewalsPageModel({
    ...input,
    contracts,
    fields,
    checkpoints,
    workItems,
    members,
    warnings,
  });
}

function shapeRenewalRow(
  contract: RenewalContractRow,
  input: {
    activeWindow: RenewalWindowKey;
    today: Date;
    fields: RenewalFieldRow[];
    checkpoints: RenewalCheckpointRow[];
    workItems: RenewalWorkItemRow[];
    ownerLabel: string;
    filters: RenewalFilterState;
  }
): RenewalRow {
  const renewalDate = pickApprovedDate(input.fields, RENEWAL_DATE_FIELDS);
  const explicitNoticeDate = pickApprovedDate(input.fields, NOTICE_DATE_FIELDS);
  const noticeWindow = pickApprovedValue(input.fields, NOTICE_WINDOW_FIELDS);
  const noticeDays = parseNoticeDays(noticeWindow);
  const computedNoticeDate =
    renewalDate && noticeDays
      ? (() => {
          const date = subDays(renewalDate.date, noticeDays);
          return { raw: formatDateOnly(date), date };
        })()
      : null;
  const noticeDate = explicitNoticeDate ?? computedNoticeDate;
  const renewalDateRaw = renewalDate?.raw ?? null;
  const noticeDateRaw = noticeDate?.raw ?? null;
  // Per-date provenance for the row's review chips, tied to the value actually
  // displayed: a shown date is approved + parseable ("reviewed"), a notice date
  // inferred from the window is "computed", and when no trusted value is shown
  // we report whether an untrusted candidate exists ("suggested") or not
  // ("missing"). Deriving from *Raw guarantees the chip never claims "reviewed"
  // over an em-dash cell (e.g. an approved-but-unparseable value like "TBD").
  const noticeDateIsComputed = !explicitNoticeDate && Boolean(computedNoticeDate);
  const renewalDateReview: RenewalDateReviewState = renewalDateRaw
    ? "reviewed"
    : unshownDateReview(input.fields, RENEWAL_DATE_FIELDS);
  const noticeDateReview: RenewalDateReviewState = noticeDateRaw
    ? noticeDateIsComputed
      ? "computed"
      : "reviewed"
    : unshownDateReview(input.fields, NOTICE_DATE_FIELDS);
  const relevantFields = input.fields.filter((field) =>
    RENEWAL_FIELD_NAMES.includes((field.field_name ?? "") as (typeof RENEWAL_FIELD_NAMES)[number])
  );
  const hasPendingReview = relevantFields.some((field) => {
    const status = normalizeToken(field.status);
    return status && status !== "approved" && status !== "rejected";
  });
  const missingCriticalDates = !renewalDateRaw || !noticeDateRaw;
  const latestCheckpoint = latestByUpdate(input.checkpoints);
  const checkpointStatus = normalizeToken(latestCheckpoint?.status);
  const hasActiveCheckpoint = input.checkpoints.some((checkpoint) => ACTIVE_CHECKPOINT_STATUSES.has(normalizeToken(checkpoint.status)));
  const hasCompletedCheckpoint =
    input.checkpoints.length > 0 &&
    input.checkpoints.every((checkpoint) => TERMINAL_CHECKPOINT_STATUSES.has(normalizeToken(checkpoint.status)));
  const hasActiveWorkItem = input.workItems.some((item) => !TERMINAL_WORK_STATUSES.has(normalizeToken(item.status)));
  const noticeWindowOpen = isNoticeWindowOpen(noticeDate?.date ?? null, renewalDate?.date ?? null, input.today);
  const status = deriveRenewalStatus({
    ownerAssigned: Boolean(contract.owner_id),
    hasPendingReview,
    missingCriticalDates,
    hasCompletedCheckpoint,
    hasActiveCheckpoint,
    hasActiveWorkItem,
    noticeWindowOpen,
  });
  const nextActionKey = nextActionForStatus(status);
  const href = `/contracts/${contract.id}?tab=renewals`;
  const actions = buildRowActions({
    contractId: contract.id,
    checkpointId: latestCheckpoint?.id ?? null,
    checkpointCompleted: status === "completed",
    activeWindow: input.activeWindow,
    filters: input.filters,
  });

  // Hoist the values the consequence line, grouping band, and report-inclusion
  // flag all read from, so they stay consistent with the displayed cells.
  const renewalDateLabel = dateLabel(renewalDateRaw);
  const noticeDateLabel = dateLabel(noticeDateRaw);
  const daysUntilRenewal = renewalDate?.date ? differenceInCalendarDays(renewalDate.date, input.today) : null;
  const daysUntilNotice = noticeDate?.date ? differenceInCalendarDays(noticeDate.date, input.today) : null;
  const inWindow = dateInWindow(renewalDate?.date ?? null, noticeDate?.date ?? null, input.activeWindow, input.today);

  return {
    id: contract.id,
    title: contract.title?.trim() || "Untitled contract",
    href,
    counterparty: displayOrUnknown(contract.counterparty, "Missing counterparty"),
    ownerUserId: contract.owner_id ?? null,
    ownerLabel: input.ownerLabel,
    contractStatus: normalizeToken(contract.status) || "unknown",
    renewalDate: renewalDateRaw,
    renewalDateLabel,
    renewalDateReview,
    noticeDate: noticeDateRaw,
    noticeDateLabel,
    noticeDateReview,
    noticeDateIsComputed,
    noticeWindowDays: noticeDays,
    daysUntilRenewal,
    daysUntilNotice,
    status,
    statusLabel: RENEWAL_STATUS_LABELS[status],
    statusTone: statusTone(status),
    consequence: buildRenewalConsequence({ status, renewalDateLabel, noticeDateLabel }),
    group: deriveRenewalGroup({ status, daysUntilNotice, inWindow }),
    reportIncluded: inWindow,
    nextActionLabel: RENEWAL_ACTION_LABELS[nextActionKey],
    nextActionHref: actionHref(nextActionKey, contract.id, input.activeWindow, input.filters),
    checkpointId: latestCheckpoint?.id ?? null,
    checkpointStatus: checkpointStatus || null,
    lastUpdateAt: contract.updated_at ?? latestCheckpoint?.updated_at ?? null,
    actions,
  };
}

// §14/§20/§21 — the plain-language operational consequence shown beneath the
// contract name. Driven purely by the model's derived status (which already
// folds in owner/date/checkpoint/notice-window state), so the line never
// contradicts the status badge.
function buildRenewalConsequence(input: {
  status: RenewalStatus;
  renewalDateLabel: string;
  noticeDateLabel: string;
}): { label: string; tone: RenewalConsequenceTone } {
  switch (input.status) {
    case "needs_owner":
      return { label: RENEWAL_CONSEQUENCE.needs_owner(), tone: "warning" };
    case "needs_review":
      return { label: RENEWAL_CONSEQUENCE.needs_review(), tone: "warning" };
    case "notice_window_open":
      return { label: RENEWAL_CONSEQUENCE.notice_open(input.renewalDateLabel), tone: "warning" };
    case "in_progress":
      return { label: RENEWAL_CONSEQUENCE.in_progress(), tone: "neutral" };
    case "completed":
      return { label: RENEWAL_CONSEQUENCE.completed(), tone: "success" };
    case "no_renewal_action_needed": {
      const nearest = input.noticeDateLabel !== "—" ? input.noticeDateLabel : input.renewalDateLabel;
      return { label: RENEWAL_CONSEQUENCE.no_action(nearest), tone: "neutral" };
    }
  }
}

// §54 — urgency band for the default-sort section headers. needs_review rows are
// the "missing or unconfirmed dates" band; an open notice window or a notice
// deadline within 30 days is the most-urgent band; remaining in-window rows are
// the renewal-window band; anything surfaced only by a filter bypass is "later".
function deriveRenewalGroup(input: {
  status: RenewalStatus;
  daysUntilNotice: number | null;
  inWindow: boolean;
}): RenewalGroupKey {
  if (input.status === "needs_review") return "unconfirmed";
  if (input.status === "notice_window_open") return "notice_30";
  if (input.daysUntilNotice != null && input.daysUntilNotice >= 0 && input.daysUntilNotice <= 30) return "notice_30";
  if (input.inWindow) return "renewal_window";
  return "later";
}

function deriveRenewalStatus(input: {
  ownerAssigned: boolean;
  hasPendingReview: boolean;
  missingCriticalDates: boolean;
  hasCompletedCheckpoint: boolean;
  hasActiveCheckpoint: boolean;
  hasActiveWorkItem: boolean;
  noticeWindowOpen: boolean;
}): RenewalStatus {
  if (!input.ownerAssigned) return "needs_owner";
  if (input.hasPendingReview || input.missingCriticalDates) return "needs_review";
  if (input.hasActiveCheckpoint || input.hasActiveWorkItem) return "in_progress";
  if (input.hasCompletedCheckpoint) return "completed";
  if (input.noticeWindowOpen) return "notice_window_open";
  return "no_renewal_action_needed";
}

function nextActionForStatus(status: RenewalStatus): keyof typeof RENEWAL_ACTION_LABELS {
  if (status === "completed") return "reopen";
  if (status === "in_progress") return "complete";
  if (status === "notice_window_open" || status === "needs_owner") return "create_renewal_task";
  if (status === "needs_review") return "mark_reviewed";
  return "mark_reviewed";
}

function buildRowActions(input: {
  contractId: string;
  checkpointId: string | null;
  checkpointCompleted: boolean;
  activeWindow: RenewalWindowKey;
  filters: RenewalFilterState;
}): RenewalRow["actions"] {
  const contractHref = `/contracts/${input.contractId}?tab=renewals`;
  const createHref = buildRenewalsHref({
    window: input.activeWindow,
    filters: input.filters,
    create: true,
    contract: input.contractId,
  });
  return [
    {
      key: "mark_reviewed",
      label: RENEWAL_ACTION_LABELS.mark_reviewed,
      kind: input.checkpointId && !input.checkpointCompleted ? "mutation" : "link",
      href: input.checkpointId && !input.checkpointCompleted ? undefined : contractHref,
      mutation: input.checkpointId && !input.checkpointCompleted ? "complete_checkpoint" : undefined,
      checkpointId: input.checkpointId,
    },
    {
      key: "create_renewal_task",
      label: RENEWAL_ACTION_LABELS.create_renewal_task,
      kind: "link",
      href: createHref,
    },
    {
      key: "complete",
      label: RENEWAL_ACTION_LABELS.complete,
      kind: input.checkpointId && !input.checkpointCompleted ? "mutation" : "link",
      href: input.checkpointId && !input.checkpointCompleted ? undefined : contractHref,
      mutation: input.checkpointId && !input.checkpointCompleted ? "complete_checkpoint" : undefined,
      checkpointId: input.checkpointId,
    },
    {
      key: "reopen",
      label: RENEWAL_ACTION_LABELS.reopen,
      kind: input.checkpointId && input.checkpointCompleted ? "mutation" : "link",
      href: input.checkpointId && input.checkpointCompleted ? undefined : contractHref,
      mutation: input.checkpointId && input.checkpointCompleted ? "reopen_checkpoint" : undefined,
      checkpointId: input.checkpointId,
    },
    {
      key: "export_renewal_report",
      label: RENEWAL_ACTION_LABELS.export_renewal_report,
      kind: "link",
      href: buildRenewalsExportHref({ window: input.activeWindow, filters: input.filters }),
    },
  ];
}

function actionHref(
  key: keyof typeof RENEWAL_ACTION_LABELS,
  contractId: string,
  activeWindow: RenewalWindowKey,
  filters: RenewalFilterState
) {
  if (key === "create_renewal_task") {
    return buildRenewalsHref({ window: activeWindow, filters, create: true, contract: contractId });
  }
  if (key === "export_renewal_report") return buildRenewalsExportHref({ window: activeWindow, filters });
  return `/contracts/${contractId}?tab=renewals`;
}

// Whether a renewal/notice date pair falls inside the window. Shared by the row
// filter (matchesWindow) and the per-row report-inclusion flag so the two can
// never disagree about what "in this window" means.
function dateInWindow(renewalDate: Date | null, noticeDate: Date | null, window: RenewalWindowKey, today: Date) {
  const end = addDays(today, Number(window));
  if (renewalDate && renewalDate >= today && renewalDate <= end) return true;
  if (noticeDate && noticeDate >= today && noticeDate <= end) return true;
  if (noticeDate && renewalDate && noticeDate < today && renewalDate >= today && renewalDate <= end) return true;
  return false;
}

function matchesWindow(row: RenewalRow, window: RenewalWindowKey, today: Date) {
  return dateInWindow(parseDateOnly(row.renewalDate), parseDateOnly(row.noticeDate), window, today);
}

function matchesFilters(row: RenewalRow, filters: RenewalFilterState) {
  if (filters.owner === "unassigned" && row.ownerUserId) return false;
  if (filters.owner && filters.owner !== "unassigned" && row.ownerUserId !== filters.owner) return false;
  if (filters.counterparty && row.counterparty.toLowerCase() !== filters.counterparty.toLowerCase()) return false;
  if (filters.status && row.status !== filters.status) return false;
  if (filters.review && !matchesReviewFilter(row, filters.review)) return false;
  return true;
}

function matchesReviewFilter(row: RenewalRow, review: RenewalDateReviewState) {
  // "Reviewed" means the whole row is trusted (both dates approved). Every other
  // state matches when EITHER date is in that state, so a single suggested or
  // missing date surfaces the row for triage.
  if (review === "reviewed") {
    return row.renewalDateReview === "reviewed" && row.noticeDateReview === "reviewed";
  }
  return row.renewalDateReview === review || row.noticeDateReview === review;
}

function compareRenewalRows(a: RenewalRow, b: RenewalRow) {
  const statusWeight: Record<RenewalStatus, number> = {
    notice_window_open: 0,
    needs_owner: 1,
    needs_review: 2,
    in_progress: 3,
    no_renewal_action_needed: 4,
    completed: 5,
  };
  const statusDiff = statusWeight[a.status] - statusWeight[b.status];
  if (statusDiff !== 0) return statusDiff;
  const aDays = Math.min(a.daysUntilNotice ?? Number.POSITIVE_INFINITY, a.daysUntilRenewal ?? Number.POSITIVE_INFINITY);
  const bDays = Math.min(b.daysUntilNotice ?? Number.POSITIVE_INFINITY, b.daysUntilRenewal ?? Number.POSITIVE_INFINITY);
  if (aDays !== bDays) return aDays - bDays;
  return a.title.localeCompare(b.title);
}

// §53 — comparator for the active sort. "urgent" keeps the historical
// status-weighted order; every explicit key sorts on a single dimension and
// falls back to the urgent order (or title) for stable, deterministic ties.
function renewalComparator(sort: RenewalSortKey): (a: RenewalRow, b: RenewalRow) => number {
  if (sort === "notice") {
    return (a, b) => bySoonest(a.daysUntilNotice, b.daysUntilNotice) || a.title.localeCompare(b.title);
  }
  if (sort === "renewal") {
    return (a, b) => bySoonest(a.daysUntilRenewal, b.daysUntilRenewal) || a.title.localeCompare(b.title);
  }
  if (sort === "owner") {
    return (a, b) => byOwner(a, b) || compareRenewalRows(a, b);
  }
  if (sort === "needs_confirmation") {
    return (a, b) => byNeedsConfirmation(a, b) || compareRenewalRows(a, b);
  }
  return compareRenewalRows;
}

// Soonest-first; rows with no date in this dimension sort last (Infinity).
function bySoonest(a: number | null, b: number | null) {
  return (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY);
}

// Assigned owners first, alphabetically by label; unassigned rows sort last.
function byOwner(a: RenewalRow, b: RenewalRow) {
  const aRank = a.ownerUserId ? 0 : 1;
  const bRank = b.ownerUserId ? 0 : 1;
  if (aRank !== bRank) return aRank - bRank;
  return a.ownerLabel.localeCompare(b.ownerLabel);
}

// Rows that still need confirmation or an owner sort first.
function byNeedsConfirmation(a: RenewalRow, b: RenewalRow) {
  const rank = (row: RenewalRow) => (row.status === "needs_review" || row.status === "needs_owner" ? 0 : 1);
  return rank(a) - rank(b);
}

function pickApprovedDate(fields: RenewalFieldRow[], names: readonly string[]) {
  const raw = pickApprovedValue(fields, names);
  const date = parseDateOnly(raw);
  return date && raw ? { raw: formatDateOnly(date), date } : null;
}

function pickApprovedValue(fields: RenewalFieldRow[], names: readonly string[]) {
  return fields
    .filter((field) => names.includes(field.field_name ?? "") && normalizeToken(field.status) === "approved")
    .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))
    .find((field) => field.field_value?.trim())?.field_value?.trim() ?? null;
}

// Provenance of a date that is NOT being displayed (no approved + parseable
// value was shown). A non-rejected extracted candidate means a value exists but
// is not yet trusted → "suggested"; nothing usable → "missing". A displayed
// date is always "reviewed"/"computed" and never routes here. Reads only the
// `extracted_fields.status` already loaded — no extra columns or joins.
function unshownDateReview(fields: RenewalFieldRow[], names: readonly string[]): RenewalDateReviewState {
  const hasCandidate = fields.some(
    (field) =>
      names.includes(field.field_name ?? "") &&
      Boolean(field.field_value?.trim()) &&
      normalizeToken(field.status) !== "rejected"
  );
  // An extracted-but-unapproved value is a "suggested" date awaiting review.
  return hasCandidate ? "suggested" : "missing";
}

function isNoticeWindowOpen(noticeDate: Date | null, renewalDate: Date | null, today: Date) {
  return Boolean(noticeDate && renewalDate && noticeDate <= today && renewalDate >= today);
}

function parseDateOnly(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null;
  const token = raw.trim().slice(0, 10);
  const parsed = parseISO(token);
  if (isValid(parsed)) return startOfDay(parsed);
  const fallback = new Date(raw.trim());
  return isValid(fallback) ? startOfDay(fallback) : null;
}

function formatDateOnly(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function dateLabel(raw: string | null) {
  // §10.12 — an absent date is "no value yet" (em dash), not a warning.
  // "Missing" is reserved for an actionable status/tone, not a date cell.
  return formatBusinessDateAtNoon(raw, "—");
}

function latestByUpdate<T extends { updated_at?: string | null; due_date?: string | null }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const aKey = String(a.updated_at ?? a.due_date ?? "");
    const bKey = String(b.updated_at ?? b.due_date ?? "");
    return bKey.localeCompare(aKey);
  })[0] ?? null;
}

function toContractOptions(contracts: RenewalContractRow[]): RenewalOption[] {
  return [...contracts]
    .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""))
    .map((contract) => ({ value: contract.id, label: contract.title?.trim() || "Untitled contract" }));
}

function toOwnerOptions(members: OrgMemberProfileRow[]): RenewalOption[] {
  return members.map((member) => ({
    value: member.user_id,
    label: orgMemberProfileLabel(member.profiles),
  }));
}

function toCounterpartyOptions(contracts: RenewalContractRow[]): RenewalOption[] {
  const labels = [...new Set(contracts.map((contract) => contract.counterparty?.trim()).filter(Boolean) as string[])];
  return labels.sort((a, b) => a.localeCompare(b)).map((label) => ({ value: label, label }));
}

function groupBy<T>(rows: T[], getKey: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return grouped;
}

function statusTone(status: RenewalStatus): RenewalRow["statusTone"] {
  if (status === "completed") return "healthy";
  if (status === "in_progress") return "info";
  if (status === "notice_window_open" || status === "needs_owner") return "warning";
  if (status === "needs_review") return "in_review";
  return "empty";
}

function isRenewalWindowKey(value: string): value is RenewalWindowKey {
  return RENEWAL_WINDOW_ORDER.includes(value as RenewalWindowKey);
}

function isRenewalStatus(value: string): value is RenewalStatus {
  return Object.prototype.hasOwnProperty.call(RENEWAL_STATUS_LABELS, value);
}

function isRenewalDateReviewState(value: string): value is RenewalDateReviewState {
  return value === "reviewed" || value === "suggested" || value === "computed" || value === "missing";
}

function normalizeToken(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
