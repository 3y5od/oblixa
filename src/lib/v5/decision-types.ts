/**
 * Canonical V5 decision workspace types (strategy spec §9.1, backlog Slice A).
 * `renewal_recommendation` is retained for backward compatibility with early V5 drafts.
 */
export const DECISION_TYPES = [
  "renewal",
  "renewal_recommendation",
  "amendment_request",
  "waiver_exception",
  "obligation_extension",
  "ownership_transfer",
  "policy_exception",
  "termination",
  "remediation_acceptance",
] as const;

export type DecisionType = (typeof DECISION_TYPES)[number];

export const DECISION_TYPE_LABELS: Record<DecisionType, string> = {
  renewal: "Renewal",
  renewal_recommendation: "Renewal (legacy label)",
  amendment_request: "Amendment",
  waiver_exception: "Waiver / exception",
  obligation_extension: "Obligation extension",
  ownership_transfer: "Ownership transfer",
  policy_exception: "Policy exception",
  termination: "Termination",
  remediation_acceptance: "Remediation acceptance",
};

export function isValidDecisionType(value: string): value is DecisionType {
  return (DECISION_TYPES as readonly string[]).includes(value);
}

export function decisionTypeValidationError(): string {
  return `Invalid decisionType. Allowed values: ${DECISION_TYPES.join(", ")}`;
}

/** Merge partial required inputs into existing object (shallow keys). */
export function mergeRequiredInputs(
  existing: unknown,
  patch: Record<string, unknown> | undefined
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  if (!patch || typeof patch !== "object") return base;
  return { ...base, ...patch };
}
