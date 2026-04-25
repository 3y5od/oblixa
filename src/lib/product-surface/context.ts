/**
 * Product surface resolution (product-surface policy §5–§6, §13, §17.3).
 *
 * **§5 layers → flags**
 * - **Layer 1 (Core)** — Always the default narrative: primary nav for Contracts, Review, Work, Renewals,
 *   Exceptions, Evidence, Reports, Settings; mode `core` unless org JSON overrides.
 * - **Layer 2 (Advanced)** — `mode` is `advanced` or `assurance`; `seesAdvancedPrimaryNav` exposes Decisions,
 *   Campaigns, Programs, Relationships subject to `advanced_modules_hidden` and `advanced_nav_roles`.
 * - **Layer 3 (Assurance)** — `mode === "assurance"` plus role defaults (or admin `assurance_nav_admin_testing`)
 *   sets `seesAssuranceNav` for the Assurance nav subtree.
 *
 * **§6** — Core/Advanced/Assurance *mode* inclusions are enforced in `routes.ts`, `nav-visibility.ts`, layouts,
 * and `buildProductSurfaceContext` (this file); feature flags gate specific pages/APIs but do not replace mode.
 */
import { cache } from "react";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { getFeatureFlags } from "@/lib/feature-flags";
import type { AdminClient } from "@/lib/v6/service";
import { getV6OrgSettingsJson, type V6OrgSettingsJson } from "@/lib/v6/org-settings";
import type { WorkspaceRole } from "@/lib/navigation";
import type {
  AdvancedNavModuleKey,
  AssuranceNavModuleKey,
  ProductSearchScope,
  UtilityModuleKey,
  WorkspaceProductMode,
} from "@/lib/product-surface/types";
import { resolveEffectiveLandingPath } from "@/lib/product-surface/landing-eligibility";
import {
  isAdvancedNavModuleKey,
  isAssuranceNavModuleKey,
  isUtilityModuleKey,
} from "@/lib/product-surface/workspace-module-keys";

export type ProductSurfaceContext = {
  orgId: string;
  workspaceMode: WorkspaceProductMode;
  mode: WorkspaceProductMode;
  v6: V6OrgSettingsJson;
  featureFlags: Record<FeatureFlagKey, boolean>;
  role: WorkspaceRole;
  isAdmin: boolean;
  /** Primary nav: Decisions, Campaigns, Programs, Relationships. */
  seesAdvancedPrimaryNav: boolean;
  /** Top-level Assurance section (§7.3). */
  seesAssuranceNav: boolean;
  /** Admin-only testing override from org JSON. */
  assuranceNavAdminTesting: boolean;
  advancedModulesHidden: Set<AdvancedNavModuleKey>;
  assuranceModulesHidden: Set<AssuranceNavModuleKey>;
  utilityModulesHidden: Set<UtilityModuleKey>;
  defaultLandingPath: string | null;
  searchScope: ProductSearchScope;
  autopilotAllowExecution: boolean;
};

export function parseWorkspaceMode(raw: V6OrgSettingsJson): WorkspaceProductMode {
  const m = raw.workspace_mode;
  if (m === "advanced" || m === "assurance") return m;
  return "core";
}

function roleSeesAdvancedNavByDefault(role: WorkspaceRole): boolean {
  return (
    role === "admin" ||
    role === "editor" ||
    role === "ops_manager" ||
    role === "manager"
  );
}

function roleSeesAssuranceNavByDefault(role: WorkspaceRole): boolean {
  return role === "admin" || role === "ops_manager" || role === "manager";
}

