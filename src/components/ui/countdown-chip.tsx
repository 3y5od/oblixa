import { differenceInDays, format, isValid } from "date-fns";
import type { StatTone } from "@/components/ui/stat-cell";

export interface CountdownChipProps {
  date: Date | string;
  label?: string;
  /** Custom tone override; otherwise derived from urgency. */
  tone?: StatTone;
  className?: string;
  ariaLabel?: string;
}

function urgencyTone(daysUntil: number): StatTone {
  if (daysUntil < 0) return "danger";
  if (daysUntil <= 14) return "danger";
  if (daysUntil <= 30) return "warning";
  if (daysUntil <= 60) return "neutral";
  return "neutral";
}

function toneClasses(tone: StatTone): string {
  if (tone === "danger") {
    return "border-[color:color-mix(in_oklab,var(--danger-soft)_55%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger-soft)_28%,var(--surface-raised))] text-[var(--danger-ink)]";
  }
  if (tone === "warning") {
    return "border-[color:color-mix(in_oklab,var(--warning-soft)_55%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_28%,var(--surface-raised))] text-[var(--warning-ink)]";
  }
  if (tone === "success") {
    return "border-[color:color-mix(in_oklab,var(--success-soft)_55%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_28%,var(--surface-raised))] text-[var(--success-ink)]";
  }
  return "border-[var(--border-card)] bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--surface-raised))] text-[var(--text-secondary)]";
}

export function CountdownChip({
  date,
  label,
  tone: toneOverride,
  className,
  ariaLabel,
}: CountdownChipProps) {
  const d = date instanceof Date ? date : new Date(date);
  if (!isValid(d)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-card)] bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--surface-raised))] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        —
      </span>
    );
  }
  const daysUntil = differenceInDays(d, new Date());
  const tone = toneOverride ?? urgencyTone(daysUntil);
  const dateLabel = format(d, "MMM d");
  const relativeLabel =
    daysUntil < 0
      ? `${Math.abs(daysUntil)}d overdue`
      : daysUntil === 0
        ? "today"
        : `${daysUntil}d`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${toneClasses(tone)} ${className ?? ""}`.trim()}
      aria-label={ariaLabel ?? `${label ?? "Due"} ${dateLabel}, ${relativeLabel}`}
      title={`${label ? `${label} · ` : ""}${format(d, "MMM d, yyyy")} · ${relativeLabel}`}
    >
      {label ? <span>{label}</span> : null}
      <span className="tabular-nums">{relativeLabel}</span>
      <span aria-hidden className="text-[var(--text-tertiary)]">
        ·
      </span>
      <span className="text-[var(--text-tertiary)] normal-case tracking-normal">
        {dateLabel}
      </span>
    </span>
  );
}
