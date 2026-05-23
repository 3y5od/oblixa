import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Sparkline } from "@/components/ui/sparkline";
import type { StatTone } from "@/components/ui/stat-cell";
import { KeyValueChip } from "@/components/ui/key-value-chip";

export interface KpiCardMetric {
  label: string;
  value: string | number;
  tone?: StatTone;
  hideLabel?: boolean;
}

export interface KpiCardWithSparklineProps {
  eyebrow: string;
  count: number;
  actionLabel: string;
  href: string;
  tone?: StatTone;
  trend?: number[];
  /** Positive = up, negative = down, undefined = no delta. */
  delta?: number;
  deltaLabel?: string;
  icon?: LucideIcon;
  /** Structured key/value metrics beneath the count — replaces the prose hint. */
  metrics?: ReadonlyArray<KpiCardMetric>;
  /** When false, the sparkline renders as a flat dashed baseline and the
   *  delta line is hidden. Use until a real metric-history store is wired. */
  hasHistoricalData?: boolean;
  /** When true, the card scales eyebrow / count / sparkline / corner ring so
   *  the wider layout doesn't visibly under-fill. */
  wide?: boolean;
  className?: string;
}

function toneInk(tone?: StatTone, isZero: boolean = false): string {
  if (isZero) return "var(--text-tertiary)";
  if (tone === "danger") return "var(--danger-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "success") return "var(--success-ink)";
  return "var(--text-primary)";
}

function deltaTone(delta: number | undefined, tone?: StatTone): StatTone {
  if (delta == null || delta === 0) return "neutral";
  // For risk-style tones (danger/warning/exceptions), going up is bad
  if (tone === "danger" || tone === "warning") {
    return delta > 0 ? "danger" : "success";
  }
  // For neutral tones, just match direction without coloring
  return delta > 0 ? "warning" : "success";
}

export function KpiCardWithSparkline({
  eyebrow,
  count,
  actionLabel,
  href,
  tone = "neutral",
  trend,
  delta,
  deltaLabel,
  icon: Icon,
  metrics,
  hasHistoricalData = false,
  wide = false,
  className,
}: KpiCardWithSparklineProps) {
  const isZero = count === 0;
  const ink = toneInk(tone, isZero);
  const dTone = deltaTone(delta, tone);
  const dInk = toneInk(dTone);
  const showSparkline = trend && trend.length > 1 && hasHistoricalData;

  return (
    <Link
      href={href}
      className={`ui-card-interactive group relative flex flex-col gap-2.5 overflow-hidden rounded-3xl border px-5 py-5 transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_45%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${className ?? ""}`.trim()}
      style={{
        borderColor:
          tone && tone !== "neutral"
            ? `color-mix(in oklab, ${ink} 12%, var(--border-card))`
            : "var(--border-card)",
        background:
          tone && tone !== "neutral"
            ? `color-mix(in oklab, ${ink} 4%, var(--surface-raised))`
            : "var(--surface-raised)",
        // v11 visual pass: one-pixel top highlight so cards have lift, not flat.
        boxShadow: "inset 0 1px 0 0 color-mix(in oklab, white 5%, transparent)",
      }}
    >
      {/* Decorative corner ring — tone-tinted; inherits hover lift via group */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-8 -top-8 rounded-full border opacity-65 transition-transform duration-[220ms] group-hover:-translate-y-[1.5px] ${wide ? "h-24 w-24" : "h-20 w-20"}`}
        style={{
          borderColor: `color-mix(in oklab, ${ink} 26%, color-mix(in oklab, var(--border-subtle) 60%, transparent))`,
        }}
      />
      <p
        className={`font-bold uppercase tracking-[0.16em] ${wide ? "text-[12px]" : "text-[11px]"}`}
        style={{ color: ink }}
      >
        {eyebrow}
      </p>
      <div className="flex items-baseline gap-3">
        {Icon ? (
          <span
            aria-hidden
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-xl border"
            style={{
              borderColor: `color-mix(in oklab, ${ink} 28%, var(--border-card))`,
              background: `color-mix(in oklab, ${ink} 10%, var(--surface-raised))`,
            }}
          >
            <Icon
              className="h-4 w-4"
              strokeWidth={1.85}
              style={{ color: ink }}
            />
          </span>
        ) : null}
        <p
          className={`font-semibold leading-none tabular-nums tracking-[-0.02em] ${wide ? "text-[3rem]" : "text-[2.5rem]"}`}
          style={{
            color: ink,
            animation: "ui-stat-value-enter 420ms var(--ui-ease-out, ease-out)",
          }}
        >
          {count}
        </p>
        {showSparkline ? (
          <div className="mb-1 flex-1">
            <Sparkline
              data={trend!}
              tone={tone}
              width={wide ? 120 : 80}
              height={wide ? 28 : 22}
            />
          </div>
        ) : null}
      </div>
      {delta !== undefined && hasHistoricalData ? (
        <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] tabular-nums" style={{ color: dInk }}>
          <span aria-hidden>{delta > 0 ? "↗" : delta < 0 ? "↘" : "·"}</span>
          {delta === 0
            ? "NO CHANGE"
            : `${delta > 0 ? "+" : ""}${delta} ${(deltaLabel ?? "vs last week").toUpperCase()}`}
        </p>
      ) : null}
      {metrics && metrics.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {metrics.map((m) => (
            <KeyValueChip
              key={m.label}
              label={m.label}
              value={m.value}
              tone={m.tone}
              hideLabel={m.hideLabel}
              className="min-h-6 whitespace-nowrap"
            />
          ))}
        </div>
      ) : null}
      <div className={`mt-auto flex items-center border-t border-[color:color-mix(in_oklab,var(--border-subtle)_40%,transparent)] ${wide ? "pt-2" : "pt-1.5"}`}>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold text-[var(--accent-strong)]">
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.85} aria-hidden />
        </span>
      </div>
    </Link>
  );
}
