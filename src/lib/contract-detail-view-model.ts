import { format } from "date-fns";
import { parseBusinessDateAtNoon } from "@/lib/business-dates";
import type { SemanticStatus } from "@/components/ui/status-badge";

/**
 * Pure view-model for the Core contract-detail surface. Centralizes the label,
 * tone, severity, pluralization, date-state, and action-priority logic so the
 * rendering components never recompute it inline. The route loads data and
 * assembles the model; the components consume it.
 */

export const CORE_CONTRACT_DATE_FIELDS = [
  "effective_date",
  "start_date",
  "end_date",
  "renewal_date",
  "notice_window",
] as const;

/** Date fields that are real calendar dates (notice_window is a duration). */
export const CALENDAR_DATE_FIELDS = CORE_CONTRACT_DATE_FIELDS.filter((f) => f !== "notice_window");

export type CoreSignalTone = "attention" | "danger" | "healthy" | "neutral" | "info";

export function coreStatusTone(status: string | null | undefined): CoreSignalTone {
  if (!status) return "neutral";
  if (["approved", "active", "complete", "completed", "accepted"].includes(status)) return "healthy";
  if (["rejected", "failed", "blocked"].includes(status)) return "danger";
  if (["pending", "pending_review", "awaiting_review", "in_progress", "open"].includes(status)) return "attention";
  return "neutral";
}

const TONE_TO_SEMANTIC: Record<CoreSignalTone, SemanticStatus> = {
  healthy: "healthy",
  attention: "warning",
  danger: "blocked",
  info: "info",
  neutral: "empty",
};

/** Single source of truth for status → StatusBadge tone (fixes pending_review
 *  mapping drift: it always resolves to warning/in-review, never empty). */
export function coreSemanticStatus(status: string | null | undefined): SemanticStatus {
  return TONE_TO_SEMANTIC[coreStatusTone(status)];
}

const DATE_LABELS: Record<string, string> = {
  effective_date: "Effective date",
  start_date: "Start date",
  end_date: "End date",
  renewal_date: "Renewal date",
  notice_window: "Notice window",
  auto_renewal: "Auto renewal",
  termination_date: "Termination date",
};

const FIELD_LABELS: Record<string, string> = {
  ...DATE_LABELS,
  contract_value: "Contract value",
  currency: "Currency",
  counterparty: "Counterparty",
  contract_type: "Contract type",
  owner: "Owner",
  payment_cadence: "Payment cadence",
  renewal_term: "Renewal term",
};

export function humanizeToken(value: string | null | undefined, fallback = "Not set"): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function contractDateLabel(field: string): string {
  return DATE_LABELS[field] ?? humanizeToken(field);
}

/** Display label for a suggested contract-detail key (e.g. `contract_value` -> "Contract value"). */
export function contractFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? humanizeToken(field);
}

/** Every count rendered as count + pluralized noun. */
export function pluralizeCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

// ── Dates ────────────────────────────────────────────────────────────────────

export type ContractDateState = "approved" | "pending" | "missing";

export interface ContractDateRow {
  key: string;
  id: string | null;
  label: string;
  /** Confirmed or suggested raw value, or "Missing". */
  value: string;
  /** notice_window is a duration, not a calendar date — never render as a date. */
  isDuration: boolean;
  state: ContractDateState;
  rawStatus: string;
  confidence: number | null;
  semantic: SemanticStatus;
}

type RawField = {
  id?: string | null;
  field_name: string;
  field_value?: string | null;
  status?: string | null;
  confidence?: number | null;
};

