import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import { buildProductSurfaceContext } from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import {
  PRODUCT_FEATURE_REGISTRY,
  type FeatureFamilyKey,
} from "@/lib/product-surface/feature-registry";

const noFlags = {} as Record<FeatureFlagKey, boolean>;

function makeCtx(mode: WorkspaceProductMode, role: "editor" | "viewer" | "admin" = "editor") {
  return buildProductSurfaceContext({
    orgId: "org-v8-matrix",
    role,
    v6: { workspace_mode: mode },
    featureFlags: noFlags,
  });
}

/** Mode strictly below `min` for V8 denial testing. */
function modeBelow(min: WorkspaceProductMode): WorkspaceProductMode | null {
  if (min === "core") return null;
  if (min === "advanced") return "core";
  return "advanced";
}

describe("v8 acceptance matrix per feature family", () => {
  for (const def of PRODUCT_FEATURE_REGISTRY) {
    const key = def.key;

    it(`${key}: allowed at min workspace mode (page surface)`, () => {
      const ctx = makeCtx(def.minWorkspaceMode);
      const r = evaluateFeatureEligibility(ctx, key, {
        surfaceType: "page",
        surfaceIdentifier: `/${key}`,
      });
      expect(r.allowed).toBe(true);
    });

    it(`${key}: denied for unauthenticated when minMode is core`, () => {
      if (def.minWorkspaceMode !== "core") return;
      const ctx = makeCtx("core");
      const r = evaluateFeatureEligibility(ctx, key, {
        surfaceType: "page",
        authState: "unauthenticated",
      });
      expect(r.allowed).toBe(false);
      expect(r.denialClass).toBe("unauthenticated");
    });

    it(`${key}: denied below min workspace mode for non-admin`, () => {
      const below = modeBelow(def.minWorkspaceMode);
      if (below === null) return;
      const ctx = makeCtx(below, "editor");
      const r = evaluateFeatureEligibility(ctx, key, { surfaceType: "page" });
      expect(r.allowed).toBe(false);
      expect(r.denialClass).toBe("insufficient_workspace_mode");
    });

    it(`${key}: api surfaceType preserves allow at min mode`, () => {
      const ctx = makeCtx(def.minWorkspaceMode);
      const r = evaluateFeatureEligibility(ctx, key, {
        surfaceType: "api",
        surfaceIdentifier: "/api/…",
      });
      expect(r.allowed).toBe(true);
    });

    it(`${key}: server_action surfaceType preserves allow at min mode`, () => {
      const ctx = makeCtx(def.minWorkspaceMode);
      const r = evaluateFeatureEligibility(ctx, key, {
        surfaceType: "server_action",
        surfaceIdentifier: "actions/foo.ts:bar",
      });
      expect(r.allowed).toBe(true);
    });
  }

  it("unknown registry key yields registry_missing_or_mapping_missing", () => {
    const ctx = makeCtx("assurance");
    const bad = evaluateFeatureEligibility(ctx, "not_a_real_feature_key" as FeatureFamilyKey, {
      surfaceType: "page",
    });
    expect(bad.allowed).toBe(false);
    expect(bad.denialClass).toBe("registry_missing_or_mapping_missing");
  });
});
