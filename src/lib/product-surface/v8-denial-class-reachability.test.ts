import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { ProductSurfaceContext } from "@/lib/product-surface/context";
import {
  evaluateFeatureEligibility,
  type V8EligibilityDenialClass,
} from "@/lib/product-surface/eligibility";
import * as featureRegistryModule from "@/lib/product-surface/feature-registry";
import type { FeatureFamilyKey, ProductFeatureDef } from "@/lib/product-surface/feature-registry";
import { statusForEligibilityDenial, v8DenialStatusMatrix } from "@/lib/product-surface/v8-denial-status";

const ALL_DENIAL_CLASSES: V8EligibilityDenialClass[] = [
  "unauthenticated",
  "unauthorized_role",
  "insufficient_workspace_mode",
  "hidden_by_module_config",
  "retired_feature",
  "experimental_deep_link_only_suppression",
  "registry_missing_or_mapping_missing",
  "org_context_unresolved",
];

function baseCtx(over: Partial<ProductSurfaceContext> = {}): ProductSurfaceContext {
  return {
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
    ...over,
  };
}

describe("v8 denial status matrix vs eligibility classes", () => {
  it("includes every V8EligibilityDenialClass with a stable HTTP mapping", () => {
    const matrix = v8DenialStatusMatrix();
    for (const c of ALL_DENIAL_CLASSES) {
      expect([401, 403, 404] as const).toContain(matrix[c]);
      expect(statusForEligibilityDenial(c)).toBe(matrix[c]);
    }
  });
});

describe("evaluateFeatureEligibility produces each denial class", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("unauthenticated", () => {
    expect(
      evaluateFeatureEligibility(baseCtx(), "contracts", { authState: "unauthenticated" }).denialClass
    ).toBe("unauthenticated");
  });

  it("org_context_unresolved", () => {
    expect(evaluateFeatureEligibility(baseCtx({ orgId: "" }), "contracts").denialClass).toBe(
      "org_context_unresolved"
    );
  });

  it("registry_missing_or_mapping_missing", () => {
    expect(
      evaluateFeatureEligibility(baseCtx(), "not_a_registry_key" as unknown as FeatureFamilyKey).denialClass
    ).toBe("registry_missing_or_mapping_missing");
  });

  it("insufficient_workspace_mode", () => {
    expect(evaluateFeatureEligibility(baseCtx(), "decisions").denialClass).toBe(
      "insufficient_workspace_mode"
    );
  });

  it("hidden_by_module_config (utility module)", () => {
    expect(
      evaluateFeatureEligibility(
        baseCtx({ utilityModulesHidden: new Set(["intake"]) }),
        "intake"
      ).denialClass
    ).toBe("hidden_by_module_config");
  });

  it("hidden_by_module_config (advanced module)", () => {
    const ctx = baseCtx({
      mode: "advanced",
      workspaceMode: "advanced",
      v6: { workspace_mode: "advanced" },
      seesAdvancedPrimaryNav: true,
      advancedModulesHidden: new Set(["decisions"]),
    });
    expect(evaluateFeatureEligibility(ctx, "decisions").denialClass).toBe("hidden_by_module_config");
  });

  it("unauthorized_role (synthetic admin_only lifecycle row)", () => {
    const real = featureRegistryModule.featureRegistryByKey();
    const contracts = real.get("contracts")!;
    const synthetic: ProductFeatureDef = { ...contracts, lifecycle: "admin_only" };
    vi.spyOn(featureRegistryModule, "featureRegistryByKey").mockImplementation(() => {
      const m = new Map(real);
      m.set("contracts", synthetic);
      return m;
    });
    expect(evaluateFeatureEligibility(baseCtx({ role: "viewer" }), "contracts").denialClass).toBe(
      "unauthorized_role"
    );
  });

  it("retired_feature (synthetic retired_hidden lifecycle row)", () => {
    const real = featureRegistryModule.featureRegistryByKey();
    const contracts = real.get("contracts")!;
    const synthetic: ProductFeatureDef = {
      ...contracts,
      lifecycle: "retired_hidden",
      defaultFeatureState: "primary",
    };
    vi.spyOn(featureRegistryModule, "featureRegistryByKey").mockImplementation(() => {
      const m = new Map(real);
      m.set("contracts", synthetic);
      return m;
    });
    expect(evaluateFeatureEligibility(baseCtx(), "contracts").denialClass).toBe("retired_feature");
  });

  it("experimental_deep_link_only_suppression (synthetic experimental lifecycle row)", () => {
    const real = featureRegistryModule.featureRegistryByKey();
    const contracts = real.get("contracts")!;
    const synthetic: ProductFeatureDef = { ...contracts, lifecycle: "experimental" };
    vi.spyOn(featureRegistryModule, "featureRegistryByKey").mockImplementation(() => {
      const m = new Map(real);
      m.set("contracts", synthetic);
      return m;
    });
    expect(evaluateFeatureEligibility(baseCtx({ role: "viewer" }), "contracts").denialClass).toBe(
      "experimental_deep_link_only_suppression"
    );
  });
});
