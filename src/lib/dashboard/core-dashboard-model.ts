import { differenceInCalendarDays, isValid, subDays } from "date-fns";
import { parseNoticeDays } from "@/lib/contract-filters";
import {
  getReviewStatsForContractIds,
  getPendingFieldNamesForContractIds,
  fetchReviewQueuePage,
} from "@/lib/contract-review-stats";
import { attachOwnerProfiles } from "@/lib/contracts";
import { EVIDENCE_GAP_STATUSES } from "@/lib/evidence-status";
import { getV10WorkItemHref } from "@/lib/job-routing";
import {
  getImportJobDetail,
  getImportJobHeadline,
  getImportJobTone,
  importJobCanRetry,
} from "@/lib/import-job-visibility";
import { applyV10ReadModelVisibility } from "@/lib/visibility";
import { compareV10WorkReadModelRows, getV10DueState } from "@/lib/work-semantics";
import { parseBusinessDateAtNoon } from "@/lib/business-dates";
import { isPlanEnforcementEnabled } from "@/lib/plan";
import { orgHasActivePlan } from "@/lib/plan";
import type { V10WorkItemType } from "@/lib/release-contract";
import {
  DASHBOARD_EMPTY_STATES,
  DASHBOARD_MAIN_SECTIONS,
  DASHBOARD_TOP_CARDS,
  type DashboardTopCardLabel,
} from "@/lib/dashboard/spec-strings";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";
import type { createAdminClient } from "@/lib/supabase/server";
import type { Contract } from "@/lib/types";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

export type DashboardTopCardKey =
  | "needs_review"
  | "upcoming_deadlines"
  | "blocked_work"
  | "missing_owners"
  | "open_exceptions"
  | "evidence_requested";

export type DashboardSectionKey =
  | "review_queue"
  | "upcoming_deadlines"
  | "work_needing_action"
  | "data_gaps"
  | "recent_activity";

export type CoreDashboardTopCard = {
  key: DashboardTopCardKey;
  label: DashboardTopCardLabel;
  count: number;
  href: string;
  actionLabel: string;
  tone: "success" | "warning" | "danger" | "accent" | "neutral";
};

export type CoreDashboardReviewRow = {
  id: string;
  title: string;
  counterparty: string | null;
  ownerLabel: string | null;
  updatedAt: string | null;
  href: string;
  reviewed: number;
  totalFields: number;
  pendingFields: number;
  /** Humanized names of the suggested fields awaiting review (e.g. "Renewal
   *  date"), capped — so the row can name what needs review, not just count it. */
  pendingFieldNames: string[];
  status: string;
};

export type CoreDashboardDeadlineRow = {
  id: string;
  contractId: string;
  contractTitle: string;
  label: string;
  date: string;
  daysRemaining: number;
  ownerLabel: string | null;
  href: string;
  /** Trust provenance (release AI boundary): `reviewed` = a human-approved
   *  source-backed field; `derived` = computed from approved fields (e.g. the
   *  notice deadline = renewal date − notice window). Both are source-backed;
   *  the distinction surfaces as a screen-reader label on the deadline row. */
  source: "reviewed" | "derived";
};

export type CoreDashboardWorkRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  dueState: string | null;
  dueAt: string | null;
  contractTitle: string | null;
  ownerLabel: string | null;
  href: string;
  actionLabel: string;
};

export type CoreDashboardDataGapRow = {
  id: string;
  title: string;
  counterparty: string | null;
  ownerLabel: string | null;
  missing: string[];
  href: string;
  updatedAt: string | null;
};

/** Aggregated over the FULL gap set (not the visible page) so the section's
 *  summary strip represents all gap contracts, not just the first few rows. */
export type CoreDashboardDataGapSummary = {
  /** Total contracts with at least one gap (matches the section count). */
  totalContracts: number;
  /** Contracts missing an operational owner. */
  missingOwners: number;
  /** Contracts missing a renewal or notice date. */
  missingDates: number;
  /** Contracts missing a counterparty name. */
  missingCounterparties: number;
  /** updatedAt of the longest-standing (oldest) gap, or null when none. */
  oldestUpdatedAt: string | null;
};

export type CoreDashboardDataGapCategory = {
  key: "owners" | "dates" | "counterparties";
  /** Human label for the column header. */
  label: string;
  /** Full count of contracts whose dominant gap is this category. */
  total: number;
  /** Top contracts (capped) whose dominant gap is this category. */
  rows: CoreDashboardDataGapRow[];
};

export type CoreDashboardActivityRow = {
  id: string;
  label: string;
  summary: string;
  contractTitle: string | null;
  occurredAt: string | null;
  href: string;
  outcome: string | null;
};

export type CoreDashboardSection =
  | {
      key: "review_queue";
      title: string;
      actionLabel: string;
      href: string;
      count: number;
      emptyState: string;
      rows: CoreDashboardReviewRow[];
    }
  | {
      key: "upcoming_deadlines";
      title: string;
      actionLabel: string;
      href: string;
      count: number;
      emptyState: string;
      rows: CoreDashboardDeadlineRow[];
    }
  | {
      key: "work_needing_action";
      title: string;
      actionLabel: string;
      href: string;
      count: number;
      emptyState: string;
      rows: CoreDashboardWorkRow[];
    }
  | {
      key: "data_gaps";
      title: string;
      actionLabel: string;
      href: string;
      count: number;
      emptyState: string;
      rows: CoreDashboardDataGapRow[];
      summary: CoreDashboardDataGapSummary;
      categories: CoreDashboardDataGapCategory[];
    }
  | {
      key: "recent_activity";
      title: string;
      actionLabel: null;
      href: string;
      count: number;
      emptyState: string;
      rows: CoreDashboardActivityRow[];
    };

