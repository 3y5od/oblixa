import Link from "next/link";
import { Check, ChevronRight, type LucideIcon } from "lucide-react";

export type MetricTone = "accent" | "warning" | "danger" | "success" | "info" | "neutral";

export interface DashboardMetricCellProps {
  href: string;
  /** Concise card title (release-state: e.g. "Contracts needing review"). */
  label: string;
  /** One-line explanatory consequence sentence. */
  description?: string;
  /** Object-class noun used in the accessible label. */
  unit?: string;
  value: number;
  /** Semantic tone. Zero counts de-emphasize regardless of tone. */
  tone: MetricTone;
  /** Short labeled condition (accessible label only). */
  state: string;
  /** Sentence fragment after the count (accessible-label fallback). */
  statement: string;
  /** Calm cleared-state phrase for a zero count. */
  zeroStatement?: string;
  /** Object icon (retained for the interface; the ledger cell omits it for density). */
  icon?: LucideIcon;
  zeroDescription?: string;
  ariaLabel?: string;
  className?: string;
}

const ZERO_INK = "color-mix(in oklab, var(--success-ink) 62%, var(--text-tertiary))";

/** Count ink per tone. Cobalt stays reserved for actions/nav, so no count is
 *  blue — needs-attention reads amber, blockers/problems red, all-clear green,
 *  evidence backlog steel, calm records ink. */
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

function formatCount(value: number): string {
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
}

/**
 * One row-cell of the workspace ledger: a tone-inked count in a fixed-width
 * column, the concise object label, a one-line consequence, a status-colored
 * left rail, and a quiet chevron click affordance. Hairline borders on the right
 * and bottom let the six cells read as one connected register rather than six
 * floating tiles. A zero count collapses to a subdued cleared-state line.
 */
export function DashboardMetricCell({
  href,
  label,
  description,
  unit,
  value,
  tone,
  state,
  statement,
  zeroStatement,
  zeroDescription,
  icon: Icon,
  ariaLabel,
  className,
}: DashboardMetricCellProps) {
  const isZero = value === 0;
  const ink = isZero ? ZERO_INK : toneInk(tone);
  const unitLabel = unit ? (value === 1 ? unit.replace(/s$/, "") : unit) : null;
  const stateLabel = isZero ? "All clear" : state;
  const effectiveDescription = isZero && zeroDescription ? zeroDescription : description;
  const computedAriaLabel = effectiveDescription
    ? `${label}: ${value} ${unitLabel ?? ""}. ${stateLabel}. ${effectiveDescription}`.replace(/\s+\./g, ".")
    : `${label}: ${value}. ${stateLabel}.`;
  const focus =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_45%,transparent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--canvas)]";
  const cardBase =
    "group relative flex min-h-[3.5rem] items-center gap-3 overflow-hidden rounded-[6px] border px-3.5 py-2.5 transition-[transform,box-shadow,background-color,border-color] duration-150 hover:-translate-y-px";

  // Cleared card — subdued, subordinate to active facts.
  if (isZero) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel ?? computedAriaLabel}
        style={{ boxShadow: `inset 3px 0 0 0 color-mix(in oklab, ${ink} 34%, transparent)` }}
        className={`${cardBase} border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_36%,var(--surface-raised))] hover:border-[color:color-mix(in_oklab,var(--success-ink)_24%,var(--border-subtle))] ${focus} ${className ?? ""}`.trim()}
      >
        <Check className="h-4 w-4 shrink-0" strokeWidth={2.4} style={{ color: ink }} aria-hidden />
        <span className="text-[12px] font-medium leading-snug" style={{ color: ink }}>
          {zeroStatement ?? statement}
        </span>
      </Link>
    );
  }

  const isHigh = tone === "danger";
  const cardBg = isHigh
    ? "color-mix(in oklab, var(--danger-soft) 14%, var(--surface-raised))"
    : "var(--surface-raised)";
  const borderColor = isHigh
    ? "color-mix(in oklab, var(--danger-ink) 24%, var(--border-subtle))"
    : "color-mix(in oklab, var(--border-subtle) 92%, transparent)";

  // Crafted record card: an icon + count cluster on the left, the object title
  // and its consequence stacked, a quiet chevron, and a status-colored rail.
  return (
    <Link
      href={href}
      aria-label={ariaLabel ?? computedAriaLabel}
      style={{ background: cardBg, borderColor, boxShadow: `inset 3px 0 0 0 ${ink}` }}
      className={`${cardBase} hover:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.12)] ${focus} ${className ?? ""}`.trim()}
    >
      <span className="flex shrink-0 items-center gap-2.5">
        <span
          aria-hidden
          className="inline-flex h-7 w-7 items-center justify-center rounded-[5px] border"
          style={{
            background: `color-mix(in oklab, ${ink} 11%, var(--surface-raised))`,
            borderColor: `color-mix(in oklab, ${ink} 26%, transparent)`,
            color: ink,
          }}
        >
          {Icon ? <Icon className="h-4 w-4" strokeWidth={2} /> : null}
        </span>
        <span className="font-bold leading-none tabular-nums tracking-[-0.02em]" style={{ color: ink, fontSize: "1.5rem" }}>
          {formatCount(value)}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold leading-tight text-[var(--text-primary)]">{label}</span>
        {description ? (
          <span className="mt-0.5 block truncate text-[11px] leading-snug text-[var(--text-tertiary)]">{description}</span>
        ) : null}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-[color:color-mix(in_oklab,var(--text-tertiary)_60%,transparent)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--text-secondary)]"
        strokeWidth={2}
        aria-hidden
      />
    </Link>
  );
}
