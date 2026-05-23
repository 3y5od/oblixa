import {
  getWorkflowAreaForNavItem,
  isActivePath,
  isContractsRoot,
  NAV_ITEMS,
  PRIMARY_NAV_GROUPS,
  type NavItem,
} from "@/lib/navigation";
import {
  isNavChildVisibleForSurface,
  isNavItemVisibleForSurface,
  type NavSurfaceInput,
} from "@/lib/product-surface/nav-visibility";

export type SidebarNavBadges = Partial<
  Record<"reviewQueue" | "approvals" | "obligations" | "watchlists", number>
>;

export type SidebarModelInput = {
  pathname: string;
  search: string | URLSearchParams;
  hash: string;
  surface: NavSurfaceInput;
  navBadges: SidebarNavBadges;
  showToolsLink: boolean;
  forcedCollapsed: boolean;
};

export type SidebarSectionModel = {
  id: string;
  label: string;
  ariaLabel: string;
  items: SidebarItemModel[];
  variant: "primary" | "secondary" | "workspace" | "rail";
  visibleWhenCollapsed: boolean;
};

export type SidebarItemModel = {
  name: string;
  href: string;
  description: string;
  icon: NavItem["icon"];
  children: SidebarItemModel[];
  active: boolean;
  exactActive: boolean;
  badge?: SidebarBadgeModel;
  prefetch: boolean | undefined;
  collapsedLabel: string;
};

export type SidebarBadgeModel = {
  value: number;
  displayValue: string;
  label: string;
  tone: NonNullable<NavItem["badgeKey"]>;
  showDotOnlyWhenCollapsed: boolean;
};

export type SidebarParsedHref = {
  pathname: string;
  searchParams: URLSearchParams;
  hash: string;
};

export type SidebarModel = {
  sections: SidebarSectionModel[];
  collapsed: boolean;
};

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  const withLeading = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  const normalized = withLeading.replace(/\/+/g, "/");
  return normalized.length > 1 ? normalized.replace(/\/$/, "") : normalized;
}

export function parseSidebarHref(href: string): SidebarParsedHref {
  const [beforeHash, hashPart = ""] = href.split("#");
  const [pathPart, searchPart = ""] = (beforeHash ?? href).split("?");
  return {
    pathname: normalizePathname(pathPart || "/"),
    searchParams: new URLSearchParams(searchPart),
    hash: hashPart ? `#${hashPart}` : "",
  };
}

function parseCurrent(input: SidebarModelInput): SidebarParsedHref {
  const parsed = parseSidebarHref(input.pathname);
  const rawSearch = typeof input.search === "string" ? input.search : input.search.toString();
  return {
    pathname: parsed.pathname,
    searchParams: new URLSearchParams(rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch),
    hash: input.hash ? (input.hash.startsWith("#") ? input.hash : `#${input.hash}`) : "",
  };
}

function hasRequiredQueryParams(current: URLSearchParams, target: URLSearchParams): boolean {
  for (const [key, value] of target.entries()) {
    if (current.get(key) !== value) return false;
  }
  return true;
}

function targetSpecificity(target: SidebarParsedHref): number {
  let score = target.pathname.length;
  target.searchParams.forEach(() => {
    score += 100;
  });
  if (target.hash) score += 50;
  return score;
}

export function isSidebarHrefExactActive(
  current: SidebarParsedHref,
  target: SidebarParsedHref
): boolean {
  if (target.pathname === "/contracts" && target.searchParams.size === 0 && !target.hash) {
    return isContractsRoot(current.pathname);
  }
  if (current.pathname !== target.pathname) return false;
  if (target.hash && current.hash !== target.hash) return false;
  if (target.searchParams.size > 0) {
    return hasRequiredQueryParams(current.searchParams, target.searchParams);
  }
  if (target.hash) return true;
  return true;
}

export function isSidebarHrefVisuallyActive(
  current: SidebarParsedHref,
  target: SidebarParsedHref
): boolean {
  if (target.searchParams.size > 0 || target.hash) return isSidebarHrefExactActive(current, target);
  return isActivePath(current.pathname, target.pathname);
}

export function sidebarPrefetch(href: string): boolean | undefined {
  const pathOnly = parseSidebarHref(href).pathname;
  if (
    pathOnly.startsWith("/contracts") ||
    pathOnly.startsWith("/reports") ||
    pathOnly.startsWith("/assurance") ||
    pathOnly.startsWith("/more")
  ) {
    return false;
  }
  return undefined;
}

