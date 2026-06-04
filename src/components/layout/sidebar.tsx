"use client";
/* Primary nav Links use default Next prefetch (hover-driven). Rare / heavy destinations use prefetch={false}. */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  BarChart3,
  Bell,
  BellRing,
  Boxes,
  Building2,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Download,
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
  ShieldCheck,
  Upload,
  Users,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from "react";
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

// Icons for the primary sidebar plus the extra cmd-K-only destinations
// (profile / workspace-identity / team / imports / security-account /
// notifications / export). The latter group never renders here — but the
// NavItem icon union is shared, so the record must be exhaustive.
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
  profile: UserRound,
  "workspace-identity": Building2,
  team: Users,
  imports: Upload,
  "security-account": ShieldCheck,
  notifications: Bell,
  export: Download,
  "review-fields": ClipboardCheck,
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

/* Nav count chip — tokenized status tones tuned for the always-dark sidebar
   (the page-content CountChip's light-surface anchors wouldn't read here, so the
   shared shape/typography is kept while the surface anchor differs). Review and
   approval queues read as "needs attention" (warning); obligations escalate to
   danger; everything else stays neutral. */
function navCountToneStyle(tone: SidebarBadgeModel["tone"]): CSSProperties {
  if (tone === "obligations") {
    return {
      color: "var(--sidebar-danger-ink)",
      background: "color-mix(in oklab, var(--sidebar-danger-ink) 16%, transparent)",
      borderColor: "color-mix(in oklab, var(--sidebar-danger-ink) 34%, transparent)",
    };
  }
  if (tone === "reviewQueue" || tone === "approvals") {
    return {
      color: "var(--sidebar-warn-ink)",
      background: "color-mix(in oklab, var(--sidebar-warn-ink) 16%, transparent)",
      borderColor: "color-mix(in oklab, var(--sidebar-warn-ink) 34%, transparent)",
    };
  }
  return {
    color: "color-mix(in oklab, var(--sidebar-fg) 80%, transparent)",
    background: "color-mix(in oklab, var(--sidebar-fg) 10%, transparent)",
    borderColor: "color-mix(in oklab, var(--sidebar-fg) 18%, transparent)",
  };
}

