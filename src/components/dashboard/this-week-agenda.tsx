import Link from "next/link";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { CalendarDays } from "lucide-react";

export interface AgendaItem {
  date: Date;
  kind: "task" | "obligation" | "approval" | "deadline";
  title: string;
  href: string;
}

interface ThisWeekAgendaProps {
  items: AgendaItem[];
}

const KIND_LABELS: Record<AgendaItem["kind"], string> = {
  task: "Task",
  obligation: "Obligation",
  approval: "Approval",
  deadline: "Deadline",
};

const KIND_TONES: Record<AgendaItem["kind"], string> = {
  task: "var(--accent-strong)",
  obligation: "var(--info-ink)",
  approval: "var(--warning-ink)",
  deadline: "var(--danger-ink)",
};

export function ThisWeekAgenda({ items }: ThisWeekAgendaProps) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const grouped = days.map((day) => ({
    date: day,
    items: items.filter((i) => isSameDay(startOfDay(i.date), day)),
  }));

  const totalThisWeek = grouped.reduce((s, g) => s + g.items.length, 0);

  if (totalThisWeek === 0) return null;

  return (
    <section className="space-y-3" aria-label="This week">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-[1.375rem] font-semibold tracking-tight text-[var(--text-primary)]">
          <CalendarDays className="h-4 w-4 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
          This week
        </h2>
        <p className="text-[11.5px] text-[var(--text-tertiary)]">
          <span className="tabular-nums font-semibold text-[var(--text-secondary)]">
            {totalThisWeek}
          </span>{" "}
          item{totalThisWeek === 1 ? "" : "s"} due in 7 days
        </p>
      </div>
      <div className="grid grid-cols-7 gap-2 rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-3">
        {grouped.map(({ date, items: dayItems }) => {
          const isToday = isSameDay(date, today);
          const dayDots = dayItems.slice(0, 3);
          const overflow = dayItems.length - dayDots.length;
          return (
            <div
              key={date.toISOString()}
              className={`flex flex-col gap-1 rounded-xl border px-2 py-2 text-center transition-colors ${
                isToday
                  ? "border-[color:color-mix(in_oklab,var(--accent)_42%,var(--border-strong))] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))]"
                  : "border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)]"
              }`}
            >
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                {format(date, "EEE")}
              </p>
              <p
                className={`text-[15px] font-semibold tabular-nums ${
                  isToday ? "text-[var(--accent-strong)]" : "text-[var(--text-primary)]"
                }`}
              >
                {format(date, "d")}
              </p>
              <div className="mt-auto flex min-h-[1.25rem] flex-wrap items-center justify-center gap-1">
                {dayDots.map((item, idx) => (
                  <Link
                    key={`${item.href}-${idx}`}
                    href={item.href}
                    title={`${KIND_LABELS[item.kind]} · ${item.title}`}
                    className="h-1.5 w-1.5 rounded-full transition-transform hover:scale-150"
                    style={{ background: KIND_TONES[item.kind] }}
                    aria-label={`${KIND_LABELS[item.kind]}: ${item.title}`}
                  />
                ))}
                {overflow > 0 ? (
                  <span className="text-[9.5px] font-semibold text-[var(--text-tertiary)] tabular-nums">
                    +{overflow}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
