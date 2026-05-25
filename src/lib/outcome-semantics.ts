/**
 * Canonical labels for unknown / missing / partial / unresolved / mixed outcomes (V9 plan).
 * Surfaces should import these instead of inventing new wording.
 */
export const V9_OUTCOME_LABELS = {
  unknown: "Unknown",
  missing: "Missing",
  unresolved: "Unresolved",
  partial: "Partial",
  mixed: "Mixed results",
} as const;

export type V9OutcomeKind = keyof typeof V9_OUTCOME_LABELS;

export function v9OutcomeLabel(kind: V9OutcomeKind): string {
  return V9_OUTCOME_LABELS[kind];
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { V9_OUTCOME_LABELS as OUTCOME_LABELS };
export { v9OutcomeLabel as outcomeLabel };
export type { V9OutcomeKind as OutcomeKind };
// End version-name compatibility aliases.
