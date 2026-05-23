import type { ReactNode } from "react";

export type StatTone = "neutral" | "success" | "warning" | "danger";

export function statToneDot(tone: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  return "color-mix(in oklab, var(--border-strong) 70%, var(--text-tertiary))";
}

export function statToneHalo(tone: StatTone): string {
  if (tone === "success") return "var(--success-soft)";
  if (tone === "danger") return "var(--danger-soft)";
  if (tone === "warning") return "var(--warning-soft)";
  return "var(--surface-contrast)";
}

export function statToneRail(tone: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  if (tone === "warning") return "color-mix(in oklab, var(--warning-ink) 86%, var(--text-primary))";
  return "color-mix(in oklab, var(--border-strong) 60%, transparent)";
}

export function statToneNumberColor(tone: StatTone, isZero: boolean): string {
  if (isZero) return "var(--text-secondary)";
  if (tone === "danger") return "var(--danger-ink)";
  if (tone === "warning") return "color-mix(in oklab, var(--warning-ink) 86%, var(--text-primary))";
  if (tone === "success") return "var(--success-ink)";
  return "var(--text-primary)";
}

export function statToneSrLabel(tone: StatTone): string {
  if (tone === "success") return "Healthy";
  if (tone === "warning") return "Attention needed";
  if (tone === "danger") return "Critical";
  return "";
}

export function toneForCount(
  value: number,
  opts: { warningAt: number; dangerAt: number }
): StatTone {
  if (value <= 0) return "neutral";
  if (value >= opts.dangerAt) return "danger";
  if (value >= opts.warningAt) return "warning";
  return "neutral";
}

export function StatCell({
  label,
  display,
  isZero,
  tone,
  context,
}: {
  label: string;
  display: string;
  isZero: boolean;
  tone: StatTone;
  context: ReactNode;
}) {
  const srTone = statToneSrLabel(tone);
  return (
    <div
      className="rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] px-4 py-3"
      style={{
        boxShadow: "inset 0 1px 0 0 color-mix(in oklab, white 6%, transparent)",
      }}
    >
      <p className="text-[9.5px] font-medium uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
        {label}
        {srTone ? <span className="sr-only"> — {srTone}</span> : null}
      </p>
      <p
        className="mt-2 text-[2.25rem] font-semibold leading-[0.9] tabular-nums tracking-[-0.02em]"
        style={{
          color: statToneNumberColor(tone, isZero),
          animation: "ui-stat-value-enter 320ms var(--ui-ease-out, ease-out)",
        }}
        aria-label={`${label}: ${display}`}
      >
        <span aria-hidden="true">{display}</span>
      </p>
      <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] text-[var(--text-secondary)]">
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: statToneDot(tone) }}
        />
        {context}
      </div>
    </div>
  );
}
