import Link from "next/link";
import { Check, type LucideIcon } from "lucide-react";

export type MetricTone = "accent" | "warning" | "danger" | "success" | "neutral";

export interface DashboardMetricCellProps {
  href: string;
  /** Short metric title. */
  label: string;
  /** Plain-language definition for what the count represents. */
  description?: string;
  value: number;
  /** Semantic tone. Zero counts override to muted success regardless of tone. */
  tone: MetricTone;
  /** Medallion glyph for active (non-zero) cells. */
  icon: LucideIcon;
  ariaLabel?: string;
  className?: string;
}

// Muted success ink shared by the zero number + unit chip so an "all clear"
// cell de-emphasizes through tone, not opacity (§10.10).
const ZERO_INK = "color-mix(in oklab, var(--success-ink) 55%, var(--text-tertiary))";

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
 * Metric summary tile. The count is prominent, but the title and definition
 * sit beside it so the user can tell what is being counted without decoding a
 * tiny abbreviated label. Zero counts still read as all-clear through the
 * muted-success icon and number treatment.
 */
export function DashboardMetricCell({
  href,
  label,
  description,
  value,
  tone,
  icon: Icon,
  ariaLabel,
  className,
}: DashboardMetricCellProps) {
  const isZero = value === 0;
  const ink = toneInk(tone);
  const numberColor = isZero ? ZERO_INK : ink;
  const computedAriaLabel = description
    ? `${label}: ${value}. ${description}`
    : `${label}: ${value}.`;
  return (
    <Link
      href={href}
      aria-label={ariaLabel ?? computedAriaLabel}
      className={`group relative grid min-h-[7rem] min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_86%,var(--surface))] px-4 py-3 shadow-[inset_0_1px_0_0_color-mix(in_oklab,var(--surface)_86%,transparent)] transition-colors duration-150 hover:border-[color:color-mix(in_oklab,var(--accent)_26%,var(--border-subtle))] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_10%,var(--surface-raised))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_45%,transparent)] ${className ?? ""}`.trim()}
    >
      <span className="inline-flex min-w-[4.75rem] flex-col items-start gap-2">
        <span
          aria-hidden
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
          style={{
            borderColor: isZero
              ? "color-mix(in oklab, var(--success-ink) 28%, var(--border-card))"
              : `color-mix(in oklab, ${ink} 26%, var(--border-card))`,
            background: isZero
              ? "color-mix(in oklab, var(--success-ink) 12%, var(--surface))"
              : `color-mix(in oklab, ${ink} 12%, var(--surface))`,
            color: isZero ? "var(--success-ink)" : ink,
          }}
        >
          {isZero ? (
            <Check className="h-4 w-4" strokeWidth={2.2} />
          ) : (
            <Icon className="h-4 w-4" strokeWidth={2} />
          )}
        </span>
        <span
          className="text-[1.9rem] font-semibold leading-none tabular-nums tracking-normal"
          style={{ color: numberColor }}
        >
          {formatCount(value)}
        </span>
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className="inline-flex h-2 w-2 shrink-0 rounded-full"
            style={{
              background: isZero
                ? "color-mix(in oklab, var(--success-ink) 60%, transparent)"
                : ink,
              boxShadow: isZero
                ? undefined
                : `0 0 0 3px color-mix(in oklab, ${ink} 16%, transparent)`,
            }}
          />
          <span className="block min-w-0 text-[13px] font-semibold leading-snug tracking-normal text-[var(--text-primary)]">
            {label}
          </span>
        </span>
        {description ? (
          <span className="mt-1.5 block max-w-[32rem] text-[12.5px] leading-snug text-[var(--text-secondary)]">
            {description}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
