import type { ReactNode } from "react";

export type MetaChipTone = "neutral" | "accent" | "success" | "warning" | "danger";

function toneInk(tone: MetaChipTone): string {
  switch (tone) {
    case "accent":
      return "var(--accent-strong)";
    case "success":
      return "var(--success-ink)";
    case "warning":
      return "var(--warning-ink)";
    case "danger":
      return "var(--danger-ink)";
    default:
      return "var(--text-tertiary)";
  }
}

export interface MetaChipProps {
  children: ReactNode;
  tone?: MetaChipTone;
  className?: string;
}

/**
 * One-token bordered caps chip — the smallest structured label (file types,
 * size limits, source tags). Use this instead of bespoke inline `<span>` chips
 * so the dashboard's micro-chip styling stays in one place. For label+value
 * pairs use `KeyValueChip`; for two caps tokens use `ChipPair`.
 */
export function MetaChip({ children, tone = "neutral", className }: MetaChipProps) {
  const toned = tone !== "neutral";
  const ink = toneInk(tone);
  return (
    <span
      className={`ui-caps-3 inline-flex items-center rounded-md border px-2 py-0.5 text-[9.5px] leading-none ${className ?? ""}`.trim()}
      style={{
        borderColor: toned
          ? `color-mix(in oklab, ${ink} 28%, var(--border-subtle))`
          : "var(--border-card)",
        background: toned
          ? `color-mix(in oklab, ${ink} 12%, var(--surface-raised))`
          : "var(--surface-raised)",
        color: ink,
      }}
    >
      {children}
    </span>
  );
}