function SidebarBadge({ badge, collapsed }: { badge?: SidebarBadgeModel; collapsed: boolean }) {
  if (!badge) return null;
  const toneStyle = navCountToneStyle(badge.tone);
  if (collapsed) {
    // Collapsed rail: a compact numeric badge pinned to the icon's top-right
    // corner, ringed against the sidebar so it reads as a count rather than a
    // stray dot. Decorative (aria-hidden) — the link keeps a terse accessible
    // name; the full count + label live in the tooltip/title.
    return (
      <span
        aria-hidden="true"
        title={badge.label}
        style={toneStyle}
        className="absolute right-1 top-1 inline-flex h-[1.05rem] min-w-[1.05rem] items-center justify-center rounded-full border px-1 text-[9px] font-semibold leading-none tabular-nums ring-2 ring-[var(--sidebar)]"
      >
        {badge.displayValue}
      </span>
    );
  }
  return (
    <span
      className="ml-auto inline-flex h-[1.125rem] min-w-[1.375rem] shrink-0 items-center justify-center rounded-md border px-1.5 text-[10.5px] font-semibold leading-none tabular-nums"
      style={toneStyle}
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
  // Three distinct top-level states: a "selected" leaf (accent rail + wash +
  // accent icon), a "parent-expanded" section header (brighter text + chevron,
  // no accent — the accent belongs to the selected child), and idle.
  const isParentExpanded = !child && !collapsed && item.children.length > 0;
  const selected = !child && item.active && !isParentExpanded;
  const childClass = child
    ? `ui-sidebar-sublink-indent text-[12.5px] ${
        item.active ? "ui-sidebar-sublink-active" : "ui-sidebar-sublink-idle"
      }`
    : collapsed
      ? item.active
        ? "ui-sidebar-link-active ui-sidebar-link-active-rail"
        : "ui-sidebar-link-idle"
      : isParentExpanded
        ? "ui-sidebar-link-parent"
        : item.active
          ? "ui-sidebar-link-active"
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
      className={`ui-sidebar-link ${collapsed && !child ? "justify-center" : ""} ${childClass}`}
      aria-current={item.exactActive ? "page" : undefined}
      aria-label={collapsed ? item.collapsedLabel : undefined}
      aria-describedby={tooltipVisible ? tooltipId : undefined}
      data-sidebar-href={item.href}
    >
      {Icon ? (
        // Icon inherits the link's currentColor (muted when idle, sidebar-fg on
        // a parent header) so glyph and label never drift apart; the selected
        // leaf is the one place the icon takes the accent.
        <Icon
          size={18}
          strokeWidth={1.85}
          className="shrink-0"
          style={selected ? { color: "var(--accent-strong)" } : undefined}
          aria-hidden
        />
      ) : child ? null : (
        /* Top-level row without icon → render an empty-ring marker, not a
           filled gray dot. The empty ring communicates "indeterminate /
           leaf" rather than implying a status signal. */
        <span
          aria-hidden
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            item.active
              ? "bg-[var(--sidebar-fg)]"
              : "border border-[color:color-mix(in_oklab,var(--sidebar-fg)_35%,transparent)] bg-transparent"
          }`}
        />
      )}
      {collapsed && <SidebarBadge badge={item.badge} collapsed />}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.name}</span>}
      {!collapsed && isParentExpanded ? (
        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--sidebar-muted)]" strokeWidth={2} aria-hidden />
      ) : !collapsed ? (
        <SidebarBadge badge={item.badge} collapsed={false} />
      ) : null}
      {tooltipVisible ? (
        <span
          id={tooltipId}
          aria-hidden="true"
          className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md border border-[color:color-mix(in_oklab,var(--sidebar-fg)_12%,transparent)] bg-[var(--sidebar-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--sidebar-fg)] shadow-[var(--shadow-2)]"
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
  onToggleCollapsed,
  onCloseMobile,
  closeButtonRef,
}: {
  mobile: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  if (collapsed && !mobile) {
    return (
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-[var(--sidebar-section-border)] px-2.5">
        <Link
          href="/dashboard"
          aria-label="Oblixa — go to dashboard"
          className="inline-flex h-10 w-10 items-center justify-center rounded-[0.7rem] border border-[color:color-mix(in_oklab,var(--sidebar-fg)_16%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_8%,transparent)] text-[var(--sidebar-fg)] shadow-[0_2px_8px_rgba(0,0,0,0.22)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_36%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"
        >
          <Orbit size={18} strokeWidth={1.9} aria-hidden />
        </Link>
      </div>
    );
  }
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--sidebar-section-border)] px-2.5">
      <Link
        href="/dashboard"
        className="group flex min-w-0 items-center gap-3 rounded-lg px-3 py-1.5 transition-colors hover:bg-[color:var(--sidebar-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"
      >
        {/* Brand lockup: neutral icon tile + wordmark. Accent stays reserved for
            the active-nav rail, so the tile uses sidebar-fg tints. The tile left
            edge sits on the same 22px column as the nav icons below. */}
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.7rem] border border-[color:color-mix(in_oklab,var(--sidebar-fg)_16%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_8%,transparent)] text-[var(--sidebar-fg)] shadow-[0_2px_8px_rgba(0,0,0,0.22)]">
          <Orbit size={18} strokeWidth={1.9} aria-hidden />
        </span>
        <span className="block min-w-0 truncate text-[15px] font-bold tracking-tight text-[var(--sidebar-fg)]">
          Oblixa
        </span>
      </Link>
      {mobile ? (
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onCloseMobile}
          className="ui-icon-button border-[color:color-mix(in_oklab,var(--sidebar-fg)_12%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_3%,transparent)] p-2 text-[var(--sidebar-muted)] hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"
          aria-label="Close navigation"
        >
          <X size={18} aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggleCollapsed}
          data-testid={shellTestIds.sidebarCollapseToggle}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--sidebar-fg)_12%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_5%,transparent)] text-[var(--sidebar-muted)] transition-colors hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"
          aria-controls={DESKTOP_SIDEBAR_BODY_ID}
          aria-expanded
          aria-label="Collapse sidebar"
          title="Collapse sidebar (⌘\\)"
        >
          <PanelLeftClose size={18} strokeWidth={1.85} aria-hidden />
        </button>
      )}
    </div>
  );
}

function SidebarExpandControl({ onToggle }: { onToggle: () => void }) {
  return (
    <div className="mb-2 flex justify-center">
      <button
        type="button"
        onClick={onToggle}
        data-testid={shellTestIds.sidebarCollapseToggle}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--sidebar-fg)_12%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_5%,transparent)] text-[var(--sidebar-muted)] transition-colors hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"
        aria-controls={DESKTOP_SIDEBAR_BODY_ID}
        aria-expanded={false}
        aria-label="Expand sidebar"
        title="Expand sidebar (⌘\\)"
      >
        <PanelLeftOpen size={18} strokeWidth={1.85} aria-hidden />
      </button>
    </div>
  );
}

function SidebarFooter({ collapsed, inset = true }: { collapsed: boolean; inset?: boolean }) {
  // `inset` adds the body's horizontal frame when the footer is a direct child
  // of the aside (collapsed rail / mobile drawer). When nested inside the
  // scrolling body (expanded desktop) the body already pads, so we drop it —
  // keeping the sign-out icon on the same 22px column as the nav icons.
  return (
    <div className={`border-t border-[var(--sidebar-section-border)] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${inset ? "px-2.5" : "px-0"}`}>
      <form action={signOut}>
        <button
          type="submit"
          data-testid={shellTestIds.sidebarSignOut}
          className={`group flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 text-[12.5px] font-medium text-[var(--sidebar-muted)] transition-[background-color,color] duration-[var(--ui-duration)] hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_18%,transparent)] hover:text-[color:color-mix(in_oklab,var(--danger-ink)_82%,var(--sidebar-fg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)] ${collapsed ? "justify-center" : ""}`}
          aria-label={collapsed ? "Sign out" : undefined}
        >
          <LogOut size={18} strokeWidth={1.85} className="shrink-0" aria-hidden />
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
      <aside className="ui-sidebar-surface flex h-dvh max-h-dvh min-h-0 w-[min(22rem,calc(100vw-1rem))] flex-col border-r border-[var(--sidebar-border)] pt-[env(safe-area-inset-top)]">
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
      window.requestAnimationFrame(() => {
        if (target?.isConnected) target.focus();
        else if (mobileOpenButton?.isConnected) mobileOpenButton.focus();
        else focusMobileOpenButton();
      });
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
          onToggleCollapsed={toggleCollapsed}
          onCloseMobile={closeMobileDrawer}
          closeButtonRef={mobileCloseButtonRef}
        />
        <div id={mobile ? undefined : DESKTOP_SIDEBAR_BODY_ID} className={bodyClassName}>
          {bodyCollapsed && !isOnboardingShell ? <SidebarExpandControl onToggle={toggleCollapsed} /> : null}
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
          {footerInScrollBody ? <SidebarFooter collapsed={bodyCollapsed} inset={false} /> : null}
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
        className={`ui-sidebar-surface sticky top-0 hidden h-dvh max-h-dvh min-h-0 shrink-0 flex-col border-r border-[var(--sidebar-border)] motion-safe:transition-[width] motion-safe:duration-[var(--ui-duration-slow)] motion-safe:ease-[var(--ui-ease-out)] motion-reduce:transition-none lg:flex ${
          model.collapsed ? "w-[4.75rem]" : "w-[18.5rem]"
        }`}
      >
        {renderBody(false)}
      </aside>
    </>
  );
}
