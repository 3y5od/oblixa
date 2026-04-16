/**
 * Shared semantic tones for operational summary surfaces (dashboard signals,
 * metric strips, queue cards). Keeps control-room data and UI aligned.
 *
 * docs/refinement.md §15.4 — queue/state chrome: map operational facts to `OperationalTone`, then to shells/chips
 * (`semanticStatusToOperationalTone` in `operational-summary-card.tsx` bridges `SemanticStatus` → tone).
 */
export type OperationalTone = "healthy" | "neutral" | "attention" | "risk";

export const OPERATIONAL_SHELL_BY_TONE: Record<OperationalTone, string> = {
  healthy:
    "border-l-[0.35rem] border-l-[color:var(--success-ink)] bg-[color:color-mix(in_oklab,var(--success-soft)_76%,transparent)] shadow-[var(--shadow-1)]",
  neutral:
    "border-l-[0.35rem] border-l-[color:color-mix(in_oklab,var(--border-contrast)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface)_88%,white)] shadow-[var(--shadow-1)]",
  attention:
    "border-l-[0.35rem] border-l-[color:var(--warning-ink)] bg-[color:color-mix(in_oklab,var(--warning-soft)_76%,transparent)] shadow-[var(--shadow-1)]",
  risk:
    "border-l-[0.35rem] border-l-[color:var(--danger-ink)] bg-[color:color-mix(in_oklab,var(--danger-soft)_74%,transparent)] shadow-[var(--shadow-1)]",
};

export const OPERATIONAL_ICON_WRAP_BY_TONE: Record<OperationalTone, string> = {
  healthy:
    "bg-[color:color-mix(in_oklab,var(--success-soft)_64%,white)] text-[color:var(--success-ink)] ring-1 ring-[color:color-mix(in_oklab,var(--success-soft)_42%,transparent)]",
  neutral:
    "bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,white)] text-[color:var(--text-secondary)] ring-1 ring-[color:color-mix(in_oklab,var(--border-subtle)_86%,transparent)]",
  attention:
    "bg-[color:color-mix(in_oklab,var(--warning-soft)_62%,white)] text-[color:var(--warning-ink)] ring-1 ring-[color:color-mix(in_oklab,var(--warning-soft)_42%,transparent)]",
  risk:
    "bg-[color:color-mix(in_oklab,var(--danger-soft)_62%,white)] text-[color:var(--danger-ink)] ring-1 ring-[color:color-mix(in_oklab,var(--danger-soft)_42%,transparent)]",
};

/** Portfolio / report signal severities → operational chrome */
export function operationalToneFromSignalSeverity(
  severity: "high" | "medium" | "low",
  value: number
): OperationalTone {
  if (value === 0) return "healthy";
  if (severity === "high") return "risk";
  if (severity === "medium") return "attention";
  return "neutral";
}