export type CoreDashboardImportStatus = {
  /** `none` → no banner; `processing` → imports are mid-flight; `attention` →
   *  the most recent import failed or finished with rows that need correction. */
  kind: "none" | "processing" | "attention";
  processingCount: number;
  /** `info` for in-flight processing (a neutral status, not a warning);
   *  `warning`/`danger` reserved for degraded imports needing attention. */
  tone: "info" | "warning" | "danger";
  headline: string;
  detail: string;
  href: string;
  occurredAt: string | null;
  canRetry: boolean;
};

export type CoreDashboardModel = {
  workspaceName: string;
  planTier: string | null;
  totalContracts: number;
  showPlanBanner: boolean;
  partialErrors: string[];
  importStatus: CoreDashboardImportStatus;
  topCards: CoreDashboardTopCard[];
  sections: CoreDashboardSection[];
};

type CountResult = { count: number | null; error?: { message?: string } | null };

type DashboardWorkItemRow = {
  id?: string | null;
  source_id?: string | null;
  source_table?: string | null;
  type: string;
  title: string | null;
  status: string;
  due_state: string | null;
  due_at: string | null;
  contract_id: string | null;
  owner_user_id?: string | null;
  owner_state?: string | null;
  primary_action: string | null;
  blocked_reason?: string | null;
  severity: string | null;
  priority: string | null;
  updated_at: string | null;
};

type DeadlineFieldRow = {
  id: string;
  contract_id: string;
  field_name: string;
  field_value: string | null;
  updated_at?: string | null;
  contracts: { id: string; title: string; organization_id: string; owner_id: string | null } | null;
};

type ContractGapSourceRow = Pick<
  Contract,
  "id" | "title" | "counterparty" | "owner_id" | "status" | "updated_at"
> & {
  annual_value?: number | null;
};

type ActivityEventRow = {
  id: string;
  contract_id: string | null;
  action: string;
  safe_summary: string | null;
  outcome: string | null;
  occurred_at: string | null;
  updated_at: string | null;
};

type AuditActivityRow = {
  id: string;
  contract_id: string | null;
  action: string;
  created_at: string | null;
  details?: Record<string, unknown> | null;
};

type ExceptionWorkSourceRow = {
  id: string;
  contract_id: string | null;
  title: string | null;
  status: string;
  severity: string | null;
  owner_id: string | null;
  due_date: string | null;
  updated_at: string | null;
};

const NON_BLOCKING_PARTIAL_SOURCES = new Set([
  "activity_read_model",
  "blocked_work",
  "evidence_requested",
  "missing_owners",
  "open_exceptions",
  "total_contracts",
  "workflow_settings",
]);

const SECTION_CONFIG: Record<
  DashboardSectionKey,
  { title: string; actionLabel: string | null; href: string; emptyState: string }
> = {
  review_queue: {
    title: DASHBOARD_MAIN_SECTIONS[0].name,
    actionLabel: DASHBOARD_MAIN_SECTIONS[0].action,
    href: "/contracts/review",
    emptyState: DASHBOARD_EMPTY_STATES.reviewQueue,
  },
  upcoming_deadlines: {
    title: DASHBOARD_MAIN_SECTIONS[1].name,
    actionLabel: DASHBOARD_MAIN_SECTIONS[1].action,
    href: "/renewals",
    emptyState: DASHBOARD_EMPTY_STATES.upcomingDeadlines,
  },
  work_needing_action: {
    title: DASHBOARD_MAIN_SECTIONS[2].name,
    actionLabel: DASHBOARD_MAIN_SECTIONS[2].action,
    href: "/work",
    emptyState: DASHBOARD_EMPTY_STATES.workNeedingAction,
  },
  data_gaps: {
    title: DASHBOARD_MAIN_SECTIONS[3].name,
    actionLabel: DASHBOARD_MAIN_SECTIONS[3].action,
    href: "/contracts/review",
    emptyState: DASHBOARD_EMPTY_STATES.dataGaps,
  },
  recent_activity: {
    title: DASHBOARD_MAIN_SECTIONS[4].name,
    actionLabel: DASHBOARD_MAIN_SECTIONS[4].action,
    href: "/contracts",
    emptyState: DASHBOARD_EMPTY_STATES.recentActivity,
  },
};

const TOP_CARD_CONFIG: Record<
  DashboardTopCardKey,
  { label: DashboardTopCardLabel; href: string; actionLabel: string }
> = {
  needs_review: { label: DASHBOARD_TOP_CARDS[0], href: "/contracts/review", actionLabel: "Confirm details" },
  upcoming_deadlines: { label: DASHBOARD_TOP_CARDS[1], href: "/renewals", actionLabel: "Create reminder" },
  blocked_work: { label: DASHBOARD_TOP_CARDS[2], href: "/work?lens=blocked", actionLabel: "Open tasks" },
  missing_owners: { label: DASHBOARD_TOP_CARDS[3], href: "/contracts?owner=missing", actionLabel: "Assign owners" },
  open_exceptions: { label: DASHBOARD_TOP_CARDS[4], href: "/contracts/exceptions?status=open", actionLabel: "Open problems" },
  evidence_requested: { label: DASHBOARD_TOP_CARDS[5], href: "/evidence", actionLabel: "Open evidence" },
};

const TOP_CARD_ORDER: DashboardTopCardKey[] = [
  "needs_review",
  "upcoming_deadlines",
  "blocked_work",
  "missing_owners",
  "open_exceptions",
  "evidence_requested",
];

const DASHBOARD_DEADLINE_FIELDS = [
  "renewal_date",
  "notice_date",
  "notice_window",
  "notice_window_starts",
  "notice_window_ends",
  "termination_date",
  "end_date",
  "effective_date",
] as const;

