import type { AdminClient } from "@/lib/v6/service";
import { NAV_ITEMS, type NavItem } from "@/lib/navigation";
import {
  isNavChildVisibleForSurface,
  isNavItemVisibleForSurface,
  type NavSurfaceInput,
} from "@/lib/product-surface/nav-visibility";
import { isNotificationAllowed } from "@/lib/notification-policy";
import { isPathAllowedForWorkspaceMode, minWorkspaceModeForPath } from "@/lib/product-surface/routes";
import type { V6OrgSettingsJson } from "@/lib/v6/org-settings";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import { logProductSurfaceDiagnostic } from "@/lib/product-surface/dev-diagnostics";
import { isHrefEligibleForNavSurface } from "@/lib/product-surface/href-eligibility";

/** Extra cmd-K entries not on primary NAV_ITEMS (keep aligned with command-palette DEEP_LINK_COMMANDS). */
export const CMDK_EXTRA_NAV_ITEMS: NavItem[] = [
  {
    name: "Compare campaigns & simulations",
    href: "/campaigns/compare",
    description: "Side-by-side campaign progress and simulation inputs.",
    section: "primary",
    v5FlagsAnyOf: ["v5PortfolioCampaigns"],
  },
];

export const HOME_SECTION_IDS = [
  "control_room_strip",
  "telemetry_compact",
  "v6_assurance_snapshot",
  "outcome_intelligence",
  "assurance_signals",
] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

export function isHomeBlockAllowed(blockId: string, v6: V6OrgSettingsJson): boolean {
  if (blockId === "dashboard_upper" || blockId === "dashboard_lower") return true;
  const hidden = new Set(v6.home_hidden_sections ?? []);
  return !hidden.has(blockId);
}

/**
 * Workspace mode gate for route prefixes (§10). Does not include admin bypass — use layout guards for that.
 */
export function isRouteAllowedForWorkspacePath(pathname: string, mode: WorkspaceProductMode): boolean {
  return isPathAllowedForWorkspaceMode(pathname, mode);
}

function allCmdkNavItems(): NavItem[] {
  return [...NAV_ITEMS, ...CMDK_EXTRA_NAV_ITEMS];
}

export function isCmdkHrefAllowed(href: string, surface: NavSurfaceInput): boolean {
  const path = href.split("?")[0] ?? href;
  if (surface.searchScope === "core_only" && minWorkspaceModeForPath(path) !== "core") return false;
  if (!isHrefEligibleForNavSurface(surface, href)) return false;
  const item = allCmdkNavItems().find((i) => (i.href.split("?")[0] ?? i.href) === path);
  if (item) return isNavItemVisibleForSurface(item, surface);

  for (const parent of NAV_ITEMS) {
    for (const child of parent.navChildren ?? []) {
      const childPath = child.href.split("?")[0] ?? child.href;
      if (childPath !== path) continue;
      return (
        isNavItemVisibleForSurface(parent, surface) &&
        isNavChildVisibleForSurface(
          { href: child.href, v5FlagsAnyOf: child.v5FlagsAnyOf },
          surface
        )
      );
    }
  }
  return false;
}

/** docs/refinement.md §20.3 — drop recent cmd-K targets hidden for the current surface. */
export function cmdkFilterRecentHrefsForSurface(hrefs: string[], surface: NavSurfaceInput): string[] {
  const filtered = hrefs.filter((href) => isCmdkHrefAllowed(href, surface));
  if (filtered.length < hrefs.length) {
    logProductSurfaceDiagnostic("cmdk_recent_hrefs", {
      mode: surface.mode,
      removed_count: hrefs.length - filtered.length,
    });
  }
  return filtered;
}

/**
 * docs/refinement.md §20.1 — lower sort values appear earlier for cmd-K static results.
 */
export function cmdkResultSortKey(href: string): number {
  const p = href.split("?")[0] ?? href;
  const order: { prefix: string; rank: number }[] = [
    { prefix: "/contracts/tasks", rank: 20 },
    { prefix: "/contracts/obligations", rank: 30 },
    { prefix: "/contracts/approvals", rank: 40 },
    { prefix: "/contracts/renewals", rank: 50 },
    { prefix: "/contracts/exceptions", rank: 60 },
    { prefix: "/contracts/evidence-studio", rank: 70 },
    { prefix: "/contracts/reports", rank: 80 },
    { prefix: "/reports", rank: 80 },
    { prefix: "/contracts/review", rank: 12 },
    { prefix: "/contracts/bulk", rank: 11 },
    { prefix: "/contracts/new", rank: 10 },
    { prefix: "/contracts", rank: 5 },
    { prefix: "/work", rank: 15 },
    { prefix: "/dashboard", rank: 1 },
  ];
  for (const { prefix, rank } of order) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return rank;
  }
  return 1000 + (p.length ? p.codePointAt(0)! : 0);
}

export async function isNotificationCategoryAllowed(
  admin: AdminClient,
  input: { organizationId: string; channel: "email" | "slack"; notificationType: string }
): Promise<boolean> {
  return isNotificationAllowed(admin, input);
}
