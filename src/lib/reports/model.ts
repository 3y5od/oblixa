import { addDays, format, isValid, parseISO, startOfDay, subDays } from "date-fns";
import type { createAdminClient } from "@/lib/supabase/server";
import { parseNoticeDays } from "@/lib/contract-filters";
import {
  loadOrgMemberProfileRows,
  orgMemberProfileLabel,
  type OrgMemberProfileRow,
} from "@/lib/org-member-profiles";
import { applyV10ReadModelVisibility } from "@/lib/visibility";
import {
  REPORT_LABELS,
  REPORT_WINDOW_LABELS,
  REPORTS_EYEBROW,
  REPORTS_PAGE_LEAD,
  REPORTS_PAGE_TITLE,
  REPORTS_PRIMARY_CTA,
} from "./spec-strings";
import type {
  ReportDefinition,
  ReportExportRun,
  ReportFilterKey,
  ReportFilterState,
  ReportKey,
  ReportOption,
  ReportPreviewRow,
  ReportWindowKey,
  ReportsModelLoadInput,
  ReportsModelSearchInput,
  ReportsPageModel,
} from "./types";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export const REPORT_ORDER = [
  "upcoming_renewals",
  "notice_deadlines",
  "missing_owners",
  "missing_key_fields",
  "open_obligations",
  "overdue_work",
  "exceptions_by_owner",
  "evidence_requests",
  "contract_inventory",
  "review_completeness",
] as const satisfies readonly ReportKey[];

export const REPORT_WINDOW_ORDER = ["30", "60", "90", "180"] as const satisfies readonly ReportWindowKey[];

export const REPORT_DEFINITIONS: Record<ReportKey, ReportDefinition> = {
  upcoming_renewals: {
    key: "upcoming_renewals",
    label: REPORT_LABELS.upcoming_renewals,
    description: "Contracts with approved renewal dates inside the selected window.",
    columns: ["Contract", "Counterparty", "Renewal date", "Owner", "Status", "Next action"],
  },
  notice_deadlines: {
    key: "notice_deadlines",
    label: REPORT_LABELS.notice_deadlines,
    description: "Notice deadlines that need attention before renewal decisions.",
    columns: ["Contract", "Counterparty", "Notice date", "Renewal date", "Owner", "Status"],
  },
  missing_owners: {
    key: "missing_owners",
    label: REPORT_LABELS.missing_owners,
    description: "Contracts that do not have a named internal owner.",
    columns: ["Contract", "Counterparty", "Status", "Last update", "Next action"],
  },
  missing_key_fields: {
    key: "missing_key_fields",
    label: REPORT_LABELS.missing_key_fields,
    description: "Contracts missing reviewed dates, values, status, counterparty, or owner data.",
    columns: ["Contract", "Counterparty", "Missing fields", "Owner", "Status", "Next action"],
  },
  open_obligations: {
    key: "open_obligations",
    label: REPORT_LABELS.open_obligations,
    description: "Contract obligations that remain open or in progress.",
    columns: ["Obligation", "Contract", "Owner", "Due date", "Status", "Last update"],
  },
  overdue_work: {
    key: "overdue_work",
    label: REPORT_LABELS.overdue_work,
    description: "Visible Core work items past their due date.",
    columns: ["Work item", "Contract", "Owner", "Due date", "Status", "Type"],
  },
  exceptions_by_owner: {
    key: "exceptions_by_owner",
    label: REPORT_LABELS.exceptions_by_owner,
    description: "Open exceptions grouped by assigned owner.",
    columns: ["Owner", "Open exceptions", "High severity", "Next due date", "Contracts"],
  },
  evidence_requests: {
    key: "evidence_requests",
    label: REPORT_LABELS.evidence_requests,
    description: "Evidence requests that need submission or review.",
    columns: ["Request", "Contract", "Owner", "Due date", "Status", "Attached files"],
  },
  contract_inventory: {
    key: "contract_inventory",
    label: REPORT_LABELS.contract_inventory,
    description: "Contract records with owner, counterparty, status, and update metadata.",
    columns: ["Contract", "Counterparty", "Owner", "Status", "Type", "Last update"],
  },
  review_completeness: {
    key: "review_completeness",
    label: REPORT_LABELS.review_completeness,
    description: "Field review progress and pending review counts by contract.",
    columns: ["Contract", "Counterparty", "Approved fields", "Pending fields", "Review state", "Last update"],
  },
};

/**
 * Status filter options scoped to the active report's domain. A renewals/contract
 * report must not offer an evidence-only status like "Requested" (the value reads
 * as cross-domain and never matches a contract row). Each value MUST also be a
 * member of `REPORT_EXPORT_STATUSES` in src/app/api/export/reports/route.ts, or
 * the export route silently drops the filter on download.
 */
const CONTRACT_STATUS_OPTIONS: ReportOption[] = [
  { value: "active", label: "Active" },
  { value: "pending_review", label: "Pending review" },
  { value: "draft", label: "Incomplete" },
  { value: "expired", label: "Expired" },
  { value: "terminated", label: "Terminated" },
];
const WORK_STATUS_OPTIONS: ReportOption[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "overdue", label: "Overdue" },
];
const OBLIGATION_STATUS_OPTIONS: ReportOption[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
];
const EVIDENCE_STATUS_OPTIONS: ReportOption[] = [
  { value: "requested", label: "Requested" },
  { value: "received", label: "Received" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "overdue", label: "Overdue" },
];