const DASHBOARD_AUDIT_ACTIVITY_ACTIONS = [
  "contract.uploaded",
  "extraction.completed",
  "field.approved",
  "contract_field.approved",
  "contract.owner_changed",
  "work_item.completed",
  "task.completed",
  "obligation.completed",
  "evidence.received",
  "evidence.submitted",
  "report.exported",
] as const;

function countValue(result: CountResult, errors: string[], label: string): number {
  if (result.error) errors.push(label);
  return result.count ?? 0;
}

function toSentenceLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isPlaceholderExceptionTitle(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "title" || normalized?.endsWith(": title") === true;
}

function topCardTone(key: DashboardTopCardKey, count: number): CoreDashboardTopCard["tone"] {
  if (count <= 0) return "success";
  if (key === "blocked_work" || key === "open_exceptions") return "danger";
  // Accent for the two interactive queues the user works straight through;
  // warning for time-pressure / actionable data gaps (deadlines, missing owners).
  if (key === "needs_review" || key === "evidence_requested") return "accent";
  return "warning";
}

export function getCoreDashboardVisiblePartialErrors(partialErrors: string[]): string[] {
  return partialErrors.filter((source) => !NON_BLOCKING_PARTIAL_SOURCES.has(source));
}

export function deriveCoreDashboardTopCards(input: {
  needsReview: number;
  upcomingDeadlines: number;
  blockedWork: number;
  missingOwners: number;
  openExceptions: number;
  evidenceRequested: number;
}): CoreDashboardTopCard[] {
  const counts: Record<DashboardTopCardKey, number> = {
    needs_review: input.needsReview,
    upcoming_deadlines: input.upcomingDeadlines,
    blocked_work: input.blockedWork,
    missing_owners: input.missingOwners,
    open_exceptions: input.openExceptions,
    evidence_requested: input.evidenceRequested,
  };
  return TOP_CARD_ORDER.map((key) => ({
    key,
    ...TOP_CARD_CONFIG[key],
    count: Math.max(0, counts[key] ?? 0),
    tone: topCardTone(key, counts[key] ?? 0),
  }));
}

export function buildUpcomingDeadlineRows(
  rows: DeadlineFieldRow[],
  ownerLabelById: Map<string, string>,
  now = new Date(),
  horizonDays = 90
): CoreDashboardDeadlineRow[] {
  const byContract = new Map<
    string,
    {
      contract: { id: string; title: string; owner_id: string | null };
      fields: Map<string, DeadlineFieldRow>;
    }
  >();
  for (const row of rows) {
    if (!row.contracts?.id) continue;
    const existing =
      byContract.get(row.contracts.id) ??
      {
        contract: {
          id: row.contracts.id,
          title: row.contracts.title,
          owner_id: row.contracts.owner_id,
        },
        fields: new Map<string, DeadlineFieldRow>(),
      };
    existing.fields.set(row.field_name, row);
    byContract.set(row.contracts.id, existing);
  }

  const built: CoreDashboardDeadlineRow[] = [];
  const pushDate = (
    contract: { id: string; title: string; owner_id: string | null },
    key: string,
    label: string,
    raw: string | null | undefined,
    idSuffix: string
  ) => {
    if (!raw?.trim()) return;
    const date = parseBusinessDateAtNoon(raw);
    if (!date || !isValid(date)) return;
    const daysRemaining = differenceInCalendarDays(date, now);
    if (daysRemaining < 0 || daysRemaining > horizonDays) return;
    const ownerLabel = contract.owner_id ? ownerLabelById.get(contract.owner_id) ?? null : null;
    built.push({
      id: `${contract.id}:${key}:${idSuffix}`,
      contractId: contract.id,
      contractTitle: contract.title,
      label,
      date: date.toISOString(),
      daysRemaining,
      ownerLabel,
      href: `/contracts/${contract.id}`,
      source: idSuffix === "computed" ? "derived" : "reviewed",
    });
  };

  for (const { contract, fields } of byContract.values()) {
    pushDate(contract, "renewal_date", "Renewal date", fields.get("renewal_date")?.field_value, "approved");
    pushDate(contract, "notice_date", "Notice date", fields.get("notice_date")?.field_value, "approved");
    pushDate(contract, "notice_window_starts", "Notice opens", fields.get("notice_window_starts")?.field_value, "approved");
    pushDate(contract, "notice_window_ends", "Notice closes", fields.get("notice_window_ends")?.field_value, "approved");
    pushDate(contract, "termination_date", "Termination date", fields.get("termination_date")?.field_value, "approved");
    pushDate(contract, "end_date", "End date", fields.get("end_date")?.field_value, "approved");
    pushDate(contract, "effective_date", "Effective date", fields.get("effective_date")?.field_value, "approved");

    const renewal = fields.get("renewal_date")?.field_value;
    const noticeWindow = fields.get("notice_window")?.field_value;
    const renewalDate = renewal ? parseBusinessDateAtNoon(renewal) : null;
    const noticeDays = parseNoticeDays(noticeWindow ?? null);
    if (renewalDate && noticeDays && isValid(renewalDate)) {
      const noticeDeadline = subDays(renewalDate, noticeDays);
      pushDate(contract, "computed_notice_deadline", "Notice deadline", noticeDeadline.toISOString(), "computed");
    }
  }

  return built
    .sort((a, b) => {
      if (a.daysRemaining !== b.daysRemaining) return a.daysRemaining - b.daysRemaining;
      return a.contractTitle.localeCompare(b.contractTitle);
    })
    .slice(0, 12);
}