function badgeLabel(badgeKey: NonNullable<NavItem["badgeKey"]>, value: number): string {
  if (badgeKey === "reviewQueue") {
    return `${value} field review ${value === 1 ? "item" : "items"} ${value === 1 ? "needs" : "need"} action`;
  }
  if (badgeKey === "approvals") {
    return `${value} pending ${value === 1 ? "approval" : "approvals"} ${value === 1 ? "needs" : "need"} action`;
  }
  if (badgeKey === "obligations") {
    return `${value} ${value === 1 ? "obligation" : "obligations"} ${value === 1 ? "needs" : "need"} attention`;
  }
  return `${value} watchlist ${value === 1 ? "item" : "items"} ${value === 1 ? "needs" : "need"} attention`;
}

function badgeForKey(
  badgeKey: NonNullable<NavItem["badgeKey"]> | undefined,
  navBadges: SidebarNavBadges
): SidebarBadgeModel | undefined {
  if (!badgeKey || !Object.prototype.hasOwnProperty.call(navBadges, badgeKey)) return undefined;
  const value = Math.max(0, Math.trunc(Number(navBadges[badgeKey] ?? 0)));
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return {
    value,
    displayValue: value > 99 ? "99+" : String(value),
    label: badgeLabel(badgeKey, value),
    tone: badgeKey,
    showDotOnlyWhenCollapsed: true,
  };
}

function badgeForItem(item: NavItem, navBadges: SidebarNavBadges): SidebarBadgeModel | undefined {
  return badgeForKey(item.badgeKey, navBadges);
}

function aggregateChildBadges(
  parent: NavItem,
  childBadges: SidebarBadgeModel[]
): SidebarBadgeModel | undefined {
  if (childBadges.length === 0) return undefined;
  if (childBadges.length === 1) return childBadges[0];
  const value = childBadges.reduce((total, badge) => total + badge.value, 0);
  return {
    value,
    displayValue: value > 99 ? "99+" : String(value),
    label: `${value} ${parent.name.toLowerCase()} ${value === 1 ? "item needs" : "items need"} action`,
    tone: childBadges[0]?.tone ?? "approvals",
    showDotOnlyWhenCollapsed: true,
  };
}

function visibleNavItems(input: SidebarModelInput): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (parseSidebarHref(item.href).pathname === "/more") {
      return input.surface.mode !== "core" && input.showToolsLink;
    }
    return isNavItemVisibleForSurface(item, input.surface);
  });
}

function mostSpecificActiveChild(
  children: NavItem["navChildren"],
  current: SidebarParsedHref
): string | null {
  if (!children?.length) return null;
  const active = children
    .map((child) => ({ child, target: parseSidebarHref(child.href) }))
    .filter(({ target }) => isSidebarHrefVisuallyActive(current, target))
    .sort((a, b) => targetSpecificity(b.target) - targetSpecificity(a.target));
  return active[0]?.child.href ?? null;
}

function toSidebarItem(
  item: NavItem,
  input: SidebarModelInput,
  current: SidebarParsedHref,
  visiblePrimaryHrefs: ReadonlySet<string>,
  exactPrimaryHref: string | null
): SidebarItemModel {
  const visibleChildren = (item.navChildren ?? []).filter((child) =>
    isNavChildVisibleForSurface(child, input.surface)
  );
  const childBadges = visibleChildren
    .map((child) => badgeForKey(child.badgeKey, input.navBadges))
    .filter((badge): badge is SidebarBadgeModel => badge !== undefined);
  const activeChildHref = mostSpecificActiveChild(visibleChildren, current);
  const target = parseSidebarHref(item.href);
  const exactActive = isSidebarHrefExactActive(current, target);
  const active = isSidebarHrefVisuallyActive(current, target) || activeChildHref != null;
  const ownBadge = badgeForItem(item, input.navBadges);
  return {
    name: item.name,
    href: item.href,
    description: item.description,
    icon: item.icon,
    children: visibleChildren.map((child) => {
      const childTarget = parseSidebarHref(child.href);
      const childExact = isSidebarHrefExactActive(current, childTarget);
      const duplicatePrimary = visiblePrimaryHrefs.has(child.href) && exactPrimaryHref === child.href;
      return {
        name: child.name,
        href: child.href,
        description: child.name,
        icon: undefined,
        children: [],
        active: child.href === activeChildHref,
        exactActive: childExact && !duplicatePrimary,
        badge: badgeForKey(child.badgeKey, input.navBadges),
        prefetch: sidebarPrefetch(child.href),
        collapsedLabel: child.name,
      } satisfies SidebarItemModel;
    }),
    exactActive,
    active,
    badge: input.forcedCollapsed ? ownBadge ?? aggregateChildBadges(item, childBadges) : ownBadge,
    prefetch: sidebarPrefetch(item.href),
    collapsedLabel: item.name,
  };
}

