"use client";
/* Primary nav Links use default Next prefetch (hover-driven). Rare / heavy destinations use prefetch={false} at call sites. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  LayoutDashboard,
  SearchCheck,
  Files,
  ListTodo,
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

export function Sidebar(props: {
  role?: WorkspaceRole;
  v5Flags?: Record<FeatureFlagKey, boolean>;
  navSurface?: NavSurfaceInput | null;
  navBadges?: Partial<
    Record<"reviewQueue" | "approvals" | "obligations" | "watchlists", number>
  >;
}) {
  const pathname = usePathname();
  const role = props.role ?? "viewer";
  const v5Flags = useMemo(
    () => props.v5Flags ?? ({} as Record<FeatureFlagKey, boolean>),
    [props.v5Flags]
  );
  const navBadges = props.navBadges ?? {};
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
    const preferredHrefs = [
      "/dashboard",
      "/work",
      "/contracts/review",
      "/reports",
      "/settings",
      "/assurance",
    ];
    const hubs: NavItem[] = [];
    for (const href of preferredHrefs) {
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
  }: {
    title?: string;
    items: NavItem[];
    compact?: boolean;
  }) => (
    <div className={title ? "mt-4 border-t border-white/[0.1] pt-3" : ""}>
      {title && !compact && (
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
          {title}
        </p>
      )}
      <nav className={title ? "mt-2 space-y-1" : "space-y-1"}>
        {items.map((item) => {
          const isActive = isActivePath(pathname, item.href);
          const hasBadgeValue =
            item.badgeKey != null &&
            Object.prototype.hasOwnProperty.call(navBadges, item.badgeKey);
          const badgeValue =
            item.badgeKey && hasBadgeValue ? Number(navBadges[item.badgeKey] ?? 0) : 0;
          const badgeTone =
            item.badgeKey === "reviewQueue"
              ? "bg-amber-300/20 text-amber-100"
              : item.badgeKey === "approvals"
                ? "bg-orange-300/20 text-orange-100"
                : item.badgeKey === "obligations"
                  ? "bg-rose-300/20 text-rose-100"
                  : "bg-white/[0.16] text-zinc-100";
          const iconKey = item.icon;
          const Icon = iconKey ? iconByKey[iconKey] : null;
          if (compact || Icon) {
            return (
              <div key={item.name} className="space-y-0.5">
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`ui-sidebar-link ${
                    isActive
                      ? "ui-sidebar-link-active ui-sidebar-link-active-rail"
                      : "ui-sidebar-link-idle"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                  title={effectiveCollapsed ? item.name : undefined}
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
                      className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white" : "bg-zinc-500"}`}
                    />
                  )}
                  {!effectiveCollapsed && (
                    <>
                      <span>{item.name}</span>
                      {hasBadgeValue && badgeValue > 0 && (
                        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight ${badgeTone}`}>
                          {badgeValue > 99 ? "99+" : badgeValue}
                        </span>
                      )}
                    </>
                  )}
                </Link>
                {!effectiveCollapsed && item.navChildren?.length
                  ? item.navChildren
                      .filter((c) => isNavChildVisibleForSurface(c, surface))
                      .map((c) => (
                        <Link
                          key={`${c.name}-${c.href}`}
                          href={c.href}
                          onClick={() => setMobileOpen(false)}
                          className={`ui-sidebar-link ui-sidebar-link-idle text-[12px] opacity-90 ${
                            Icon ? "ui-sidebar-sublink-align-icon" : "ui-sidebar-sublink-align-dot"
                          }`}
                        >
                          {c.name}
                        </Link>
                      ))
                  : null}
              </div>
            );
          }

          return (
            <div key={item.name} className="space-y-0.5">
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                  isActive
                    ? "bg-white/[0.1] text-zinc-100"
                    : "text-zinc-300 hover:bg-white/[0.05] hover:text-zinc-100"
                }`}
                aria-current={isActive ? "page" : undefined}
                title={item.description}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-zinc-100" : "bg-zinc-500"}`}
                />
                <span>{item.name}</span>
                {hasBadgeValue && badgeValue > 0 && (
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight ${badgeTone}`}>
                    {badgeValue > 99 ? "99+" : badgeValue}
                  </span>
                )}
              </Link>
              {!effectiveCollapsed && item.navChildren?.length
                ? item.navChildren
                    .filter((c) => isNavChildVisibleForSurface(c, surface))
                    .map((c) => (
                      <Link
                        key={`${c.name}-${c.href}`}
                        href={c.href}
                        onClick={() => setMobileOpen(false)}
                        className="ui-sidebar-sublink-align-dot-row flex items-center gap-2 rounded-lg py-1.5 pr-3 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-100"
                      >
                        {c.name}
                      </Link>
                    ))
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

  const renderSidebarBody = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      <div className="flex h-[4.5rem] items-center justify-between border-b border-white/[0.08] px-3">
        {!effectiveCollapsed && (
          <div className="flex min-w-0 items-center gap-3 pl-1">
            <span className="flex h-10 w-10 items-center justify-center rounded-[1rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
              <Orbit size={18} strokeWidth={1.85} aria-hidden />
            </span>
            <div className="min-w-0">
              <Link
                href="/dashboard"
                className="block truncate text-[15px] font-semibold tracking-tight text-white"
              >
                Oblixa
              </Link>
              <p className="truncate text-[11px] uppercase tracking-[0.16em] text-white/55">
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
            className="rounded-[0.95rem] p-2 text-zinc-300 transition-[background-color,color] duration-200 ease-out hover:bg-white/[0.1] hover:text-white"
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
            className={`rounded-[0.95rem] p-2 text-zinc-300 transition-[background-color,color] duration-200 ease-out hover:bg-white/[0.1] hover:text-white ${collapsed ? "mx-auto" : ""}`}
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
        {mobile && !effectiveCollapsed ? (
          <Link
            href="/more"
            onClick={() => setMobileOpen(false)}
            className="mb-4 block rounded-[1rem] border border-white/[0.14] bg-white/[0.06] px-3 py-2.5 text-[12px] font-semibold text-white/95"
          >
            Open utilities
          </Link>
        ) : null}
        {!effectiveCollapsed ? (
          <div className="mb-5 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-2.5">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/48">
              Areas
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {workflowAreaLinks.map(({ area, item }) => {
                const Icon = areaIconByKey[area];
                const isAreaActive = activeWorkflowArea === area;
                return (
                  <Link
                    key={`${area}-${item.href}`}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 rounded-[0.95rem] px-2.5 py-2 text-[12px] font-semibold transition-colors ${
                      isAreaActive
                        ? "bg-white/[0.12] text-white"
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
          {effectiveCollapsed ? renderNavSection({ title: "Primary", items: workflowHubs, compact: true }) : null}
          {!effectiveCollapsed
            ? groupedPrimary.map((group) => (
                <div key={group.label}>
                  {renderNavSection({
                    title: group.label,
                    items: group.items,
                    compact: true,
                  })}
                </div>
              ))
            : null}
        </div>
        {!effectiveCollapsed && (
          <>
            {renderNavSection({
              title: "Workflow queues",
              items: navBySection.operations.slice(0, 6),
            })}
            {navBySection.operations.length > 6 && (
              <Link
                href="/more?section=workflows"
                onClick={() => setMobileOpen(false)}
                className="mt-2 block rounded-[0.95rem] px-3 py-2 text-[12px] font-medium text-zinc-200 hover:bg-white/[0.08] hover:text-white"
              >
                Browse all queues
              </Link>
            )}
            {renderNavSection({
              title: "My views",
              items: navBySection.personal,
            })}
          </>
        )}
        {renderNavSection({
          title: effectiveCollapsed ? undefined : "Workspace",
          items: navBySection.workspace,
          compact: true,
        })}
      </div>

      <div className="border-t border-white/[0.08] p-2.5">
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-[1rem] px-3 py-2.5 text-[13px] font-medium text-zinc-300 transition-[background-color,color] duration-200 ease-out hover:bg-white/[0.08] hover:text-white"
            title={effectiveCollapsed ? "Sign out" : undefined}
          >
            <LogOut size={18} strokeWidth={1.65} className="shrink-0 opacity-95" aria-hidden />
            {!effectiveCollapsed && <span>Sign out</span>}
          </button>
        </form>
      </div>
    </>
  );

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
        className={`hidden min-h-0 flex-col border-r border-[var(--sidebar-border)] bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.18),transparent_28%),linear-gradient(180deg,var(--sidebar),color-mix(in_oklab,var(--sidebar)_92%,black)_100%)] motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out lg:flex ${
          effectiveCollapsed ? "w-[4.5rem]" : "w-[18.75rem]"
        }`}
      >
        {renderSidebarBody({})}
      </aside>
    </>
  );
}
