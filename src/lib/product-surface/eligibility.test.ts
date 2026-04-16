import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { buildProductSurfaceContext } from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";

const noFlags = {} as Record<FeatureFlagKey, boolean>;

describe("evaluateFeatureEligibility", () => {
  it("suppresses advanced features for core mode", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "editor",
      v6: { workspace_mode: "core" },
      featureFlags: noFlags,
    });
    const out = evaluateFeatureEligibility(ctx, "decisions");
    expect(out.allowed).toBe(false);
    expect(out.discoverability).toBe("suppressed");
  });

  it("marks utility as context_only", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "admin",
      v6: { workspace_mode: "core" },
      featureFlags: noFlags,
    });
    const out = evaluateFeatureEligibility(ctx, "more_tools");
    expect(out.allowed).toBe(true);
    expect(out.discoverability).toBe("context_only");
  });

  it("respects hidden assurance module settings", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "manager",
      v6: { workspace_mode: "assurance", assurance_modules_hidden: ["autopilot"] },
      featureFlags: noFlags,
    });
    const out = evaluateFeatureEligibility(ctx, "autopilot");
    expect(out.allowed).toBe(false);
    expect(out.reason).toBe("module_hidden");
  });

  it("suppresses utility features when utility module is hidden", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "editor",
      v6: { workspace_mode: "core", utility_modules_hidden: ["intake"] },
      featureFlags: noFlags,
    });
    const out = evaluateFeatureEligibility(ctx, "intake");
    expect(out.allowed).toBe(false);
    expect(out.reason).toBe("utility_module_hidden");
  });

  it("allows admin bypass for hidden utility modules", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "admin",
      v6: { workspace_mode: "core", utility_modules_hidden: ["intake"] },
      featureFlags: noFlags,
    });
    const out = evaluateFeatureEligibility(ctx, "intake");
    expect(out.allowed).toBe(true);
    expect(out.discoverability).toBe("admin_only");
  });

  it("suppresses other hidden utility modules for non-admins", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "viewer",
      v6: { workspace_mode: "core", utility_modules_hidden: ["watchlists", "more_tools"] },
      featureFlags: noFlags,
    });
    expect(evaluateFeatureEligibility(ctx, "watchlists").allowed).toBe(false);
    expect(evaluateFeatureEligibility(ctx, "more_tools").allowed).toBe(false);
  });

  it("allows admin bypass for hidden utility module rows with specific keys", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "admin",
      v6: { workspace_mode: "core", utility_modules_hidden: ["data_quality"] },
      featureFlags: noFlags,
    });
    const out = evaluateFeatureEligibility(ctx, "data_quality");
    expect(out.allowed).toBe(true);
    expect(out.discoverability).toBe("admin_only");
  });

  it("respects hidden advanced analytics module", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "editor",
      v6: { workspace_mode: "advanced", advanced_modules_hidden: ["analytics"] },
      featureFlags: noFlags,
    });
    const out = evaluateFeatureEligibility(ctx, "advanced_analytics");
    expect(out.allowed).toBe(false);
    expect(out.reason).toBe("module_hidden");
  });

  it("returns unauthenticated denial class when auth state indicates no session", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "viewer",
      v6: { workspace_mode: "core" },
      featureFlags: noFlags,
    });
    const out = evaluateFeatureEligibility(ctx, "contracts", {
      surfaceType: "api",
      surfaceIdentifier: "/api/contracts",
      authState: "unauthenticated",
    });
    expect(out.allowed).toBe(false);
    expect(out.denialClass).toBe("unauthenticated");
  });

  it("returns org_context_unresolved when org context is missing", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "viewer",
      v6: { workspace_mode: "core" },
      featureFlags: noFlags,
    });
    const out = evaluateFeatureEligibility(
      {
        ...ctx,
        orgId: "",
      },
      "contracts",
      {
        surfaceType: "page",
        surfaceIdentifier: "/contracts",
      }
    );
    expect(out.allowed).toBe(false);
    expect(out.denialClass).toBe("org_context_unresolved");
  });
});
