import type { ProductSurfaceContext } from "@/lib/product-surface/context";
import {
  featureRegistryByKey,
  type FeatureFamilyKey,
  type ProductFeatureDef,
  workspaceModeAtLeast,
} from "@/lib/product-surface/feature-registry";
import type { UtilityModuleKey } from "@/lib/product-surface/types";

export type FeatureDiscoverability =
  | "direct"
  | "context_only"
  | "deep_link_only"
  | "admin_only"
  | "suppressed";

export type FeatureEligibility = {
  allowed: boolean;
  discoverability: FeatureDiscoverability;
  reason: string | null;
  definition: ProductFeatureDef;
};

function adminBypass(ctx: ProductSurfaceContext): boolean {
  return ctx.role === "admin";
}

const UTILITY_FEATURE_KEYS = new Set<FeatureFamilyKey>([
  "intake",
  "data_quality",
  "review_cadence",
  "watchlists",
  "execution_graph",
  "approval_workload",
  "approval_sla_simulator",
  "more_tools",
]);

function isUtilityFeatureHidden(ctx: ProductSurfaceContext, featureKey: FeatureFamilyKey): boolean {
  if (!UTILITY_FEATURE_KEYS.has(featureKey)) return false;
  return ctx.utilityModulesHidden.has(featureKey as UtilityModuleKey);
}

function isAdvancedModuleRowHidden(ctx: ProductSurfaceContext, def: ProductFeatureDef): boolean {
  if (!def.advancedModuleKey) return false;
  return ctx.advancedModulesHidden.has(def.advancedModuleKey);
}

function isAssuranceModuleRowHidden(ctx: ProductSurfaceContext, def: ProductFeatureDef): boolean {
  if (!def.assuranceModuleKey) return false;
  return ctx.assuranceModulesHidden.has(def.assuranceModuleKey);
}

export function evaluateFeatureEligibility(
  ctx: ProductSurfaceContext,
  featureKey: FeatureFamilyKey
): FeatureEligibility {
  const def = featureRegistryByKey().get(featureKey);
  if (!def) {
    throw new Error(`Unknown feature key: ${featureKey}`);
  }

  if (def.lifecycle === "retired_hidden" || def.defaultFeatureState === "disabled") {
    return { allowed: false, discoverability: "suppressed", reason: "disabled_or_retired_hidden", definition: def };
  }

  if (!workspaceModeAtLeast(ctx.mode, def.minWorkspaceMode)) {
    if (def.adminRevealAllowed && adminBypass(ctx)) {
      return { allowed: true, discoverability: "admin_only", reason: "admin_bypass", definition: def };
    }
    return { allowed: false, discoverability: "suppressed", reason: "workspace_mode_ineligible", definition: def };
  }

  if (isUtilityFeatureHidden(ctx, featureKey)) {
    if (def.adminRevealAllowed && adminBypass(ctx)) {
      return { allowed: true, discoverability: "admin_only", reason: "admin_hidden_bypass", definition: def };
    }
    return { allowed: false, discoverability: "suppressed", reason: "utility_module_hidden", definition: def };
  }

  if (isAdvancedModuleRowHidden(ctx, def) || isAssuranceModuleRowHidden(ctx, def)) {
    if (def.adminRevealAllowed && adminBypass(ctx)) {
      return { allowed: true, discoverability: "admin_only", reason: "admin_hidden_bypass", definition: def };
    }
    return { allowed: false, discoverability: "suppressed", reason: "module_hidden", definition: def };
  }

  if (def.lifecycle === "admin_only" && !adminBypass(ctx)) {
    return { allowed: false, discoverability: "suppressed", reason: "admin_only", definition: def };
  }

  if (def.lifecycle === "experimental" && !adminBypass(ctx)) {
    return { allowed: false, discoverability: "deep_link_only", reason: "experimental", definition: def };
  }

  if (def.contextualEntryAllowed && !def.topLevelNavAllowed && def.deepLinkAllowed) {
    return { allowed: true, discoverability: "context_only", reason: null, definition: def };
  }

  if (!def.contextualEntryAllowed && def.deepLinkAllowed) {
    return { allowed: true, discoverability: "deep_link_only", reason: null, definition: def };
  }

  return { allowed: true, discoverability: "direct", reason: null, definition: def };
}
