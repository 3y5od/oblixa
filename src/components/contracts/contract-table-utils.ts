import { isValid } from "date-fns";
import type { ContractReviewStats } from "@/lib/contract-review-stats";
import type { ContractListRowSignals } from "@/lib/contract-list-row-signals";
import type { Contract, ContractStatus } from "@/lib/types";

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
const FRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type ContractTableNextDateTone = "danger" | "warning" | undefined;

export type ContractStatusTone = "healthy" | "warning" | "overdue" | "neutral";

/**
 * Condition-specific reading of the lifecycle status. STATUS_LABELS still owns
 * the canonical noun (Active / Incomplete / Pending review / Expired /
 * Terminated — shared across detail + watchlists); this adds the operational
 * descriptor and ink weight so the three live states stop reading as three
 * same-weight pills (§16 status hierarchy, §18.5 "what is true / needed next").
 */
const STATUS_DESCRIPTOR: Record<ContractStatus, { tone: ContractStatusTone; descriptor: string }> = {
  active: { tone: "healthy", descriptor: "Tracked and confirmed" },
  pending_review: { tone: "warning", descriptor: "Suggested details await confirmation" },
  draft: { tone: "warning", descriptor: "Not yet ready to track" },
  expired: { tone: "overdue", descriptor: "Term has ended" },
  terminated: { tone: "neutral", descriptor: "Closed out" },
};

export function statusDescriptor(status: ContractStatus) {
  return STATUS_DESCRIPTOR[status] ?? STATUS_DESCRIPTOR.draft;
}

export function statusInkColor(tone: ContractStatusTone) {
  if (tone === "healthy") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "overdue") return "var(--danger-ink)";
  return "var(--text-secondary)";
}

function horizonLabel(field: string | null) {
  switch (field) {
    case "notice_window":
      return "Notice";
    case "renewal_date":
      return "Renewal";
    case "end_date":
      return "End";
    default:
      return "Date";
  }
}

function ownerDisplay(
  contract: Contract
): { display: string; tooltip?: string; isEmailFallback?: boolean } | null {
  const ownerName = contract.owner?.full_name?.trim();
  const ownerEmail = contract.owner?.email?.trim();
  if (ownerName && ownerName.toLowerCase() !== "name") {
    return { display: ownerName, tooltip: ownerEmail };
  }
  if (ownerEmail && ownerEmail.toLowerCase() !== "name") {
    const local = ownerEmail.split("@")[0];
    return {
      display: local || ownerEmail,
      tooltip: ownerEmail,
      isEmailFallback: OWNER_EMAIL_RE.test(ownerEmail),
    };
  }
  return null;
}

function reviewState(contractId: string, stats?: ContractReviewStats) {
  if (!stats || stats.total <= 0) return null;
  if (stats.pending > 0) {
    return {
      status: "warning" as const,
      href: `/contracts/${contractId}#extracted-fields`,
    };
  }
  return {
    status: "success" as const,
    href: `/contracts/${contractId}#extracted-fields`,
  };
}

export function buildContractTableRowModel({
  contract,
  stats,
  sig,
  renderNow,
}: {
  contract: Contract;
  stats?: ContractReviewStats;
  sig?: ContractListRowSignals;
  renderNow: number;
}) {
  const updatedDate = new Date(contract.updated_at);
  const updatedStale = isValid(updatedDate) && renderNow - updatedDate.getTime() > FRESH_WINDOW_MS;
  const nextDateTone: ContractTableNextDateTone =
    sig?.nextHorizonDays == null
      ? undefined
      : sig.nextHorizonDays < 0
        ? "danger"
        : sig.nextHorizonDays <= 14
          ? "warning"
          : undefined;
  const horizonTypeLabel = sig?.nextHorizonField ? horizonLabel(sig.nextHorizonField) : null;
  const horizonRelative =
    sig?.nextHorizonDays != null
      ? sig.nextHorizonDays < 0
        ? `Overdue ${Math.abs(sig.nextHorizonDays)}d`
        : sig.nextHorizonDays === 0
          ? "Due today"
          : sig.nextHorizonDays === 1
            ? "Due tomorrow"
            : `In ${sig.nextHorizonDays}d`
      : null;
  const cp = contract.counterparty?.trim();
  const type = contract.contract_type?.trim();
  const owner = ownerDisplay(contract);
  const review = reviewState(contract.id, stats);
  return {
    contract,
    stats,
    sig,
    updatedDate,
    updatedStale,
    owner,
    review,
    nextDateTone,
    horizonTypeLabel,
    horizonRelative,
    cp,
    cpFallback: !!cp && COUNTERPARTY_FALLBACK_TOKENS.has(cp.toLowerCase()),
    type,
    typeFallback: !!type && CONTRACT_TYPE_FALLBACK_TOKENS.has(type.toLowerCase()),
    condition: primaryCondition({ contract, sig, owner, review, cp, nextDateTone }),
  };
}

export type ContractRecordConditionTone = "danger" | "warning" | "neutral";

/**
 * The single most important operational condition for the record block under the
 * contract name — one sentence that pairs what is true with its consequence, in
 * descending urgency (§7 consequence copy, §18.5). Returns null when the record
 * is clean, so a healthy contract reads quietly rather than carrying a filler
 * line. Critical column chips (Missing owner/counterparty/dates, problems) still
 * render independently; this is the at-a-glance "why this row matters".
 */
function primaryCondition({
  contract,
  sig,
  owner,
  review,
  cp,
  nextDateTone,
}: {
  contract: Contract;
  sig?: ContractListRowSignals;
  owner: ReturnType<typeof ownerDisplay>;
  review: ReturnType<typeof reviewState>;
  cp?: string;
  nextDateTone: ContractTableNextDateTone;
}): { text: string; tone: ContractRecordConditionTone } | null {
  if ((sig?.openExceptionCount ?? 0) > 0) {
    const n = sig?.openExceptionCount ?? 0;
    return { tone: "danger", text: `${n} open ${n === 1 ? "problem keeps" : "problems keep"} this record open` };
  }
  if (nextDateTone === "danger") {
    return { tone: "danger", text: "Key date is overdue - the requirement stays open" };
  }
  if (sig?.missingCriticalDates) {
    return { tone: "warning", text: "Missing renewal or notice dates - renewal timing cannot be trusted" };
  }
  if (!owner || owner.isEmailFallback) {
    return { tone: "warning", text: "No owner assigned - reminders cannot route" };
  }
  if (!cp) {
    return { tone: "warning", text: "No counterparty - search, grouping, and reports are incomplete" };
  }
  if (contract.status === "pending_review" && review?.status === "warning") {
    return { tone: "warning", text: "Suggested details are not confirmed - they stay out of reminders and reports" };
  }
  if (nextDateTone === "warning") {
    return { tone: "warning", text: "A key date falls due soon" };
  }
  return null;
}

export type ContractTableRowModel = ReturnType<typeof buildContractTableRowModel>;

export function nextDateColor(tone: ContractTableNextDateTone) {
  if (tone === "danger") return "var(--danger-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  return "var(--text-primary)";
}

export function reviewChipText(m: ContractTableRowModel) {
  if (!m.stats) return "";
  const { pending, approved, total } = m.stats;
  // "X of Y verb" so the cell reads as a confirmation tally against the whole
  // detail set, not a bare count: complete → "N of N confirmed", incomplete →
  // "N of N to confirm" (§19 count semantics, §18.8 suggested-vs-confirmed).
  return pending === 0 ? `${approved} of ${total} confirmed` : `${pending} of ${total} to confirm`;
}
