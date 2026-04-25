/**
 * Nav visibility vs capability vs route guards (product-surface policy §12.4).
 *
 * - **Primary nav / cmd-K**: `isNavItemVisibleForSurface` and `isNavChildVisibleForSurface` control what
 *   appears in the sidebar and command palette. Hiding an item does not revoke backend capability by itself.
 * - **Deep links**: A user may still open a bookmarked URL; authorization and mode are enforced by
 *   `assertWorkspaceModeAtLeast`, `assertAssuranceWorkspaceOrRedirect`, `assertCoreUtilitySurfaceOrRedirect`,
 *   and route handlers—not by nav visibility alone.
 * - **Badges**: `filterNavBadgesForSurface` keeps counts aligned with what the surface is allowed to show.
 */
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { NavItem, WorkspaceRole } from "@/lib/navigation";
import {
  canAccessItem,
  isV5NavChildVisible,
  isV5NavItemVisible,
} from "@/lib/navigation";
import type { ProductSurfaceContext } from "@/lib/product-surface/context";
import { isRefinementCoreUtilityPath } from "@/lib/product-surface/core-utility-paths";
import {
  minWorkspaceModeForReportsHash,
  workspaceModeAtLeast,
} from "@/lib/product-surface/feature-registry";
import { logProductSurfaceDiagnostic } from "@/lib/product-surface/dev-diagnostics";
import type {
  AdvancedNavModuleKey,
  AssuranceNavModuleKey,
  ProductSearchScope,
  UtilityModuleKey,
  WorkspaceProductMode,
} from "@/lib/product-surface/types";

/** Serializable subset for client nav / cmd-K (pass from server layout). */
export type NavSurfaceInput = {
  mode: WorkspaceProductMode;
  role: WorkspaceRole;
  featureFlags: Record<FeatureFlagKey, boolean>;
  seesAdvancedPrimaryNav: boolean;
  seesAssuranceNav: boolean;
  advancedModulesHidden: readonly AdvancedNavModuleKey[];
  assuranceModulesHidden: readonly AssuranceNavModuleKey[];
  utilityModulesHidden: readonly UtilityModuleKey[];
  searchScope: ProductSearchScope;
};

export function toNavSurfaceInput(ctx: ProductSurfaceContext): NavSurfaceInput {
  return {
    mode: ctx.mode,
    role: ctx.role,
    featureFlags: ctx.featureFlags,
    seesAdvancedPrimaryNav: ctx.seesAdvancedPrimaryNav,
    seesAssuranceNav: ctx.seesAssuranceNav,
    advancedModulesHidden: [...ctx.advancedModulesHidden],
    assuranceModulesHidden: [...ctx.assuranceModulesHidden],
    utilityModulesHidden: [...ctx.utilityModulesHidden],
    searchScope: ctx.searchScope,
  };
}

function hiddenSet(input: NavSurfaceInput): Set<AdvancedNavModuleKey> {
  return new Set(input.advancedModulesHidden);
}

function isModuleHidden(input: NavSurfaceInput, key: AdvancedNavModuleKey): boolean {
  return hiddenSet(input).has(key);
}

function assuranceHiddenSet(input: NavSurfaceInput): Set<AssuranceNavModuleKey> {
  return new Set(input.assuranceModulesHidden);
}

function isAssuranceModuleHidden(
  input: NavSurfaceInput,
  key: AssuranceNavModuleKey
): boolean {
  return assuranceHiddenSet(input).has(key);
}

function isCoreUtilityNavPath(href: string): boolean {
  const p = href.split("?")[0] ?? href;
  return isRefinementCoreUtilityPath(p);
}

function utilityHiddenSet(input: NavSurfaceInput): Set<UtilityModuleKey> {
  return new Set(input.utilityModulesHidden);
}

function utilityModuleForHref(href: string): UtilityModuleKey | null {
  const path = href.split("?")[0] ?? href;
  if (path.startsWith("/contracts/intake")) return "intake";
  if (path.startsWith("/contracts/data-quality")) return "data_quality";
  if (path.startsWith("/contracts/review-cadence")) return "review_cadence";
  if (path.startsWith("/contracts/watchlists")) return "watchlists";
  if (path.startsWith("/contracts/execution-graph")) return "execution_graph";
  if (path.startsWith("/contracts/approvals/workload")) return "approval_workload";
  if (path.startsWith("/contracts/approvals/sla-simulator")) return "approval_sla_simulator";
  if (path === "/more" || path.startsWith("/more/")) return "more_tools";
  return null;
}

function advancedModuleForHref(href: string): AdvancedNavModuleKey | null {
  const path = href.split("?")[0] ?? href;
  if (path.startsWith("/decisions/compare") || path.startsWith("/campaigns/compare")) {
    return "compare_views";
  }
  if (path.startsWith("/contracts/analytics")) return "analytics";
  if (path.startsWith("/contracts/maintenance")) return "maintenance";
  if (path.startsWith("/contracts/collaboration")) return "collaboration";
  if (path.startsWith("/decisions")) return "decisions";
  if (path.startsWith("/campaigns")) return "campaigns";
  if (path.startsWith("/contracts/programs")) return "programs";
  if (
    path.startsWith("/relationship-workspaces") ||
    path.startsWith("/accounts/") ||
    path.startsWith("/counterparties/")
  ) {
    return "relationships";
  }
  return null;
}

function isAssuranceHref(href: string): boolean {
  return (href.split("?")[0] ?? href).startsWith("/assurance");
}

