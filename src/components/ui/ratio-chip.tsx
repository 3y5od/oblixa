import type { StatTone } from "@/components/ui/stat-cell";

export interface RatioChipProps {
  numerator: number;
  denominator: number;
  tone?: StatTone;
  /** Optional caps suffix (e.g., "REVIEWED"). Renders inside the chip. */
  suffix?: string;
  className?: string;
}

function toneInk(tone?: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  return "var(--text-primary)";
}

/**
 * Tabular-num ratio chip (e.g., `1 / 1000 reviewed`) in a hairline-bordered pill.
 *
 * v11 visual pass: dropped caps tracking on the numerals + suffix. The
 * chip's job is to read as a quick mini-stat, not as a tracked-caps badge.
 * Caps reserved for chips that carry hierarchy (eyebrows, status tokens).
 */
export function RatioChip({
  numerator,
  denominator,
  tone,
  suffix,
  className,
}: RatioChipProps) {
  const ink = toneInk(tone);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium leading-none ${className ?? ""}`.trim()}
      style={{
        borderColor: tone
          ? `color-mix(in oklab, ${ink} 28%, var(--border-card))`
          : "var(--border-card)",
        background: tone
          ? `color-mix(in oklab, ${ink} 8%, var(--surface-raised))`
          : "var(--surface-raised)",
        color: ink,
      }}
    >
      <span className="tabular-nums font-semibold">{numerator}</span>
      <span className="text-[var(--text-tertiary)]" aria-hidden>
        /
      </span>
      <span className="tabular-nums text-[var(--text-tertiary)]">{denominator}</span>
      {suffix ? (
        <span className="ml-0.5 text-[var(--text-tertiary)]">{suffix}</span>
      ) : null}
    </span>
  );
}
