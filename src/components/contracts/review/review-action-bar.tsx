import type { ReactNode } from "react";
import { formatSuggestedValue } from "./review-helpers";

interface ReviewActionBarProps {
  children: ReactNode;
  fieldLabel: string;
  suggestedValue: string | null;
}

/** Decision footer for the whole review unit — a quiet cool band spanning the
 *  detail and source proof, so Confirm / Edit / Mark unknown / Skip read as one
 *  decision for the unit, not a toolbar bolted to the detail. The cool wash ties
 *  it to the decision (inspection) register; a top hairline is the boundary.
 *
 *  A compact decision recap leads the band — the field plus the value the primary
 *  action will commit — so Confirm sits beside the datum it confirms rather than
 *  being a bare verb detached from the suggested value above. */
export function ReviewActionBar({ children, fieldLabel, suggestedValue }: ReviewActionBarProps) {
  const hasValue = !!suggestedValue?.trim();
  const displayValue = hasValue
    ? formatSuggestedValue(suggestedValue, { month: "long" })
    : "No value suggested";
  return (
    <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-cool)_46%,var(--surface-raised))] px-5 py-2.5 sm:px-6">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 leading-none">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          Your decision
        </span>
        <span className="text-[12.5px] font-medium text-[var(--text-secondary)]">{fieldLabel}</span>
        <span aria-hidden className="text-[var(--border-strong)]">
          ·
        </span>
        <span
          className={`text-[13px] font-semibold tabular-nums ${hasValue ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}`}
        >
          {displayValue}
        </span>
      </div>
      {children}
    </div>
  );
}
