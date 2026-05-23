import type { StatTone } from "@/components/ui/stat-cell";

export interface KeyValueChipProps {
  label: string;
  value: string | number;
  tone?: StatTone;
  /** When true, the label is rendered as a visually-hidden screen-reader prefix
   *  and only the value pills shows. Used when the label is filler ("STATUS",
   *  "PRIORITY") that the value already implies. */
  hideLabel?: boolean;
  className?: string;
}

function toneInk(tone?: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  return "var(--text-primary)";
}

/**
 * Caps-tracking key + tabular-num value, bordered. Use as a structured
 * replacement for "Label: value" prose strings.
 */
export function KeyValueChip({ label, value, tone, hideLabel, className }: KeyValueChipProps) {
  const ink = toneInk(tone);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none ${className ?? ""}`.trim()}
      style={{
        borderColor: tone
          ? `color-mix(in oklab, ${ink} 32%, var(--border-card))`
          : "var(--border-card)",
        background: tone
          ? `color-mix(in oklab, ${ink} 14%, var(--surface-raised))`
          : "var(--surface-raised)",
        color: "var(--text-tertiary)",
      }}
    >
      {hideLabel ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span>{label.toUpperCase()}</span>
      )}
      <span className="tabular-nums" style={{ color: ink }}>
        {value}
      </span>
    </span>
  );
}