export function buildDataGapRows(
  contracts: ContractGapSourceRow[],
  approvedFieldRows: Array<{ contract_id: string; field_name: string; field_value: string | null; status: string }>,
  ownerLabelById: Map<string, string>
): CoreDashboardDataGapRow[] {
  const approvedByContract = new Map<string, Set<string>>();
  for (const field of approvedFieldRows) {
    if (field.status !== "approved" || !field.field_value?.trim()) continue;
    const set = approvedByContract.get(field.contract_id) ?? new Set<string>();
    set.add(field.field_name);
    approvedByContract.set(field.contract_id, set);
  }

  const gapRows = contracts.flatMap((contract) => {
    const fields = approvedByContract.get(contract.id) ?? new Set<string>();
    const missing: string[] = [];
    if (!contract.owner_id) missing.push("Owner");
    if (!contract.counterparty?.trim()) missing.push("Counterparty");
    if (!fields.has("renewal_date")) missing.push("Renewal date");
    if (!fields.has("notice_date") && !fields.has("notice_window") && !fields.has("notice_window_ends")) {
      missing.push("Notice date");
    }
    if (contract.annual_value == null) missing.push("Contract value");
    if (!contract.status?.trim()) missing.push("Status");
    if (missing.length === 0) return [];
    return [
      {
        id: contract.id,
        title: contract.title,
        counterparty: contract.counterparty,
        ownerLabel: contract.owner_id ? ownerLabelById.get(contract.owner_id) ?? null : null,
        missing,
        href: `/contracts/${contract.id}`,
        updatedAt: contract.updated_at,
      },
    ];
  });

  // Surface the gaps that block the core tracking loop first: an unowned
  // contract (no accountability) and missing renewal/notice dates (no deadline
  // to track) outrank softer metadata gaps like counterparty or value. Stable
  // sort preserves the source `updated_at` ordering within each severity tier.
  return [...gapRows].sort(
    (a, b) => dataGapSeverity(b.missing) - dataGapSeverity(a.missing)
  );
}

function dataGapSeverity(missing: string[]): number {
  let score = 0;
  if (missing.includes("Owner")) score += 4;
  if (missing.includes("Renewal date")) score += 3;
  if (missing.includes("Notice date")) score += 3;
  if (missing.includes("Counterparty")) score += 1;
  return score;
}

/** Aggregate the FULL gap set into the section summary. Counts the major gap
 *  families and the oldest (longest-standing) gap so the summary strip is
 *  truthful for all gap contracts, not just the visible page. */
export function summarizeDataGaps(
  rows: CoreDashboardDataGapRow[]
): CoreDashboardDataGapSummary {
  let missingOwners = 0;
  let missingDates = 0;
  let missingCounterparties = 0;
  let oldestUpdatedAt: string | null = null;
  for (const row of rows) {
    if (row.missing.includes("Owner")) missingOwners += 1;
    if (row.missing.includes("Renewal date") || row.missing.includes("Notice date")) {
      missingDates += 1;
    }
    if (row.missing.includes("Counterparty")) missingCounterparties += 1;
    // ISO timestamps sort correctly as strings; keep the earliest (oldest) gap.
    if (row.updatedAt && (oldestUpdatedAt === null || row.updatedAt < oldestUpdatedAt)) {
      oldestUpdatedAt = row.updatedAt;
    }
  }
  return {
    totalContracts: rows.length,
    missingOwners,
    missingDates,
    missingCounterparties,
    oldestUpdatedAt,
  };
}

const DATA_GAP_CATEGORY_LABEL: Record<"owners" | "dates" | "counterparties", string> = {
  owners: "Owners",
  dates: "Dates",
  counterparties: "Counterparties",
};

/** Dominant gap category for a contract — the highest-severity missing field
 *  family. Value/status-only gaps (rare, severity 0) return null and are not
 *  shown in the category board. Keep in lockstep with `dataGapSeverity`. */
function dominantGapCategory(
  missing: string[]
): "owners" | "dates" | "counterparties" | null {
  if (missing.includes("Owner")) return "owners";
  if (missing.includes("Renewal date") || missing.includes("Notice date")) return "dates";
  if (missing.includes("Counterparty")) return "counterparties";
  return null;
}

/** Bucket the full gap set into balanced category columns: each column gets its
 *  OWN top-N rows (preserving the incoming severity order) plus the full category
 *  count. A single global top-N list can't drive the board — a category with many
 *  gaps would starve the others — which is why selection happens per category. */
export function buildDataGapCategories(
  rows: CoreDashboardDataGapRow[],
  perCategory = 5
): CoreDashboardDataGapCategory[] {
  const buckets: Record<"owners" | "dates" | "counterparties", CoreDashboardDataGapRow[]> = {
    owners: [],
    dates: [],
    counterparties: [],
  };
  for (const row of rows) {
    const category = dominantGapCategory(row.missing);
    if (category) buckets[category].push(row);
  }
  // `total` is the dominant-bucket size (contracts whose PRIMARY gap is this
  // category), so the column count always matches its rows. A contract missing
  // owner + counterparty counts under owners; its counterparty gap shows as a
  // chip on that row rather than inflating an otherwise-empty counterparty
  // column.
  return (["owners", "dates", "counterparties"] as const).map((key) => ({
    key,
    label: DATA_GAP_CATEGORY_LABEL[key],
    total: buckets[key].length,
    rows: buckets[key].slice(0, perCategory),
  }));
}

export function buildWorkRows(
  rows: DashboardWorkItemRow[],
  contractTitleById: Map<string, string>,
  ownerLabelById: Map<string, string>
): CoreDashboardWorkRow[] {
  return [...rows]
    .sort(compareV10WorkReadModelRows)
    .slice(0, 8)
    .map((row) => ({
      id: row.id ?? `${row.type}:${row.source_id ?? row.title ?? "work"}`,
      title: row.title ?? toSentenceLabel(row.type),
      type: row.type,
      status: row.status,
      dueState: row.due_state,
      dueAt: row.due_at,
      contractTitle: row.contract_id ? contractTitleById.get(row.contract_id) ?? null : null,
      ownerLabel: row.owner_user_id ? ownerLabelById.get(row.owner_user_id) ?? null : null,
      href: getV10WorkItemHref({
        type: row.type as V10WorkItemType,
        sourceId: String(row.source_id ?? row.id ?? ""),
        contractId: row.contract_id,
        primaryAction: row.primary_action,
        fallbackHref: "/work",
      }),
      actionLabel: row.primary_action ? toSentenceLabel(row.primary_action) : "Open task",
    }));
}

