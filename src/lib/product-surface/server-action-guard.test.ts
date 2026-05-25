import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthContext = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getAuthContext: () => getAuthContext(),
}));

const buildProductSurfaceContext = vi.fn();
vi.mock("@/lib/product-surface/context", () => ({
  buildProductSurfaceContext: (...args: unknown[]) => buildProductSurfaceContext(...args),
}));

const evaluateFeatureEligibility = vi.fn();
vi.mock("@/lib/product-surface/eligibility", () => ({
  evaluateFeatureEligibility: (...args: unknown[]) => evaluateFeatureEligibility(...args),
}));

const featureRegistryByKey = vi.fn();
vi.mock("@/lib/product-surface/feature-registry", () => ({
  featureRegistryByKey: () => featureRegistryByKey(),
}));

const logProductSurfaceDiagnostic = vi.fn();
vi.mock("@/lib/product-surface/dev-diagnostics", () => ({
  logProductSurfaceDiagnostic: (...args: unknown[]) => logProductSurfaceDiagnostic(...args),
}));

const getFeatureFlags = vi.fn();
vi.mock("@/lib/feature-flags", () => ({
  getFeatureFlags: () => getFeatureFlags(),
}));

const getOrgSettingsJson = vi.fn();
vi.mock("@/lib/assurance/org-settings", () => ({
  getOrgSettingsJson: (...args: unknown[]) => getOrgSettingsJson(...args),
}));

describe("requireServerActionEligibility", () => {
  beforeEach(() => {
    getAuthContext.mockReset();
    buildProductSurfaceContext.mockReset();
    evaluateFeatureEligibility.mockReset();
    featureRegistryByKey.mockReset();
    logProductSurfaceDiagnostic.mockReset();
    getFeatureFlags.mockReset();
    getOrgSettingsJson.mockReset();
  });

  it("fails closed for unauthenticated callers", async () => {
    getAuthContext.mockResolvedValue(null);
    const { requireServerActionEligibility } = await import("@/lib/product-surface/server-action-guard");
    await expect(
      requireServerActionEligibility({
        actionId: "src/actions/contracts.ts:createContract",
        featureFamily: "contracts",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        denialClass: "unauthenticated",
      })
    );
  });

  it("fails closed and logs when feature family is missing", async () => {
    getAuthContext.mockResolvedValue({ admin: {}, orgId: "org_1", role: "admin" });
    featureRegistryByKey.mockReturnValue(new Map());
    const { requireServerActionEligibility } = await import("@/lib/product-surface/server-action-guard");
    await expect(
      requireServerActionEligibility({
        actionId: "src/actions/contracts.ts:createContract",
        featureFamily: "contracts",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        denialClass: "registry_missing_or_mapping_missing",
      })
    );
    expect(logProductSurfaceDiagnostic).toHaveBeenCalledWith(
      "surface_mapping_missing",
      expect.objectContaining({
        surfaceType: "server_action",
      })
    );
  });

  it("returns allow for eligible mapped features", async () => {
    const auth = { admin: {}, orgId: "org_1", role: "admin" };
    getAuthContext.mockResolvedValue(auth);
    featureRegistryByKey.mockReturnValue(new Map([["contracts", { key: "contracts" }]]));
    getOrgSettingsJson.mockResolvedValue({});
    getFeatureFlags.mockReturnValue({});
    buildProductSurfaceContext.mockReturnValue({ mode: "advanced", role: "admin" });
    evaluateFeatureEligibility.mockReturnValue({ allowed: true });

    const { requireServerActionEligibility } = await import("@/lib/product-surface/server-action-guard");
    await expect(
      requireServerActionEligibility({
        actionId: "src/actions/contracts.ts:createContract",
        featureFamily: "contracts",
      })
    ).resolves.toEqual({
      ok: true,
      auth,
    });
  });

  it("returns denial payload and diagnostic details when mapped action is ineligible", async () => {
    const auth = { admin: {}, orgId: "org_1", role: "editor" };
    getAuthContext.mockResolvedValue(auth);
    featureRegistryByKey.mockReturnValue(new Map([["decisions", { key: "decisions" }]]));
    getOrgSettingsJson.mockResolvedValue({});
    getFeatureFlags.mockReturnValue({});
    buildProductSurfaceContext.mockReturnValue({ mode: "core", role: "editor" });
    evaluateFeatureEligibility.mockReturnValue({
      allowed: false,
      denialClass: "insufficient_workspace_mode",
      reason: "workspace_mode_ineligible",
      discoverability: "suppressed",
    });

    const { requireServerActionEligibility } = await import("@/lib/product-surface/server-action-guard");
    await expect(
      requireServerActionEligibility({
        actionId: "src/actions/decisions.ts:createDecision",
        featureFamily: "decisions",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        denialClass: "insufficient_workspace_mode",
        reason: "workspace_mode_ineligible",
      })
    );
    expect(logProductSurfaceDiagnostic).toHaveBeenCalledWith(
      "server_action_eligibility_denied",
      expect.objectContaining({
        featureFamily: "decisions",
        denialClass: "insufficient_workspace_mode",
      })
    );
  });
});
