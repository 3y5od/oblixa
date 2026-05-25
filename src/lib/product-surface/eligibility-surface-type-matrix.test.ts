import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { ProductSurfaceContext } from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";

const flags = {} as Record<FeatureFlagKey, boolean>;

const ctx: ProductSurfaceContext = {
  orgId: "org-1",
  workspaceMode: "core",
  mode: "core",
  v6: { workspace_mode: "core" },
  featureFlags: flags,
  role: "viewer",
  isAdmin: false,
  seesAdvancedPrimaryNav: false,
  seesAssuranceNav: false,
  assuranceNavAdminTesting: false,
  advancedModulesHidden: new Set(),
  assuranceModulesHidden: new Set(),
  utilityModulesHidden: new Set(),
  defaultLandingPath: null,
  searchScope: "match_mode",
  autopilotAllowExecution: false,
};

describe("evaluateFeatureEligibility surfaceType matrix (§10.1)", () => {
  it("returns the same denial class for page vs api vs server_action when mode gates the feature", () => {
    const surfaces = ["page", "api", "server_action"] as const;
    const results = surfaces.map((surfaceType) =>
      evaluateFeatureEligibility(ctx, "decisions", {
        surfaceType,
        surfaceIdentifier: surfaceType === "page" ? "/decisions" : "decisions:noop",
      })
    );
    const d0 = results[0].denialClass;
    expect(results.every((r) => r.denialClass === d0)).toBe(true);
    expect(d0).toBe("insufficient_workspace_mode");
  });

  it("keeps contracts allowed across surface types on Core", () => {
    for (const surfaceType of ["page", "api", "server_action"] as const) {
      const r = evaluateFeatureEligibility(ctx, "contracts", {
        surfaceType,
        surfaceIdentifier: "x",
      });
      expect(r.allowed).toBe(true);
      expect(r.denialClass).toBeNull();
    }
  });
});
