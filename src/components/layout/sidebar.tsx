"use client";
/* Primary nav Links use default Next prefetch (hover-driven). Rare / heavy destinations use prefetch={false}. */

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import { buildSidebarModel, type SidebarNavBadges } from "./sidebar-model";
import { COLLAPSED_PREF_EVENT, DESKTOP_SIDEBAR_BODY_ID } from "./sidebar/constants";
import { SidebarBrand } from "./sidebar/sidebar-brand";
import { SidebarFooter } from "./sidebar/sidebar-footer";
import { SidebarSection } from "./sidebar/sidebar-section";
import { SidebarMobileAccount } from "./sidebar/sidebar-account";
import { MobileDrawer, MobileNavigationTrigger } from "./sidebar/mobile-drawer";

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
    const bodyClassName = "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2.5 py-3";
    return (
      <>
        <SidebarBrand
          mobile={mobile}
          collapsed={bodyCollapsed}
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
        </div>
        {/* Desktop sign-out lives in the topbar account menu (single source);
            the mobile drawer keeps its own account section. The desktop rail
            gets a stable footer with the collapse control + quiet role state. */}
        {mobile ? (
          <SidebarMobileAccount />
        ) : (
          <SidebarFooter
            collapsed={bodyCollapsed}
            isOnboarding={isOnboardingShell}
            role={role}
            onToggleCollapsed={toggleCollapsed}
          />
        )}
      </>
    );
  };

  return (
    <>
      <MobileNavigationTrigger buttonRef={mobileOpenButtonRef} onOpen={openMobileDrawer} />

      {mobileOpen && (
        <MobileDrawer drawerRef={mobileDrawerRef} onClose={closeMobileDrawer}>
          {renderBody(true)}
        </MobileDrawer>
      )}

      <aside
        aria-label="Workspace"
        data-testid={shellTestIds.sidebarDesktop}
        className={`ui-sidebar-surface sticky top-0 hidden h-dvh max-h-dvh min-h-0 shrink-0 flex-col border-r border-[var(--sidebar-border)] motion-safe:transition-[width] motion-safe:duration-[var(--ui-duration-slow)] motion-safe:ease-[var(--ui-ease-out)] motion-reduce:transition-none lg:flex ${
          model.collapsed ? "w-[var(--shell-sidebar-collapsed-w)]" : "w-[var(--shell-sidebar-w)]"
        }`}
      >
        {renderBody(false)}
      </aside>
    </>
  );
}
