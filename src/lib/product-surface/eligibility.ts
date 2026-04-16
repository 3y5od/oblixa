import type { ProductSurfaceContext } from "@/lib/product-surface/context";
import {
  featureRegistryByKey,
  type FeatureFamilyKey,
  type ProductFeatureDef,
  workspaceModeAtLeast,
} from "@/lib/product-surface/feature-registry";
import type { UtilityModuleKey } from "@/lib/product-surface/types";
import type { V8FeatureDiscoverability } from "@/lib/product-surface/feature-registry";
import type { V8SurfaceType } from "@/lib/product-surface/v8-surface-mapping";

export type FeatureDiscoverability =
  | "direct"
  | "context_only"
  | "deep_link_only"
  | "admin_only"
  | "suppressed";

export type V8EligibilityDenialClass =
  | "unauthenticated"
  | "unauthorized_role"
  | "insufficient_workspace_mode"
  | "hidden_by_module_config"
  | "retired_feature"
  | "experimental_deep_link_only_suppression"
  | "registry_missing_or_mapping_missing"
  | "org_context_unresolved";

export type FeatureEligibility = {
  allowed: boolean;
  discoverability: FeatureDiscoverability;
  reason: string | null;
  denialClass: V8EligibilityDenialClass | null;
  resolvedDiscoverability: V8FeatureDiscoverability;
  telemetry: {
    featureKey: FeatureFamilyKey;
    mode: ProductSurfaceContext["mode"];
    role: ProductSurfaceContext["role"];
    isAdmin: boolean;
    surfaceType: V8SurfaceType;
    surfaceIdentifier: string;
  };
  definition: ProductFeatureDef;
};

