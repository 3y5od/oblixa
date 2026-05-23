import type { StatTone } from "@/components/ui/stat-cell";

export interface UiCountdownProps {
  dueDate: Date | string;
  format?: "short" | "long";
  className?: string;
}

function differenceInDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function toneForDays(days: number): StatTone {
  if (days < 0) return "danger";
  if (days <= 14) return "warning";
  return "neutral";
}

function colorFor(tone: StatTone): string {
  if (tone === "danger") return "var(--danger-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  return "var(--text-secondary)";
}

export function UiCountdown({ dueDate, format = "short", className }: UiCountdownProps) {
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  if (Number.isNaN(due.getTime())) {
    return (
      <span className={`text-[12.5px] text-[var(--text-tertiary)] ${className ?? ""}`}>—</span>
    );
  }
  const now = new Date();
  const days = differenceInDays(now, due);
  const tone = toneForDays(days);

  const text =
    days === 0
      ? "Due today"
      : days < 0
        ? format === "long"
          ? `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`
          : `Overdue ${Math.abs(days)}d`
        : format === "long"
          ? `Due in ${days} day${days === 1 ? "" : "s"}`
          : `Due in ${days}d`;

  return (
    <span
      className={`inline-flex items-center text-[12.5px] font-medium tabular-nums ${className ?? ""}`}
      style={{ color: colorFor(tone) }}
    >
      {text}
    </span>
  );
}
