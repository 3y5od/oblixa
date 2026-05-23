import type { StatTone } from "@/components/ui/stat-cell";

export interface StackedBarSegment {
  label: string;
  value: number;
  tone?: StatTone | "accent";
}

export interface StackedBarProps {
  segments: StackedBarSegment[];
  height?: number;
  showLegend?: boolean;
  className?: string;
  ariaLabel?: string;
}

const TONE_COLORS: Record<NonNullable<StackedBarSegment["tone"]>, string> = {
  neutral: "color-mix(in oklab, var(--text-tertiary) 60%, var(--surface-contrast))",
  success: "var(--success-ink)",
  warning: "var(--warning-ink)",
  danger: "var(--danger-ink)",
  accent: "var(--accent-strong)",
};

const FALLBACK_PALETTE = [
  "var(--accent-strong)",
  "var(--success-ink)",
  "var(--warning-ink)",
  "var(--info-ink)",
  "color-mix(in oklab, var(--text-tertiary) 70%, var(--surface-contrast))",
];

export function StackedBar({
  segments,
  height = 10,
  showLegend = true,
  className,
  ariaLabel,
}: StackedBarProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total <= 0) {
    return (
      <div
        className={`rounded-full bg-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] ${className ?? ""}`.trim()}
        style={{ height }}
        aria-label={ariaLabel ?? "No data"}
      />
    );
  }

  return (
    <div className={className} aria-label={ariaLabel}>
      <div
        className="flex overflow-hidden rounded-full"
        style={{ height }}
      >
        {segments.map((seg, i) => {
          const color = seg.tone
            ? TONE_COLORS[seg.tone]
            : FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]!;
          const pct = (seg.value / total) * 100;
          return (
            <div
              key={seg.label}
              className="h-full"
              style={{ width: `${pct}%`, background: color }}
              title={`${seg.label}: ${seg.value}`}
            />
          );
        })}
      </div>
      {showLegend ? (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)]">
          {segments.map((seg, i) => {
            const color = seg.tone
              ? TONE_COLORS[seg.tone]
              : FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]!;
            return (
              <li key={seg.label} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: color }}
                />
                <span>{seg.label}</span>
                <span className="tabular-nums text-[var(--text-tertiary)]">{seg.value}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
