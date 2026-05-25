import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { WorkspaceRole } from "@/lib/navigation";
import type { ProductSurfaceContext } from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";

const flags = {} as Record<FeatureFlagKey, boolean>;

function ctxForRole(
  mode: ProductSurfaceContext["mode"],
  role: WorkspaceRole,
  over: Partial<ProductSurfaceContext> = {}
): ProductSurfaceContext {
  return {
    orgId: "org-1",
    workspaceMode: mode,
    mode,
    v6: { workspace_mode: mode },
    featureFlags: flags,
    role,
    isAdmin: role === "admin",
    seesAdvancedPrimaryNav: mode !== "core",
    seesAssuranceNav: mode === "assurance",
    assuranceNavAdminTesting: false,
    advancedModulesHidden: new Set(),
    assuranceModulesHidden: new Set(),
    utilityModulesHidden: new Set(),
    defaultLandingPath: null,
    searchScope: "match_mode",
    autopilotAllowExecution: false,
    ...over,
  };
}

describe("workspace role vs denial class (§10.3)", () => {
  it("uses insufficient_workspace_mode when mode is the gate (non-admin; admin may bypass)", () => {
    const roles: WorkspaceRole[] = ["viewer", "editor", "manager", "ops_manager"];
    for (const role of roles) {
      expect(evaluateFeatureEligibility(ctxForRole("core", role), "decisions").denialClass).toBe(
        "insufficient_workspace_mode"
      );
    }
    const adminOnCore = evaluateFeatureEligibility(ctxForRole("core", "admin"), "decisions");
    expect(adminOnCore.allowed).toBe(true);
    expect(adminOnCore.denialClass).toBeNull();
  });

  it("allows advanced feature for viewer when workspace mode satisfies the registry", () => {
    const r = evaluateFeatureEligibility(ctxForRole("advanced", "viewer"), "decisions");
    expect(r.allowed).toBe(true);
    expect(r.denialClass).toBeNull();
  });
});