export function buildContractDateRows(extractedFields: RawField[]): ContractDateRow[] {
  const byName = new Map(extractedFields.map((f) => [f.field_name, f]));
  return CORE_CONTRACT_DATE_FIELDS.map((key) => {
    const field = byName.get(key);
    const value = field?.field_value?.trim() || "Missing";
    const rawStatus = field?.status ?? "missing";
    const state: ContractDateState =
      !field || value === "Missing" ? "missing" : rawStatus === "approved" ? "approved" : "pending";
    return {
      key,
      id: field?.id ?? null,
      label: contractDateLabel(key),
      value,
      isDuration: key === "notice_window",
      state,
      rawStatus,
      confidence: field?.confidence ?? null,
      semantic: state === "missing" ? "warning" : coreSemanticStatus(rawStatus),
    };
  });
}

export interface ContractDateSummary {
  approved: number;
  pending: number;
  missing: number;
  /** Rows that still need attention (pending + missing) — never counts approved. */
  gaps: number;
}

export function summarizeDateRows(rows: ContractDateRow[]): ContractDateSummary {
  const approved = rows.filter((r) => r.state === "approved").length;
  const pending = rows.filter((r) => r.state === "pending").length;
  const missing = rows.filter((r) => r.state === "missing").length;
  return { approved, pending, missing, gaps: pending + missing };
}

/** Soonest upcoming confirmed calendar date — excludes the notice-window duration
 *  entirely so a duration string can never parse to NaN into a date slot. */
