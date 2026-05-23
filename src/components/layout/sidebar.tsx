"use client";
/* Primary nav Links use default Next prefetch (hover-driven). Rare / heavy destinations use prefetch={false}. */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  BarChart3,
  BellRing,
  Boxes,
  CalendarClock,
  CreditCard,
  FileCheck2,
  Files,
  GitBranch,
  Grid2x2,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Megaphone,
  Orbit,
  PanelLeftClose,
  PanelLeftOpen,
  SearchCheck,
  Settings,
  Shield,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { signOut } from "@/actions/auth";
import { fetchJson } from "@/lib/http/client-json";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { WorkspaceRole } from "@/lib/navigation";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { filterNavBadgesForSurface } from "@/lib/product-surface/nav-visibility";
import { shellTestIds } from "@/lib/qa/test-ids";
import {
  readSidebarCollapsedPreference,
  writeSidebarCollapsedPreference,
} from "@/lib/security/client-storage";
import {
  buildSidebarModel,
  type SidebarBadgeModel,
  type SidebarItemModel,
  type SidebarNavBadges,
  type SidebarSectionModel,
} from "./sidebar-model";

const COLLAPSED_PREF_EVENT = "oblixa:sidebar-collapsed-change";
const DESKTOP_SIDEBAR_BODY_ID = "desktop-sidebar-body";

const iconByKey: Record<NonNullable<SidebarItemModel["icon"]>, LucideIcon> = {
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
};

function fallbackNavSurface(role: WorkspaceRole, flags: Record<FeatureFlagKey, boolean>): NavSurfaceInput {
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

function badgeToneClass(tone: SidebarBadgeModel["tone"]): string {
  if (tone === "reviewQueue") {
    return "border border-amber-400/30 bg-amber-300/15 text-amber-100";
  }
  if (tone === "approvals") {
    return "border border-orange-400/30 bg-orange-300/15 text-orange-100";
  }
  if (tone === "obligations") {
    return "border border-rose-400/30 bg-rose-300/15 text-rose-100";
  }
  return "border border-white/10 bg-white/[0.08] text-[color:color-mix(in_oklab,var(--sidebar-fg)_90%,transparent)]";
}

function SidebarBadge({ badge, collapsed }: { badge?: SidebarBadgeModel; collapsed: boolean }) {
  if (!badge) return null;
  if (collapsed && badge.showDotOnlyWhenCollapsed) {
    return (
      <span
        aria-hidden="true"
        title={badge.label}
        className={`absolute right-1.5 top-1.5 h-2 min-w-2 rounded-full ring-1 ring-black/20 ${badgeToneClass(badge.tone)}`}
      />
    );
  }
  return (
    <span
      className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${badgeToneClass(badge.tone)}`}
      aria-label={badge.label}
      title={badge.label}
    >
      {badge.displayValue}
    </span>
  );
}

function SidebarNavLink({
  item,
  collapsed,
  child = false,
  onNavigate,
  tooltipHref,
  setTooltipHref,
}: {
  item: SidebarItemModel;
  collapsed: boolean;
  child?: boolean;
  onNavigate: () => void;
  tooltipHref: string | null;
  setTooltipHref: (href: string | null) => void;
}) {
  const Icon = item.icon ? iconByKey[item.icon] : null;
  const tooltipId = `sidebar-tooltip-${item.href.replace(/[^a-z0-9]+/gi, "-")}`;
  const tooltipVisible = collapsed && tooltipHref === item.href;
  const childClass = child
    ? `ui-sidebar-sublink-indent text-[12.5px] ${
        item.active ? "ui-sidebar-sublink-active" : "ui-sidebar-link-idle opacity-90"
      }`
    : item.active
      ? `ui-sidebar-link-active ${collapsed ? "ui-sidebar-link-active-rail" : ""}`
      : "ui-sidebar-link-idle";

  return (
    <Link
      href={item.href}
      prefetch={item.prefetch}
      onClick={onNavigate}
      onFocus={() => collapsed && setTooltipHref(item.href)}
      onBlur={() => collapsed && setTooltipHref(null)}
      onMouseEnter={() => collapsed && setTooltipHref(item.href)}
      onMouseLeave={() => collapsed && setTooltipHref(null)}
      className={`ui-sidebar-link ${childClass}`}
      aria-current={item.exactActive ? "page" : undefined}
      aria-label={collapsed ? item.collapsedLabel : undefined}
      aria-describedby={tooltipVisible ? tooltipId : undefined}
      data-sidebar-href={item.href}
    >
      {Icon ? (
        <Icon size={18} strokeWidth={1.85} className="shrink-0 opacity-90" aria-hidden />
      ) : child ? null : (
        /* Top-level row without icon → render an empty-ring marker, not a
           filled gray dot. The empty ring communicates "indeterminate /
           leaf" rather than implying a status signal. */
        <span
          aria-hidden
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            item.active
              ? "bg-white"
              : "border border-white/35 bg-transparent"
          }`}
        />
      )}
      {collapsed && <SidebarBadge badge={item.badge} collapsed />}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.name}</span>}
      {!collapsed && <SidebarBadge badge={item.badge} collapsed={false} />}
      {tooltipVisible ? (
        <span
          id={tooltipId}
          aria-hidden="true"
          className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[var(--sidebar-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--sidebar-fg)] shadow-[var(--shadow-2)]"
        >
          {item.collapsedLabel}
        </span>
      ) : null}
    </Link>
  );
}