function assuranceModuleForHref(href: string): AssuranceNavModuleKey | null {
  const path = href.split("?")[0] ?? href;
  if (path.startsWith("/assurance/findings")) return "findings";
  if (path.startsWith("/assurance/control-policies")) return "control_policies";
  if (path.startsWith("/assurance/scorecards")) return "scorecards";
  if (path.startsWith("/assurance/playbooks")) return "playbooks";
  if (path.startsWith("/assurance/autopilot")) return "autopilot";
  if (path.startsWith("/assurance/review-boards")) return "review_boards";
  if (path.startsWith("/assurance/segments")) return "segments";
  if (path.startsWith("/assurance/program-evolution")) return "program_evolution";
  if (path.startsWith("/assurance/health-graph")) return "health_graph";
  return null;
}

/** Reports deep links: align nav children with §5 layers. */
function reportsNavChildMinMode(href: string): WorkspaceProductMode {
  const path = href.split("?")[0] ?? href;
  if (!path.startsWith("/reports")) return "core";
  const hash = href.includes("#") ? (href.split("#")[1] ?? "").toLowerCase() : "";
  if (!hash) return "core";
  return minWorkspaceModeForReportsHash(hash);
}

/**
 * Whether a nav item should appear in sidebar / command palette for this org context.
 * Combines role, env flags, workspace mode, and admin module hides.
 */
export function isNavItemVisibleForSurface(item: NavItem, input: NavSurfaceInput): boolean {
  if (!canAccessItem(item, input.role)) return false;

  const href = item.href.split("?")[0] ?? item.href;

  if (href === "/more") {
    return !utilityHiddenSet(input).has("more_tools");
  }

  if (href === "/reports" || href === "/contracts/reports") {
    return true;
  }

  if (input.mode === "core" && isCoreUtilityNavPath(href)) {
    return false;
  }
  const utl = utilityModuleForHref(href);
  if (utl && utilityHiddenSet(input).has(utl)) return false;

  if (!isV5NavItemVisible(item, input.featureFlags)) return false;

  const adv = advancedModuleForHref(href);
  if (adv) {
    if (input.mode === "core") return false;
    if (!input.seesAdvancedPrimaryNav) return false;
    if (isModuleHidden(input, adv)) return false;
  }

  if (isAssuranceHref(href) || item.name === "Assurance") {
    if (!input.seesAssuranceNav) return false;
    const asm = assuranceModuleForHref(href);
    if (asm && isAssuranceModuleHidden(input, asm)) return false;
  }

  if (href === "/dashboard/persona") {
    if (input.mode === "core" && (input.role === "viewer" || input.role === "legal_reviewer" || input.role === "finance_reviewer")) {
      return false;
    }
  }

  return true;
}

export function isNavChildVisibleForSurface(
  child: { href: string; v5FlagsAnyOf?: FeatureFlagKey[] },
  input: NavSurfaceInput
): boolean {
  if (!isV5NavChildVisible(child, input.featureFlags)) return false;
  const href = child.href.split("?")[0] ?? child.href;

  const reportsMin = reportsNavChildMinMode(child.href);
  if (!workspaceModeAtLeast(input.mode, reportsMin)) return false;

  if (href === "/contracts/intake" || href === "/contracts/watchlists") {
    if (input.mode === "core") return false;
  }
  const utility = utilityModuleForHref(href);
  if (utility && utilityHiddenSet(input).has(utility)) return false;
  if (href === "/relationship-workspaces") {
    if (input.mode === "core") return false;
    if (!input.seesAdvancedPrimaryNav || isModuleHidden(input, "relationships")) return false;
  }

  const adv = advancedModuleForHref(href);
  if (adv) {
    if (input.mode === "core") return false;
    if (!input.seesAdvancedPrimaryNav) return false;
    if (isModuleHidden(input, adv)) return false;
  }

  if (isAssuranceHref(href)) {
    if (!input.seesAssuranceNav) return false;
    const asm = assuranceModuleForHref(href);
    if (asm && isAssuranceModuleHidden(input, asm)) return false;
  }

  return true;
}

export function filterNavBadgesForSurface(
  badges: Partial<Record<"reviewQueue" | "approvals" | "obligations" | "watchlists", number>>,
  input: NavSurfaceInput
): Partial<Record<"reviewQueue" | "approvals" | "obligations" | "watchlists", number>> {
  const incomingKeys = Object.keys(badges);
  const out: Partial<Record<"reviewQueue" | "approvals" | "obligations" | "watchlists", number>> = {
    ...badges,
  };

  const reviewItem = { href: "/contracts/review" } as NavItem;
  if (!isNavItemVisibleForSurface(reviewItem, input)) delete out.reviewQueue;

  const approvalsVisible = isNavChildVisibleForSurface({ href: "/contracts/approvals" }, input);
  if (!approvalsVisible) delete out.approvals;

  const obligationsVisible = isNavChildVisibleForSurface({ href: "/contracts/obligations" }, input);
  if (!obligationsVisible) delete out.obligations;

  const watchVisible =
    input.mode !== "core" &&
    isNavChildVisibleForSurface({ href: "/contracts/watchlists" }, input);
  if (!watchVisible) delete out.watchlists;

  if (Object.keys(out).length < incomingKeys.length) {
    const removedKeys = incomingKeys.filter((key) => !(key in out));
    logProductSurfaceDiagnostic("nav_badges", {
      mode: input.mode,
      removed_keys: removedKeys,
    });
    logProductSurfaceDiagnostic("nav_badge_payload_filtered", {
      mode: input.mode,
      removed_keys: removedKeys,
      incoming_count: incomingKeys.length,
      outgoing_count: Object.keys(out).length,
    });
  }

  return out;
}

export function roleMayBypassProductRoute(role: WorkspaceRole): boolean {
  return role === "admin";
}