function sectionId(label: string, variant: SidebarSectionModel["variant"]): string {
  return `sidebar-${variant}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function localPrimaryLabel(label: string): string {
  return label === "Workspace" ? "Core" : label;
}

function orderPrimaryItems(primary: NavItem[]): NavItem[] {
  const byHref = new Map(primary.map((item) => [item.href, item]));
  const ordered: NavItem[] = [];
  for (const group of PRIMARY_NAV_GROUPS) {
    for (const href of group.hrefs) {
      const item = byHref.get(href);
      if (item) ordered.push(item);
    }
  }
  for (const item of primary) {
    if (!ordered.some((orderedItem) => orderedItem.href === item.href)) ordered.push(item);
  }
  return ordered;
}

export function buildSidebarModel(input: SidebarModelInput): SidebarModel {
  const current = parseCurrent(input);
  const visible = visibleNavItems(input);
  const primary = orderPrimaryItems(visible.filter((item) => item.section === "primary"));
  const operations = visible.filter((item) => item.section === "operations");
  const personal = visible.filter((item) => item.section === "personal");
  const workspace = visible.filter((item) => item.section === "workspace");
  const visiblePrimaryHrefs = new Set(primary.map((item) => item.href));
  const visiblePrimaryChildHrefs = new Set(
    primary.flatMap((item) =>
      (item.navChildren ?? [])
        .filter((child) => isNavChildVisibleForSurface(child, input.surface))
        .map((child) => child.href)
    )
  );
  const exactPrimaryHref = primary.find((item) => isSidebarHrefExactActive(current, parseSidebarHref(item.href)))?.href ?? null;
  const toItem = (item: NavItem) => toSidebarItem(item, input, current, visiblePrimaryHrefs, exactPrimaryHref);
  const nonDuplicatedOperations =
    input.surface.mode === "core"
      ? []
      : operations.filter((item) => !visiblePrimaryChildHrefs.has(item.href));

  if (input.forcedCollapsed) {
    return {
      collapsed: true,
      sections: [
        {
          id: "sidebar-rail-primary",
          label: "Primary",
          ariaLabel: "Primary rail navigation",
          items: primary.map(toItem),
          variant: "rail" as const,
          visibleWhenCollapsed: true,
        },
        ...(workspace.length > 0
          ? [
              {
                id: "sidebar-rail-workspace",
                label: "Workspace",
                ariaLabel: "Workspace rail navigation",
                items: workspace.map(toItem),
                variant: "rail" as const,
                visibleWhenCollapsed: true,
              },
            ]
          : []),
      ].filter((section) => section.items.length > 0),
    };
  }

  const sections: SidebarSectionModel[] = [];
  for (const group of PRIMARY_NAV_GROUPS) {
    const groupItems = primary.filter((item) => group.hrefs.includes(item.href));
    if (groupItems.length === 0) continue;
    const label = localPrimaryLabel(group.label);
    sections.push({
      id: sectionId(label, "primary"),
      label,
      ariaLabel: `${label} navigation`,
      items: groupItems.map(toItem),
      variant: "primary",
      visibleWhenCollapsed: false,
    });
  }

  if (nonDuplicatedOperations.length > 0) {
    const visibleOperations = nonDuplicatedOperations.slice(0, 6).map(toItem);
    if (nonDuplicatedOperations.length > 6 && input.showToolsLink) {
      visibleOperations.push({
        name: "Browse all queues",
        href: "/more?section=workflows",
        description: "Browse all workflow queues.",
        icon: undefined,
        children: [],
        active: isSidebarHrefVisuallyActive(current, parseSidebarHref("/more?section=workflows")),
        exactActive: isSidebarHrefExactActive(current, parseSidebarHref("/more?section=workflows")),
        prefetch: false,
        collapsedLabel: "Queues",
      });
    }
    sections.push({
      id: "sidebar-secondary-workflow-queues",
      label: "Workflow queues",
      ariaLabel: "Workflow queues navigation",
      items: visibleOperations,
      variant: "secondary",
      visibleWhenCollapsed: false,
    });
  }

  if (personal.length > 1 || (personal.length > 0 && input.surface.mode !== "core")) {
    sections.push({
      id: "sidebar-secondary-my-views",
      label: "My views",
      ariaLabel: "My views navigation",
      items: personal.map(toItem),
      variant: "secondary",
      visibleWhenCollapsed: false,
    });
  }

  if (workspace.length > 0) {
    sections.push({
      id: "sidebar-workspace-tools",
      label: "Workspace",
      ariaLabel: "Workspace navigation",
      items: workspace.map(toItem),
      variant: "workspace",
      visibleWhenCollapsed: false,
    });
  }

  return { collapsed: false, sections };
}

export function sidebarWorkflowAreaForHref(href: string): ReturnType<typeof getWorkflowAreaForNavItem> {
  return getWorkflowAreaForNavItem({ href, section: "primary", name: href, description: href });
}