export function buildExceptionWorkRows(
  rows: ExceptionWorkSourceRow[],
  contractTitleById: Map<string, string>,
  ownerLabelById: Map<string, string>,
  excludedExceptionIds = new Set<string>()
): CoreDashboardWorkRow[] {
  return rows
    .filter((row) => {
      if (excludedExceptionIds.has(row.id)) return false;
      if (row.contract_id && !contractTitleById.has(row.contract_id)) return false;
      return !isPlaceholderExceptionTitle(row.title);
    })
    .map((row) => {
      const dueState = row.due_date ? getV10DueState(row.due_date, { dateOnly: true }) : "none";
      return {
        id: `exception:${row.id}`,
        title: row.title?.trim() || "Resolve problem",
        type: "exception",
        status: row.status,
        dueState,
        dueAt: row.due_date,
        contractTitle: row.contract_id ? contractTitleById.get(row.contract_id) ?? null : null,
        ownerLabel: row.owner_id ? ownerLabelById.get(row.owner_id) ?? null : null,
        href: row.contract_id
          ? `/contracts/exceptions?status=open&contract=${row.contract_id}`
          : "/contracts/exceptions?status=open",
        actionLabel: "Open problem",
      };
    })
    .sort((a, b) => {
      const aRank = a.status === "blocked" || a.dueState === "overdue" ? 0 : 1;
      const bRank = b.status === "blocked" || b.dueState === "overdue" ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
      return String(a.title).localeCompare(String(b.title));
    });
}

export function buildActivityRows(
  rows: ActivityEventRow[],
  contractTitleById: Map<string, string>
): CoreDashboardActivityRow[] {
  return rows.slice(0, 8).map((row) => ({
    id: row.id,
    label: toSentenceLabel(row.action.replace(/\./g, " ")),
    summary: row.safe_summary || toSentenceLabel(row.action.replace(/\./g, " ")),
    contractTitle: row.contract_id ? contractTitleById.get(row.contract_id) ?? null : null,
    occurredAt: row.occurred_at ?? row.updated_at,
    href: row.contract_id ? `/contracts/${row.contract_id}` : "/contracts",
    outcome: row.outcome,
  }));
}

function auditActivitySummary(action: string): string {
  switch (action) {
    case "contract.uploaded":
      return "Contract uploaded";
    case "extraction.completed":
      return "Extraction completed";
    case "field.approved":
    case "contract_field.approved":
      return "Field approved";
    case "contract.owner_changed":
      return "Owner changed";
    case "work_item.completed":
    case "task.completed":
    case "obligation.completed":
      return "Task completed";
    case "evidence.received":
    case "evidence.submitted":
      return "Evidence received";
    case "report.exported":
      return "Report exported";
    default:
      return toSentenceLabel(action.replace(/\./g, " "));
  }
}

export function buildAuditActivityRows(
  rows: AuditActivityRow[],
  contractTitleById: Map<string, string>
): CoreDashboardActivityRow[] {
  return rows.map((row) => {
    const summary = auditActivitySummary(row.action);
    return {
      id: `audit:${row.id}`,
      label: summary,
      summary,
      contractTitle: row.contract_id ? contractTitleById.get(row.contract_id) ?? null : null,
      occurredAt: row.created_at,
      href: row.contract_id ? `/contracts/${row.contract_id}` : "/contracts",
      outcome: null,
    };
  });
}

type ImportJobSummaryRow = {
  id: string;
  status: string;
  total_rows: number | null;
  inserted_rows: number | null;
  error_rows: number | null;
  failure_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  superseded_by_job_id: string | null;
  retry_of_job_id: string | null;
};

const IMPORT_ATTENTION_WINDOW_DAYS = 14;

function importJobRecencyTs(row: ImportJobSummaryRow): string | null {
  return row.completed_at ?? row.updated_at ?? row.created_at ?? null;
}

/**
 * Collapse recent contract import jobs into the single banner state the
 * dashboard shows. Mid-flight imports win (`processing`); otherwise the most
 * recent failed / partially-failed import within a recency window surfaces as
 * `attention` (reusing the shared import-job visibility copy). A clean
 * completed import shows nothing — the dashboard shouldn't nag after success.
 * Superseded jobs (replaced by a retry) are ignored.
 */
export function deriveImportStatusSummary(
  rows: ImportJobSummaryRow[],
  now = new Date()
): CoreDashboardImportStatus {
  const href = "/contracts/bulk";
  const none: CoreDashboardImportStatus = {
    kind: "none",
    processingCount: 0,
    tone: "warning",
    headline: "",
    detail: "",
    href,
    occurredAt: null,
    canRetry: false,
  };

  const active = rows.filter((row) => !row.superseded_by_job_id);

  const processing = active.filter((row) => row.status === "processing");
  if (processing.length > 0) {
    return {
      kind: "processing",
      processingCount: processing.length,
      // In-flight import is informational, not a warning — reserve amber/red for
      // degraded imports.
      tone: "info",
      headline:
        processing.length === 1
          ? "1 import processing"
          : `${processing.length} imports processing`,
      detail: "Contract counts may update as import jobs finish.",
      href,
      occurredAt: null,
      canRetry: false,
    };
  }

  const attention = active
    .filter(
      (row) =>
        row.status === "failed" ||
        (row.status === "completed" && (row.error_rows ?? 0) > 0)
    )
    .filter((row) => {
      const ts = importJobRecencyTs(row);
      if (!ts) return false;
      const when = new Date(ts);
      if (!Number.isFinite(when.getTime())) return false;
      return differenceInCalendarDays(now, when) <= IMPORT_ATTENTION_WINDOW_DAYS;
    })
    .sort((a, b) => {
      const at = new Date(importJobRecencyTs(a) ?? 0).getTime();
      const bt = new Date(importJobRecencyTs(b) ?? 0).getTime();
      return bt - at;
    });

  const job = attention[0];
  if (job) {
    return {
      kind: "attention",
      processingCount: 0,
      tone: getImportJobTone(job) === "risk" ? "danger" : "warning",
      headline: getImportJobHeadline(job),
      detail: getImportJobDetail(job),
      href,
      occurredAt: job.completed_at ?? job.updated_at ?? null,
      canRetry: importJobCanRetry(job),
    };
  }

  return none;
}

