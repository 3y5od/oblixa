import type { ReactNode } from "react";
import type { StatTone } from "@/components/ui/stat-cell";

export type StatusPillTone = StatTone;

export function StatusPill({
  tone,
  srLabel,
  children,
}: {
  tone: StatusPillTone;
  srLabel?: string;
  children: ReactNode;
}) {
  const cls =
    tone === "success"
      ? "border-[color:color-mix(in_oklab,var(--success)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_28%,var(--surface-raised))] text-[var(--success-ink)]"
      : tone === "danger"
        ? "border-[color:color-mix(in_oklab,var(--danger)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger-soft)_28%,var(--surface-raised))] text-[var(--danger-ink)]"
        : tone === "warning"
          ? "border-[color:color-mix(in_oklab,var(--warning)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_30%,var(--surface-raised))] text-[var(--warning-ink)]"
          : "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--surface-raised))] text-[var(--text-tertiary)]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}
      aria-label={srLabel}
    >
      {children}
    </span>
  );
}
