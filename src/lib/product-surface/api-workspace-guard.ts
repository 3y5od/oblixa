import { NextResponse } from "next/server";
import { getFeatureFlags } from "@/lib/feature-flags";
import type { WorkspaceRole } from "@/lib/navigation";
import { buildProductSurfaceContext } from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import { logProductSurfaceDiagnostic } from "@/lib/product-surface/dev-diagnostics";
import { statusForEligibilityDenial } from "@/lib/product-surface/v8-denial-status";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";
import { resolveFeatureMappingForApiPath } from "@/lib/product-surface/v8-surface-mapping";

export function resolveApiWorkspaceEligibilityDeniedStatus(input: {
  denialClass?: Parameters<typeof statusForEligibilityDenial>[0];
  modeMismatchStatus?: 403 | 404;
}): 403 | 404 {
  if (input.modeMismatchStatus) return input.modeMismatchStatus;
  const status = statusForEligibilityDenial(input.denialClass, 403);
  return status === 401 ? 403 : status;
}

export async function requireApiWorkspaceEligibility(input: {
  admin: Parameters<typeof getV6OrgSettingsJson>[0];
  orgId: string;
  apiPath: string;
  /** Defaults to viewer when omitted (token feeds, etc.); pass real role whenever available. */
  role?: WorkspaceRole;
  modeMismatchStatus?: 403 | 404;
}): Promise<NextResponse | null> {
  const mapping = resolveFeatureMappingForApiPath(input.apiPath);
  if (mapping.status === "exempt") return null;

  if (mapping.status === "unmapped") {
    logProductSurfaceDiagnostic("surface_mapping_missing", {
      surfaceType: "api",
      apiPath: input.apiPath,
      reason: "registry_missing_or_mapping_missing",
    });
    const status = resolveApiWorkspaceEligibilityDeniedStatus({
      denialClass: "registry_missing_or_mapping_missing",
      modeMismatchStatus: input.modeMismatchStatus,
    });
    return NextResponse.json({ error: "Feature mapping missing for API route" }, { status });
  }

  const family = mapping.featureFamily;
  const settings = await getV6OrgSettingsJson(input.admin, input.orgId);
  const role = input.role ?? "viewer";
  const ctx = buildProductSurfaceContext({
    orgId: input.orgId,
    role,
    v6: settings,
    featureFlags: getFeatureFlags(),
  });
  const elig = evaluateFeatureEligibility(ctx, family, {
    surfaceType: "api",
    surfaceIdentifier: input.apiPath,
  });
  if (elig.allowed) return null;

  logProductSurfaceDiagnostic("api_workspace_gate_denied", {
    apiPath: input.apiPath,
    family,
    reason: elig.reason,
    denialClass: elig.denialClass,
    discoverability: elig.discoverability,
  });
  const status = resolveApiWorkspaceEligibilityDeniedStatus({
    denialClass: elig.denialClass,
    modeMismatchStatus: input.modeMismatchStatus,
  });
  return NextResponse.json({ error: "Feature not available in workspace mode" }, { status });
}