/** Canonical activity kind, derived from the same label/summary/outcome text
 *  the feed component maps to a caps verb. Two rows that classify the same way
 *  on the same contract render identically (e.g. "CHANGED · RIDGEWAY"), so they
 *  must dedupe — even when the two sources phrase the summary differently
 *  ("Owner changed" vs "Updated the owner"). Keep these branches in lockstep
 *  with `activityVisual` in core-dashboard.tsx. */
export function activityDedupeKind(row: CoreDashboardActivityRow): string {
  const text = `${row.label} ${row.summary} ${row.outcome ?? ""}`.toLowerCase();
  if (text.includes("upload")) return "uploaded";
  if (text.includes("extract")) return "extracted";
  if (text.includes("approv")) return "approved";
  if (text.includes("reject")) return "rejected";
  if (text.includes("creat")) return "created";
  if (text.includes("delet")) return "deleted";
  // owner_changed / status_changed / *_updated / file_superseded all display as
  // CHANGED, so they share a dedupe kind.
  if (
    text.includes("owner") ||
    text.includes("updat") ||
    text.includes("chang") ||
    text.includes("status") ||
    text.includes("supersed") ||
    text.includes("applied")
  )
    return "changed";
  if (text.includes("complet") || text.includes("done")) return "completed";
  if (text.includes("evidence") || text.includes("receiv")) return "received";
  if (text.includes("export")) return "exported";
  if (text.includes("sign")) return "signed";
  // Last word, not first: "Contract Created" → "created", not "contract"
  // (which collapsed every unmapped contract event into one generic kind).
  const words = row.label.trim().split(/\s+/);
  return (words[words.length - 1] || "activity").toLowerCase();
}

