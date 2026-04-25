import { NAV_ITEMS, getWorkflowAreaForNavItem } from "@/lib/navigation";
import { MORE_PAGE_JUMP_LINKS, MORE_TOOLS_GROUP_ORDER } from "@/lib/navigation/more-tools-model";
import { isNavItemVisibleForSurface, type NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { isPathAllowedForWorkspaceMode, minWorkspaceModeForPath } from "@/lib/product-surface/routes";
import { isHrefEligibleForNavSurface } from "@/lib/product-surface/href-eligibility";

/**
 * Whether `/more` would list at least one destination (ungrouped search) or show jump shortcuts.
 * Used to gate header Utilities links (Appendix B).
 */
export function moreToolsIndexHasVisibleEntries(
  input: NavSurfaceInput | null,
  v6Any: boolean
): boolean {
  if (!input) return true;

  if (v6Any) {
    const jumpAllowed = MORE_PAGE_JUMP_LINKS.filter((link) => {
      const path = link.href.split("#")[0] ?? link.href;
      if (!isPathAllowedForWorkspaceMode(path, input.mode)) return false;
      if (input.searchScope === "core_only" && minWorkspaceModeForPath(path) !== "core") return false;
      return isHrefEligibleForNavSurface(input, link.href);
    });
    if (jumpAllowed.length > 0) return true;
  }

  for (const group of MORE_TOOLS_GROUP_ORDER) {
    const items = NAV_ITEMS.filter(
      (item) =>
        getWorkflowAreaForNavItem(item) === group &&
        item.href !== "/more" &&
        isNavItemVisibleForSurface(item, input) &&
        isHrefEligibleForNavSurface(input, item.href)
    );
    if (items.length > 0) return true;
  }

  return false;
}
