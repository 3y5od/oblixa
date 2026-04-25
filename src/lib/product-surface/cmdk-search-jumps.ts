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
import {
  buildContractsSearchListHref,
  normalizeContractsSearchQuery,
} from "@/lib/contracts-search-url";
import {
  resolveWorkflowDestination,
  workflowDestinationForHref,
} from "@/lib/product-surface/workflow-destinations";

export type CmdkSearchJumpItem = {
  id: string;
  name: string;
  description: string;
  href: string;
  meta: string;
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

function workSectionHref(section: "tasks" | "approvals" | "obligations") {
  return `/work#${section}`;
}

function roleAllowsSearchClass(surface: NavSurfaceInput, row: SearchIndexClassDef): boolean {
  return canAccessItem(syntheticNavItem(row.minRole), surface.role);
}

function hrefForSearchClass(row: SearchIndexClassDef, queryTrimmed: string): string {
  switch (row.key) {
    case "contracts":
      return buildContractsSearchListHref(queryTrimmed);
    case "tasks":
      return workSectionHref("tasks");
    case "obligations":
      return workSectionHref("obligations");
    case "approvals":
      return workSectionHref("approvals");
    case "renewals":
      return "/contracts/renewals?horizon=renewal_90";
    case "exceptions":
      return "/contracts/exceptions?status=open";
    case "evidence":
      return "/contracts/evidence-studio#live-request-queue";
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
  switch (row.key) {
    case "contracts":
      return queryTrimmed
        ? `Open the contracts list prefiltered for "${queryTrimmed}".`
        : "Open the contracts list and filter from there.";
    case "tasks":
      return "Open the Work queue focused on task follow-up.";
    case "approvals":
      return "Open the Work queue focused on approvals waiting on action.";
    case "obligations":
      return "Open the Work queue focused on recurring obligations.";
    case "renewals":
      return "Open renewals already scoped to the 90-day horizon.";
    case "exceptions":
      return "Open active exceptions that still need owner action.";
    case "evidence":
      return "Open the live evidence request queue.";
    case "reports":
      return "Open reporting and export control-room views.";
    default:
      return `Open ${row.label.toLowerCase()}.`;
  }
}

function metaForSearchClass(row: SearchIndexClassDef, href: string, queryTrimmed: string): string {
  switch (row.key) {
    case "contracts":
      return queryTrimmed ? `Contracts search · ${pathOnly(href)}` : `Contracts list · ${pathOnly(href)}`;
    case "tasks":
      return "Work queue · tasks lens";
    case "approvals":
      return "Work queue · approvals lens";
    case "obligations":
      return "Work queue · obligations lens";
    case "renewals":
      return "Renewals queue · 90-day horizon";
    case "exceptions":
      return "Exceptions queue · open only";
    case "evidence":
      return "Evidence Studio · live request queue";
    default:
      return `${row.label} · ${pathOnly(href)}`;
  }
}

function pathOnly(href: string): string {
  return href.split(/[?#]/)[0] ?? href;
}

function destinationCopyForSearchHref(href: string, surface: NavSurfaceInput) {
  const def = workflowDestinationForHref(href);
  if (!def) return null;
  const resolved = resolveWorkflowDestination(surface, def.key);
  return resolved?.visible ? resolved.copy : null;
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
    const visibleQuery = row.key === "contracts" ? normalizeContractsSearchQuery(queryTrimmed) : queryTrimmed;
    const href = hrefForSearchClass(row, visibleQuery);
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
    const destinationCopy =
      row.key === "contracts" && visibleQuery ? null : destinationCopyForSearchHref(href, surface);
    out.push({
      id: `search-jump:${row.key}`,
      name:
        row.key === "contracts" && visibleQuery
          ? `Search contracts: ${visibleQuery}`
          : destinationCopy?.label ?? row.label,
      description: destinationCopy?.description ?? descriptionForSearchClass(row, visibleQuery),
      href,
      meta: metaForSearchClass(row, href, visibleQuery),
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

/** §18.2 / §18.3 — canonical Core deep links for the seven operational notification classes. */
export type V9SevenNotificationClassKey =
  | "due_work"
  | "overdue_work"
  | "pending_approvals"
  | "renewal_horizon"
  | "evidence_request"
  | "exception_assignment"
  | "review_backlog";

export const V9_SEVEN_NOTIFICATION_CLASS_KEYS: V9SevenNotificationClassKey[] = [
  "due_work",
  "overdue_work",
  "pending_approvals",
  "renewal_horizon",
  "evidence_request",
  "exception_assignment",
  "review_backlog",
];

function searchClassRow(key: SearchIndexClassDef["key"]): SearchIndexClassDef {
  const row = SEARCH_INDEX_CLASSES.find((r) => r.key === key);
  if (!row) {
    throw new Error(`cmdk-search-jumps: missing SEARCH_INDEX_CLASSES row for key ${key}`);
  }
  return row;
}

/**
 * Stable href for each §18.2 notification class. CmdK “tasks / approvals / renewals / …” jumps reuse the same
 * destinations where the registry defines them; overdue + review backlog use explicit work / review routes.
 */
export function hrefV9SevenNotificationClass(key: V9SevenNotificationClassKey): string {
  switch (key) {
    case "due_work":
      return workSectionHref("tasks");
    case "overdue_work":
      return "/work?lens=overdue";
    case "pending_approvals":
      return workSectionHref("approvals");
    case "renewal_horizon":
      return hrefForSearchClass(searchClassRow("renewals"), "");
    case "evidence_request":
      return hrefForSearchClass(searchClassRow("evidence"), "");
    case "exception_assignment":
      return hrefForSearchClass(searchClassRow("exceptions"), "");
    case "review_backlog":
      return "/contracts/review";
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}