export type EligibilityEvaluationInput = {
  surfaceType?: V8SurfaceType;
  surfaceIdentifier?: string;
  authState?: "authenticated" | "unauthenticated";
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
  featureKey: FeatureFamilyKey,
  input?: EligibilityEvaluationInput
): FeatureEligibility {
  const surfaceType = input?.surfaceType ?? "page";
  const surfaceIdentifier = input?.surfaceIdentifier ?? featureKey;
  const authState = input?.authState ?? "authenticated";

  if (authState === "unauthenticated") {
    const def = featureRegistryByKey().get(featureKey);
    return {
      allowed: false,
      discoverability: "suppressed",
      reason: "unauthenticated",
      denialClass: "unauthenticated",
      resolvedDiscoverability: "hidden",
      telemetry: {
        featureKey,
        mode: ctx.mode,
        role: ctx.role,
        isAdmin: adminBypass(ctx),
        surfaceType,
        surfaceIdentifier,
      },
      definition:
        def ?? {
          key: featureKey,
          label: featureKey,
          parentDomain: "core",
          minWorkspaceMode: "core",
          defaultFeatureState: "disabled",
          lifecycle: "retired_hidden",
          topLevelNavAllowed: false,
          globalSearchAllowed: false,
          notificationsAllowed: false,
          dashboardPromotionAllowed: false,
          badgeCountsAllowed: false,
          contextualEntryAllowed: false,
          deepLinkAllowed: false,
          adminRevealAllowed: false,
          routePrefixes: [],
          apiPrefixes: [],
        },
    };
  }

  if (!ctx.orgId || ctx.orgId.trim().length === 0) {
    const def = featureRegistryByKey().get(featureKey);
    return {
      allowed: false,
      discoverability: "suppressed",
      reason: "org_context_unresolved",
      denialClass: "org_context_unresolved",
      resolvedDiscoverability: "hidden",
      telemetry: {
        featureKey,
        mode: ctx.mode,
        role: ctx.role,
        isAdmin: adminBypass(ctx),
        surfaceType,
        surfaceIdentifier,
      },
      definition:
        def ?? {
          key: featureKey,
          label: featureKey,
          parentDomain: "core",
          minWorkspaceMode: "core",
          defaultFeatureState: "disabled",
          lifecycle: "retired_hidden",
          topLevelNavAllowed: false,
          globalSearchAllowed: false,
          notificationsAllowed: false,
          dashboardPromotionAllowed: false,
          badgeCountsAllowed: false,
          contextualEntryAllowed: false,
          deepLinkAllowed: false,
          adminRevealAllowed: false,
          routePrefixes: [],
          apiPrefixes: [],
        },
    };
  }

  const def = featureRegistryByKey().get(featureKey);
  if (!def) {
    return {
      allowed: false,
      discoverability: "suppressed",
      reason: "registry_missing",
      denialClass: "registry_missing_or_mapping_missing",
      resolvedDiscoverability: "hidden",
      telemetry: {
        featureKey,
        mode: ctx.mode,
        role: ctx.role,
        isAdmin: adminBypass(ctx),
        surfaceType,
        surfaceIdentifier,
      },
      definition: {
        key: featureKey,
        label: featureKey,
        parentDomain: "core",
        minWorkspaceMode: "core",
        defaultFeatureState: "disabled",
        lifecycle: "retired_hidden",
        topLevelNavAllowed: false,
        globalSearchAllowed: false,
        notificationsAllowed: false,
        dashboardPromotionAllowed: false,
        badgeCountsAllowed: false,
        contextualEntryAllowed: false,
        deepLinkAllowed: false,
        adminRevealAllowed: false,
        routePrefixes: [],
        apiPrefixes: [],
      },
    };
  }

  const telemetry = {
    featureKey,
    mode: ctx.mode,
    role: ctx.role,
    isAdmin: adminBypass(ctx),
    surfaceType,
    surfaceIdentifier,
  } as const;

  if (def.lifecycle === "retired_hidden" || def.defaultFeatureState === "disabled") {
    return {
      allowed: false,
      discoverability: "suppressed",
      reason: "disabled_or_retired_hidden",
      denialClass: "retired_feature",
      resolvedDiscoverability: "hidden",
      telemetry,
      definition: def,
    };
  }

  if (!workspaceModeAtLeast(ctx.mode, def.minWorkspaceMode)) {
    if (def.adminRevealAllowed && adminBypass(ctx)) {
      return {
        allowed: true,
        discoverability: "admin_only",
        reason: "admin_bypass",
        denialClass: null,
        resolvedDiscoverability: "normal",
        telemetry,
        definition: def,
      };
    }
    return {
      allowed: false,
      discoverability: "suppressed",
      reason: "workspace_mode_ineligible",
      denialClass: "insufficient_workspace_mode",
      resolvedDiscoverability: "hidden",
      telemetry,
      definition: def,
    };
  }

  if (isUtilityFeatureHidden(ctx, featureKey)) {
    if (def.adminRevealAllowed && adminBypass(ctx)) {
      return {
        allowed: true,
        discoverability: "admin_only",
        reason: "admin_hidden_bypass",
        denialClass: null,
        resolvedDiscoverability: "normal",
        telemetry,
        definition: def,
      };
    }
    return {
      allowed: false,
      discoverability: "suppressed",
      reason: "utility_module_hidden",
      denialClass: "hidden_by_module_config",
      resolvedDiscoverability: "hidden",
      telemetry,
      definition: def,
    };
  }

  if (isAdvancedModuleRowHidden(ctx, def) || isAssuranceModuleRowHidden(ctx, def)) {
    if (def.adminRevealAllowed && adminBypass(ctx)) {
      return {
        allowed: true,
        discoverability: "admin_only",
        reason: "admin_hidden_bypass",
        denialClass: null,
        resolvedDiscoverability: "normal",
        telemetry,
        definition: def,
      };
    }
    return {
      allowed: false,
      discoverability: "suppressed",
      reason: "module_hidden",
      denialClass: "hidden_by_module_config",
      resolvedDiscoverability: "hidden",
      telemetry,
      definition: def,
    };
  }

  if (def.lifecycle === "admin_only" && !adminBypass(ctx)) {
    return {
      allowed: false,
      discoverability: "suppressed",
      reason: "admin_only",
      denialClass: "unauthorized_role",
      resolvedDiscoverability: "hidden",
      telemetry,
      definition: def,
    };
  }

  if (def.lifecycle === "experimental" && !adminBypass(ctx)) {
    return {
      allowed: false,
      discoverability: "deep_link_only",
      reason: "experimental",
      denialClass: "experimental_deep_link_only_suppression",
      resolvedDiscoverability: "deep_link_only",
      telemetry,
      definition: def,
    };
  }

  if (def.contextualEntryAllowed && !def.topLevelNavAllowed && def.deepLinkAllowed) {
    return {
      allowed: true,
      discoverability: "context_only",
      reason: null,
      denialClass: null,
      resolvedDiscoverability: "normal",
      telemetry,
      definition: def,
    };
  }

  if (!def.contextualEntryAllowed && def.deepLinkAllowed) {
    return {
      allowed: true,
      discoverability: "deep_link_only",
      reason: null,
      denialClass: null,
      resolvedDiscoverability: "deep_link_only",
      telemetry,
      definition: def,
    };
  }

  return {
    allowed: true,
    discoverability: "direct",
    reason: null,
    denialClass: null,
    resolvedDiscoverability: "normal",
    telemetry,
    definition: def,
  };
}
