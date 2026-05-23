import type { StatTone } from "@/components/ui/stat-cell";

export interface DonutSegment {
  label: string;
  value: number;
  tone?: StatTone | "accent";
}

export interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
  ariaLabel?: string;
}

const TONE_COLORS: Record<NonNullable<DonutSegment["tone"]>, string> = {
  neutral: "color-mix(in oklab, var(--text-tertiary) 50%, var(--surface-contrast))",
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
  "var(--danger-ink)",
  "color-mix(in oklab, var(--accent) 60%, var(--text-tertiary))",
];

export function DonutChart({
  segments,
  size = 120,
  thickness = 14,
  centerLabel,
  centerValue,
  className,
  ariaLabel,
}: DonutChartProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  if (total <= 0) {
    return (
      <div
        className={`flex flex-col items-center gap-2 ${className ?? ""}`}
        style={{ width: size }}
        aria-label={ariaLabel ?? centerLabel ?? "Donut chart"}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="color-mix(in oklab, var(--border-subtle) 60%, transparent)"
            strokeWidth={thickness}
            strokeDasharray="4 6"
          />
        </svg>
      </div>
    );
  }

  const segmentOffsets = segments.reduce<number[]>((offsets, seg, index) => {
    const priorOffset = offsets[index - 1] ?? 0;
    const priorLength =
      index === 0 ? 0 : (segments[index - 1]!.value / total) * circumference;
    offsets.push(priorOffset + priorLength);
    return offsets;
  }, []);

  return (
    <div className={`flex flex-col items-center gap-3 ${className ?? ""}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={ariaLabel ?? centerLabel ?? "Donut chart"}
        style={{ transform: "rotate(-90deg)" }}
      >
        {segments.map((seg, i) => {
          const fraction = seg.value / total;
          const length = fraction * circumference;
          const offset = segmentOffsets[i] ?? 0;
          const color = seg.tone
            ? TONE_COLORS[seg.tone]
            : FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]!;
          return (
            <circle
              key={seg.label}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={thickness}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            >
              <title>{`${seg.label}: ${seg.value}`}</title>
            </circle>
          );
        })}
      </svg>
      {(centerLabel || centerValue) && (
        <div
          className="-mt-[calc(50%+0.5rem)] flex flex-col items-center"
          aria-hidden
          style={{ pointerEvents: "none" }}
        >
          {centerValue !== undefined ? (
            <p className="text-[1.5rem] font-semibold tabular-nums leading-none text-[var(--text-primary)]">
              {centerValue}
            </p>
          ) : null}
          {centerLabel ? (
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              {centerLabel}
            </p>
          ) : null}
        </div>
      )}
      <ul className="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)]">
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
              <span className="truncate">{seg.label}</span>
              <span className="tabular-nums text-[var(--text-tertiary)]">{seg.value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
