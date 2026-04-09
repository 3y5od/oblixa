"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  SearchCheck,
  Files,
  ListTodo,
  Settings,
  CreditCard,
  LogOut,
  PanelLeftOpen,
  PanelLeftClose,
  Grid2x2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "@/actions/auth";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import {
  NAV_ITEMS,
  canAccessItem,
  isActivePath,
  isV5NavChildVisible,
  isV5NavItemVisible,
  type NavItem,
  type WorkspaceRole,
} from "@/lib/navigation";

const iconByKey = {
  dashboard: LayoutDashboard,
  review: SearchCheck,
  contracts: Files,
  tasks: ListTodo,
  settings: Settings,
  billing: CreditCard,
  more: Grid2x2,
} as const;

const COLLAPSED_PREF_KEY = "oblixa.sidebar.collapsed";

export function Sidebar(props: {
  role?: WorkspaceRole;
  v5Flags?: Record<FeatureFlagKey, boolean>;
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

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_PREF_KEY, collapsed ? "1" : "0");
    } catch {
      // Ignore storage errors.
    }
  }, [collapsed]);

  const navBySection = useMemo(() => {
    const visible = NAV_ITEMS.filter(
      (item) => canAccessItem(item, role) && isV5NavItemVisible(item, v5Flags)
    );
    return {
      primary: visible.filter((item) => item.section === "primary"),
      operations: visible.filter((item) => item.section === "operations"),
      personal: visible.filter((item) => item.section === "personal"),
      workspace: visible.filter((item) => item.section === "workspace"),
    };
  }, [role, v5Flags]);

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
          const badgeValue = item.badgeKey ? Number(navBadges[item.badgeKey] ?? 0) : 0;
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
                  title={collapsed ? item.name : undefined}
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
                  {!collapsed && (
                    <>
                      <span>{item.name}</span>
                      {badgeValue > 0 && (
                        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight ${badgeTone}`}>
                          {badgeValue > 99 ? "99+" : badgeValue}
                        </span>
                      )}
                    </>
                  )}
                </Link>
                {!collapsed && item.navChildren?.length
                  ? item.navChildren
                      .filter((c) => isV5NavChildVisible(c, v5Flags))
                      .map((c) => (
                        <Link
                          key={`${c.name}-${c.href}`}
                          href={c.href}
                          onClick={() => setMobileOpen(false)}
                          className="ui-sidebar-link ui-sidebar-link-idle pl-9 text-[12px] opacity-90"
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
                {badgeValue > 0 && (
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight ${badgeTone}`}>
                    {badgeValue > 99 ? "99+" : badgeValue}
                  </span>
                )}
              </Link>
              {!collapsed && item.navChildren?.length
                ? item.navChildren
                    .filter((c) => isV5NavChildVisible(c, v5Flags))
                    .map((c) => (
                      <Link
                        key={`${c.name}-${c.href}`}
                        href={c.href}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 rounded-lg py-1.5 pr-3 pl-8 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-100"
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

  const renderSidebarBody = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      <div className="flex h-[3.5rem] items-center justify-between border-b border-white/[0.1] px-2.5">
        {!collapsed && (
          <Link
            href="/dashboard"
            className="pl-1 text-[14px] font-semibold tracking-tight text-white"
          >
            Oblixa
          </Link>
        )}
        {mobile ? (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-zinc-300 transition-[background-color,color] duration-200 ease-out hover:bg-white/[0.1] hover:text-white"
            aria-label="Close navigation"
          >
            <X size={18} aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={`rounded-lg p-2 text-zinc-300 transition-[background-color,color] duration-200 ease-out hover:bg-white/[0.1] hover:text-white ${collapsed ? "mx-auto" : ""}`}
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

      <div className="flex-1 overflow-y-auto px-2 py-4">
        {renderNavSection({ items: navBySection.primary, compact: true })}
        {!collapsed && (
          <>
            {renderNavSection({
              title: "Operations",
              items: navBySection.operations.slice(0, 4),
            })}
            {navBySection.operations.length > 4 && (
              <Link
                href="/more?section=operations"
                onClick={() => setMobileOpen(false)}
                className="mt-2 block rounded-lg px-3 py-1.5 text-[12px] font-medium text-zinc-200 hover:bg-white/[0.08] hover:text-white"
              >
                Show all operations tools
              </Link>
            )}
            {renderNavSection({
              title: "Personal",
              items: navBySection.personal.slice(0, 2),
            })}
          </>
        )}
        {renderNavSection({
          title: collapsed ? undefined : "Workspace",
          items: navBySection.workspace,
          compact: true,
        })}
      </div>

      <div className="border-t border-white/[0.1] p-2.5">
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-zinc-300 transition-[background-color,color] duration-200 ease-out hover:bg-white/[0.08] hover:text-white"
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut size={18} strokeWidth={1.65} className="shrink-0 opacity-95" aria-hidden />
            {!collapsed && <span>Sign out</span>}
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 rounded-lg border border-zinc-200 bg-white/95 p-2 text-zinc-700 shadow-sm backdrop-blur lg:hidden"
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
        >
          <button
            type="button"
            className="h-full flex-1 bg-black/52"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation overlay"
          />
          <aside className="flex w-80 max-w-[90vw] flex-col border-l border-[var(--sidebar-border)] bg-[var(--sidebar)]">
            {renderSidebarBody({ mobile: true })}
          </aside>
        </div>
      )}

      <aside
        aria-label="Workspace"
        className={`hidden flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out lg:flex ${
          collapsed ? "w-[4rem]" : "w-56"
        }`}
      >
        {renderSidebarBody({})}
      </aside>
    </>
  );
}
