import type { StatTone } from "@/components/ui/stat-cell";

export interface ChipPairProps {
  /** Primary caps token (renders heavier). */
  primary: string;
  /** Optional secondary caps token (renders lighter — modifier role). */
  secondary?: string;
  tone?: StatTone;
  /** "tight" = 4px gap, "loose" = 8px gap. Default "tight". */
  gap?: "tight" | "loose";
  className?: string;
}

function toneInk(tone?: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  return "var(--text-primary)";
}

/**
 * Renders two caps tokens inside a single bordered chip using weight
 * gradation (primary 700 + secondary 500) and whitespace — no middle-dot.
 * Used by Tactic B sites in v7 to replace `TOKEN · MODIFIER` patterns.
 */
export function ChipPair({
  primary,
  secondary,
  tone,
  gap = "tight",
  className,
}: ChipPairProps) {
  const ink = toneInk(tone);
  const gapClass = gap === "loose" ? "gap-2" : "gap-1";
  return (
    <span
      className={`inline-flex items-center ${gapClass} rounded-full border px-2 py-0.5 text-[10.5px] uppercase leading-none ${className ?? ""}`.trim()}
      style={{
        borderColor: tone
          ? `color-mix(in oklab, ${ink} 28%, var(--border-card))`
          : "var(--border-card)",
        background: tone
          ? `color-mix(in oklab, ${ink} 10%, var(--surface-raised))`
          : "var(--surface-raised)",
        color: ink,
      }}
    >
      <span
        className="font-bold tracking-[0.14em]"
        style={{ color: ink }}
      >
        {primary.toUpperCase()}
      </span>
      {secondary ? (
        <span
          className="font-medium tracking-[0.12em]"
          style={{ color: tone ? `color-mix(in oklab, ${ink} 70%, var(--text-secondary))` : "var(--text-secondary)" }}
        >
          {secondary.toUpperCase()}
        </span>
      ) : null}
    </span>
  );
}
