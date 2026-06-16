import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Info,
  MinusCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { PROVENANCE, provenanceInk } from "@/components/ui/date-provenance-badge";
import type { StatTone } from "@/components/ui/stat-cell";
import type { SemanticStatus } from "@/components/ui/status-badge";
import type { ReportKey } from "@/lib/reports/types";

/** Per-semantic glyph so status reads without relying on color alone (§7.7). */
export const STATUS_ICON: Record<SemanticStatus, LucideIcon> = {
  healthy: CheckCircle2,
  info: Info,
  in_review: Clock,
  warning: AlertTriangle,
  blocked: Ban,
  overdue: AlertCircle,
  critical: XCircle,
  empty: MinusCircle,
  disabled: MinusCircle,
};

/**
 * Per-report risk tone. Color is rationed to the few reports where a non-zero
 * count is a genuine "act now" signal, so amber/red stay meaningful instead of
 * blanketing the rail (§10.2 "status earns color"). Deadlines that lock in if
 * missed read warning; past-due tasks and open issues read danger. Data
 * gaps and reference reports stay neutral — their grouping carries the meaning,
 * not a tint.
 */
export const REPORT_TONE: Record<ReportKey, StatTone> = {
  upcoming_renewals: "warning",
  notice_deadlines: "warning",
  overdue_work: "danger",
  exceptions_by_owner: "danger",
  missing_owners: "neutral",
  missing_key_fields: "neutral",
  open_obligations: "neutral",
  evidence_requests: "neutral",
  contract_inventory: "neutral",
  review_completeness: "neutral",
};

export function reportToneFor(key: ReportKey): StatTone {
  return REPORT_TONE[key] ?? "neutral";
}

/**
 * Ordered rail groups. Splitting the ten reports into a handful of titled
 * clusters replaces the failing single-row tab strip (which overflowed and
 * clipped labels) and gives the list real hierarchy instead of ten equal-weight
 * tabs. Every `ReportKey` must appear in exactly one group.
 */
export const REPORT_RAIL_GROUPS: ReadonlyArray<{ label: string; keys: ReportKey[] }> = [
  { label: "Deadlines", keys: ["upcoming_renewals", "notice_deadlines"] },
  {
    label: "Tasks and problems",
    keys: ["overdue_work", "exceptions_by_owner", "open_obligations", "evidence_requests"],
  },
  { label: "Data gaps", keys: ["missing_owners", "missing_key_fields"] },
  { label: "Reference", keys: ["contract_inventory", "review_completeness"] },
];

/**
 * The object type each report's catalog count refers to, so the count never
 * forces the user to infer whether "2" means contracts, tasks, dates, or
 * requests. Used to compose an accessible label ("2 renewal rows", "4
 * contracts") beside the visible number.
 */
export const REPORT_COUNT_NOUN: Record<ReportKey, { singular: string; plural: string }> = {
  upcoming_renewals: { singular: "renewal row", plural: "renewal rows" },
  notice_deadlines: { singular: "notice deadline", plural: "notice deadlines" },
  missing_owners: { singular: "contract", plural: "contracts" },
  missing_key_fields: { singular: "contract", plural: "contracts" },
  open_obligations: { singular: "requirement", plural: "requirements" },
  overdue_work: { singular: "task", plural: "tasks" },
  exceptions_by_owner: { singular: "owner", plural: "owners" },
  evidence_requests: { singular: "evidence request", plural: "evidence requests" },
  contract_inventory: { singular: "contract", plural: "contracts" },
  review_completeness: { singular: "contract", plural: "contracts" },
};

export function reportCountLabel(key: ReportKey, count: number): string {
  const noun = REPORT_COUNT_NOUN[key];
  return `${count} ${count === 1 ? noun.singular : noun.plural}`;
}

/**
 * Concise index annotations for the report catalog. Distinct from the full
 * report description (shown in the inspection header) so the catalog reads like
 * a legal index — each entry carries a short, scannable definition rather than
 * only a name and count.
 */
export const REPORT_CATALOG_BLURB: Record<ReportKey, string> = {
  upcoming_renewals: "Renewals inside the selected window",
  notice_deadlines: "Last day to send notice",
  missing_owners: "Contracts with no named owner",
  missing_key_fields: "Contracts missing confirmed details",
  open_obligations: "Contract requirements still open",
  overdue_work: "Tasks past their due date",
  exceptions_by_owner: "Open problems per owner",
  evidence_requests: "Proof still to submit or review",
  contract_inventory: "Every contract record",
  review_completeness: "Confirmation progress by contract",
};

