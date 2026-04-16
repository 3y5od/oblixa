/**
 * docs/refinement.md §21.2 — org default landing must match workspace mode and not be a §10.4 utility on Core.
 */
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { isRefinementCoreUtilityPath } from "@/lib/product-surface/core-utility-paths";
import { isPathAllowedForWorkspaceMode } from "@/lib/product-surface/routes";
import { logProductSurfaceDiagnostic } from "@/lib/product-surface/dev-diagnostics";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import type { WorkspaceRole } from "@/lib/navigation";
import type {
  AdvancedNavModuleKey,
  AssuranceNavModuleKey,
  UtilityModuleKey,
} from "@/lib/product-surface/types";
import { resolveFeatureMappingForPagePath } from "@/lib/product-surface/v8-surface-mapping";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";

/** Strip query/hash for path policy checks. */
export function normalizeLandingPath(path: string): string {
  const s = path.trim();
  const noQuery = s.split("?")[0] ?? s;
  return (noQuery.split("#")[0] ?? noQuery).trim();
}

type LandingEligibilityInput = {
  role: WorkspaceRole;
  advancedModulesHidden: Set<AdvancedNavModuleKey>;
  assuranceModulesHidden: Set<AssuranceNavModuleKey>;
  utilityModulesHidden: Set<UtilityModuleKey>;
  isAdmin: boolean;
};

function isEligibleLandingPath(
  path: string,
  mode: WorkspaceProductMode,
  input: LandingEligibilityInput
): boolean {
  const mapping = resolveFeatureMappingForPagePath(path);
  if (mapping.status === "exempt") return true;
  if (mapping.status === "unmapped") return false;

  const eligibility = evaluateFeatureEligibility(
    {
      orgId: "__landing_check__",
      workspaceMode: mode,
      mode,
      v6: { workspace_mode: mode },
      featureFlags: {} as Record<FeatureFlagKey, boolean>,
      role: input.role,
      isAdmin: input.isAdmin,
      seesAdvancedPrimaryNav: mode !== "core",
      seesAssuranceNav: mode === "assurance",
      assuranceNavAdminTesting: false,
      advancedModulesHidden: input.advancedModulesHidden,
      assuranceModulesHidden: input.assuranceModulesHidden,
      utilityModulesHidden: input.utilityModulesHidden,
      defaultLandingPath: null,
      searchScope: "match_mode",
      autopilotAllowExecution: false,
    },
    mapping.featureFamily,
    { surfaceType: "page", surfaceIdentifier: path }
  );
  return eligibility.allowed;
}

/**
 * Whether `path` is acceptable as `organizations.v6_org_settings_json.default_landing_path`
 * for the given workspace mode.
 */
export function isValidDefaultLandingPath(
  path: string,
  mode: WorkspaceProductMode,
  eligibilityInput?: LandingEligibilityInput
): boolean {
  const p = normalizeLandingPath(path);
  if (!p.startsWith("/")) return false;
  if (p === "/more") return false;
  if (!isPathAllowedForWorkspaceMode(p, mode)) return false;
  if (mode === "core" && isRefinementCoreUtilityPath(p)) return false;
  if (eligibilityInput && !isEligibleLandingPath(p, mode, eligibilityInput)) return false;
  return true;
}

/** Resolves org landing for a mode; invalid or missing values fall back to `/dashboard`. */
export function resolveEffectiveLandingPath(
  rawPath: string | null | undefined,
  mode: WorkspaceProductMode,
  eligibilityInput?: LandingEligibilityInput
): string {
  if (typeof rawPath !== "string") {
    logProductSurfaceDiagnostic("landing_path_normalized", {
      mode,
      reason: "missing_or_non_string",
      fallback: "/dashboard",
    });
    return "/dashboard";
  }
  const p = normalizeLandingPath(rawPath);
  if (isValidDefaultLandingPath(p, mode, eligibilityInput)) return p;
  logProductSurfaceDiagnostic("landing_path_normalized", {
    mode,
    requested: p,
    reason: eligibilityInput ? "invalid_for_surface_eligibility" : "invalid_for_mode",
    fallback: "/dashboard",
  });
  return "/dashboard";
}
