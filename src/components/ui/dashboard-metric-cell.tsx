import Link from "next/link";
import { Check, type LucideIcon } from "lucide-react";

export type MetricTone = "accent" | "warning" | "danger" | "success" | "info" | "neutral";

export interface DashboardMetricCellProps {
  href: string;
  /** Short metric title. */
  label: string;
  /** Plain-language definition for what the count represents. */
  description?: string;
  /** Object-class noun rendered beside the number (e.g. "contracts", "tasks") so
   *  the count names what it measures at the numeral itself (§19). */
  unit?: string;
  value: number;
  /** Semantic tone. Zero counts override to muted success regardless of tone. */
  tone: MetricTone;
  /** Short labeled condition (e.g. "Needs confirmation", "Cannot proceed") shown
   *  as a tone chip — carries state in WORDS so the signal never depends on color
   *  alone (§Accessibility: no color-only state). Replaced by "All clear" at 0. */
  state: string;
  /** Medallion glyph for active (non-zero) cells. */
  icon: LucideIcon;
  /** Replacement definition shown when the count is zero, so an all-clear cell
   *  explains the absence instead of reusing the "there is work" copy. */
  zeroDescription?: string;
  ariaLabel?: string;
  className?: string;
}

// Muted success ink shared by the zero number + chip so an "all clear" cell
// de-emphasizes through tone, not opacity (§10.10).
const ZERO_INK = "color-mix(in oklab, var(--success-ink) 60%, var(--text-tertiary))";

/** Number ink per tone. Cobalt is reserved for action/selection, so no data
 *  count is blue — needs-attention reads amber, problems read oxblood, calm
 *  records read ink/steel, all-clear reads controlled green (§Palette). */
function toneInk(tone: MetricTone): string {
  switch (tone) {
    case "accent":
      return "var(--accent-strong)";
    case "warning":
      return "var(--warning-ink)";
    case "danger":
      return "var(--danger-ink)";
    case "success":
      return "var(--success-ink)";
    case "info":
      return "var(--info-ink)";
    default:
      return "var(--text-primary)";
  }
}

/** Compact display for large counts ("1.2k") while the accessible label keeps
 *  the exact value (§10.11). */
function formatCount(value: number): string {
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
}

/**
 * One ledger cell in the operational snapshot. Reads top-down like a ledger
 * entry: tone-inked tabular number + object-class unit, the object title with a
 * quiet glyph anchor, a labeled condition chip (state in words, not a color
 * dot), then the mandated explanatory sentence. Cells sit flush (no per-cell
 * border/shadow) so the snapshot reads as one surface ruled by its grid, not a
 * strip of floating cards. Zero counts read all-clear through muted-green ink.
 */
export function DashboardMetricCell({
  href,
  label,
  description,
  unit,
  value,
  tone,
  state,
  icon: Icon,
  zeroDescription,
  ariaLabel,
  className,
}: DashboardMetricCellProps) {
  const isZero = value === 0;
  const ink = isZero ? ZERO_INK : toneInk(tone);
  const stateLabel = isZero ? "All clear" : state;
  // Singular-aware object noun so the count reads as a natural phrase
  // ("1 contract", "5 dates", "0 evidence requests") instead of "1 CONTRACTS"
  // (§18.13 grammar, §19 count names its object). Units are regular plurals.
  const unitLabel = unit ? (value === 1 ? unit.replace(/s$/, "") : unit) : null;
  // All-clear cells explain the absence; active cells keep the "there is work"
  // definition (§33).
  const effectiveDescription = isZero && zeroDescription ? zeroDescription : description;
  const computedAriaLabel = effectiveDescription
    ? `${label}: ${value} ${unitLabel ?? ""}. ${stateLabel}. ${effectiveDescription}`.replace(/\s+\./g, ".")
    : `${label}: ${value}. ${stateLabel}.`;
  return (
    <Link
      href={href}
      aria-label={ariaLabel ?? computedAriaLabel}
      // Thin tone top-rule so each cell's status is recognizable from the rule,
      // not only the small condition badge (§13 rules over elevation). Inset
      // shadow avoids any layout shift against the gap-px grid.
      style={{ boxShadow: `inset 0 2px 0 0 color-mix(in oklab, ${ink} 55%, transparent)` }}
      className={`group relative flex min-h-[8rem] min-w-0 flex-col gap-2 bg-[var(--surface-raised)] px-4 py-3.5 transition-colors duration-150 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,var(--surface-raised))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_45%,transparent)] ${className ?? ""}`.trim()}
    >
      {/* Number + object-class unit on one baseline: the count names what it
          measures right at the numeral (§4 / §19 count semantics). */}
      <span className="flex items-baseline gap-1.5">
        <span
          className="text-[1.75rem] font-semibold leading-none tabular-nums tracking-tight"
          style={{ color: ink }}
        >
          {formatCount(value)}
        </span>
        {unitLabel ? (
          <span className="text-[13px] font-medium leading-none text-[var(--text-secondary)]">
            {unitLabel}
          </span>
        ) : null}
      </span>
      {/* Object title with a quiet glyph anchor — the glyph orients, the number
          and the labeled state carry the signal (§icons as quiet anchors). */}
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]"
          strokeWidth={1.85}
        />
        <span className="block min-w-0 truncate text-[13px] font-semibold leading-snug text-[var(--text-primary)]">
          {label}
        </span>
      </span>
      {/* Labeled condition — state in words, tinted by tone (color reinforces,
          never carries, the meaning). */}
      <span
        className="inline-flex self-start items-center gap-1.5 rounded-[3px] border px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-[0.08em]"
        style={{
          borderColor: `color-mix(in oklab, ${ink} 30%, var(--border-card))`,
          background: `color-mix(in oklab, ${ink} 9%, var(--surface))`,
          color: ink,
        }}
      >
        {isZero ? <Check aria-hidden className="h-3 w-3" strokeWidth={2.4} /> : null}
        {stateLabel}
      </span>
      {effectiveDescription ? (
        <span className="mt-auto block max-w-[34rem] text-[12px] leading-snug text-[var(--text-secondary)]">
          {effectiveDescription}
        </span>
      ) : null}
    </Link>
  );
}