/**
 * Reports whose row set is actually filtered by the date window. The export
 * always sends a window param, but it is a no-op for the others — so only
 * these surface the window as export scope to avoid a misleading "90 DAYS".
 */
export const REPORT_WINDOWED = new Set<ReportKey>(["upcoming_renewals", "notice_deadlines"]);

/** Columns rendered as a tabular mono date so date columns scan in a stable grid (§7.5). */
export const DATE_COLUMNS = new Set<string>([
  "Renewal date",
  "Notice date",
  "Due date",
  "Next due date",
  "Last update",
  "Effective date",
  "Termination date",
]);

/** Columns rendered as a tabular mono count. */
export const NUMERIC_COLUMNS = new Set<string>([
  "Open problems",
  "High severity",
  "Contracts",
  "Confirmed details",
  "Pending details",
  "Attached files",
]);

/** Columns rendered as a structured status badge with non-color reinforcement (§7.7). */
export const STATUS_COLUMNS = new Set<string>(["Status", "Confirmation state"]);

/** Columns rendered as a date-provenance chip so a date's trust state (confirmed,
 *  calculated, suggested, missing) is never inferred — a core trust-clarity
 *  requirement before a date drives reminders, tasks, or an exported report. */
export const DATE_STATE_COLUMNS = new Set<string>(["Date state"]);

/** Reports that carry a date-provenance column and the accompanying trust
 *  disclosure beneath the preview. */
export const REPORT_DATE_STATE = new Set<ReportKey>(["upcoming_renewals", "notice_deadlines"]);

export type DateStateKey = "confirmed" | "calculated" | "suggested" | "missing";

/**
 * Date-provenance treatment for the report preview's "Date state" column.
 * Derived from the canonical `PROVENANCE` map (date-provenance-badge) so a
 * Confirmed / Calculated / Suggested / Missing date renders the SAME icon and
 * trust tone here as it does on Renewals and contract detail — they can no
 * longer drift apart. Kept quieter than the loud `.ui-status-badge`: the
 * sentence-case label carries the meaning and the per-state glyph keeps it
 * legible without relying on color (§7.7), with only confirmed earning green.
 */
export const DATE_STATE_META: Record<DateStateKey, { label: string; icon: LucideIcon; ink: string }> = {
  confirmed: { label: PROVENANCE.confirmed.label, icon: PROVENANCE.confirmed.icon, ink: provenanceInk(PROVENANCE.confirmed.tone) },
  calculated: { label: PROVENANCE.calculated.label, icon: PROVENANCE.calculated.icon, ink: provenanceInk(PROVENANCE.calculated.tone) },
  suggested: { label: PROVENANCE.suggested.label, icon: PROVENANCE.suggested.icon, ink: provenanceInk(PROVENANCE.suggested.tone) },
  missing: { label: PROVENANCE.missing.label, icon: PROVENANCE.missing.icon, ink: provenanceInk(PROVENANCE.missing.tone) },
};

export function dateStateKey(value: string): DateStateKey {
  switch (value.trim().toLowerCase()) {
    case "confirmed":
      return "confirmed";
    case "calculated":
      return "calculated";
    case "suggested":
      return "suggested";
    default:
      return "missing";
  }
}

/** Columns whose value is a recommended next step — a report value, not a link (§ issue 20). */
export const NEXT_ACTION_COLUMNS = new Set<string>(["Next action"]);

/** Values that read as "no real value here" and should recede. */
const MUTED_VALUES = new Set<string>(["unassigned", "missing", "unknown", "none"]);

export function isMutedValue(value: string): boolean {
  return MUTED_VALUES.has(value.trim().toLowerCase());
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** Map a human report status string to a semantic badge tone. */
export function statusToSemantic(value: string): SemanticStatus {
  switch (normalize(value)) {
    case "active":
    case "accepted":
    case "received":
    case "approved":
    case "completed":
    case "complete":
    case "signed":
    case "executed":
      return "healthy";
    case "pending_review":
    case "needs_review":
    case "needs_confirmation":
    case "in_review":
    case "review":
      return "in_review";
    case "blocked":
      return "blocked";
    case "overdue":
      return "overdue";
    case "rejected":
    case "canceled":
    case "cancelled":
    case "expired":
      return "critical";
    // Ended/inactive states read neutral (grey), not as an active problem —
    // a terminated contract isn't something to "fix", unlike expired/rejected.
    case "terminated":
    case "inactive":
      return "disabled";
    case "unknown":
    case "":
      return "empty";
    // open / in_progress / requested / draft / pending and anything else read
    // as an active-but-neutral state.
    default:
      return "info";
  }
}