export function buildProductSurfaceContext(input: {
  orgId: string;
  role: WorkspaceRole;
  v6: V6OrgSettingsJson;
  featureFlags: Record<FeatureFlagKey, boolean>;
}): ProductSurfaceContext {
  const mode = parseWorkspaceMode(input.v6);
  const hidden = Array.isArray(input.v6.advanced_modules_hidden)
    ? input.v6.advanced_modules_hidden.filter(isAdvancedNavModuleKey)
    : [];
  const advancedModulesHidden = new Set(hidden);
  const assuranceHidden = Array.isArray(input.v6.assurance_modules_hidden)
    ? input.v6.assurance_modules_hidden.filter(isAssuranceNavModuleKey)
    : [];
  const assuranceModulesHidden = new Set(assuranceHidden);
  const utilityHidden = Array.isArray(input.v6.utility_modules_hidden)
    ? input.v6.utility_modules_hidden.filter(isUtilityModuleKey)
    : [];
  const utilityModulesHidden = new Set(utilityHidden);

  let seesAdvancedPrimaryNav = false;
  if (mode === "advanced" || mode === "assurance") {
    const roles = input.v6.advanced_nav_roles;
    if (Array.isArray(roles)) {
      if (roles.length === 0) {
        seesAdvancedPrimaryNav = input.role === "admin";
      } else {
        seesAdvancedPrimaryNav = roles.includes(input.role);
      }
    } else {
      seesAdvancedPrimaryNav = roleSeesAdvancedNavByDefault(input.role);
    }
  }

  const assuranceNavAdminTesting = input.v6.assurance_nav_admin_testing === true;

  let seesAssuranceNav = false;
  if (mode === "assurance") {
    const ar = input.v6.assurance_nav_roles;
    if (Array.isArray(ar)) {
      if (ar.length === 0) {
        seesAssuranceNav = input.role === "admin";
      } else {
        seesAssuranceNav = ar.includes(input.role);
      }
    } else if (roleSeesAssuranceNavByDefault(input.role)) {
      seesAssuranceNav = true;
    }
  } else if (assuranceNavAdminTesting && input.role === "admin") {
    seesAssuranceNav = true;
  }

  const defaultLandingPath =
    typeof input.v6.default_landing_path === "string"
      ? resolveEffectiveLandingPath(input.v6.default_landing_path, mode, {
          role: input.role,
          advancedModulesHidden,
          assuranceModulesHidden,
          utilityModulesHidden,
          isAdmin: input.role === "admin",
        })
      : null;

  return {
    orgId: input.orgId,
    workspaceMode: mode,
    mode,
    v6: input.v6,
    featureFlags: input.featureFlags,
    role: input.role,
    isAdmin: input.role === "admin",
    seesAdvancedPrimaryNav,
    seesAssuranceNav,
    assuranceNavAdminTesting,
    advancedModulesHidden,
    assuranceModulesHidden,
    utilityModulesHidden,
    defaultLandingPath,
    searchScope: input.v6.search_scope === "core_only" ? "core_only" : "match_mode",
    autopilotAllowExecution: input.v6.autopilot_allow_execution === true,
  };
}

/**
 * Deduplicated per React request (e.g. layout + page) so org settings are not re-fetched.
 * Feature flags are read via `getFeatureFlags()` so callers do not pass a new object each time.
 */
export const loadProductSurfaceContext = cache(
  async (admin: AdminClient, orgId: string, role: WorkspaceRole): Promise<ProductSurfaceContext> => {
    const featureFlags = getFeatureFlags();
    const v6 = await getV6OrgSettingsJson(admin, orgId);
    return buildProductSurfaceContext({ orgId, role, v6, featureFlags });
  }
);

export function isAdvancedModuleHidden(
  ctx: ProductSurfaceContext,
  key: AdvancedNavModuleKey
): boolean {
  return ctx.advancedModulesHidden.has(key);
}

export function isAssuranceModuleHidden(
  ctx: ProductSurfaceContext,
  key: AssuranceNavModuleKey
): boolean {
  return ctx.assuranceModulesHidden.has(key);
}

export function isAssuranceAutomationModuleHidden(ctx: ProductSurfaceContext): boolean {
  return isAssuranceModuleHidden(ctx, "autopilot");
}
