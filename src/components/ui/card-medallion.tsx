import type { ReactNode } from "react";

export type CardMedallionTone = "accent" | "danger";

/**
 * 32px tone-tinted square medallion used at the head of settings cards.
 * Shared so card headers stay normalized across security, billing, and
 * notification surfaces (one medallion shell, not a per-file copy).
 */
export function CardMedallion({
  children,
  tone = "accent",
}: {
  children: ReactNode;
  tone?: CardMedallionTone;
}) {
  const toneCls =
    tone === "danger"
      ? "border-[color:color-mix(in_oklab,var(--danger-ink)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger-soft)_30%,var(--surface-raised))] text-[var(--danger-ink)]"
      : "border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)]";
  return (
    <span
      aria-hidden
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${toneCls} shadow-[var(--shadow-1)]`}
    >
      {children}
    </span>
  );
}
