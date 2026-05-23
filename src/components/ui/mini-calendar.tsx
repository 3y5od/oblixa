import {
  addDays,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { StatTone } from "@/components/ui/stat-cell";

export interface MiniCalendarMarker {
  date: Date | string;
  count?: number;
  tone?: StatTone;
}

export interface MiniCalendarProps {
  markers?: MiniCalendarMarker[];
  /** Anchor date — the calendar shows the month containing this date. Defaults to today. */
  anchor?: Date;
  className?: string;
  ariaLabel?: string;
}

function toneColor(tone?: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  return "var(--accent-strong)";
}

export function MiniCalendar({
  markers = [],
  anchor,
  className,
  ariaLabel,
}: MiniCalendarProps) {
  const focus = anchor ?? new Date();
  const today = new Date();
  const start = startOfWeek(startOfMonth(focus), { weekStartsOn: 1 });
  const endOfMonthDate = endOfMonth(focus);
  // Always render 6 rows for layout stability.
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(start, i));

  const markerMap = new Map<string, MiniCalendarMarker[]>();
  for (const m of markers) {
    const d = m.date instanceof Date ? m.date : new Date(m.date);
    const key = format(d, "yyyy-MM-dd");
    const cur = markerMap.get(key) ?? [];
    cur.push(m);
    markerMap.set(key, cur);
  }

  const weekLabels = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  const eventCount = Array.from(markerMap.values()).flat().length;
  return (
    <div className={className} aria-label={ariaLabel ?? `Calendar for ${format(focus, "MMMM yyyy")}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)]">
          {format(focus, "MMM yyyy").toUpperCase()}
        </p>
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none tabular-nums"
          style={{
            borderColor: "var(--border-card)",
            background: "var(--surface-raised)",
            color: eventCount === 0 ? "var(--text-tertiary)" : "var(--accent-strong)",
          }}
        >
          <span>{eventCount}</span>
          <span className="text-[var(--text-tertiary)]/70" aria-hidden>EVENTS</span>
          <span className="mx-1 text-[var(--border-strong)]" aria-hidden>|</span>
          <span className="text-[var(--text-tertiary)]">60D</span>
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {weekLabels.map((w) => (
          <div key={w} className="mb-1 inline-flex min-h-5 items-center justify-center text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            {w}
          </div>
        ))}
        {days.slice(0, endOfMonthDate.getDate() > 28 ? 42 : 35).map((d) => {
          const inMonth = isSameMonth(d, focus);
          const isToday = isSameDay(d, today);
          const key = format(d, "yyyy-MM-dd");
          const dayMarkers = markerMap.get(key) ?? [];
          const has = dayMarkers.length > 0;
          // Tone priority: danger > warning > neutral > success
          const tone: StatTone | undefined = dayMarkers.find((m) => m.tone === "danger")
            ? "danger"
            : dayMarkers.find((m) => m.tone === "warning")
              ? "warning"
              : dayMarkers[0]?.tone;
          return (
            <div
              key={key}
              className="relative flex aspect-square min-h-8 flex-col items-center justify-center text-[12.5px] tabular-nums"
              style={{
                color: inMonth
                  ? "var(--text-secondary)"
                  : "color-mix(in oklab, var(--text-tertiary) 50%, transparent)",
                fontWeight: isToday ? 700 : 400,
              }}
            >
              {/* v11 visual pass: today marker is a rounded-full disc, not
                  a square outline — aligns with the page's rounded chip /
                  pill / button geometry instead of fighting it. */}
              {isToday ? (
                <span
                  aria-hidden
                  className="absolute inset-1 rounded-full"
                  style={{
                    background:
                      "color-mix(in oklab, var(--accent-soft) 36%, transparent)",
                    boxShadow:
                      "inset 0 0 0 1px color-mix(in oklab, var(--accent) 55%, transparent)",
                  }}
                />
              ) : null}
              <span
                className="relative"
                style={{ color: isToday ? "var(--accent-strong)" : undefined }}
              >
                {d.getDate()}
              </span>
              {has ? (
                <span
                  aria-hidden
                  className="absolute bottom-0.5 h-1 w-1 rounded-full"
                  style={{ background: toneColor(tone) }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