function SidebarSection({
  section,
  collapsed,
  onNavigate,
  tooltipHref,
  setTooltipHref,
  first,
}: {
  section: SidebarSectionModel;
  collapsed: boolean;
  onNavigate: () => void;
  tooltipHref: string | null;
  setTooltipHref: (href: string | null) => void;
  first: boolean;
}) {
  if (section.items.length === 0) return null;
  const hideHeadingVisually = collapsed || first;
  return (
    <section className={section.variant === "rail" ? "mt-2" : first ? "mt-0 pt-0" : "mt-3 border-t border-[var(--sidebar-section-border)] pt-2.5"}>
      <h2
        id={`${section.id}-heading`}
        className={
          hideHeadingVisually
            ? "sr-only"
            : "ui-caps-1 px-3 text-[10px]"
        }
        style={
          hideHeadingVisually
            ? undefined
            : { color: "var(--sidebar-heading)" }
        }
      >
        {section.label}
      </h2>
      <nav aria-labelledby={`${section.id}-heading`} className={collapsed ? "space-y-1.5" : hideHeadingVisually ? "space-y-1.5" : "mt-2 space-y-1.5"}>
        {section.items.map((item) => (
          <div key={item.href} className="space-y-0.5">
            <SidebarNavLink
              item={item}
              collapsed={collapsed}
              onNavigate={onNavigate}
              tooltipHref={tooltipHref}
              setTooltipHref={setTooltipHref}
            />
            {!collapsed &&
              item.children.map((child) => (
                <SidebarNavLink
                  key={`${child.name}-${child.href}`}
                  item={child}
                  child
                  collapsed={false}
                  onNavigate={onNavigate}
                  tooltipHref={tooltipHref}
                  setTooltipHref={setTooltipHref}
                />
              ))}
          </div>
        ))}
      </nav>
    </section>
  );
}

