import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, FileWarning } from "lucide-react";
import type { FieldReviewSegmentedProgress } from "@/lib/field-review/model";
import { ReviewSegmentedProgress } from "./review-segmented-progress";

/** Prev/next detail navigation. Renders a disabled, muted control (not an opacity
 *  wash) at the ends of the queue so the cluster keeps a stable width. */
function FieldNavButton({ href, direction }: { href: string | null; direction: "prev" | "next" }) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const label = direction === "prev" ? "Previous suggested detail" : "Next suggested detail";
  // Fixed square, low-radius button so the stepper reads as a precise ledger
  // control rather than a pill. Both ends always render a bordered square: the
  // disabled end is a real <button disabled> with a visible (muted) icon and an
  // accessible name — never empty visual space.
  const base = "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors";
  if (!href) {
    return (
      <button
        type="button"
        disabled
        aria-label={`${label} (unavailable)`}
        // Lower-contrast than the active button (fainter border, no fill, a
        // lightened chevron) but still clearly a present, bordered control.
        className={`${base} cursor-not-allowed border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] text-[color:color-mix(in_oklab,var(--text-tertiary)_60%,var(--surface-raised))]`}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${base} border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[color:color-mix(in_oklab,var(--surface-cool-strong)_60%,var(--surface-raised))] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] motion-safe:active:scale-95`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
    </Link>
  );
}

/** Source-state badge for the band's source column — always present so the band
 *  reads as four explicit columns (contract · progress · source state ·
 *  navigation). When the original file is missing it says so calmly and states
 *  whether searchable text remains — never a red "Source file not attached" that
 *  reads as conflicting with the per-detail "Source text found" trust signal. */
function BandSourceState({
  noSourceFile,
  previewAvailable,
}: {
  noSourceFile: boolean;
  previewAvailable: boolean;
}) {
  // Plain metadata (icon + label), not a bordered pill — the source-file state is
  // band context, not a status the user acts on here. Colour still encodes the
  // state for legibility.
  const state = !noSourceFile ? "attached" : previewAvailable ? "searchable" : "none";
  const tone =
    state === "attached"
      ? "text-[var(--success-ink)]"
      : state === "none"
        ? "text-[var(--warning-ink)]"
        : "text-[var(--text-secondary)]";
  const label = state === "attached" ? "File attached" : state === "searchable" ? "Searchable text only" : "No source text";
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] leading-none text-[var(--text-tertiary)]">
        Source file
      </span>
      <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium leading-none ${tone}`}>
        {state === "none" ? (
          <FileWarning className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        ) : (
          <FileText
            className={`h-3.5 w-3.5 shrink-0 ${state === "searchable" ? "text-[var(--text-tertiary)]" : ""}`}
            strokeWidth={1.85}
            aria-hidden
          />
        )}
        {label}
        {state === "searchable" ? <span className="sr-only">. Original file not attached.</span> : null}
      </span>
    </div>
  );
}

interface ReviewControlBarProps {
  contractTitle: string;
  counterparty: string | null;
  ownerLabel: string;
  segments: FieldReviewSegmentedProgress;
  noSourceFile: boolean;
  previewAvailable: boolean;
  activeContractPosition: number;
  contractsWaiting: number;
  activeFieldPosition: number;
  activeContractPendingFields: number;
  prevHref: string | null;
  nextHref: string | null;
}

/** Persistent contract band above the three panes, composed of three legible
 *  zones separated by hairline rules on wide screens:
 *    1. Identity   — which contract is being decided (name, counterparty, owner).
 *    2. Progress   — review progress + a calm source-file state.
 *    3. Navigation — contract position + a prev/next suggested-detail stepper.
 *  It is the fixed header of the full-height workbench (never cropped) and stays
 *  scoped to the current contract; workspace-wide counts live in the page header. */
export function ReviewControlBar({
  contractTitle,
  counterparty,
  ownerLabel,
  segments,
  noSourceFile,
  previewAvailable,
  activeContractPosition,
  contractsWaiting,
  activeFieldPosition,
  activeContractPendingFields,
  prevHref,
  nextHref,
}: ReviewControlBarProps) {
  const ownerUnassigned = ownerLabel === "Unassigned";
  return (
    // Raised shelf: `relative z-10` + a downward cast so the internally-scrolling
    // detail and source panes visibly pass *beneath* the fixed contract band
    // rather than colliding with it at the seam. This is the fix for the band
    // appearing to overlap the first heading ("Effective date" / "Source excerpt")
    // mid-scroll — the cast reads the seam as an intentional shelf edge.
    <div className="relative z-10 flex shrink-0 flex-col gap-x-6 gap-y-3 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-5 py-3.5 shadow-[0_6px_12px_-9px_rgba(15,23,42,0.3)] sm:px-6 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
      {/* Zone 1 — identity */}
      <div className="flex min-w-0 flex-col gap-1 lg:flex-1">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] leading-none text-[var(--text-tertiary)]">
          Active contract
        </span>
        <span
          className="min-w-0 max-w-full line-clamp-2 text-[15px] font-semibold leading-tight text-[var(--text-primary)] sm:text-[16px]"
          title={contractTitle}
        >
          {contractTitle}
        </span>
        <span className="min-w-0 max-w-full truncate text-[12px] leading-tight text-[var(--text-tertiary)]">
          <span className="sr-only">Counterparty </span>
          {counterparty ?? "No counterparty"}
          <span aria-hidden> · </span>
          <span className="sr-only">Owner </span>
          <span className={ownerUnassigned ? "text-[var(--warning-ink)]" : undefined}>{ownerLabel}</span>
        </span>
      </div>

      {/* Zone 2 — review progress */}
      <div className="flex min-w-0 lg:shrink-0 lg:border-l lg:border-[var(--border-subtle)] lg:pl-6">
        <ReviewSegmentedProgress segments={segments} />
      </div>

      {/* Zone 3 — source state */}
      <div className="flex min-w-0 lg:shrink-0 lg:border-l lg:border-[var(--border-subtle)] lg:pl-6">
        <BandSourceState noSourceFile={noSourceFile} previewAvailable={previewAvailable} />
      </div>

      {/* Zone 4 — navigation. One position line ("Contract X of Y · Detail X of
          Y") with the prev/next stepper sitting immediately after it, since the
          chevrons step through details. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 lg:border-l lg:border-[var(--border-subtle)] lg:pl-6">
        <span className="text-[11.5px] leading-none tabular-nums text-[var(--text-tertiary)]">
          Contract <span className="font-semibold text-[var(--text-secondary)]">{activeContractPosition}</span> of{" "}
          {contractsWaiting}
          <span aria-hidden className="px-1.5 text-[var(--border-strong)]">
            ·
          </span>
          Detail <span className="font-semibold text-[var(--text-secondary)]">{activeFieldPosition}</span> of{" "}
          {activeContractPendingFields}
        </span>
        <span className="inline-flex items-center gap-1" aria-label="Move between suggested details to review">
          <FieldNavButton href={prevHref} direction="prev" />
          <FieldNavButton href={nextHref} direction="next" />
        </span>
      </div>
    </div>
  );
}
