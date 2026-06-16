import Link from "next/link";
import { ChevronRight, ExternalLink, Pin } from "lucide-react";
import { RatioChip } from "@/components/ui/ratio-chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { TimeChip } from "@/components/ui/time-chip";
import { UiAvatar } from "@/components/ui/ui-avatar";
import type { ContractReviewStats } from "@/lib/contract-review-stats";
import { STATUS_LABELS, STATUS_SEMANTICS } from "@/lib/contracts";
import type { Contract } from "@/lib/types";

function humanizeEmailLocal(local: string): string | null {
  const cleaned = local.replace(/\+.*$/, "");
  const words = cleaned.split(/[._-]/).filter(Boolean);
  if (words.length <= 1) return null;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function ownerDisplayFor(contract: Contract): string | null {
  const ownerName = contract.owner?.full_name;
  const ownerEmail = contract.owner?.email;
  if (ownerName && ownerName !== "name") return ownerName;
  if (!ownerEmail || ownerEmail === "name") return null;
  return humanizeEmailLocal(ownerEmail.split("@")[0] ?? ownerEmail);
}

export function CompactRecentContractsList({
  contracts,
  reviewStats,
  showOnboardingTiles = false,
}: {
  contracts: Contract[];
  reviewStats?: Record<string, ContractReviewStats>;
  showOnboardingTiles?: boolean;
}) {
  const minRows = 3;
  const padCount = showOnboardingTiles ? Math.max(0, minRows - contracts.length) : 0;
  const referenceTimeMs = new Date().getTime();

  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)]">
      {contracts.map((contract) => (
        <RecentContractRow
          key={contract.id}
          contract={contract}
          stats={reviewStats?.[contract.id]}
          referenceTimeMs={referenceTimeMs}
        />
      ))}
      {padCount > 0 ? <OnboardingRows count={padCount} /> : null}
    </ul>
  );
}

function RecentContractRow({
  contract,
  stats,
  referenceTimeMs,
}: {
  contract: Contract;
  stats?: ContractReviewStats;
  referenceTimeMs: number;
}) {
  const updatedDate = new Date(contract.updated_at);
  const ownerName = contract.owner?.full_name;
  const ownerEmail = contract.owner?.email;
  const ownerDisplay = ownerDisplayFor(contract);

  return (
    <li>
      <Link
        href={`/contracts/${contract.id}`}
        className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
            {contract.title}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[12.5px] text-[var(--text-tertiary)]">
            {contract.counterparty && !contract.title.toLowerCase().startsWith(contract.counterparty.toLowerCase()) ? (
              <>
                <span className="truncate text-[var(--text-secondary)]">{contract.counterparty}</span>
                <span aria-hidden>-</span>
              </>
            ) : null}
            <span>
              Updated <TimeChip date={updatedDate} format="readable" className="text-[var(--text-secondary)]" /> ago
            </span>
          </p>
        </div>
        {stats && stats.total > 0 ? (
          <div className="hidden shrink-0 sm:flex">
            <RatioChip numerator={stats.approved} denominator={stats.total} suffix="reviewed" />
          </div>
        ) : null}
        {ownerDisplay ? (
          <>
            <span aria-hidden className="hidden h-5 w-px self-center bg-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] lg:inline-block" />
            <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
              <UiAvatar name={ownerName} email={ownerEmail} size="xs" />
              <span className="max-w-[8rem] truncate text-[12px] font-medium text-[var(--text-secondary)]">
                {ownerDisplay}
              </span>
            </div>
          </>
        ) : null}
        <StatusBadge
          status={STATUS_SEMANTICS[contract.status] ?? STATUS_SEMANTICS.draft}
          className="shrink-0"
          pulse={contract.status === "pending_review" && referenceTimeMs - updatedDate.getTime() > 3 * 86400000}
        >
          {STATUS_LABELS[contract.status] || contract.status}
        </StatusBadge>
        <span aria-hidden className="hidden shrink-0 items-center gap-1 text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100 sm:inline-flex">
          <span title="Pin to top" className="rounded p-1 hover:bg-[var(--surface-tint-soft)]">
            <Pin className="h-3 w-3" strokeWidth={1.85} />
          </span>
          <span title="Open in new tab" className="rounded p-1 hover:bg-[var(--surface-tint-soft)]">
            <ExternalLink className="h-3 w-3" strokeWidth={1.85} />
          </span>
          <span className="inline-flex items-center gap-0.5 rounded-md border border-[var(--border-card)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-[var(--accent-strong)]">
            OPEN
            <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.85} />
          </span>
        </span>
      </Link>
    </li>
  );
}

function OnboardingRows({ count }: { count: number }) {
  const tiles: Array<{ href: string; title: string; meta: string }> = [
    { href: "/contracts/new", title: "Upload another contract", meta: "Drag-and-drop or browse files" },
    { href: "/contracts/bulk", title: "Bulk import contracts", meta: "CSV, ZIP, or integration sync" },
    { href: "/contracts/maintenance", title: "Browse templates", meta: "MSA - NDA - SOW - Renewal" },
  ];

  return (
    <>
      {tiles.slice(0, count).map((tile) => (
        <li key={tile.href}>
          <Link
            href={tile.href}
            className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium text-[var(--accent-strong)]">{tile.title}</p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary)]">{tile.meta}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] opacity-50 transition-opacity group-hover:opacity-100" strokeWidth={1.85} aria-hidden />
          </Link>
        </li>
      ))}
    </>
  );
}
