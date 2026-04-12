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
    "border-l-[0.35rem] border-l-emerald-500 bg-emerald-50/40 shadow-[var(--shadow-1)] dark:bg-emerald-950/15",
  neutral: "border-l-[0.35rem] border-l-zinc-400 bg-surface shadow-[var(--shadow-1)]",
  attention:
    "border-l-[0.35rem] border-l-amber-500 bg-amber-50/45 shadow-[var(--shadow-1)] dark:bg-amber-950/20",
  risk: "border-l-[0.35rem] border-l-rose-600 bg-rose-50/45 shadow-[var(--shadow-1)] dark:bg-rose-950/20",
};

export const OPERATIONAL_ICON_WRAP_BY_TONE: Record<OperationalTone, string> = {
  healthy: "bg-emerald-100/90 text-emerald-900 ring-1 ring-emerald-200/80",
  neutral: "bg-zinc-100/90 text-zinc-700 ring-1 ring-zinc-200/80",
  attention: "bg-amber-100/90 text-amber-950 ring-1 ring-amber-200/80",
  risk: "bg-rose-100/90 text-rose-950 ring-1 ring-rose-200/80",
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
