import { NextResponse } from "next/server";
import { getFeatureFlags } from "@/lib/feature-flags";
import type { WorkspaceRole } from "@/lib/navigation";
import { buildProductSurfaceContext } from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import { logProductSurfaceDiagnostic } from "@/lib/product-surface/dev-diagnostics";
import { featureFamilyForApiPath, type FeatureFamilyKey } from "@/lib/product-surface/feature-registry";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";

const SUPPRESSED_REASON_STATUS: Record<string, 403 | 404> = {
  workspace_mode_ineligible: 404,
  module_hidden: 404,
  utility_module_hidden: 404,
  disabled_or_retired_hidden: 404,
  admin_only: 404,
  experimental: 404,
};

export function resolveApiWorkspaceEligibilityDeniedStatus(input: {
  family: FeatureFamilyKey;
  reason: string | null;
  modeMismatchStatus?: 403 | 404;
}): 403 | 404 {
  if (input.modeMismatchStatus) return input.modeMismatchStatus;
  if (!input.reason) return 403;
  return SUPPRESSED_REASON_STATUS[input.reason] ?? 403;
}

export async function requireApiWorkspaceEligibility(input: {
  admin: Parameters<typeof getV6OrgSettingsJson>[0];
  orgId: string;
  apiPath: string;
  /** Defaults to viewer when omitted (token feeds, etc.); pass real role whenever available. */
  role?: WorkspaceRole;
  modeMismatchStatus?: 403 | 404;
}): Promise<NextResponse | null> {
  const family = featureFamilyForApiPath(input.apiPath);
  if (!family) return null;

  const settings = await getV6OrgSettingsJson(input.admin, input.orgId);
  const role = input.role ?? "viewer";
  const ctx = buildProductSurfaceContext({
    orgId: input.orgId,
    role,
    v6: settings,
    featureFlags: getFeatureFlags(),
  });
  const elig = evaluateFeatureEligibility(ctx, family);
  if (elig.allowed) return null;

  logProductSurfaceDiagnostic("api_workspace_gate_denied", {
    apiPath: input.apiPath,
    family,
    reason: elig.reason,
    discoverability: elig.discoverability,
  });
  const status = resolveApiWorkspaceEligibilityDeniedStatus({
    family,
    reason: elig.reason,
    modeMismatchStatus: input.modeMismatchStatus,
  });
  return NextResponse.json({ error: "Feature not available in workspace mode" }, { status });
}