const REPORT_STATUS_DOMAIN: Record<ReportKey, ReportOption[]> = {
  upcoming_renewals: CONTRACT_STATUS_OPTIONS,
  notice_deadlines: CONTRACT_STATUS_OPTIONS,
  missing_owners: CONTRACT_STATUS_OPTIONS,
  missing_key_fields: CONTRACT_STATUS_OPTIONS,
  contract_inventory: CONTRACT_STATUS_OPTIONS,
  review_completeness: CONTRACT_STATUS_OPTIONS,
  open_obligations: OBLIGATION_STATUS_OPTIONS,
  overdue_work: WORK_STATUS_OPTIONS,
  evidence_requests: EVIDENCE_STATUS_OPTIONS,
  // Rows are grouped per owner and are always "open" exceptions, so a status
  // filter is a no-op here — the toolbar drops the control entirely.
  exceptions_by_owner: [],
};

/**
 * Filter dimensions each report actually supports, in display order. `window`
 * only filters the two windowed reports; the owner-grouped exceptions report
 * carries no counterparty/status on its rows, so it exposes only `owner`.
 * Rendering a no-op control (and worse, one that empties the report when used)
 * is removed by gating on this list.
 */
const REPORT_APPLICABLE_FILTERS: Record<ReportKey, ReportFilterKey[]> = {
  upcoming_renewals: ["window", "owner", "counterparty", "status"],
  notice_deadlines: ["window", "owner", "counterparty", "status"],
  missing_owners: ["owner", "counterparty", "status"],
  missing_key_fields: ["owner", "counterparty", "status"],
  open_obligations: ["owner", "counterparty", "status"],
  overdue_work: ["owner", "counterparty", "status"],
  evidence_requests: ["owner", "counterparty", "status"],
  contract_inventory: ["owner", "counterparty", "status"],
  review_completeness: ["owner", "counterparty", "status"],
  exceptions_by_owner: ["owner"],
};

const DEFAULT_REPORT: ReportKey = "upcoming_renewals";
const DEFAULT_WINDOW: ReportWindowKey = "90";
const TERMINAL_WORK_STATUSES = new Set(["done", "completed", "closed", "resolved", "canceled", "cancelled"]);
const OPEN_OBLIGATION_STATUSES = new Set(["open", "pending", "in_progress", "blocked", "active"]);
const OPEN_EXCEPTION_STATUSES = new Set(["open", "pending", "in_progress", "blocked"]);
const CORE_WORK_TYPES = new Set([
  "contract_task",
  "obligation",
  "approval",
  "exception",
  "evidence_request",
  "renewal_checkpoint",
  "unassigned_work",
]);
const RENEWAL_DATE_FIELDS = ["renewal_date", "renewal", "renewal_deadline"] as const;
const NOTICE_DATE_FIELDS = ["notice_date", "notice_deadline", "notice_deadline_date"] as const;
const NOTICE_WINDOW_FIELDS = ["notice_window", "notice_period", "notice_days"] as const;
const VALUE_FIELDS = ["contract_value", "annual_value", "fee_reference", "total_contract_value"] as const;