function SidebarHeader({
  mobile,
  collapsed,
  forcedCollapsed,
  onToggleCollapsed,
  onCloseMobile,
  closeButtonRef,
}: {
  mobile: boolean;
  collapsed: boolean;
  forcedCollapsed: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--sidebar-section-border)] px-3">
      {!collapsed && (
        <Link
          href="/dashboard"
          className="group flex min-w-0 items-center gap-3 rounded-md pl-0.5 pr-2 py-1 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,rgba(255,255,255,0.10))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,rgba(255,255,255,0.04))] text-[var(--accent-strong)] shadow-[0_4px_10px_rgba(0,0,0,0.12)]">
            <Orbit size={18} strokeWidth={1.85} aria-hidden />
          </span>
          <span className="block min-w-0 truncate text-[15px] font-bold tracking-tight text-white">
            Oblixa
          </span>
        </Link>
      )}
      {mobile ? (
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onCloseMobile}
          className="ui-icon-button border-white/10 bg-white/[0.02] p-2 text-[var(--sidebar-muted)] hover:bg-white/[0.1] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"
          aria-label="Close navigation"
        >
          <X size={18} aria-hidden />
        </button>
      ) : forcedCollapsed ? (
        <div className="mx-auto h-10 w-10 shrink-0" aria-hidden />
      ) : (
        <button
          type="button"
          onClick={onToggleCollapsed}
          data-testid={shellTestIds.sidebarCollapseToggle}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--sidebar-muted)] transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)] ${collapsed ? "mx-auto" : ""}`}
          aria-controls={DESKTOP_SIDEBAR_BODY_ID}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar (⌘\\)" : "Collapse sidebar (⌘\\)"}
        >
          {collapsed ? <PanelLeftOpen size={16} strokeWidth={1.85} aria-hidden /> : <PanelLeftClose size={16} strokeWidth={1.85} aria-hidden />}
        </button>
      )}
    </div>
  );
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="border-t border-[var(--sidebar-section-border)] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <form action={signOut}>
        <button
          type="submit"
          data-testid={shellTestIds.sidebarSignOut}
          className="group flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 text-[12.5px] font-medium text-[var(--sidebar-muted)] transition-[background-color,color] duration-[var(--ui-duration)] hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_18%,transparent)] hover:text-[color:color-mix(in_oklab,var(--danger-ink)_80%,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"
          aria-label={collapsed ? "Sign out" : undefined}
        >
          <LogOut size={16} strokeWidth={1.85} className="shrink-0" aria-hidden />
          {!collapsed && <span>Sign out</span>}
        </button>
      </form>
    </div>
  );
}

function MobileNavigationTrigger({ buttonRef, onOpen }: { buttonRef: RefObject<HTMLButtonElement | null>; onOpen: () => void }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpen}
      data-testid={shellTestIds.sidebarMobileOpen}
      className="fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[color:var(--surface-tint)] p-2 text-[var(--text-secondary)] shadow-[var(--shadow-1)] backdrop-blur transition-transform duration-[var(--ui-duration)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] lg:hidden motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      aria-label="Open navigation"
    >
      <Grid2x2 size={18} aria-hidden />
    </button>
  );
}

function MobileNavigationDrawer({
  drawerRef,
  children,
  onClose,
}: {
  drawerRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      ref={drawerRef}
      className="fixed inset-0 z-50 flex lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation drawer"
      data-testid={shellTestIds.sidebarMobileDrawer}
    >
      <aside className="flex h-dvh max-h-dvh min-h-0 w-[min(22rem,calc(100vw-1rem))] flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] pt-[env(safe-area-inset-top)]">
        {children}
      </aside>
      <button
        type="button"
        className="ui-overlay-scrim h-full flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        onClick={onClose}
        aria-label="Close navigation overlay"
      />
    </div>
  );
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((node) => !node.hasAttribute("disabled") && node.getAttribute("aria-hidden") !== "true");
}

function getStoredCollapsedPreference(): boolean {
  return readSidebarCollapsedPreference();
}

function subscribeCollapsedPreference(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(COLLAPSED_PREF_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(COLLAPSED_PREF_EVENT, handler);
  };
}

export function Sidebar(props: {
  role?: WorkspaceRole;
  v5Flags?: Record<FeatureFlagKey, boolean>;
  navSurface?: NavSurfaceInput | null;
  navBadges?: SidebarNavBadges;
  showToolsLink?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = props.role ?? "viewer";
  const v5Flags = useMemo(() => props.v5Flags ?? ({} as Record<FeatureFlagKey, boolean>), [props.v5Flags]);
  const surface = useMemo(() => props.navSurface ?? fallbackNavSurface(role, v5Flags), [props.navSurface, role, v5Flags]);
  const [clientNavBadges, setClientNavBadges] = useState<SidebarNavBadges>(() => props.navBadges ?? {});
  const collapsed = useSyncExternalStore(subscribeCollapsedPreference, getStoredCollapsedPreference, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hash, setHash] = useState("");
  const [tooltipHref, setTooltipHref] = useState<string | null>(null);
  const mobileOpenButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const previousPathnameRef = useRef(pathname);

  const isOnboardingShell = pathname.startsWith("/onboarding");
  const effectiveCollapsed = isOnboardingShell || collapsed;
  const showToolsLink = props.showToolsLink ?? true;

  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    try {
      writeSidebarCollapsedPreference(next);
      window.dispatchEvent(new Event(COLLAPSED_PREF_EVENT));
    } catch {
      // Ignore storage errors.
    }
  }, [collapsed]);

  const focusMobileOpenButton = useCallback(() => {
    mobileOpenButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const update = () => setHash(window.location.hash);
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, [pathname]);

  useEffect(() => {
    const next = filterNavBadgesForSurface(props.navBadges ?? {}, surface);
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setClientNavBadges(next);
    });
    return () => {
      cancelled = true;
    };
  }, [props.navBadges, surface]);

  useEffect(() => {
    if (!props.navSurface) return;
    let cancelled = false;
    void fetchJson("/api/workspace/nav-badges", { headers: { Accept: "application/json" } })
      .then((result) => (result.ok ? (result.data as { navBadges?: SidebarNavBadges } | null) : null))
      .then((payload) => {
        if (!cancelled && payload?.navBadges) {
          setClientNavBadges(filterNavBadgesForSurface(payload.navBadges, surface));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [props.navSurface, surface]);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    const frame = window.requestAnimationFrame(() => setMobileOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!tooltipHref) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setTooltipHref(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tooltipHref]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const appContent = document.querySelector<HTMLElement>("[data-app-content]");
    const previousAriaHidden = appContent?.getAttribute("aria-hidden");
    const previousInert = appContent ? Boolean((appContent as HTMLElement & { inert?: boolean }).inert) : false;
    const mobileOpenButton = mobileOpenButtonRef.current;
    if (appContent) {
      appContent.setAttribute("aria-hidden", "true");
      (appContent as HTMLElement & { inert?: boolean }).inert = true;
    }
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => mobileCloseButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      if (appContent) {
        if (previousAriaHidden == null) appContent.removeAttribute("aria-hidden");
        else appContent.setAttribute("aria-hidden", previousAriaHidden);
        (appContent as HTMLElement & { inert?: boolean }).inert = previousInert;
      }
      const target = restoreFocusRef.current;
      if (target?.isConnected) target.focus();
      else if (mobileOpenButton?.isConnected) mobileOpenButton.focus();
      else focusMobileOpenButton();
    };
  }, [focusMobileOpenButton, mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !mobileDrawerRef.current) return;
      const focusables = focusableElements(mobileDrawerRef.current);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const closeMobileDrawer = useCallback(() => setMobileOpen(false), []);
  const openMobileDrawer = useCallback(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : mobileOpenButtonRef.current;
    setMobileOpen(true);
  }, []);
  const noopNavigate = useCallback(() => undefined, []);

  const model = useMemo(
    () =>
      buildSidebarModel({
        pathname,
        search: searchParams.toString(),
        hash,
        surface,
        navBadges: clientNavBadges,
        showToolsLink,
        forcedCollapsed: effectiveCollapsed,
      }),
    [pathname, searchParams, hash, surface, clientNavBadges, showToolsLink, effectiveCollapsed]
  );

  const renderBody = (mobile = false) => {
    const bodyCollapsed = mobile ? false : model.collapsed;
    const footerInScrollBody = !mobile && !bodyCollapsed;
    const bodyClassName = "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2.5 py-3";
    return (
      <>
        <SidebarHeader
          mobile={mobile}
          collapsed={bodyCollapsed}
          forcedCollapsed={isOnboardingShell && !mobile}
          onToggleCollapsed={toggleCollapsed}
          onCloseMobile={closeMobileDrawer}
          closeButtonRef={mobileCloseButtonRef}
        />
        <div id={mobile ? undefined : DESKTOP_SIDEBAR_BODY_ID} className={bodyClassName}>
          <div data-testid={shellTestIds.primaryNav} className={bodyCollapsed ? "space-y-2" : "space-y-1"}>
            {model.sections.map((section, index) => (
              <SidebarSection
                key={section.id}
                section={section}
                collapsed={bodyCollapsed}
                onNavigate={mobile ? closeMobileDrawer : noopNavigate}
                tooltipHref={tooltipHref}
                setTooltipHref={setTooltipHref}
                first={index === 0}
              />
            ))}
          </div>
          {footerInScrollBody ? <SidebarFooter collapsed={bodyCollapsed} /> : null}
        </div>
        {footerInScrollBody ? null : <SidebarFooter collapsed={bodyCollapsed} />}
      </>
    );
  };

  return (
    <>
      <MobileNavigationTrigger buttonRef={mobileOpenButtonRef} onOpen={openMobileDrawer} />

      {mobileOpen && (
        <MobileNavigationDrawer drawerRef={mobileDrawerRef} onClose={closeMobileDrawer}>
          {renderBody(true)}
        </MobileNavigationDrawer>
      )}

      <aside
        aria-label="Workspace"
        data-testid={shellTestIds.sidebarDesktop}
        className={`sticky top-0 hidden h-dvh max-h-dvh min-h-0 shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[linear-gradient(180deg,var(--sidebar),color-mix(in_oklab,var(--sidebar)_94%,black)_100%)] motion-safe:transition-[width] motion-safe:duration-[var(--ui-duration-slow)] motion-safe:ease-[var(--ui-ease-out)] motion-reduce:transition-none lg:flex ${
          model.collapsed ? "w-[4.75rem]" : "w-[18.5rem]"
        }`}
      >
        {renderBody(false)}
      </aside>
    </>
  );
}
