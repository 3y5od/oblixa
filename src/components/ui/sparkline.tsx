import type { StatTone } from "@/components/ui/stat-cell";

export interface SparklineProps {
  data: number[];
  tone?: StatTone;
  width?: number;
  height?: number;
  showArea?: boolean;
  showDot?: boolean;
  /** When true, ignore `data` and render a flat dashed baseline.
   *  Use for "no historical data yet" states so we don't fabricate trends. */
  placeholder?: boolean;
  className?: string;
  ariaLabel?: string;
}

function toneStroke(tone: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  return "color-mix(in oklab, var(--text-secondary) 70%, var(--accent))";
}

export function Sparkline({
  data,
  tone = "neutral",
  width = 80,
  height = 24,
  showArea = true,
  showDot = true,
  placeholder = false,
  className,
  ariaLabel,
}: SparklineProps) {
  if (placeholder || data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-label={ariaLabel ?? "No trend data yet"}
        className={className}
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="color-mix(in oklab, var(--border-strong) 90%, transparent)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const innerH = height - padding * 2;
  const innerW = width - padding * 2;
  const stepX = innerW / (data.length - 1);

  const points = data.map((v, i) => {
    const x = padding + i * stepX;
    const y = padding + innerH - ((v - min) / range) * innerH;
    return { x, y };
  });

  const path = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  const areaPath =
    showArea && points.length > 0
      ? `${path} L ${points[points.length - 1]!.x} ${height - padding} L ${points[0]!.x} ${height - padding} Z`
      : null;

  const stroke = toneStroke(tone);
  const last = points[points.length - 1]!;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={ariaLabel ?? "Sparkline"}
      className={`transition-transform duration-150 ease-out hover:scale-[1.06] ${className ?? ""}`.trim()}
    >
      {areaPath ? (
        <path
          d={areaPath}
          fill={stroke}
          fillOpacity="0.12"
          className="transition-[fill-opacity] duration-150 ease-out"
          style={{ fillOpacity: 0.12 }}
        />
      ) : null}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot ? (
        <>
          {/* Halo ring around the current-value dot. */}
          <circle
            cx={last.x}
            cy={last.y}
            r={4}
            fill="none"
            stroke={stroke}
            strokeWidth={1}
            strokeOpacity={0.35}
          />
          <circle
            cx={last.x}
            cy={last.y}
            r={2.5}
            fill={stroke}
            className="transition-[r] duration-150 ease-out"
          />
        </>
      ) : null}
    </svg>
  );
}
