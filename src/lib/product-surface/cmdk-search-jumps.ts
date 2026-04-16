import { NAV_ITEMS, type NavItem, type WorkspaceRole } from "@/lib/navigation";
import { canAccessItem } from "@/lib/navigation";
import {
  SEARCH_INDEX_CLASSES,
  type SearchIndexClassDef,
  workspaceModeAtLeast,
} from "@/lib/product-surface/feature-registry";
import { minWorkspaceModeForPath } from "@/lib/product-surface/routes";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import {
  isNavChildVisibleForSurface,
  isNavItemVisibleForSurface,
} from "@/lib/product-surface/nav-visibility";
import { isHrefEligibleForNavSurface } from "@/lib/product-surface/href-eligibility";
import { logProductSurfaceDiagnostic } from "@/lib/product-surface/dev-diagnostics";

export type CmdkSearchJumpItem = {
  id: string;
  name: string;
  description: string;
  href: string;
};

function syntheticNavItem(minRole: WorkspaceRole): NavItem {
  return {
    name: "",
    href: "/",
    description: "",
    section: "workspace",
    minRole,
  };
}

function roleAllowsSearchClass(surface: NavSurfaceInput, row: SearchIndexClassDef): boolean {
  return canAccessItem(syntheticNavItem(row.minRole), surface.role);
}

function hrefForSearchClass(row: SearchIndexClassDef, queryTrimmed: string): string {
  const q = queryTrimmed.length > 0 ? encodeURIComponent(queryTrimmed) : "";
  switch (row.key) {
    case "contracts":
      return q ? `/contracts?search=${q}` : "/contracts";
    case "tasks":
      return "/contracts/tasks";
    case "obligations":
      return "/contracts/obligations";
    case "approvals":
      return "/contracts/approvals";
    case "renewals":
      return "/contracts/renewals";
    case "exceptions":
      return "/contracts/exceptions";
    case "evidence":
      return "/contracts/evidence-studio";
    case "reports":
      return "/reports";
    case "decisions":
      return "/decisions";
    case "campaigns":
      return "/campaigns";
    case "programs":
      return "/contracts/programs";
    case "relationship_workspaces":
      return "/relationship-workspaces";
    case "findings":
      return "/assurance/findings";
    case "control_policies":
      return "/assurance/control-policies";
    case "scorecards":
      return "/assurance/scorecards";
    case "playbooks":
      return "/assurance/playbooks";
    case "review_boards":
      return "/assurance/review-boards";
    case "segments":
      return "/assurance/segments";
    case "program_evolution":
      return "/assurance/program-evolution";
    default:
      return "/dashboard";
  }
}

function descriptionForSearchClass(row: SearchIndexClassDef, queryTrimmed: string): string {
  if (row.key === "contracts" && queryTrimmed) {
    return `Search contracts for “${queryTrimmed}”.`;
  }
  return `Open ${row.label.toLowerCase()}.`;
}

function pathOnly(href: string): string {
  return href.split("?")[0] ?? href;
}

function isSearchJumpHrefVisibleForSurface(href: string, surface: NavSurfaceInput): boolean {
  const p = pathOnly(href);
  for (const item of NAV_ITEMS) {
    const itemPath = pathOnly(item.href);
    if (itemPath === p) return isNavItemVisibleForSurface(item, surface);
    for (const child of item.navChildren ?? []) {
      const childPath = pathOnly(child.href);
      if (childPath !== p) continue;
      return (
        isNavItemVisibleForSurface(item, surface) &&
        isNavChildVisibleForSurface({ href: child.href, v5FlagsAnyOf: child.v5FlagsAnyOf }, surface)
      );
    }
  }
  return true;
}

/**
 * Registry-backed cmd-K rows (V7 search jump list). Filtered by mode, role, module hides, and search scope.
 */
export function getCmdkSearchJumpItems(surface: NavSurfaceInput, query: string): CmdkSearchJumpItem[] {
  const queryTrimmed = query.trim();
  const out: CmdkSearchJumpItem[] = [];
  let dropped = 0;
  for (const row of SEARCH_INDEX_CLASSES) {
    if (!row.globalSearch) continue;
    if (!workspaceModeAtLeast(surface.mode, row.minWorkspaceMode)) {
      dropped += 1;
      continue;
    }
    if (!roleAllowsSearchClass(surface, row)) {
      dropped += 1;
      continue;
    }
    const href = hrefForSearchClass(row, queryTrimmed);
    const hrefPath = pathOnly(href);
    if (surface.searchScope === "core_only" && minWorkspaceModeForPath(hrefPath) !== "core") {
      dropped += 1;
      continue;
    }
    if (!isSearchJumpHrefVisibleForSurface(href, surface)) {
      dropped += 1;
      continue;
    }
    if (!isHrefEligibleForNavSurface(surface, href)) {
      dropped += 1;
      continue;
    }
    out.push({
      id: `search-jump:${row.key}`,
      name: row.key === "contracts" && queryTrimmed ? `Search contracts: ${queryTrimmed}` : row.label,
      description: descriptionForSearchClass(row, queryTrimmed),
      href,
    });
  }
  if (dropped > 0) {
    logProductSurfaceDiagnostic("cmdk_search_index_filtered", {
      mode: surface.mode,
      dropped_count: dropped,
      query_len: queryTrimmed.length,
    });
  }
  return out;
}
