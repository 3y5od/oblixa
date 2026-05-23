import Link from "next/link";
import { differenceInDays, format } from "date-fns";
import type { StatTone } from "@/components/ui/stat-cell";

export interface HorizonMarker {
  date: Date | string;
  label: string;
  tone?: StatTone;
  href?: string;
}

export interface HorizonTimelineProps {
  markers: HorizonMarker[];
  /** Total horizon span in days. Default 90. */
  horizonDays?: number;
  className?: string;
  ariaLabel?: string;
}

function toneColor(tone?: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  return "var(--accent-strong)";
}

export function HorizonTimeline({
  markers,
  horizonDays = 90,
  className,
  ariaLabel,
}: HorizonTimelineProps) {
  const today = new Date();
  const positioned = markers
    .map((m) => {
      const d = m.date instanceof Date ? m.date : new Date(m.date);
      const days = differenceInDays(d, today);
      if (days < 0 || days > horizonDays) return null;
      return { ...m, date: d, days, pct: (days / horizonDays) * 100 };
    })
    .filter((m): m is NonNullable<typeof m> => m != null)
    .sort((a, b) => a.days - b.days);

  const ticks = [0, 30, 60, 90].filter((t) => t <= horizonDays);

  return (
    <div className={`space-y-3 ${className ?? ""}`.trim()} aria-label={ariaLabel}>
      <div className="relative h-12">
        {/* Axis line */}
        <div className="absolute left-0 right-0 top-5 h-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]" />
        {/* Today marker */}
        <div className="absolute left-0 top-3 flex flex-col items-center">
          <span
            aria-hidden
            className="h-3 w-3 rounded-full border-2 border-[var(--surface-raised)] bg-[var(--accent-strong)]"
          />
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
            Today
          </span>
        </div>
        {/* Day ticks */}
        {ticks.map((t) =>
          t === 0 ? null : (
            <div
              key={t}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${(t / horizonDays) * 100}%`, transform: "translateX(-50%)" }}
            >
              <span
                aria-hidden
                className="mt-4 h-2 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]"
              />
              <span className="mt-1 text-[10px] tabular-nums text-[var(--text-tertiary)]">
                +{t}d
              </span>
            </div>
          )
        )}
        {/* Markers */}
        {positioned.map((m) => {
          const dot = (
            <span
              aria-hidden
              className="block h-2.5 w-2.5 rounded-full ring-2 ring-[var(--surface-raised)]"
              style={{ background: toneColor(m.tone) }}
            />
          );
          const node = (
            <div
              className="absolute top-[14px] flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${m.pct}%` }}
              title={`${m.label} · ${format(m.date, "MMM d, yyyy")} · ${m.days}d`}
            >
              {dot}
            </div>
          );
          return m.href ? (
            <Link
              key={`${m.label}-${m.days}`}
              href={m.href}
              className="group focus-visible:outline-none"
            >
              {node}
            </Link>
          ) : (
            <div key={`${m.label}-${m.days}`}>{node}</div>
          );
        })}
      </div>
      {positioned.length === 0 ? (
        <p className="text-[11px] text-[var(--text-tertiary)]">
          No upcoming events in the next {horizonDays} days.
        </p>
      ) : (
        <ul className="space-y-1 text-[11.5px]">
          {positioned.slice(0, 5).map((m) => {
            const row = (
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: toneColor(m.tone) }}
                />
                <span className="font-medium text-[var(--text-primary)]">{m.label}</span>
                <span className="ml-auto text-[var(--text-tertiary)] tabular-nums">
                  {m.days === 0 ? "today" : `${m.days}d`}
                </span>
              </span>
            );
            return (
              <li key={`row-${m.label}-${m.days}`}>
                {m.href ? (
                  <Link
                    href={m.href}
                    className="block rounded-md px-2 py-1 transition-colors hover:bg-[var(--surface-tint-soft)] focus-visible:bg-[var(--surface-tint-soft)] focus-visible:outline-none"
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="px-2 py-1">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
