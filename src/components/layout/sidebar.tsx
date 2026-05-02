"use client";
/* Primary nav Links use default Next prefetch (hover-driven). Rare / heavy destinations use prefetch={false} at call sites. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  BadgeCheck,
  BarChart3,
  BellRing,
  Boxes,
  CalendarClock,
  FileCheck2,
  GitBranch,
  LayoutDashboard,
  SearchCheck,
  Files,
  ListTodo,
  Megaphone,
  Settings,
  CreditCard,
  LogOut,
  Orbit,
  PanelLeftOpen,
  PanelLeftClose,
  Grid2x2,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "@/actions/auth";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import {
  getWorkflowAreaForNavItem,
  NAV_ITEMS,
  PRIMARY_NAV_GROUPS,
  WORKFLOW_AREA_LABELS,
  isActivePath,
  type NavItem,
  type WorkspaceRole,
} from "@/lib/navigation";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import {
  isNavChildVisibleForSurface,
  isNavItemVisibleForSurface,
} from "@/lib/product-surface/nav-visibility";
import { shellTestIds } from "@/lib/qa/test-ids";

function fallbackNavSurface(
  role: WorkspaceRole,
  flags: Record<FeatureFlagKey, boolean>
): NavSurfaceInput {
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

const iconByKey = {
  dashboard: LayoutDashboard,
  review: SearchCheck,
  contracts: Files,
  tasks: ListTodo,
  renewals: CalendarClock,
  exceptions: BellRing,
  evidence: FileCheck2,
  reports: BarChart3,
  decisions: BadgeCheck,
  campaigns: Megaphone,
  assurance: Shield,
  relationships: GitBranch,
  programs: Boxes,
  settings: Settings,
  billing: CreditCard,
  more: Grid2x2,
} as const;

const areaIconByKey = {
  monitor: Orbit,
  workflows: BriefcaseBusiness,
  assurance: Shield,
  insights: SearchCheck,
  workspace: Settings,
} as const;

const COLLAPSED_PREF_KEY = "oblixa.sidebar.collapsed";

/** Heavy RSC destinations: avoid viewport prefetch churn (default hover prefetch stays on elsewhere). */
function sidebarPrefetch(href: string): boolean | undefined {
  const pathOnly = href.split("?")[0]?.split("#")[0] ?? href;
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

const RAIL_NAV_HREFS = [
  "/dashboard",
  "/contracts",
  "/contracts/review",
  "/work",
  "/reports",
  "/settings",
  "/assurance",
  "/more",
] as const;

type SidebarNavBadges = Partial<
  Record<"reviewQueue" | "approvals" | "obligations" | "watchlists", number>
>;

function pathOnly(href: string): string {
  return href.split("?")[0]?.split("#")[0] ?? href;
}

function badgeToneClass(badgeKey: NavItem["badgeKey"]): string {
  if (badgeKey === "reviewQueue") return "bg-amber-300/20 text-amber-100";
  if (badgeKey === "approvals") return "bg-orange-300/20 text-orange-100";
  if (badgeKey === "obligations") return "bg-rose-300/20 text-rose-100";
  return "bg-white/[0.16] text-[color:color-mix(in_oklab,var(--sidebar-fg)_90%,transparent)]";
}

function badgeLabel(badgeKey: NavItem["badgeKey"], value: number): string {
  const noun =
    badgeKey === "reviewQueue"
      ? "review queue items"
      : badgeKey === "approvals"
        ? "pending approvals"
        : badgeKey === "obligations"
          ? "open obligations"
          : "watchlist items";
  return `${value} ${noun}`;
}

export function Sidebar(props: {
  role?: WorkspaceRole;
  v5Flags?: Record<FeatureFlagKey, boolean>;
  navSurface?: NavSurfaceInput | null;
  navBadges?: SidebarNavBadges;
}) {
  const pathname = usePathname();
  const role = props.role ?? "viewer";
  const v5Flags = useMemo(
    () => props.v5Flags ?? ({} as Record<FeatureFlagKey, boolean>),
    [props.v5Flags]
  );
  const [clientNavBadges, setClientNavBadges] = useState<SidebarNavBadges>(
    () => props.navBadges ?? {}
  );
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const current = window.localStorage.getItem(COLLAPSED_PREF_KEY);
      if (current != null) return current === "1";
      return false;
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileNavOpenedRef = useRef(false);
  const mobileOpenButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!props.navSurface) return;
    let cancelled = false;
    void fetch("/api/workspace/nav-badges", {
      headers: { Accept: "application/json" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { navBadges?: SidebarNavBadges } | null) => {
        if (!cancelled && payload?.navBadges) {
          setClientNavBadges(payload.navBadges);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [props.navSurface, role]);

  useEffect(() => {
    if (mobileOpen) {
      mobileNavOpenedRef.current = true;
      requestAnimationFrame(() => mobileCloseButtonRef.current?.focus());
    } else if (mobileNavOpenedRef.current) {
      mobileOpenButtonRef.current?.focus();
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  /** Onboarding routes: icon rail only on desktop (focused calibration shell; pathname-driven). */
  const isOnboardingShell = pathname.startsWith("/onboarding");
  const effectiveCollapsed = isOnboardingShell || collapsed;

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_PREF_KEY, collapsed ? "1" : "0");
    } catch {
      // Ignore storage errors.
    }
  }, [collapsed]);

  const surface = useMemo(
    () => props.navSurface ?? fallbackNavSurface(role, v5Flags),
    [props.navSurface, role, v5Flags]
  );
  const navBadges = clientNavBadges;

  const navBySection = useMemo(() => {
    const visible = NAV_ITEMS.filter((item) => isNavItemVisibleForSurface(item, surface));
    return {
      primary: visible.filter((item) => item.section === "primary"),
      operations: visible.filter((item) => item.section === "operations"),
      personal: visible.filter((item) => item.section === "personal"),
      workspace: visible.filter((item) => item.section === "workspace"),
    };
  }, [surface]);

  const workflowHubs = useMemo(() => {
    const hubs: NavItem[] = [];
    for (const href of RAIL_NAV_HREFS) {
      const match = navBySection.primary.find((item) => item.href === href);
      if (match) hubs.push(match);
    }
    return hubs;
  }, [navBySection.primary]);

  const groupedPrimary = useMemo(() => {
    return PRIMARY_NAV_GROUPS.map((group) => ({
      label: group.label,
      items: navBySection.primary.filter((item) => group.hrefs.includes(item.href)),
    })).filter((group) => group.items.length > 0);
  }, [navBySection.primary]);

  const renderNavSection = ({
    title,
    items,
    compact = false,
    collapsed: sectionCollapsed = effectiveCollapsed,
  }: {
    title?: string;
    items: NavItem[];
    compact?: boolean;
    collapsed?: boolean;
  }) => (
    <div className={title ? "mt-4 border-t border-white/[0.08] pt-3.5" : ""}>
      {title && !compact && (
        <p id={`sidebar-section-${title.toLowerCase().replace(/\s+/g, "-")}`} className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
          {title}
        </p>
      )}
      <nav aria-label={title ?? "Primary navigation"} className={title ? "mt-2.5 space-y-1.5" : "space-y-1.5"}>
        {items.map((item) => {
          const visibleChildren = (item.navChildren ?? []).filter((c) =>
            isNavChildVisibleForSurface(c, surface)
          );
          const activeChildHref = visibleChildren.find((c) => {
            const childPath = pathOnly(c.href);
            return pathname === childPath || pathname.startsWith(`${childPath}/`);
          })?.href;
          const isExactActive = isActivePath(pathname, item.href);
          const isActive = isExactActive || Boolean(activeChildHref);
          const hasBadgeValue =
            item.badgeKey != null &&
            Object.prototype.hasOwnProperty.call(navBadges, item.badgeKey);
          const badgeValue =
            item.badgeKey && hasBadgeValue ? Number(navBadges[item.badgeKey] ?? 0) : 0;
          const badgeTone = badgeToneClass(item.badgeKey);
          const renderedBadge =
            item.badgeKey && hasBadgeValue && badgeValue > 0 ? (
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${badgeTone}`}
                aria-label={badgeLabel(item.badgeKey, badgeValue)}
                title={badgeLabel(item.badgeKey, badgeValue)}
              >
                {badgeValue > 99 ? "99+" : badgeValue}
              </span>
            ) : null;
          const renderedCollapsedBadge =
            item.badgeKey && hasBadgeValue && badgeValue > 0 ? (
              <span
                className={`absolute right-1.5 top-1.5 h-2 min-w-2 rounded-full ${badgeTone}`}
                aria-label={badgeLabel(item.badgeKey, badgeValue)}
                title={badgeLabel(item.badgeKey, badgeValue)}
              />
            ) : null;
          const iconKey = item.icon;
          const Icon = iconKey ? iconByKey[iconKey] : null;
          if (compact || Icon) {
            return (
              <div key={item.href} className="space-y-0.5">
                <Link
                  href={item.href}
                  prefetch={sidebarPrefetch(item.href)}
                  onClick={() => setMobileOpen(false)}
                  className={`ui-sidebar-link ${
                    isActive
                      ? "ui-sidebar-link-active ui-sidebar-link-active-rail"
                      : "ui-sidebar-link-idle"
                  }`}
                  aria-current={isExactActive ? "page" : undefined}
                  title={sectionCollapsed ? item.name : undefined}
                >
                  {Icon ? (
                    <Icon
                      size={18}
                      strokeWidth={1.65}
                      className="shrink-0 opacity-90"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white" : "bg-white/35"}`}
                    />
                  )}
                  {sectionCollapsed ? renderedCollapsedBadge : null}
                  {!sectionCollapsed && (
                    <>
                      <span className="min-w-0 truncate">{item.name}</span>
                      {renderedBadge}
                    </>
                  )}
                </Link>
                {!sectionCollapsed && visibleChildren.length
                  ? visibleChildren.map((c) => {
                      const childPath = pathOnly(c.href);
                      const childActive = activeChildHref === c.href;
                      return (
                        <Link
                          key={`${c.name}-${c.href}`}
                          href={c.href}
                          prefetch={sidebarPrefetch(c.href)}
                          onClick={() => setMobileOpen(false)}
                          className={`ui-sidebar-link text-[12px] ${
                            childActive ? "ui-sidebar-sublink-active" : "ui-sidebar-link-idle opacity-90"
                          } ${Icon ? "ui-sidebar-sublink-align-icon" : "ui-sidebar-sublink-align-dot"}`}
                          aria-current={pathname === childPath ? "page" : undefined}
                        >
                          <span className="min-w-0 truncate">{c.name}</span>
                        </Link>
                      );
                    })
                  : null}
              </div>
            );
          }

          return (
            <div key={item.href} className="space-y-0.5">
              <Link
                href={item.href}
                prefetch={sidebarPrefetch(item.href)}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                  isActive
                    ? "bg-white/[0.12] text-[color:color-mix(in_oklab,var(--sidebar-fg)_92%,transparent)]"
                    : "text-[var(--text-tertiary)] hover:bg-white/[0.06] hover:text-[color:color-mix(in_oklab,var(--sidebar-fg)_92%,transparent)]"
                }`}
                aria-current={isExactActive ? "page" : undefined}
                title={item.description}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))]" : "bg-white/35"}`}
                />
                <span className="min-w-0 truncate">{item.name}</span>
                {renderedBadge}
              </Link>
              {!sectionCollapsed && visibleChildren.length
                ? visibleChildren.map((c) => {
                    const childPath = pathOnly(c.href);
                    const childActive = activeChildHref === c.href;
                    return (
                      <Link
                        key={`${c.name}-${c.href}`}
                        href={c.href}
                        prefetch={sidebarPrefetch(c.href)}
                        onClick={() => setMobileOpen(false)}
                        className={`ui-sidebar-sublink-align-dot-row flex items-center gap-2 rounded-lg py-1.5 pr-3 text-[12px] transition-colors ${
                          childActive
                            ? "ui-sidebar-sublink-active"
                            : "text-[var(--text-tertiary)] hover:bg-white/[0.05] hover:text-[color:color-mix(in_oklab,var(--sidebar-fg)_92%,transparent)]"
                        }`}
                        aria-current={pathname === childPath ? "page" : undefined}
                      >
                        <span className="min-w-0 truncate">{c.name}</span>
                      </Link>
                    );
                  })
                : null}
            </div>
          );
        })}
      </nav>
    </div>
  );

  const workflowAreaLinks = useMemo(() => {
    return (["monitor", "workflows", "assurance", "insights", "workspace"] as const)
      .map((area) => {
        const item = navBySection.primary.find((entry) => getWorkflowAreaForNavItem(entry) === area) ??
          (area === "workspace"
            ? NAV_ITEMS.find((entry) => entry.href === "/settings")
            : area === "insights"
              ? NAV_ITEMS.find((entry) => entry.href === "/reports")
              : area === "assurance"
                ? NAV_ITEMS.find((entry) => entry.href === "/assurance")
                : area === "monitor"
                  ? NAV_ITEMS.find((entry) => entry.href === "/dashboard")
                  : NAV_ITEMS.find((entry) => entry.href === "/work"));
        if (!item || !isNavItemVisibleForSurface(item, surface)) return null;
        return { area, item };
      })
      .filter((value): value is NonNullable<typeof value> => value != null);
  }, [navBySection.primary, surface]);

  const activeWorkflowArea = useMemo(() => {
    const active = NAV_ITEMS
      .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0];
    return active ? getWorkflowAreaForNavItem(active) : "monitor";
  }, [pathname]);

  const renderSidebarBody = ({ mobile = false }: { mobile?: boolean }) => {
    const bodyCollapsed = mobile ? false : effectiveCollapsed;

    return (
    <>
      <div className="flex h-[4.5rem] items-center justify-between border-b border-white/[0.08] px-3">
        {!bodyCollapsed && (
          <div className="flex min-w-0 items-center gap-3 pl-1">
            <span className="flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.05))] text-white shadow-[0_14px_28px_rgba(0,0,0,0.18)]">
              <Orbit size={18} strokeWidth={1.85} aria-hidden />
            </span>
            <div className="min-w-0">
              <Link
                href="/dashboard"
                className="block truncate text-[15px] font-semibold tracking-tight text-white"
              >
                Oblixa
              </Link>
              <p className="truncate text-[10px] uppercase tracking-[0.18em] text-white/52">
                Contract operations OS
              </p>
            </div>
          </div>
        )}
        {mobile ? (
          <button
            ref={mobileCloseButtonRef}
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ui-icon-button border-white/10 bg-white/[0.02] p-2 text-[var(--sidebar-muted)] hover:bg-white/[0.1] hover:text-white"
            aria-label="Close navigation"
          >
            <X size={18} aria-hidden />
          </button>
        ) : isOnboardingShell ? (
          <div className="mx-auto h-10 w-10 shrink-0" aria-hidden />
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            data-testid={shellTestIds.sidebarCollapseToggle}
            className={`ui-icon-button border-white/10 bg-white/[0.02] p-2 text-[var(--sidebar-muted)] hover:bg-white/[0.1] hover:text-white ${collapsed ? "mx-auto" : ""}`}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} aria-hidden />
            ) : (
              <PanelLeftClose size={18} aria-hidden />
            )}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2.5 py-4">
        {mobile && !bodyCollapsed ? (
          <Link
            href="/more"
            prefetch={false}
            onClick={() => setMobileOpen(false)}
            className="mb-4 block rounded-[1rem] border border-white/[0.14] bg-white/[0.06] px-3 py-2.5 text-[12px] font-semibold text-white/95"
          >
            Open tools
          </Link>
        ) : null}
        {!bodyCollapsed ? (
          <div className="mb-5 rounded-[1.35rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/46">
              Workflow areas
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              {workflowAreaLinks.map(({ area, item }) => {
                const Icon = areaIconByKey[area];
                const isAreaActive = activeWorkflowArea === area;
                return (
                  <Link
                    key={`${area}-${item.href}`}
                    href={item.href}
                    prefetch={sidebarPrefetch(item.href)}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 rounded-[0.95rem] px-2.5 py-2 text-[12px] font-semibold transition-colors ${
                      isAreaActive
                        ? "bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        : "text-white/70 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    <Icon size={14} strokeWidth={1.8} aria-hidden />
                    <span>{WORKFLOW_AREA_LABELS[area]}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
        <div data-testid={shellTestIds.primaryNav}>
          {bodyCollapsed ? renderNavSection({ title: "Primary", items: workflowHubs, compact: true, collapsed: bodyCollapsed }) : null}
          {!bodyCollapsed
            ? groupedPrimary.map((group) => (
                <div key={group.label}>
                  {renderNavSection({
                    title: group.label,
                    items: group.items,
                    compact: true,
                    collapsed: bodyCollapsed,
                  })}
                </div>
              ))
            : null}
        </div>
        {!bodyCollapsed && (
          <>
            {renderNavSection({
              title: "Workflow queues",
              items: navBySection.operations.slice(0, 6),
              collapsed: bodyCollapsed,
            })}
            {navBySection.operations.length > 6 && (
              <Link
                href="/more?section=workflows"
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                className="mt-2.5 block rounded-[var(--radius-lg)] px-3 py-2 text-[12px] font-medium text-[color:color-mix(in_oklab,var(--sidebar-fg)_78%,transparent)] transition-colors duration-[var(--ui-duration)] hover:bg-white/[0.08] hover:text-white"
              >
                Browse all queues
              </Link>
            )}
            {renderNavSection({
              title: "My views",
              items: navBySection.personal,
              collapsed: bodyCollapsed,
            })}
          </>
        )}
        {renderNavSection({
          title: bodyCollapsed ? undefined : "Workspace",
          items: navBySection.workspace,
          compact: true,
          collapsed: bodyCollapsed,
        })}
      </div>

      <div className="border-t border-white/[0.08] p-2.5">
        <form action={signOut}>
          <button
            type="submit"
            data-testid={shellTestIds.sidebarSignOut}
            className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2.5 text-[13px] font-medium text-[var(--sidebar-muted)] transition-[background-color,color] duration-[var(--ui-duration)] hover:bg-white/[0.08] hover:text-white"
            title={bodyCollapsed ? "Sign out" : undefined}
          >
            <LogOut size={18} strokeWidth={1.65} className="shrink-0 opacity-95" aria-hidden />
            {!bodyCollapsed && <span>Sign out</span>}
          </button>
        </form>
      </div>
    </>
    );
  };

  return (
    <>
      <button
        ref={mobileOpenButtonRef}
        type="button"
        onClick={() => setMobileOpen(true)}
        data-testid={shellTestIds.sidebarMobileOpen}
        className="fixed left-4 top-4 z-40 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[1rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white)] p-2 text-[var(--text-secondary)] shadow-[var(--shadow-1)] backdrop-blur lg:hidden"
        aria-label="Open navigation"
      >
        <Grid2x2 size={18} aria-hidden />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
          data-testid={shellTestIds.sidebarMobileDrawer}
        >
          <button
            type="button"
            className="ui-overlay-scrim h-full flex-1"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation overlay"
          />
          <aside className="flex h-dvh max-h-dvh min-h-0 w-[22rem] max-w-[92vw] flex-col border-l border-[var(--sidebar-border)] bg-[var(--sidebar)]">
            {renderSidebarBody({ mobile: true })}
          </aside>
        </div>
      )}

      <aside
        aria-label="Workspace"
        data-testid={shellTestIds.sidebarDesktop}
        className={`hidden min-h-0 flex-col border-r border-[var(--sidebar-border)] bg-[radial-gradient(circle_at_top,color-mix(in_oklab,var(--accent)_20%,transparent),transparent_28%),linear-gradient(180deg,var(--sidebar),color-mix(in_oklab,var(--sidebar)_92%,black)_100%)] motion-safe:transition-[width] motion-safe:duration-[var(--ui-duration-slow)] motion-safe:ease-[var(--ui-ease-out)] lg:flex ${
          effectiveCollapsed ? "w-[4.75rem]" : "w-[19.5rem]"
        }`}
      >
        {renderSidebarBody({})}
      </aside>
    </>
  );
}
