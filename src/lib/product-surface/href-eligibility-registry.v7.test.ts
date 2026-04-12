import { describe, expect, it } from "vitest";
import { featureFamilyForPath, minWorkspaceModeForRegistryPath } from "@/lib/product-surface/feature-registry";

/** Mirrors href-eligibility.ts STRICT_DENY_PREFIXES — each must map to an advanced/assurance family (V7 §23.3). */
const STRICT_DENY_PREFIXES = [
  "/decisions",
  "/decisions/compare",
  "/campaigns",
  "/campaigns/compare",
  "/assurance",
  "/relationship-workspaces",
  "/accounts",
  "/counterparties",
  "/contracts/programs",
  "/contracts/maintenance",
  "/contracts/collaboration",
] as const;

describe("href-eligibility STRICT_DENY_PREFIXES vs feature registry", () => {
  for (const prefix of STRICT_DENY_PREFIXES) {
    it(`maps ${prefix} to a registry family with advanced-or-assurance floor`, () => {
      const ex = prefix.endsWith("/compare") ? prefix : `${prefix}/example`;
      const family = featureFamilyForPath(ex);
      expect(family, ex).not.toBeNull();
      const floor = minWorkspaceModeForRegistryPath(ex);
      expect(floor === "advanced" || floor === "assurance", `${ex} floor=${floor}`).toBe(true);
    });
  }
});