export function nextReviewedCalendarDate(rows: ContractDateRow[]): { date: Date; label: string } | null {
  const today = parseBusinessDateAtNoon(new Date().toISOString().slice(0, 10));
  const soonest = rows
    .filter((r) => !r.isDuration && r.state === "approved")
    .map((r) => parseBusinessDateAtNoon(r.value))
    .filter((d): d is Date => d != null && (!today || d.getTime() >= today.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return soonest ? { date: soonest, label: format(soonest, "MMM d, yyyy") } : null;
}

/** Compact reviewed notice-window token ("75D"); null unless reviewed. */
export function noticeWindowToken(rows: ContractDateRow[]): string | null {
  const row = rows.find((r) => r.key === "notice_window");
  if (!row || row.state !== "approved" || row.value === "Missing") return null;
  const n = row.value.match(/\d+/)?.[0];
  return n ? `${n}D` : row.value;
}

// ── Action-summary signals ───────────────────────────────────────────────────

export interface ContractActionSignal {
  key: "fields" | "dates" | "exceptions" | "evidence";
  label: string;
  value: number;
  unit: string;
  tone: CoreSignalTone;
  href: string;
  /** Persistent action verb shown in the cell when actionable. */
  actionLabel?: string;
  /** Optional review progress (renders a microbar). */
  progress?: { current: number; total: number };
}

export function buildContractActionSignals(input: {
  contractId: string;
  hasSourceFiles: boolean;
  hasExtractedFields: boolean;
  pendingFieldsCount: number;
  approvedFieldsCount: number;
  fieldsCount: number;
  dateSummary: ContractDateSummary;
  openExceptionsCount: number;
  activeEvidenceCount: number;
}): ContractActionSignal[] {
  const { contractId, dateSummary } = input;
  const fields: ContractActionSignal = input.hasExtractedFields
    ? {
        key: "fields",
        label: "Suggested details",
        value: input.pendingFieldsCount,
        unit: input.pendingFieldsCount > 0 ? "pending" : "confirmed",
        tone: input.pendingFieldsCount > 0 ? "attention" : "healthy",
        href: "#extracted-fields",
        actionLabel: input.pendingFieldsCount > 0 ? "Confirm" : undefined,
        progress: input.fieldsCount > 0 ? { current: input.approvedFieldsCount, total: input.fieldsCount } : undefined,
      }
    : {
        key: "fields",
        label: "Suggested details",
        value: 0,
        unit: input.hasSourceFiles ? "awaiting suggestions" : "awaiting file",
        tone: input.hasSourceFiles ? "attention" : "neutral",
        href: input.hasSourceFiles ? "#extracted-fields" : "#source-documents",
        actionLabel: input.hasSourceFiles ? "Run" : "Attach",
      };

  const dateUnit = !input.hasExtractedFields
    ? "waiting"
    : dateSummary.gaps === 0
      ? "tracked"
      : dateSummary.missing > 0
        ? dateSummary.pending > 0
          ? "gaps"
          : "missing"
        : "pending";
  const dates: ContractActionSignal = {
    key: "dates",
    label: "Key dates",
    value: input.hasExtractedFields ? dateSummary.gaps : 0,
    unit: dateUnit,
    tone: !input.hasExtractedFields ? "neutral" : dateSummary.gaps > 0 ? "attention" : "healthy",
    href: "#contract-dates",
    actionLabel: !input.hasExtractedFields ? "Inspect" : dateSummary.gaps > 0 ? "Add" : undefined,
  };

  const exceptions: ContractActionSignal = {
    key: "exceptions",
    label: "Issues",
    value: input.openExceptionsCount,
    unit: input.openExceptionsCount > 0 ? "open" : "clear",
    tone: input.openExceptionsCount > 0 ? "danger" : "healthy",
    href:
      input.openExceptionsCount > 0
        ? `/contracts/exceptions?status=open&contract=${contractId}`
        : `/contracts/${contractId}?tab=work`,
    actionLabel: input.openExceptionsCount > 0 ? "Triage" : undefined,
  };

  const evidence: ContractActionSignal = {
    key: "evidence",
    label: "Evidence",
    value: input.activeEvidenceCount,
    unit: input.activeEvidenceCount > 0 ? (input.activeEvidenceCount === 1 ? "request" : "requests") : "clear",
    tone: input.activeEvidenceCount > 0 ? "attention" : "healthy",
    href: input.activeEvidenceCount > 0 ? "#contract-evidence" : `/contracts/${contractId}?tab=evidence`,
    actionLabel: input.activeEvidenceCount > 0 ? "Request" : undefined,
  };

  return [fields, dates, exceptions, evidence];
}

// ── Needs-attention ──────────────────────────────────────────────────────────

export type ContractAttentionTone = "warning" | "danger";

export interface ContractAttentionItem {
  key: string;
  kind: string;
  count: number;
  verb: string;
  href: string;
  label: string;
  tone: ContractAttentionTone;
}

const ATTENTION_PRIORITY: Record<string, number> = {
  issues: 0,
  approvals: 1,
  fields: 2,
  dates: 3,
  evidence: 4,
  file: 5,
  extraction: 6,
  owner: 7,
  counterparty: 8,
};

export function buildContractAttentionItems(input: {
  contractId: string;
  hasSourceFiles: boolean;
  hasExtractedFields: boolean;
  needsOwner: boolean;
  needsCounterparty: boolean;
  missingCriticalDateLabels: string[];
  pendingFieldsCount: number;
  hasActiveIssues: boolean;
  activeIssueCount: number;
  hasBlockingApprovals: boolean;
  blockingApprovalCount: number;
  attentionEvidenceCount: number;
}): ContractAttentionItem[] {
  const { contractId } = input;
  const items: Array<ContractAttentionItem | null> = [
    !input.hasSourceFiles
      ? { key: "file", kind: "File", count: 1, verb: "Attach", tone: "warning", href: `/contracts/${contractId}?tab=files`, label: "Signed source file is missing" }
      : null,
    input.needsOwner
      ? { key: "owner", kind: "Owner", count: 1, verb: "Assign", tone: "warning", href: "#ownership-record", label: "Owner is unassigned" }
      : null,
    input.needsCounterparty
      ? { key: "counterparty", kind: "Counterparty", count: 1, verb: "Add", tone: "warning", href: "#ownership-record", label: "Counterparty is missing" }
      : null,
    input.hasSourceFiles && !input.hasExtractedFields
      ? { key: "extraction", kind: "Suggestions", count: 1, verb: "Run", tone: "warning", href: "#extracted-fields", label: "Suggested details are not ready yet" }
      : null,
    input.hasExtractedFields && input.missingCriticalDateLabels.length > 0
      ? {
          key: "dates",
          kind: input.missingCriticalDateLabels.length === 1 ? "Date" : "Dates",
          count: input.missingCriticalDateLabels.length,
          verb: "Add",
          tone: "warning",
          href: "#contract-dates",
          label: `Missing key ${input.missingCriticalDateLabels.length === 1 ? "date" : "dates"}: ${input.missingCriticalDateLabels.join(", ")}`,
        }
      : null,
    input.pendingFieldsCount > 0
      ? {
          key: "fields",
          kind: input.pendingFieldsCount === 1 ? "Detail" : "Details",
          count: input.pendingFieldsCount,
          verb: "Confirm",
          tone: "warning",
          href: "#extracted-fields",
          label: `${pluralizeCount(input.pendingFieldsCount, "pending detail")} ${input.pendingFieldsCount === 1 ? "needs" : "need"} confirmation`,
        }
      : null,
    input.hasActiveIssues
      ? {
          key: "issues",
          kind: input.activeIssueCount === 1 ? "Issue" : "Issues",
          count: input.activeIssueCount,
          verb: "Triage",
          tone: "danger",
          href: `/contracts/exceptions?status=open&contract=${contractId}`,
          label: `${pluralizeCount(input.activeIssueCount, "active issue")}`,
        }
      : null,
    input.hasBlockingApprovals
      ? {
          key: "approvals",
          kind: input.blockingApprovalCount === 1 ? "Approval" : "Approvals",
          count: input.blockingApprovalCount,
          verb: "Review",
          tone: "warning",
          href: "#renewal-approvals",
          label: `${pluralizeCount(input.blockingApprovalCount, "approval")} blocking next action`,
        }
      : null,
    input.attentionEvidenceCount > 0
      ? {
          key: "evidence",
          kind: input.attentionEvidenceCount === 1 ? "Gap" : "Gaps",
          count: input.attentionEvidenceCount,
          verb: "Request",
          tone: "warning",
          href: "#contract-evidence",
          label: `${pluralizeCount(input.attentionEvidenceCount, "evidence gap")} ${input.attentionEvidenceCount === 1 ? "needs" : "need"} follow-up`,
        }
      : null,
  ];
  return items
    .filter((i): i is ContractAttentionItem => i !== null)
    .sort((a, b) => (ATTENTION_PRIORITY[a.key] ?? 99) - (ATTENTION_PRIORITY[b.key] ?? 99));
}

// ── Primary action (severity-aware; only issues/approvals are urgent/accent) ──

export interface ContractPrimaryAction {
  href: string;
  label: string;
  /** Active issues and pending approvals get the accent/primary button; everything
   *  else is a quiet secondary so the CTA doesn't read as urgent when it isn't. */
  urgent: boolean;
}

export function buildContractPrimaryAction(input: {
  contractId: string;
  hasActiveIssues: boolean;
  hasBlockingApprovals: boolean;
  pendingFieldsCount: number;
  hasSourceFiles: boolean;
  hasExtractedFields: boolean;
  needsOwner: boolean;
  dateGaps: number;
}): ContractPrimaryAction {
  if (input.hasActiveIssues)
    return { href: `/contracts/exceptions?status=open&contract=${input.contractId}`, label: "Review issues", urgent: true };
  if (input.hasBlockingApprovals) return { href: "#renewal-approvals", label: "Review approval", urgent: true };
  if (input.pendingFieldsCount > 0) return { href: "#extracted-fields", label: "Confirm details", urgent: false };
  if (!input.hasSourceFiles) return { href: `/contracts/${input.contractId}?tab=files`, label: "Attach source file", urgent: false };
  if (input.needsOwner) return { href: "#ownership-record", label: "Assign owner", urgent: false };
  if (input.hasExtractedFields && input.dateGaps > 0) return { href: "#contract-dates", label: "Add key date", urgent: false };
  return { href: "#contract-notes", label: "Add note", urgent: false };
}
