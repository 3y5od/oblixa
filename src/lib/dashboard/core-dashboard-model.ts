import { differenceInCalendarDays, isValid, subDays } from "date-fns";
import { parseNoticeDays } from "@/lib/contract-filters";
import { getReviewStatsForContractIds, fetchReviewQueuePage } from "@/lib/contract-review-stats";
import { attachOwnerProfiles } from "@/lib/contracts";
import { EVIDENCE_GAP_STATUSES } from "@/lib/evidence-status";
import { getV10WorkItemHref } from "@/lib/v10-job-routing";
import { applyV10ReadModelVisibility } from "@/lib/v10-visibility";
import { compareV10WorkReadModelRows, getV10DueState } from "@/lib/v10-work-semantics";
import { parseBusinessDateAtNoon } from "@/lib/v9-business-dates";
import { isPlanEnforcementEnabled } from "@/lib/plan";
import { orgHasActivePlan } from "@/lib/plan";
import type { V10WorkItemType } from "@/lib/v10-release-contract";
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
  tone: "success" | "warning" | "danger" | "neutral";
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

export type CoreDashboardModel = {
  workspaceName: string;
  planTier: string | null;
  totalContracts: number;
  showPlanBanner: boolean;
  partialErrors: string[];
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
    href: "/contracts/renewals",
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
  needs_review: { label: DASHBOARD_TOP_CARDS[0], href: "/contracts/review", actionLabel: "Review fields" },
  upcoming_deadlines: { label: DASHBOARD_TOP_CARDS[1], href: "/contracts/renewals", actionLabel: "Create reminder" },
  blocked_work: { label: DASHBOARD_TOP_CARDS[2], href: "/work?lens=blocked", actionLabel: "Open work" },
  missing_owners: { label: DASHBOARD_TOP_CARDS[3], href: "/contracts?owner=missing", actionLabel: "Assign owners" },
  open_exceptions: { label: DASHBOARD_TOP_CARDS[4], href: "/contracts/exceptions?status=open", actionLabel: "Open" },
  evidence_requested: { label: DASHBOARD_TOP_CARDS[5], href: "/contracts/evidence-studio", actionLabel: "Open evidence" },
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

  return contracts.flatMap((contract) => {
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
      actionLabel: row.primary_action ? toSentenceLabel(row.primary_action) : "Open work",
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
        title: row.title?.trim() || "Resolve exception",
        type: "exception",
        status: row.status,
        dueState,
        dueAt: row.due_date,
        contractTitle: row.contract_id ? contractTitleById.get(row.contract_id) ?? null : null,
        ownerLabel: row.owner_id ? ownerLabelById.get(row.owner_id) ?? null : null,
        href: row.contract_id
          ? `/contracts/exceptions?status=open&contract=${row.contract_id}`
          : "/contracts/exceptions?status=open",
        actionLabel: "Open exception",
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
      return "Work completed";
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

export function mergeActivityRows(
  preferredRows: CoreDashboardActivityRow[],
  fallbackRows: CoreDashboardActivityRow[],
  limit = 8
): CoreDashboardActivityRow[] {
  const seen = new Set<string>();
  const merged: CoreDashboardActivityRow[] = [];
  for (const row of [...preferredRows, ...fallbackRows]) {
    const key = `${row.contractTitle ?? row.href}:${row.summary}`;
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
    admin.from("organizations").select("name, plan_tier").eq("id", orgId).maybeSingle(),
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
      .limit(5000),
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
  const reviewStats = await getReviewStatsForContractIds(
    admin,
    reviewContracts.map((contract) => contract.id)
  );

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
  const dataGapFieldRowsRes = await admin
    .from("extracted_fields")
    .select("contract_id, field_name, field_value, status, contracts!inner(organization_id)")
    .eq("contracts.organization_id", orgId)
    .in("field_name", ["renewal_date", "notice_date", "notice_window", "notice_window_ends"])
    .limit(5000);
  if (dataGapFieldRowsRes.error) partialErrors.push("data_gap_fields");

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
    planTier: orgRes.data?.plan_tier?.trim() || null,
    totalContracts: countValue(totalContractsRes as CountResult, partialErrors, "total_contracts"),
    showPlanBanner: enforcePlan && !hasActivePlan,
    partialErrors,
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
        actionLabel: SECTION_CONFIG.review_queue.actionLabel ?? "Review fields",
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
        actionLabel: SECTION_CONFIG.work_needing_action.actionLabel ?? "Open work",
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
        rows: dataGapRows.slice(0, 6),
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
