import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FieldReviewSegmentedProgress } from "@/lib/field-review/model";
import { ReviewSegmentedProgress } from "./review-segmented-progress";

/** Prev/next detail navigation. Renders a disabled, muted control (not an opacity
 *  wash) at the ends of the queue so the cluster keeps a stable width (§10.9). */
function FieldNavButton({ href, direction }: { href: string | null; direction: "prev" | "next" }) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const label = direction === "prev" ? "Previous detail" : "Next detail";
  const base = "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors";
  if (!href) {
    return (
      <span aria-hidden className={`${base} text-[color:color-mix(in_oklab,var(--text-tertiary)_55%,transparent)]`}>
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${base} text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_32%,var(--surface-raised))] hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] motion-safe:active:scale-90`}
    >
      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
    </Link>
  );
}

interface ReviewControlBarProps {
  contractTitle: string;
  segments: FieldReviewSegmentedProgress;
  activeContractPosition: number;
  contractsWaiting: number;
  activeFieldPosition: number;
  activeContractPendingFields: number;
  prevHref: string | null;
  nextHref: string | null;
}

/** Persistent top bar: this-contract progress (left) + contract/detail position
 *  with a stepper (right). Workspace-scope counts live in the page header so this
 *  bar stays about the current contract. */
export function ReviewControlBar({
  contractTitle,
  segments,
  activeContractPosition,
  contractsWaiting,
  activeFieldPosition,
  activeContractPendingFields,
  prevHref,
  nextHref,
}: ReviewControlBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_32%,transparent)] px-5 py-3 sm:px-6 lg:shrink-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="ui-caps-2 shrink-0 text-[10px] leading-none text-[var(--text-tertiary)]">
            This contract
          </span>
          <span className="min-w-0 max-w-[16rem] truncate text-[12.5px] font-semibold text-[var(--text-primary)]">
            {contractTitle}
          </span>
        </div>
        <ReviewSegmentedProgress segments={segments} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:ml-auto">
        <span className="ui-caps-3 text-[10px] leading-none tabular-nums text-[var(--text-tertiary)]">
          Contract <span className="text-[var(--text-secondary)]">{activeContractPosition}</span> of {contractsWaiting}
        </span>
        <div
          className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] p-0.5"
          aria-label="Contract detail navigation"
        >
          <FieldNavButton href={prevHref} direction="prev" />
          <span className="ui-caps-3 px-1.5 text-[10px] leading-none tabular-nums text-[var(--text-tertiary)]">
            Detail <span className="text-[var(--text-secondary)]">{activeFieldPosition}</span> of{" "}
            {activeContractPendingFields}
          </span>
          <FieldNavButton href={nextHref} direction="next" />
        </div>
      </div>
    </div>
  );
}
