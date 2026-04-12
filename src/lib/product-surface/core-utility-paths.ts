/**
 * docs/refinement.md §10.4 — secondary/utility routes (not primary narrative on Core).
 * Shared by nav/cmd-K hiding and default landing validation.
 */
export const REFINEMENT_CORE_UTILITY_PREFIXES: readonly string[] = [
  "/contracts/analytics",
  "/contracts/maintenance",
  "/contracts/intake",
  "/contracts/data-quality",
  "/contracts/review-cadence",
  "/contracts/watchlists",
  "/contracts/collaboration",
  "/contracts/execution-graph",
  "/contracts/approvals/workload",
  "/contracts/approvals/sla-simulator",
];

/** True when path is a §10.4 utility (prefix match). */
export function isRefinementCoreUtilityPath(pathname: string): boolean {
  const p = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  return REFINEMENT_CORE_UTILITY_PREFIXES.some((u) => p === u || p.startsWith(`${u}/`));
}
