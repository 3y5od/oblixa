import { describe, expect, it } from "vitest";
import { isRefinementCoreUtilityPath, REFINEMENT_CORE_UTILITY_PREFIXES } from "@/lib/product-surface/core-utility-paths";

/**
 * Layouts that re-export `contracts/utility-route-layout` (assertCoreUtilitySurfaceOrRedirect).
 * Keep in sync with layout files under `src/app/(dashboard)/contracts` that re-export that module.
 * `/contracts/analytics` shares the layout but is Advanced-gated by page eligibility, not §10.4 refinement list.
 */
const CONTRACTS_UTILITY_ROUTE_LAYOUT_PREFIXES = [
  "/contracts/analytics",
  "/contracts/approvals/sla-simulator",
  "/contracts/approvals/workload",
  "/contracts/collaboration",
  "/contracts/data-quality",
  "/contracts/execution-graph",
  "/contracts/intake",
  "/contracts/maintenance",
  "/contracts/review-cadence",
  "/contracts/watchlists",
] as const;

describe("§10.4 utility layout vs refinement core-utility prefixes", () => {
  it("every non-analytics utility-route-layout prefix is listed in REFINEMENT_CORE_UTILITY_PREFIXES", () => {
    for (const p of CONTRACTS_UTILITY_ROUTE_LAYOUT_PREFIXES) {
      if (p === "/contracts/analytics") continue;
      expect(
        REFINEMENT_CORE_UTILITY_PREFIXES.some((u) => p === u || p.startsWith(`${u}/`)),
        `${p} must appear in REFINEMENT_CORE_UTILITY_PREFIXES for nav/cmd-k/landing parity`
      ).toBe(true);
      expect(isRefinementCoreUtilityPath(p), `${p} must be detectable as refinement utility path`).toBe(true);
    }
  });

  it("analytics uses utility layout but is not a refinement utility path (Advanced surface)", () => {
    expect(isRefinementCoreUtilityPath("/contracts/analytics")).toBe(false);
  });

  it("REFINEMENT_CORE_UTILITY_PREFIXES entries are covered by a utility layout or nested under one", () => {
    for (const u of REFINEMENT_CORE_UTILITY_PREFIXES) {
      const covered = CONTRACTS_UTILITY_ROUTE_LAYOUT_PREFIXES.some(
        (layout) => u === layout || u.startsWith(`${layout}/`) || layout.startsWith(`${u}/`)
      );
      expect(covered, `REFINEMENT prefix ${u} should map to a contracts utility layout`).toBe(true);
    }
  });
});
