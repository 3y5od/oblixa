import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { ProductSurfaceContext } from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";

const baseCtx: ProductSurfaceContext = {
  orgId: "org-1",
  workspaceMode: "core",
  mode: "core",
  v6: { workspace_mode: "core" },
  featureFlags: {} as Record<FeatureFlagKey, boolean>,
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

describe("evaluateFeatureEligibility output contract (§10.2)", () => {
  it("returns stable top-level fields for allow and deny paths", () => {
    const allowed = evaluateFeatureEligibility(baseCtx, "contracts");
    expect(allowed.allowed).toBe(true);
    expect(allowed).toMatchObject({
      allowed: expect.any(Boolean),
      discoverability: expect.any(String),
      reason: null,
      denialClass: null,
      resolvedDiscoverability: expect.any(String),
      telemetry: {
        featureKey: "contracts",
        mode: "core",
        role: "viewer",
        isAdmin: false,
        surfaceType: "page",
        surfaceIdentifier: "contracts",
      },
      definition: { key: "contracts" },
    });

    const denied = evaluateFeatureEligibility(baseCtx, "decisions");
    expect(denied.allowed).toBe(false);
    expect(denied.denialClass).toBe("insufficient_workspace_mode");
    expect(denied.telemetry.surfaceType).toBe("page");
    expect(denied.definition.key).toBe("decisions");
  });

  it("includes surfaceType and surfaceIdentifier from evaluation input", () => {
    const r = evaluateFeatureEligibility(baseCtx, "contracts", {
      surfaceType: "api",
      surfaceIdentifier: "/api/foo",
    });
    expect(r.telemetry.surfaceType).toBe("api");
    expect(r.telemetry.surfaceIdentifier).toBe("/api/foo");
  });
});
