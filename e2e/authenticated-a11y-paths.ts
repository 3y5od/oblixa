import {
  GENERATED_AUTHENTICATED_CORE_A11Y_PATHS,
  GENERATED_AUTHENTICATED_UTILITY_A11Y_PATHS,
} from "@/lib/qa/generated-route-matrices";

/**
 * Tier 1 + Tier 2 routes for authenticated Axe (serious/critical) checks.
 * Also drives narrow-viewport document overflow checks except paths in
 * {@link AUTHENTICATED_VIEWPORT_OVERFLOW_EXCLUDED} (heavy client viz).
 *
 * The source of truth now lives in the generated route matrices; this file remains
 * as a compatibility shim for existing specs and static checks.
 *
 * `/onboarding/calibration` is omitted by default: the fixture org is often not in blocking or
 * in-progress calibration. Set `E2E_ONBOARDING_A11Y=1` when CI seeds blocking/recalibration so the
 * path is included in the Axe and narrow-viewport matrices (see `getAuthenticatedA11yAndViewportPaths`).
 *
 * Utility / §10.4 surfaces (watchlists, intake, etc.): deep-linkable but gated for non-admin Core users —
 * see `assertCoreUtilitySurfaceOrRedirect` in `src/lib/product-surface/route-guard.ts` and E2E cmd-K checks
 * in `authenticated.spec.ts` (hidden modules not discoverable from the palette on Core).
 */
export const AUTHENTICATED_A11Y_AND_VIEWPORT_PATHS = [
  ...GENERATED_AUTHENTICATED_CORE_A11Y_PATHS,
] as const;

export type AuthenticatedA11yPath = (typeof AUTHENTICATED_A11Y_AND_VIEWPORT_PATHS)[number];

/** Base matrix plus refinement utility paths (deduped), optional `/onboarding/calibration`. */
export function getAuthenticatedA11yAndViewportPaths(): string[] {
  const paths: string[] = [
    ...new Set<string>([
      ...AUTHENTICATED_A11Y_AND_VIEWPORT_PATHS,
      ...REFINEMENT_S10_4_UTILITY_PATHS,
    ]),
  ];
  const onboardingA11y =
    process.env.E2E_ONBOARDING_A11Y === "1" || process.env.E2E_ONBOARDING_A11Y === "true";
  if (onboardingA11y) paths.push("/onboarding/calibration");
  return paths;
}

/** product-surface policy §10.4 — admin-deep utility surfaces (Axe matrix may skip 403). */
export const REFINEMENT_S10_4_UTILITY_PATHS = [...GENERATED_AUTHENTICATED_UTILITY_A11Y_PATHS] as const;

/** Excluded from 390×844 document-width check — wide client-only graph may scroll inside shell. */
export const AUTHENTICATED_VIEWPORT_OVERFLOW_EXCLUDED: ReadonlySet<string> = new Set([
  "/contracts/execution-graph",
]);