export type ReportContractRow = {
  id: string;
  title: string | null;
  counterparty?: string | null;
  contract_type?: string | null;
  status?: string | null;
  owner_id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type ReportFieldRow = {
  contract_id: string;
  field_name: string | null;
  field_value: string | null;
  status?: string | null;
  updated_at?: string | null;
};

export type ReportWorkItemSourceRow = {
  id?: string | null;
  title?: string | null;
  type?: string | null;
  status?: string | null;
  contract_id?: string | null;
  owner_user_id?: string | null;
  owner_id?: string | null;
  due_at?: string | null;
  due_date?: string | null;
  blocked_reason?: string | null;
  updated_at?: string | null;
  last_state_change_at?: string | null;
};

export type ReportObligationRow = {
  id: string;
  title: string | null;
  contract_id?: string | null;
  owner_id?: string | null;
  due_date?: string | null;
  next_due_date?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

export type ReportExceptionRow = {
  id: string;
  title: string | null;
  contract_id?: string | null;
  owner_id?: string | null;
  due_date?: string | null;
  severity?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

export type ReportEvidenceRequirementRow = {
  id: string;
  title: string | null;
  contract_id?: string | null;
  reviewer_id?: string | null;
  due_at?: string | null;
  review_due_at?: string | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type ReportEvidenceSubmissionRow = {
  id?: string | null;
  requirement_id?: string | null;
  evidence_requirement_id?: string | null;
  status?: string | null;
  file_count?: number | null;
  files?: unknown;
  created_at?: string | null;
};

export type ReportExportJobRow = {
  status?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  exported_rows?: number | null;
  export_format?: string | null;
  filter_json?: Record<string, unknown> | null;
};

export type BuildReportsPageModelInput = ReportsModelLoadInput & {
  contracts: ReportContractRow[];
  fields: ReportFieldRow[];
  workItems: ReportWorkItemSourceRow[];
  obligations: ReportObligationRow[];
  exceptions: ReportExceptionRow[];
  evidenceRequirements: ReportEvidenceRequirementRow[];
  evidenceSubmissions: ReportEvidenceSubmissionRow[];
  exportJobs: ReportExportJobRow[];
  members: OrgMemberProfileRow[];
  warnings?: string[];
  now?: Date;
};

export function resolveReportKey(input: string | null | undefined): ReportKey | null {
  const token = normalizeToken(input);
  if (!token) return DEFAULT_REPORT;
  if (isReportKey(token)) return token;
  const matched = REPORT_ORDER.find((key) => normalizeToken(REPORT_LABELS[key]) === token);
  return matched ?? null;
}

export function normalizeReportKey(input: ReportsModelSearchInput): ReportKey {
  if (input.report?.trim()) return resolveReportKey(input.report) ?? DEFAULT_REPORT;
  if (input.family?.trim()) return resolveReportKey(input.family) ?? DEFAULT_REPORT;
  return DEFAULT_REPORT;
}

export function normalizeReportFilters(input: ReportsModelSearchInput): ReportFilterState {
  const window = normalizeToken(input.window);
  return {
    window: isReportWindowKey(window) ? window : DEFAULT_WINDOW,
    owner: stringValue(input.owner),
    counterparty: stringValue(input.counterparty),
    status: stringValue(input.status),
  };
}

export function buildReportsHref(input: { report?: ReportKey; filters?: ReportFilterState }) {
  const params = new URLSearchParams();
  if (input.report && input.report !== DEFAULT_REPORT) params.set("report", input.report);
  const filters = input.filters;
  if (filters) {
    if (filters.window !== DEFAULT_WINDOW) params.set("window", filters.window);
    if (filters.owner) params.set("owner", filters.owner);
    if (filters.counterparty) params.set("counterparty", filters.counterparty);
    if (filters.status) params.set("status", filters.status);
  }
  const qs = params.toString();
  return qs ? `/reports?${qs}` : "/reports";
}

export function buildReportsExportHref(input: { report: ReportKey; filters: ReportFilterState }) {
  const params = new URLSearchParams();
  params.set("report", input.report);
  params.set("window", input.filters.window);
  if (input.filters.owner) params.set("owner", input.filters.owner);
  if (input.filters.counterparty) params.set("counterparty", input.filters.counterparty);
  if (input.filters.status) params.set("status", input.filters.status);
  return `/api/export/reports?${params.toString()}`;
}

export function buildReportsPageModel(input: BuildReportsPageModelInput): ReportsPageModel {
  const activeReport = normalizeReportKey(input);
  const filters = normalizeReportFilters(input);
  const today = startOfDay(input.now ?? new Date());
  const ownerLabelById = new Map(input.members.map((member) => [member.user_id, orgMemberProfileLabel(member.profiles)]));
  const contracts = input.contracts.map((contract) => normalizeContract(contract));
  const contractById = new Map(contracts.map((contract) => [contract.id, contract]));
  const fieldsByContract = groupBy(input.fields, (field) => field.contract_id);
  const submissionsByRequirement = groupBy(input.evidenceSubmissions, (submission) => {
    return submission.requirement_id ?? submission.evidence_requirement_id ?? "";
  });
  const context: ReportBuildContext = {
    today,
    filters,
    ownerLabelById,
    contracts,
    contractById,
    fieldsByContract,
    workItems: input.workItems,
    obligations: input.obligations,
    exceptions: input.exceptions,
    evidenceRequirements: input.evidenceRequirements,
    submissionsByRequirement,
  };

  const rowSets = new Map<ReportKey, ReportPreviewRow[]>();
  for (const key of REPORT_ORDER) {
    rowSets.set(key, buildRowsForReport(key, context));
  }

  const allActiveRows = rowSets.get(activeReport) ?? [];
  const previewLimit = input.previewLimit === null ? null : input.previewLimit ?? 8;
  const previewRows = previewLimit === null ? allActiveRows : allActiveRows.slice(0, previewLimit);
  const lastGeneratedAt = getLastGeneratedAt(input.exportJobs, activeReport);
  const activeLabel = REPORT_DEFINITIONS[activeReport].label;

  return {
    title: REPORTS_PAGE_TITLE,
    eyebrow: REPORTS_EYEBROW,
    lead: REPORTS_PAGE_LEAD,
    primaryCta: REPORTS_PRIMARY_CTA,
    // Context-aware label so the CTA names what it exports ("Export upcoming
    // renewals") instead of a generic verb. `primaryCta` keeps the generic
    // wording for aria/fallback.
    exportCtaLabel: `Export ${activeLabel.charAt(0).toLowerCase()}${activeLabel.slice(1)}`,
    activeReport,
    activeDefinition: REPORT_DEFINITIONS[activeReport],
    filters,
    applicableFilters: REPORT_APPLICABLE_FILTERS[activeReport],
    reports: REPORT_ORDER.map((key) => ({
      key,
      label: REPORT_DEFINITIONS[key].label,
      description: REPORT_DEFINITIONS[key].description,
      count: rowSets.get(key)?.length ?? 0,
      // Carry only the filters the target report can actually use, so switching
      // reports never lands on an empty preview narrowed by a hidden, out-of-domain
      // filter (e.g. a contract "Pending review" status dragged onto evidence).
      href: buildReportsHref({ report: key, filters: sanitizeFiltersForReport(key, filters) }),
      active: key === activeReport,
    })),
    previewColumns: REPORT_DEFINITIONS[activeReport].columns,
    previewRows,
    totalPreviewRows: allActiveRows.length,
    exportHref: buildReportsExportHref({ report: activeReport, filters }),
    lastGeneratedAt,
    // "Never" pairs cleanly with the page's "Last generated" eyebrow label
    // — the previous "Never generated" duplicated the word in the rendered
    // pair ("Last generated · Never generated").
    lastGeneratedLabel: lastGeneratedAt ? formatDateTimeLabel(lastGeneratedAt) : "Never",
    recentExports: buildRecentExports(input.exportJobs),
    filterOptions: {
      windows: REPORT_WINDOW_ORDER.map((value) => ({ value, label: REPORT_WINDOW_LABELS[value] })),
      owners: toOwnerOptions(input.members),
      counterparties: toCounterpartyOptions(contracts),
      statuses: toStatusOptions(activeReport),
    },
    warnings: input.warnings ?? [],
  };
}

export async function loadReportsPageModel(
  admin: AdminClient,
  orgId: string,
  input: ReportsModelLoadInput
): Promise<ReportsPageModel> {
  const warnings: string[] = [];

  const contracts = await safeQuery<ReportContractRow[]>(
    warnings,
    "contracts",
    admin
      .from("contracts")
      .select("id, title, counterparty, contract_type, status, owner_id, updated_at, created_at")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(2000)
  );

  const contractIds = contracts.map((contract) => contract.id).filter(Boolean);
  const fields =
    contractIds.length > 0
      ? await safeQuery<ReportFieldRow[]>(
          warnings,
          "extracted_fields",
          admin
            .from("extracted_fields")
            .select("contract_id, field_name, field_value, status, updated_at")
            .in("contract_id", contractIds)
            .range(0, 9999)
        )
      : [];

  const workQuery = applyV10ReadModelVisibility(
    admin
      .from("v10_work_items")
      .select(
        "id, title, type, status, contract_id, owner_user_id, due_at, blocked_reason, updated_at, last_state_change_at, organization_id, visibility_state, required_role_minimum, workspace_mode"
      ),
    {
      organizationId: orgId,
      role: input.role,
      workspaceMode: input.workspaceMode,
    }
  );
  const workItems = (
    await safeQuery<ReportWorkItemSourceRow[]>(warnings, "v10_work_items", workQuery.limit(2000))
  ).filter((row) => CORE_WORK_TYPES.has(normalizeToken(row.type)));

  const obligations = await safeQuery<ReportObligationRow[]>(
    warnings,
    "contract_obligations",
    admin
      .from("contract_obligations")
      .select("id, contract_id, title, owner_id, due_date, next_due_date, status, updated_at")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(2000)
  );

  const exceptions = await safeQuery<ReportExceptionRow[]>(
    warnings,
    "exceptions",
    admin
      .from("exceptions")
      .select("id, contract_id, title, owner_id, due_date, severity, status, updated_at")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(2000)
  );

  const evidenceRequirements = await safeQuery<ReportEvidenceRequirementRow[]>(
    warnings,
    "evidence_requirements",
    admin
      .from("evidence_requirements")
      .select("id, title, contract_id, reviewer_id, due_at, review_due_at, status, updated_at, created_at")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(2000)
  );

  const requirementIds = evidenceRequirements.map((row) => row.id).filter(Boolean);
  const evidenceSubmissions =
    requirementIds.length > 0
      ? await safeQuery<ReportEvidenceSubmissionRow[]>(
          warnings,
          "evidence_submissions",
          admin
            .from("evidence_submissions")
            .select("id, requirement_id, evidence_requirement_id, status, file_count, files, created_at")
            .or(`requirement_id.in.(${requirementIds.join(",")}),evidence_requirement_id.in.(${requirementIds.join(",")})`)
            .range(0, 4999)
        )
      : [];

  const exportJobs = await safeQuery<ReportExportJobRow[]>(
    warnings,
    "contract_export_jobs",
    admin
      .from("contract_export_jobs")
      .select("status, completed_at, created_at, exported_rows, export_format, filter_json")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100)
  );

  const memberIds = [
    ...new Set([
      ...contracts.map((row) => row.owner_id).filter(Boolean),
      ...workItems.map((row) => row.owner_user_id ?? row.owner_id).filter(Boolean),
      ...obligations.map((row) => row.owner_id).filter(Boolean),
      ...exceptions.map((row) => row.owner_id).filter(Boolean),
      ...evidenceRequirements.map((row) => row.reviewer_id).filter(Boolean),
    ] as string[]),
  ];
  const members = await loadOrgMemberProfileRows(admin, orgId, {
    userIds: memberIds,
    memberColumns: "user_id, role, created_at",
    orderByCreatedAt: true,
    limit: 500,
  });

  return buildReportsPageModel({
    ...input,
    contracts,
    fields,
    workItems,
    obligations,
    exceptions,
    evidenceRequirements,
    evidenceSubmissions,
    exportJobs,
    members,
    warnings,
  });
}

type NormalizedContract = Required<Pick<ReportContractRow, "id">> &
  Omit<ReportContractRow, "id"> & {
    title: string;
    counterparty: string;
    status: string;
  };

type ReportBuildContext = {
  today: Date;
  filters: ReportFilterState;
  ownerLabelById: Map<string, string>;
  contracts: NormalizedContract[];
  contractById: Map<string, NormalizedContract>;
  fieldsByContract: Map<string, ReportFieldRow[]>;
  workItems: ReportWorkItemSourceRow[];
  obligations: ReportObligationRow[];
  exceptions: ReportExceptionRow[];
  evidenceRequirements: ReportEvidenceRequirementRow[];
  submissionsByRequirement: Map<string, ReportEvidenceSubmissionRow[]>;
};

function buildRowsForReport(key: ReportKey, context: ReportBuildContext): ReportPreviewRow[] {
  switch (key) {
    case "upcoming_renewals":
      return buildUpcomingRenewalsRows(context);
    case "notice_deadlines":
      return buildNoticeDeadlineRows(context);
    case "missing_owners":
      return buildMissingOwnersRows(context);
    case "missing_key_fields":
      return buildMissingKeyFieldRows(context);
    case "open_obligations":
      return buildOpenObligationRows(context);
    case "overdue_work":
      return buildOverdueWorkRows(context);
    case "exceptions_by_owner":
      return buildExceptionsByOwnerRows(context);
    case "evidence_requests":
      return buildEvidenceRequestRows(context);
    case "contract_inventory":
      return buildContractInventoryRows(context);
    case "review_completeness":
      return buildReviewCompletenessRows(context);
  }
}

function buildUpcomingRenewalsRows(context: ReportBuildContext) {
  const windowEnd = addDays(context.today, Number(context.filters.window));
  return context.contracts
    .map((contract) => {
      const fields = context.fieldsByContract.get(contract.id) ?? [];
      const renewalDate = approvedDate(fields, RENEWAL_DATE_FIELDS);
      if (!renewalDate || renewalDate < context.today || renewalDate > windowEnd) return null;
      return contractRow(contract, context, {
        "Renewal date": formatDateLabel(renewalDate),
        // These rows already have an approved renewal date, so the step is to
        // open the renewal — not "review"/"monitor" it (which implied either
        // unreviewed data or ongoing decision-intelligence). Missing-notice rows
        // still need the date added first.
        "Next action": approvedDate(fields, NOTICE_DATE_FIELDS) || computedNoticeDate(fields) ? "Open renewal" : "Add notice date",
      });
    })
    .filter(isPresent)
    .filter((row) => matchesRowFilters(row, context.filters))
    .sort(compareRowsByColumn("Renewal date"));
}

function buildNoticeDeadlineRows(context: ReportBuildContext) {
  const windowEnd = addDays(context.today, Number(context.filters.window));
  return context.contracts
    .map((contract) => {
      const fields = context.fieldsByContract.get(contract.id) ?? [];
      const renewalDate = approvedDate(fields, RENEWAL_DATE_FIELDS);
      const noticeDate = approvedDate(fields, NOTICE_DATE_FIELDS) ?? computedNoticeDate(fields);
      if (!noticeDate || noticeDate < context.today || noticeDate > windowEnd) return null;
      return contractRow(contract, context, {
        "Notice date": formatDateLabel(noticeDate),
        "Renewal date": renewalDate ? formatDateLabel(renewalDate) : "Missing",
      });
    })
    .filter(isPresent)
    .filter((row) => matchesRowFilters(row, context.filters))
    .sort(compareRowsByColumn("Notice date"));
}

function buildMissingOwnersRows(context: ReportBuildContext) {
  return context.contracts
    .filter((contract) => !contract.owner_id)
    .map((contract) =>
      contractRow(contract, context, {
        "Last update": formatDateTimeLabel(contract.updated_at ?? contract.created_at),
        "Next action": "Assign owner",
      })
    )
    .filter((row) => matchesRowFilters(row, context.filters));
}

function buildMissingKeyFieldRows(context: ReportBuildContext) {
  return context.contracts
    .map((contract) => {
      const fields = context.fieldsByContract.get(contract.id) ?? [];
      const missing = getMissingKeyFields(contract, fields);
      if (missing.length === 0) return null;
      return contractRow(contract, context, {
        "Missing fields": missing.join(", "),
        "Next action": "Review missing fields",
      });
    })
    .filter(isPresent)
    .filter((row) => matchesRowFilters(row, context.filters));
}

function buildOpenObligationRows(context: ReportBuildContext) {
  return context.obligations
    .filter((obligation) => OPEN_OBLIGATION_STATUSES.has(normalizeToken(obligation.status)))
    .map((obligation) => {
      const contract = context.contractById.get(obligation.contract_id ?? "");
      return {
        id: obligation.id,
        href: obligation.contract_id ? `/contracts/${obligation.contract_id}#obligations` : null,
        cells: {
          Obligation: obligation.title || "Untitled obligation",
          Contract: contract?.title ?? "Unknown contract",
          Owner: ownerLabel(context, obligation.owner_id),
          "Due date": formatDateLabel(parseDate(obligation.next_due_date ?? obligation.due_date)),
          Status: labelize(obligation.status ?? "open"),
          "Last update": formatDateTimeLabel(obligation.updated_at),
          __owner: obligation.owner_id ?? "",
          __counterparty: contract?.counterparty ?? "",
          __status: obligation.status ?? "",
        },
      };
    })
    .filter((row) => matchesRowFilters(row, context.filters));
}

function buildOverdueWorkRows(context: ReportBuildContext) {
  return context.workItems
    .filter((item) => !TERMINAL_WORK_STATUSES.has(normalizeToken(item.status)))
    .filter((item) => {
      const due = parseDate(item.due_at ?? item.due_date);
      return due ? due < context.today : false;
    })
    .map((item) => {
      const contract = context.contractById.get(item.contract_id ?? "");
      return {
        id: item.id ?? `${item.contract_id}-${item.title}`,
        href: item.contract_id ? `/contracts/${item.contract_id}#work` : "/work",
        cells: {
          "Work item": item.title || "Untitled work item",
          Contract: contract?.title ?? "Unknown contract",
          Owner: ownerLabel(context, item.owner_user_id ?? item.owner_id),
          "Due date": formatDateLabel(parseDate(item.due_at ?? item.due_date)),
          Status: labelize(item.status ?? "open"),
          Type: labelize(item.type ?? "work"),
          __owner: item.owner_user_id ?? item.owner_id ?? "",
          __counterparty: contract?.counterparty ?? "",
          __status: item.status ?? "",
        },
      };
    })
    .filter((row) => matchesRowFilters(row, context.filters))
    .sort(compareRowsByColumn("Due date"));
}

function buildExceptionsByOwnerRows(context: ReportBuildContext) {
  const open = context.exceptions.filter((exception) => OPEN_EXCEPTION_STATUSES.has(normalizeToken(exception.status)));
  const grouped = groupBy(open, (exception) => exception.owner_id ?? "");
  return [...grouped.entries()]
    .map(([ownerId, exceptions]) => {
      const nextDue = exceptions
        .map((exception) => parseDate(exception.due_date))
        .filter(isPresent)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      const contracts = new Set(exceptions.map((exception) => exception.contract_id).filter(Boolean));
      return {
        id: ownerId || "unassigned",
        href: "/contracts/exceptions",
        cells: {
          Owner: ownerLabel(context, ownerId),
          "Open exceptions": String(exceptions.length),
          "High severity": String(exceptions.filter((exception) => normalizeToken(exception.severity) === "high").length),
          "Next due date": formatDateLabel(nextDue),
          Contracts: String(contracts.size),
          __owner: ownerId,
          __counterparty: "",
          __status: "open",
        },
      };
    })
    .filter((row) => matchesRowFilters(row, context.filters))
    .sort((a, b) => Number(b.cells["Open exceptions"]) - Number(a.cells["Open exceptions"]));
}

function buildEvidenceRequestRows(context: ReportBuildContext) {
  return context.evidenceRequirements
    .filter((requirement) => normalizeToken(requirement.status) !== "waived")
    .map((requirement) => {
      const contract = context.contractById.get(requirement.contract_id ?? "");
      const submissions = context.submissionsByRequirement.get(requirement.id) ?? [];
      return {
        id: requirement.id,
        href: requirement.contract_id ? `/contracts/${requirement.contract_id}#evidence` : "/evidence",
        cells: {
          Request: requirement.title || "Untitled evidence request",
          Contract: contract?.title ?? "Unknown contract",
          Owner: ownerLabel(context, requirement.reviewer_id),
          "Due date": formatDateLabel(parseDate(requirement.due_at ?? requirement.review_due_at)),
          Status: evidenceStatusLabel(requirement, context.today),
          "Attached files": String(countSubmittedFiles(submissions)),
          __owner: requirement.reviewer_id ?? "",
          __counterparty: contract?.counterparty ?? "",
          __status: evidenceStatusLabel(requirement, context.today),
        },
      };
    })
    .filter((row) => matchesRowFilters(row, context.filters));
}

function buildContractInventoryRows(context: ReportBuildContext) {
  return context.contracts
    .map((contract) =>
      contractRow(contract, context, {
        Type: contract.contract_type || "Unknown",
        "Last update": formatDateTimeLabel(contract.updated_at ?? contract.created_at),
      })
    )
    .filter((row) => matchesRowFilters(row, context.filters));
}

function buildReviewCompletenessRows(context: ReportBuildContext) {
  return context.contracts
    .map((contract) => {
      const fields = context.fieldsByContract.get(contract.id) ?? [];
      const approved = fields.filter((field) => normalizeToken(field.status) === "approved").length;
      const pending = fields.filter((field) => normalizeToken(field.status) !== "approved").length;
      return contractRow(contract, context, {
        "Approved fields": String(approved),
        "Pending fields": String(pending),
        "Review state": pending > 0 ? "Needs review" : "Complete",
        "Last update": formatDateTimeLabel(contract.updated_at ?? contract.created_at),
      });
    })
    .filter((row) => matchesRowFilters(row, context.filters));
}

function contractRow(
  contract: NormalizedContract,
  context: ReportBuildContext,
  extra: Record<string, string>
): ReportPreviewRow {
  return {
    id: contract.id,
    href: `/contracts/${contract.id}`,
    cells: {
      Contract: contract.title,
      Counterparty: contract.counterparty || "Missing",
      Owner: ownerLabel(context, contract.owner_id),
      Status: labelize(contract.status),
      ...extra,
      __owner: contract.owner_id ?? "",
      __counterparty: contract.counterparty,
      __status: contract.status,
    },
  };
}

function getMissingKeyFields(contract: NormalizedContract, fields: ReportFieldRow[]) {
  const missing: string[] = [];
  if (!contract.owner_id) missing.push("Owner");
  if (!contract.counterparty) missing.push("Counterparty");
  if (!contract.status) missing.push("Status");
  if (!approvedValue(fields, RENEWAL_DATE_FIELDS)) missing.push("Renewal date");
  if (!approvedValue(fields, NOTICE_DATE_FIELDS) && !computedNoticeDate(fields)) missing.push("Notice date");
  if (!approvedValue(fields, VALUE_FIELDS)) missing.push("Contract value");
  return missing;
}

function approvedValue(fields: ReportFieldRow[], aliases: readonly string[]) {
  const aliasSet = new Set(aliases.map(normalizeToken));
  const field = fields.find(
    (candidate) =>
      aliasSet.has(normalizeToken(candidate.field_name)) &&
      normalizeToken(candidate.status) === "approved" &&
      Boolean(candidate.field_value?.trim())
  );
  return field?.field_value?.trim() ?? null;
}

function approvedDate(fields: ReportFieldRow[], aliases: readonly string[]) {
  return parseDate(approvedValue(fields, aliases));
}

function computedNoticeDate(fields: ReportFieldRow[]) {
  const renewalDate = approvedDate(fields, RENEWAL_DATE_FIELDS);
  const noticeWindow = approvedValue(fields, NOTICE_WINDOW_FIELDS);
  const days = parseNoticeDays(noticeWindow);
  if (!renewalDate || !days) return null;
  return startOfDay(subDays(renewalDate, days));
}

function evidenceStatusLabel(requirement: ReportEvidenceRequirementRow, today: Date) {
  const status = normalizeToken(requirement.status);
  if (status === "approved") return "Accepted";
  if (status === "rejected") return "Rejected";
  if (status === "submitted") return "Received";
  const due = parseDate(requirement.due_at ?? requirement.review_due_at);
  if (due && due < today) return "Overdue";
  return "Requested";
}

function matchesRowFilters(row: ReportPreviewRow, filters: ReportFilterState) {
  const owner = row.cells.__owner ?? "";
  const counterparty = normalizeToken(row.cells.__counterparty);
  const status = normalizeToken(row.cells.__status || row.cells.Status || row.cells["Review state"]);
  if (filters.owner === "unassigned" && owner) return false;
  if (filters.owner && filters.owner !== "unassigned" && owner !== filters.owner) return false;
  if (filters.counterparty && counterparty !== normalizeToken(filters.counterparty)) return false;
  if (filters.status && status !== normalizeToken(filters.status)) return false;
  return true;
}

function normalizeContract(contract: ReportContractRow): NormalizedContract {
  return {
    ...contract,
    id: contract.id,
    title: contract.title?.trim() || "Untitled contract",
    counterparty: contract.counterparty?.trim() || "",
    status: contract.status?.trim() || "",
  };
}

function toOwnerOptions(members: OrgMemberProfileRow[]): ReportOption[] {
  return [
    { value: "", label: "Any owner" },
    { value: "unassigned", label: "Unassigned" },
    ...members.map((member) => ({
      value: member.user_id,
      label: orgMemberProfileLabel(member.profiles),
    })),
  ];
}

function toCounterpartyOptions(contracts: { counterparty?: string | null }[]): ReportOption[] {
  const values = [
    ...new Set(contracts.map((contract) => contract.counterparty?.trim()).filter(Boolean) as string[]),
  ].sort((a, b) => a.localeCompare(b));
  return [{ value: "", label: "Any counterparty" }, ...values.map((value) => ({ value, label: value }))];
}

function toStatusOptions(report: ReportKey): ReportOption[] {
  const domain = REPORT_STATUS_DOMAIN[report] ?? [];
  // No "Any status" entry when the report has no status dimension — the toolbar
  // drops the control rather than showing a lone, meaningless option.
  if (domain.length === 0) return [];
  return [{ value: "", label: "Any status" }, ...domain];
}

/**
 * Reduce a filter set to what the target report supports: drop any dimension it
 * doesn't apply, and drop a status value that isn't in the target's domain.
 * Used to build rail links so cross-report navigation can't smuggle a filter the
 * destination silently honors but never displays.
 */
function sanitizeFiltersForReport(report: ReportKey, filters: ReportFilterState): ReportFilterState {
  const applicable = new Set(REPORT_APPLICABLE_FILTERS[report]);
  const statusInDomain = REPORT_STATUS_DOMAIN[report].some((option) => option.value === filters.status);
  return {
    window: applicable.has("window") ? filters.window : DEFAULT_WINDOW,
    owner: applicable.has("owner") ? filters.owner : "",
    counterparty: applicable.has("counterparty") ? filters.counterparty : "",
    status: applicable.has("status") && statusInDomain ? filters.status : "",
  };
}

function ownerLabel(context: ReportBuildContext, ownerId: string | null | undefined) {
  if (!ownerId) return "Unassigned";
  return context.ownerLabelById.get(ownerId) ?? "Member";
}

function getLastGeneratedAt(jobs: ReportExportJobRow[], report: ReportKey) {
  const matching = jobs.find((job) => {
    const status = normalizeToken(job.status);
    const reportKey = String(job.filter_json?.report_key ?? job.filter_json?.report ?? "");
    return ["completed", "succeeded", "success"].includes(status) && normalizeToken(reportKey) === report;
  });
  return matching?.completed_at ?? matching?.created_at ?? null;
}

/**
 * Recent report export runs for the "Recent exports" history band. Only jobs
 * whose `filter_json.report_key` resolves to a Core report are included (so
 * contract/renewal/calendar exports sharing the table are excluded), and each
 * run is given a re-export link rebuilt from its stored report + filters.
 */
function buildRecentExports(jobs: ReportExportJobRow[], limit = 5): ReportExportRun[] {
  const runs: ReportExportRun[] = [];
  for (const job of jobs) {
    const fj = (job.filter_json ?? {}) as Record<string, unknown>;
    const token = normalizeToken(String(fj.report_key ?? fj.report ?? ""));
    if (!token || !isReportKey(token)) continue;
    const reportKey = token;
    const rawFilters = (fj.filters ?? {}) as Partial<ReportFilterState>;
    const windowValue = normalizeToken(rawFilters.window);
    const filters: ReportFilterState = {
      window: isReportWindowKey(windowValue) ? windowValue : DEFAULT_WINDOW,
      owner: typeof rawFilters.owner === "string" ? rawFilters.owner : "",
      counterparty: typeof rawFilters.counterparty === "string" ? rawFilters.counterparty : "",
      status: typeof rawFilters.status === "string" ? rawFilters.status : "",
    };
    // Distinguishes otherwise-identical runs of the same report: the date
    // window (for windowed reports) plus a "Filtered" marker when any
    // owner/counterparty/status was applied.
    const windowed = reportKey === "upcoming_renewals" || reportKey === "notice_deadlines";
    const scopeParts: string[] = [];
    if (windowed) scopeParts.push(REPORT_WINDOW_LABELS[filters.window]);
    if (filters.owner || filters.counterparty || filters.status) scopeParts.push("Filtered");
    const at = job.completed_at ?? job.created_at ?? null;
    runs.push({
      reportKey,
      reportLabel:
        (typeof fj.report_label === "string" && fj.report_label.trim()) || REPORT_DEFINITIONS[reportKey].label,
      scope: scopeParts,
      status: normalizeToken(job.status) || "completed",
      at,
      atLabel: at ? formatExportRunTime(at) : "",
      rows: typeof job.exported_rows === "number" ? job.exported_rows : null,
      format: typeof job.export_format === "string" ? job.export_format : null,
      href: buildReportsExportHref({ report: reportKey, filters }),
    });
    if (runs.length >= limit) break;
  }
  return runs;
}

function countSubmittedFiles(submissions: ReportEvidenceSubmissionRow[]) {
  return submissions.reduce((sum, submission) => {
    if (typeof submission.file_count === "number") return sum + submission.file_count;
    if (Array.isArray(submission.files)) return sum + submission.files.length;
    return sum + 1;
  }, 0);
}

async function safeQuery<T>(warnings: string[], label: string, query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await query;
  if (error) {
    warnings.push(label);
    return [] as T;
  }
  return (data ?? []) as T;
}

function groupBy<T>(rows: T[], keyFn: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const next = map.get(key) ?? [];
    next.push(row);
    map.set(key, next);
  }
  return map;
}

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null;
  const iso = parseISO(raw.trim());
  if (isValid(iso)) return startOfDay(iso);
  const date = new Date(raw.trim());
  return isValid(date) ? startOfDay(date) : null;
}

function formatDateLabel(date: Date | string | null | undefined) {
  const parsed = typeof date === "string" ? parseDate(date) : date;
  return parsed && isValid(parsed) ? format(parsed, "MMM d, yyyy") : "Missing";
}

function formatDateTimeLabel(raw: string | null | undefined) {
  const date = parseDateTime(raw);
  return date ? format(date, "MMM d, yyyy h:mm a") : "Never";
}

/** Compact exact run time for the export history (no year), e.g. "May 30, 3:42 PM". */
function formatExportRunTime(raw: string | null | undefined) {
  const date = parseDateTime(raw);
  return date ? format(date, "MMM d, h:mm a") : "";
}

function compareRowsByColumn(column: string) {
  return (a: ReportPreviewRow, b: ReportPreviewRow) => a.cells[column].localeCompare(b.cells[column]);
}

function labelize(raw: string | null | undefined) {
  const token = normalizeToken(raw);
  if (!token) return "Unknown";
  return token.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeToken(raw: string | null | undefined) {
  return (raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function parseDateTime(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null;
  const iso = parseISO(raw.trim());
  if (isValid(iso)) return iso;
  const date = new Date(raw.trim());
  return isValid(date) ? date : null;
}

function stringValue(raw: string | null | undefined) {
  return (raw ?? "").trim();
}

function isReportKey(value: string): value is ReportKey {
  return REPORT_ORDER.includes(value as ReportKey);
}

function isReportWindowKey(value: string): value is ReportWindowKey {
  return REPORT_WINDOW_ORDER.includes(value as ReportWindowKey);
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