export function mergeActivityRows(
  preferredRows: CoreDashboardActivityRow[],
  fallbackRows: CoreDashboardActivityRow[],
  limit = 8
): CoreDashboardActivityRow[] {
  const seen = new Set<string>();
  const merged: CoreDashboardActivityRow[] = [];
  for (const row of [...preferredRows, ...fallbackRows]) {
    // Dedupe on contract + displayed kind, not the raw summary string: the v10
    // read model and the audit fallback describe the same event with different
    // phrasings, which slipped past a summary-keyed check and surfaced as
    // visually identical duplicate rows.
    const key = `${row.contractTitle ?? row.href}:${activityDedupeKind(row)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
    if (merged.length >= limit) break;
  }
  return merged;
}

async function loadOwnerLabels(admin: Admin, orgId: string, userIds: string[]): Promise<Map<string, string>> {
  const rows = await loadOrgMemberProfileRows(admin, orgId, { userIds });
  return new Map(rows.map((row) => [row.user_id, orgMemberProfileLabel(row.profiles, "Unassigned")]));
}

async function loadContractTitleMap(admin: Admin, orgId: string, contractIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(contractIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data } = await admin
    .from("contracts")
    .select("id, title")
    .eq("organization_id", orgId)
    .in("id", ids);
  return new Map(((data ?? []) as Array<{ id: string; title: string }>).map((row) => [row.id, row.title]));
}

export async function loadCoreDashboardModel(input: {
  admin: Admin;
  orgId: string;
  userId: string;
  role: string;
  workspaceMode: WorkspaceProductMode;
}): Promise<CoreDashboardModel> {
  const { admin, orgId, userId, role, workspaceMode } = input;
  const partialErrors: string[] = [];
  const enforcePlan = isPlanEnforcementEnabled();

  const [
    orgRes,
    workflowSettingsRes,
    hasActivePlan,
    reviewQueue,
    missingOwnersRes,
    openExceptionsRes,
    blockedWorkRes,
    evidenceRequestedRes,
    totalContractsRes,
    deadlineFieldsRes,
    dataGapContractsRes,
    workItemsRes,
    exceptionRowsRes,
    activityRes,
    auditActivityRes,
  ] = await Promise.all([
    // Keep this query on durable org identity columns only. `plan_tier` is not
    // present in all dev/staging schemas; selecting it turns the whole org load
    // into a visible partial-data dashboard warning.
    admin.from("organizations").select("name").eq("id", orgId).maybeSingle(),
    admin
      .from("organization_workflow_settings")
      .select("dashboard_tracking_enabled")
      .eq("organization_id", orgId)
      .maybeSingle(),
    enforcePlan ? orgHasActivePlan(admin, orgId) : Promise.resolve(true),
    fetchReviewQueuePage(admin, orgId, 1),
    admin
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("owner_id", null),
    admin
      .from("exceptions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress"]),
    applyV10ReadModelVisibility(
      admin.from("v10_work_items").select("id", { count: "exact", head: true }),
      { organizationId: orgId, role, workspaceMode }
    ).eq("status", "blocked"),
    applyV10ReadModelVisibility(
      admin.from("v10_evidence_request_statuses").select("id", { count: "exact", head: true }),
      { organizationId: orgId, role, workspaceMode }
    ).in("status", [...EVIDENCE_GAP_STATUSES, "overdue"]),
    admin.from("contracts").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    admin
      .from("extracted_fields")
      .select("id, contract_id, field_name, field_value, updated_at, contracts!inner(id, title, organization_id, owner_id)")
      .eq("contracts.organization_id", orgId)
      .eq("status", "approved")
      .in("field_name", [...DASHBOARD_DEADLINE_FIELDS])
      .not("field_value", "is", null)
      .range(0, 4999),
    admin
      .from("contracts")
      .select("id, title, counterparty, owner_id, status, annual_value, updated_at")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(1000),
    applyV10ReadModelVisibility(
      admin
        .from("v10_work_items")
        .select("id, source_id, source_table, type, title, status, due_state, due_at, contract_id, owner_user_id, owner_state, primary_action, blocked_reason, severity, priority, updated_at"),
      { organizationId: orgId, role, workspaceMode }
    )
      .in("type", ["contract_task", "obligation", "approval", "exception", "evidence_request", "renewal_checkpoint"])
      .neq("status", "done")
      .neq("status", "canceled")
      .order("updated_at", { ascending: false })
      .limit(100),
    admin
      .from("exceptions")
      .select("id, contract_id, title, status, severity, owner_id, due_date, updated_at")
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress"])
      .order("updated_at", { ascending: false })
      .limit(25),
    applyV10ReadModelVisibility(
      admin
        .from("v10_contract_activity_events")
        .select("id, contract_id, action, safe_summary, outcome, occurred_at, updated_at"),
      { organizationId: orgId, role, workspaceMode }
    )
      .order("occurred_at", { ascending: false })
      .limit(12),
    admin
      .from("audit_events")
      .select("id, contract_id, action, created_at, details")
      .eq("organization_id", orgId)
      .in("action", [...DASHBOARD_AUDIT_ACTIVITY_ACTIONS])
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  if (orgRes.error) partialErrors.push("organization");
  if (workflowSettingsRes.error) partialErrors.push("workflow_settings");
  if (deadlineFieldsRes.error) partialErrors.push("upcoming_deadlines");
  if (dataGapContractsRes.error) partialErrors.push("data_gaps");
  if (workItemsRes.error) partialErrors.push("work_needing_action");
  if (exceptionRowsRes.error) partialErrors.push("exception_work_fallback");
  if (activityRes.error && auditActivityRes.error) partialErrors.push("recent_activity");
  if (activityRes.error && !auditActivityRes.error) partialErrors.push("activity_read_model");

  const reviewContracts = await attachOwnerProfiles(admin, orgId, reviewQueue.contracts);
  const reviewContractIds = reviewContracts.map((contract) => contract.id);
  const [reviewStats, pendingFieldNamesByContract] = await Promise.all([
    getReviewStatsForContractIds(admin, reviewContractIds),
    // Only the first 6 contracts render rows; name their suggested fields.
    getPendingFieldNamesForContractIds(admin, reviewContractIds.slice(0, 6)),
  ]);

  const ownerIds = new Set<string>();
  for (const contract of reviewContracts) if (contract.owner_id) ownerIds.add(contract.owner_id);
  for (const field of (deadlineFieldsRes.data ?? []) as unknown as DeadlineFieldRow[]) {
    if (field.contracts?.owner_id) ownerIds.add(field.contracts.owner_id);
  }
  for (const contract of (dataGapContractsRes.data ?? []) as ContractGapSourceRow[]) {
    if (contract.owner_id) ownerIds.add(contract.owner_id);
  }
  for (const item of (workItemsRes.data ?? []) as DashboardWorkItemRow[]) {
    if (item.owner_user_id) ownerIds.add(item.owner_user_id);
  }
  for (const item of (exceptionRowsRes.data ?? []) as ExceptionWorkSourceRow[]) {
    if (item.owner_id) ownerIds.add(item.owner_id);
  }
  const ownerLabelById = await loadOwnerLabels(admin, orgId, [...ownerIds]);

  const deadlineRows = buildUpcomingDeadlineRows(
    (deadlineFieldsRes.data ?? []) as unknown as DeadlineFieldRow[],
    ownerLabelById
  );
  const [dataGapFieldRowsRes, importJobsRes] = await Promise.all([
    admin
      .from("extracted_fields")
      .select("contract_id, field_name, field_value, status, contracts!inner(organization_id)")
      .eq("contracts.organization_id", orgId)
      .in("field_name", ["renewal_date", "notice_date", "notice_window", "notice_window_ends"])
      .range(0, 4999),
    admin
      .from("contract_import_jobs")
      .select(
        "id, status, total_rows, inserted_rows, error_rows, failure_reason, created_at, updated_at, completed_at, superseded_by_job_id, retry_of_job_id"
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (dataGapFieldRowsRes.error) partialErrors.push("data_gap_fields");

  // Import status is its own banner, distinct from the dashboard partial-data
  // notice. A failed query just yields "none" — it must not masquerade as a
  // partial-data error (the two states have different meanings and banners).
  const importStatus = deriveImportStatusSummary(
    (importJobsRes.error ? [] : (importJobsRes.data ?? [])) as ImportJobSummaryRow[]
  );

  const dataGapRows = buildDataGapRows(
    (dataGapContractsRes.data ?? []) as ContractGapSourceRow[],
    (dataGapFieldRowsRes.data ?? []) as Array<{
      contract_id: string;
      field_name: string;
      field_value: string | null;
      status: string;
    }>,
    ownerLabelById
  );
  const dataGapSummary = summarizeDataGaps(dataGapRows);
  const dataGapCategories = buildDataGapCategories(dataGapRows);
  // Rows actually shown across the category columns — drives the section's
  // "showing N of M" footer and the empty check.
  const dataGapShownRows = dataGapCategories.flatMap((category) => category.rows);

  const workRowsRaw = (workItemsRes.data ?? []) as DashboardWorkItemRow[];
  const activityRowsRaw = (activityRes.data ?? []) as ActivityEventRow[];
  const exceptionRowsRaw = (exceptionRowsRes.data ?? []) as ExceptionWorkSourceRow[];
  const auditActivityRowsRaw = (auditActivityRes.data ?? []) as unknown as AuditActivityRow[];
  const contractIds = [
    ...workRowsRaw.flatMap((row) => (row.contract_id ? [row.contract_id] : [])),
    ...exceptionRowsRaw.flatMap((row) => (row.contract_id ? [row.contract_id] : [])),
    ...activityRowsRaw.flatMap((row) => (row.contract_id ? [row.contract_id] : [])),
    ...auditActivityRowsRaw.flatMap((row) => (row.contract_id ? [row.contract_id] : [])),
  ];
  const contractTitleById = await loadContractTitleMap(admin, orgId, contractIds);
  const workRows = buildWorkRows(workRowsRaw, contractTitleById, ownerLabelById);
  const v10ExceptionSourceIds = new Set(
    workRowsRaw
      .filter((row) => row.type === "exception" && row.source_id)
      .map((row) => String(row.source_id))
  );
  const exceptionWorkRows = buildExceptionWorkRows(
    exceptionRowsRaw,
    contractTitleById,
    ownerLabelById,
    v10ExceptionSourceIds
  );
  const combinedWorkRows = [...workRows, ...exceptionWorkRows].slice(0, 8);
  const activityRows = mergeActivityRows(
    buildActivityRows(activityRowsRaw, contractTitleById),
    buildAuditActivityRows(auditActivityRowsRaw, contractTitleById)
  );

  const needsReview = reviewQueue.total;
  const upcomingDeadlines = deadlineRows.length;
  const blockedWork = countValue(blockedWorkRes as CountResult, partialErrors, "blocked_work");
  const missingOwners = countValue(missingOwnersRes as CountResult, partialErrors, "missing_owners");
  const openExceptions = countValue(openExceptionsRes as CountResult, partialErrors, "open_exceptions");
  const evidenceRequested = countValue(evidenceRequestedRes as CountResult, partialErrors, "evidence_requested");

  if (workflowSettingsRes.data?.dashboard_tracking_enabled !== false) {
    await admin.from("audit_events").insert({
      organization_id: orgId,
      contract_id: null,
      user_id: userId,
      action: "dashboard.viewed",
      details: { surface: "core_dashboard" },
    });
  }

  return {
    workspaceName: orgRes.data?.name?.trim() || "Workspace",
    planTier: null,
    totalContracts: countValue(totalContractsRes as CountResult, partialErrors, "total_contracts"),
    showPlanBanner: enforcePlan && !hasActivePlan,
    partialErrors,
    importStatus,
    topCards: deriveCoreDashboardTopCards({
      needsReview,
      upcomingDeadlines,
      blockedWork,
      missingOwners,
      openExceptions,
      evidenceRequested,
    }),
    sections: [
      {
        key: "review_queue",
        title: SECTION_CONFIG.review_queue.title,
        actionLabel: SECTION_CONFIG.review_queue.actionLabel ?? "Confirm details",
        href: SECTION_CONFIG.review_queue.href,
        count: reviewQueue.total,
        emptyState: SECTION_CONFIG.review_queue.emptyState,
        rows: reviewContracts.slice(0, 6).map((contract) => {
          const stats = reviewStats[contract.id] ?? { total: 0, approved: 0, pending: 0 };
          return {
            id: contract.id,
            title: contract.title,
            counterparty: contract.counterparty,
            ownerLabel: contract.owner?.full_name ?? contract.owner?.email ?? null,
            updatedAt: contract.updated_at,
            href: `/contracts/${contract.id}?tab=overview&from=dashboard#extracted-fields`,
            reviewed: stats.approved,
            totalFields: stats.total,
            pendingFields: stats.pending,
            pendingFieldNames: (pendingFieldNamesByContract[contract.id] ?? []).map(toSentenceLabel),
            status: contract.status,
          };
        }),
      },
      {
        key: "upcoming_deadlines",
        title: SECTION_CONFIG.upcoming_deadlines.title,
        actionLabel: SECTION_CONFIG.upcoming_deadlines.actionLabel ?? "Create reminder",
        href: SECTION_CONFIG.upcoming_deadlines.href,
        count: deadlineRows.length,
        emptyState: SECTION_CONFIG.upcoming_deadlines.emptyState,
        rows: deadlineRows.slice(0, 6),
      },
      {
        key: "work_needing_action",
        title: SECTION_CONFIG.work_needing_action.title,
        actionLabel: SECTION_CONFIG.work_needing_action.actionLabel ?? "Open tasks",
        href: SECTION_CONFIG.work_needing_action.href,
        count: combinedWorkRows.length,
        emptyState: SECTION_CONFIG.work_needing_action.emptyState,
        rows: combinedWorkRows.slice(0, 6),
      },
      {
        key: "data_gaps",
        title: SECTION_CONFIG.data_gaps.title,
        actionLabel: SECTION_CONFIG.data_gaps.actionLabel ?? "Fix missing data",
        href: SECTION_CONFIG.data_gaps.href,
        count: dataGapRows.length,
        emptyState: SECTION_CONFIG.data_gaps.emptyState,
        rows: dataGapShownRows,
        summary: dataGapSummary,
        categories: dataGapCategories,
      },
      {
        key: "recent_activity",
        title: SECTION_CONFIG.recent_activity.title,
        actionLabel: null,
        href: SECTION_CONFIG.recent_activity.href,
        count: activityRows.length,
        emptyState: SECTION_CONFIG.recent_activity.emptyState,
        rows: activityRows.slice(0, 6),
      },
    ],
  };
}
