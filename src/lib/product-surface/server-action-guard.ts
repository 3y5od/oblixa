import { getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import { buildProductSurfaceContext } from "@/lib/product-surface/context";
import {
  evaluateFeatureEligibility,
  type EligibilityDenialClass,
} from "@/lib/product-surface/eligibility";
import { featureRegistryByKey, type FeatureFamilyKey } from "@/lib/product-surface/feature-registry";
import { logProductSurfaceDiagnostic } from "@/lib/product-surface/dev-diagnostics";
import { getFeatureFlags } from "@/lib/feature-flags";
import { getOrgSettingsJson } from "@/lib/assurance/org-settings";

export type ServerActionEligibilityDenied = {
  ok: false;
  denialClass: EligibilityDenialClass;
  reason: string;
  message: string;
};

export type ServerActionEligibilityAllowed = {
  ok: true;
  auth: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;
};

export async function requireServerActionEligibility(input: {
  actionId: string;
  featureFamily: FeatureFamilyKey;
}): Promise<ServerActionEligibilityAllowed | ServerActionEligibilityDenied> {
  const auth = await getAuthContext();
  if (!auth) {
    return {
      ok: false,
      denialClass: "unauthenticated",
      reason: "auth_required",
      message: "Not authenticated",
    };
  }

  const def = featureRegistryByKey().get(input.featureFamily);
  if (!def) {
    logProductSurfaceDiagnostic("surface_mapping_missing", {
      surfaceType: "server_action",
      actionId: input.actionId,
      featureFamily: input.featureFamily,
    });
    return {
      ok: false,
      denialClass: "registry_missing_or_mapping_missing",
      reason: "feature_not_registered",
      message: "Action is not available in this workspace",
    };
  }

  const v6 = await getOrgSettingsJson(auth.admin, auth.orgId);
  const ctx = buildProductSurfaceContext({
    orgId: auth.orgId,
    role: auth.role as WorkspaceRole,
    v6,
    featureFlags: getFeatureFlags(),
  });
  const eligibility = evaluateFeatureEligibility(ctx, input.featureFamily, {
    surfaceType: "server_action",
    surfaceIdentifier: input.actionId,
  });
  if (eligibility.allowed) return { ok: true, auth };

  logProductSurfaceDiagnostic("server_action_eligibility_denied", {
    actionId: input.actionId,
    featureFamily: input.featureFamily,
    denialClass: eligibility.denialClass,
    reason: eligibility.reason,
    discoverability: eligibility.discoverability,
    mode: ctx.mode,
    role: ctx.role,
  });
  return {
    ok: false,
    denialClass: eligibility.denialClass ?? "registry_missing_or_mapping_missing",
    reason: eligibility.reason ?? "ineligible",
    message: "Action is not available in this workspace",
  };
}
