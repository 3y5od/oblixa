import { NextResponse } from "next/server";
import { getFeatureFlags } from "@/lib/feature-flags";
import type { WorkspaceRole } from "@/lib/navigation";
import { buildProductSurfaceContext } from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import type { V8EligibilityDenialClass } from "@/lib/product-surface/eligibility";
import { logProductSurfaceDiagnostic } from "@/lib/product-surface/dev-diagnostics";
import { statusForEligibilityDenial } from "@/lib/product-surface/v8-denial-status";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";
import { resolveFeatureMappingForApiPath } from "@/lib/product-surface/v8-surface-mapping";
import {
  buildV10DeniedMutationResponse,
  buildV10MutationJsonResponse,
} from "@/lib/v10-server-contracts";
import type { V10MutationOutcome } from "@/lib/v10-release-contract";

export function resolveApiWorkspaceEligibilityDeniedStatus(input: {
  denialClass?: Parameters<typeof statusForEligibilityDenial>[0];
  modeMismatchStatus?: 403 | 404;
}): 403 | 404 {
  if (input.modeMismatchStatus) return input.modeMismatchStatus;
  const status = statusForEligibilityDenial(input.denialClass, 403);
  return status === 401 ? 403 : status;
}

function v10OutcomeForApiWorkspaceDenial(denialClass: V8EligibilityDenialClass): Extract<
  V10MutationOutcome,
  "unauthorized" | "forbidden" | "not_found" | "plan_required" | "mode_required" | "hidden_module"
> {
  if (denialClass === "unauthenticated") return "unauthorized";
  if (denialClass === "unauthorized_role") return "forbidden";
  if (denialClass === "insufficient_workspace_mode") return "mode_required";
  if (denialClass === "hidden_by_module_config") return "hidden_module";
  return "not_found";
}

export async function requireApiWorkspaceEligibility(input: {
  admin: Parameters<typeof getV6OrgSettingsJson>[0];
  orgId: string;
  apiPath: string;
  /** Defaults to viewer when omitted (token feeds, etc.); pass real role whenever available. */
  role?: WorkspaceRole;
  modeMismatchStatus?: 403 | 404;
  v10MutationResponse?: boolean;
  nextDestinationHref?: string | null;
}): Promise<NextResponse | Response | null> {
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
    if (input.v10MutationResponse) {
      return buildV10MutationJsonResponse(
        buildV10DeniedMutationResponse({
          outcome: "not_found",
          message: "This V10 API route is not available.",
          diagnosticId: "v10_api_workspace_mapping_missing",
          nextDestinationHref: input.nextDestinationHref ?? "/settings/product",
        })
      );
    }
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
  if (input.v10MutationResponse) {
    const denialClass = elig.denialClass ?? "registry_missing_or_mapping_missing";
    return buildV10MutationJsonResponse(
      buildV10DeniedMutationResponse({
        outcome: v10OutcomeForApiWorkspaceDenial(denialClass),
        message: "This V10 action is not available in the current workspace configuration.",
        diagnosticId: `v10_api_workspace_gate_${denialClass}`,
        nextDestinationHref: input.nextDestinationHref ?? "/settings/product",
      })
    );
  }
  return NextResponse.json({ error: "Feature not available in workspace mode" }, { status });
}

export async function requireApiWorkspaceEligibilityV10(input: {
  admin: Parameters<typeof getV6OrgSettingsJson>[0];
  orgId: string;
  apiPath: string;
  role?: WorkspaceRole;
  nextDestinationHref?: string | null;
}): Promise<Response | null> {
  const mapping = resolveFeatureMappingForApiPath(input.apiPath);
  if (mapping.status === "exempt") return null;

  if (mapping.status === "unmapped") {
    logProductSurfaceDiagnostic("surface_mapping_missing", {
      surfaceType: "api",
      apiPath: input.apiPath,
      reason: "registry_missing_or_mapping_missing",
    });
    return buildV10MutationJsonResponse(
      buildV10DeniedMutationResponse({
        outcome: "not_found",
        message: "This V10 API route is not available.",
        diagnosticId: "v10_api_workspace_mapping_missing",
        nextDestinationHref: input.nextDestinationHref ?? "/settings/product",
      })
    );
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
  const denialClass = elig.denialClass ?? "registry_missing_or_mapping_missing";
  return buildV10MutationJsonResponse(
    buildV10DeniedMutationResponse({
      outcome: v10OutcomeForApiWorkspaceDenial(denialClass),
      message: "This V10 action is not available in the current workspace configuration.",
      diagnosticId: `v10_api_workspace_gate_${denialClass}`,
      nextDestinationHref: input.nextDestinationHref ?? "/settings/product",
    })
  );
}
