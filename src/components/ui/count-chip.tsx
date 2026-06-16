import type { StatTone } from "@/components/ui/stat-cell";

export interface CountChipProps {
  value: number;
  tone?: StatTone;
  emphasis?: "subtle" | "strong";
  /** Optional object-class noun (plural form) so a bare "6" reads as "6 tasks"
   *  (§19 count semantics). Singularized automatically at a value of 1. */
  unit?: string;
  className?: string;
}

function toneInk(tone?: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  return "var(--text-primary)";
}

/**
 * Minimal numeric pill — `subtle` matches in-row "view 2" footers while
 * `strong` matches header count badges.
 */
export function CountChip({
  value,
  tone,
  emphasis = "subtle",
  unit,
  className,
}: CountChipProps) {
  const ink = toneInk(tone);
  const strongBg = tone
    ? `color-mix(in oklab, ${ink} 18%, var(--surface-raised))`
    : "var(--surface-raised)";
  const subtleBg = "var(--surface)";
  const unitLabel = unit ? (value === 1 ? unit.replace(/s$/, "") : unit) : null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] leading-none tabular-nums ${className ?? ""}`.trim()}
      style={{
        borderColor: tone
          ? `color-mix(in oklab, ${ink} 32%, var(--border-card))`
          : "var(--border-card)",
        background: emphasis === "strong" ? strongBg : subtleBg,
        color: ink,
      }}
    >
      {value}
      {unitLabel ? (
        <span className="font-medium normal-case tracking-normal text-[var(--text-tertiary)]">
          {unitLabel}
        </span>
      ) : null}
    </span>
  );
}
