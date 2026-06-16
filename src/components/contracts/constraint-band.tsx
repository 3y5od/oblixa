import type { ReactNode } from "react";

export interface ConstraintBandItem {
  /** Sentence-case name of the constrained object (e.g. "Accepted files"). */
  label: string;
  /** The constraint value. Pass a string for numeric/limit values so the band
   *  can render it with tabular figures; pass a node for chips/acronyms. */
  value: ReactNode;
  /** Optional clarifying line shown under the value in a smaller quiet style. */
  hint?: string;
}

export interface ConstraintBandProps {
  items: ConstraintBandItem[];
  className?: string;
}

/**
 * A quiet labeled metadata band that replaces decorative header pill rows. Each
 * item is a label + value pair, separated by thin vertical rules, wrapping
 * gracefully and stacking on narrow widths. Values that are plain strings get
 * tabular figures so limits and counts align. This is a band, not chips — no
 * rounded pills, no tint (§16 — chips carry state; constraints are metadata).
 */
export function ConstraintBand({ items, className }: ConstraintBandProps) {
  return (
    <dl
      className={`flex flex-col gap-x-5 gap-y-3 rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--surface-raised))] px-4 py-3 sm:flex-row sm:flex-wrap sm:items-stretch ${className ?? ""}`.trim()}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`flex min-w-0 flex-col gap-0.5 ${
            index > 0
              ? "sm:border-l sm:border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] sm:pl-5"
              : ""
          }`}
        >
          <dt className="text-[11px] leading-none text-[var(--text-tertiary)]">
            {item.label}
          </dt>
          <dd className="text-[12.5px] font-medium leading-snug tabular-nums text-[var(--text-primary)]">
            {item.value}
          </dd>
          {item.hint ? (
            <p className="text-[10.5px] leading-snug text-[var(--text-tertiary)]">
              {item.hint}
            </p>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
