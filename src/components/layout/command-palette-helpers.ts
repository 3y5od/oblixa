import type { FeatureFlagKey } from "@/lib/feature-flags";
import {
  NAV_ITEMS,
  WORKFLOW_AREA_LABELS,
  getWorkflowAreaForNavItem,
  type NavItem,
  type WorkspaceRole,
} from "@/lib/navigation";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { CMDK_EXTRA_NAV_ITEMS } from "@/lib/product-surface/resolver";
import { normalizeContractsSearchQuery } from "@/lib/contracts-search-url";

export type PaletteItem = NavItem & { resultMeta?: string; resultOrder?: number };
export type ContractPaletteResult = {
  id: string;
  title: string;
  counterparty?: string | null;
  status?: string | null;
  ownerLabel?: string | null;
  href?: string | null;
  resultType?: string | null;
  description?: string | null;
  actionLabel?: string | null;
};
export type CommandPaletteRecoveryAction = {
  label: string;
  href: string;
  reason?: string | null;
};
export type CommandPaletteRecovery = {
  message: string;
  diagnosticId?: string | null;
  actions: CommandPaletteRecoveryAction[];
};

export function fallbackNavSurface(role: WorkspaceRole, flags: Record<FeatureFlagKey, boolean>): NavSurfaceInput {
  return {
    mode: "core",
    role,
    featureFlags: flags,
    seesAdvancedPrimaryNav: false,
    seesAssuranceNav: false,
    advancedModulesHidden: [],
    assuranceModulesHidden: [],
    utilityModulesHidden: [],
    searchScope: "match_mode",
  };
}

export function allCommandItems(): PaletteItem[] {
  const items = [
    ...NAV_ITEMS,
    ...NAV_ITEMS.flatMap((parent) =>
      (parent.navChildren ?? []).filter((child) => child.href !== parent.href).map(
        (child): PaletteItem => ({
          name: child.name,
          href: child.href,
          description: parent.description,
          section: parent.section,
          v5FlagsAnyOf: child.v5FlagsAnyOf,
          badgeKey: child.badgeKey,
        })
      )
    ),
    ...CMDK_EXTRA_NAV_ITEMS,
  ];
  return [...new Map(items.map((item) => [item.href, item])).values()];
}

export function paletteHrefKey(href: string): string {
  return href.split("?")[0] ?? href;
}

export function resultMetaLabel(item: PaletteItem): string {
  if (item.resultMeta) return item.resultMeta;
  const area = WORKFLOW_AREA_LABELS[getWorkflowAreaForNavItem(item)];
  const path = item.href.split("?")[0] ?? item.href;
  return `${area} · ${path}`;
}

function isCmdkContractsListSearchJumpHref(href: string): boolean {
  const path = href.split("?")[0] ?? "";
  return path === "/contracts" && href.includes("search=");
}

export function cmdkJumpMatchesPaletteQuery(item: PaletteItem, q: string): boolean {
  if (isCmdkContractsListSearchJumpHref(item.href)) {
    if (/z{3,}/i.test(q) && !/\b(contract|search)\b/i.test(q)) return false;
    const n = normalizeContractsSearchQuery(q.trim());
    const nameBase = item.name.replace(/^Search contracts:\s*.+$/i, "Search contracts");
    const desc = item.description.replace(/prefiltered for "[^"]*"/, "prefiltered");
    const haystack = `${nameBase} ${desc} ${item.resultMeta ?? ""} ${n} ${item.href.split("?")[0] ?? ""}`.toLowerCase();
    return haystack.includes(q);
  }
  return `${item.name} ${item.description} ${item.href}`.toLowerCase().includes(q);
}
