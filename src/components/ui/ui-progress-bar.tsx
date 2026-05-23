import type { StatTone } from "@/components/ui/stat-cell";

export interface UiProgressBarProps {
  value: number;
  max?: number;
  tone?: StatTone;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
  ariaLabel?: string;
}

function barColor(tone: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  return "var(--accent)";
}

export function UiProgressBar({
  value,
  max = 100,
  tone = "neutral",
  size = "sm",
  showLabel = false,
  className,
  ariaLabel,
}: UiProgressBarProps) {
  const clamped = Math.max(0, Math.min(max, value));
  const pct = max === 0 ? 0 : (clamped / max) * 100;
  const height = size === "sm" ? 4 : 6;

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={ariaLabel}
        className="relative flex-1 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,transparent)]"
        style={{ height }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: barColor(tone),
            transitionDuration: "var(--duration-default, 160ms)",
          }}
        />
      </div>
      {showLabel ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] tabular-nums text-[var(--text-tertiary)]">
          {Math.round(pct)}%
        </span>
      ) : null}
    </div>
  );
}
