import { isValid } from "date-fns";
import type { ContractReviewStats } from "@/lib/contract-review-stats";
import type { ContractListRowSignals } from "@/lib/contract-list-row-signals";
import type { Contract } from "@/lib/types";

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
  return {
    contract,
    stats,
    sig,
    updatedDate,
    updatedStale,
    owner: ownerDisplay(contract),
    review: reviewState(contract.id, stats),
    nextDateTone,
    horizonTypeLabel,
    horizonRelative,
    cp,
    cpFallback: !!cp && COUNTERPARTY_FALLBACK_TOKENS.has(cp.toLowerCase()),
    type,
    typeFallback: !!type && CONTRACT_TYPE_FALLBACK_TOKENS.has(type.toLowerCase()),
  };
}

export type ContractTableRowModel = ReturnType<typeof buildContractTableRowModel>;

export function nextDateColor(tone: ContractTableNextDateTone) {
  if (tone === "danger") return "var(--danger-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  return "var(--text-primary)";
}

export function reviewChipText(m: ContractTableRowModel) {
  return m.stats
    ? m.stats.pending === 0
      ? `${m.stats.approved} confirmed ${m.stats.approved === 1 ? "detail" : "details"}`
      : `${m.stats.pending} ${m.stats.pending === 1 ? "detail" : "details"} to confirm`
    : "";
}
