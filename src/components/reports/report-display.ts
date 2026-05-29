import type { StatTone } from "@/components/ui/stat-cell";
import type { SemanticStatus } from "@/components/ui/status-badge";
import type { ReportKey } from "@/lib/reports/types";

/**
 * Per-report risk tone. Color is rationed to the few reports where a non-zero
 * count is a genuine "act now" signal, so amber/red stay meaningful instead of
 * blanketing the rail (§10.2 "status earns color"). Deadlines that lock in if
 * missed read warning; past-due work and open exceptions read danger. Data
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
    label: "Work & exceptions",
    keys: ["overdue_work", "exceptions_by_owner", "open_obligations", "evidence_requests"],
  },
  { label: "Data gaps", keys: ["missing_owners", "missing_key_fields"] },
  { label: "Reference", keys: ["contract_inventory", "review_completeness"] },
];

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
  "Open exceptions",
  "High severity",
  "Contracts",
  "Approved fields",
  "Pending fields",
  "Attached files",
]);

/** Columns rendered as a structured status badge with non-color reinforcement (§7.7). */
export const STATUS_COLUMNS = new Set<string>(["Status", "Review state"]);

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
    case "unknown":
    case "":
      return "empty";
    // open / in_progress / requested / draft / pending and anything else read
    // as an active-but-neutral state.
    default:
      return "info";
  }
}
