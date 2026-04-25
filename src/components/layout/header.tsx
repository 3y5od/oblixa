"use client";

/** Appendix B — Utilities header link is gated by `showUtilitiesLink` (see `more-index-visibility.ts`) so Core empty `/more` stays honest. */
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Command, PanelLeftOpen, Search, Sparkles } from "lucide-react";
import {
  NAV_ITEMS,
  CONTRACTS_SUBROUTES,
  WORKFLOW_AREA_LABELS,
  getWorkflowAreaForNavItem,
  isContractsRoot,
} from "@/lib/navigation";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import {
  COMMAND_PALETTE_OPEN_EVENT,
  type CommandPaletteOpenDetail,
} from "@/lib/product-surface/command-palette-bridge";
import { shellTestIds } from "@/lib/qa/test-ids";

interface HeaderProps {
  fullName?: string | null;
  email?: string | null;
  navSurface?: NavSurfaceInput | null;
  /** Appendix B — hide when `/more` would be empty for this surface. */
  showUtilitiesLink?: boolean;
}

function coreProductContextLine(pathname: string): string {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return "Home";
  if (pathname.startsWith("/work")) return "Work";
  if (pathname.startsWith("/contracts/review")) return "Review";
  if (pathname.startsWith("/contracts/renewals")) return "Renewals";
  if (pathname.startsWith("/contracts/exceptions")) return "Exceptions";
  if (pathname.startsWith("/contracts/evidence-studio")) return "Evidence";
  if (pathname.startsWith("/reports") || pathname.startsWith("/contracts/reports")) return "Reports";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/more")) return "Tools";
  if (pathname.startsWith("/contracts/new")) return "New contract";
  if (pathname.startsWith("/contracts/bulk")) return "Bulk import";
  if (isContractsRoot(pathname)) return "Contracts";
  if (CONTRACTS_SUBROUTES.some((prefix) => pathname.startsWith(prefix))) return "Contracts";
  if (pathname.startsWith("/decisions")) return "Decisions";
  if (pathname.startsWith("/campaigns")) return "Campaigns";
  if (pathname.startsWith("/assurance")) return "Assurance";
  if (pathname.startsWith("/relationship-workspaces") || pathname.startsWith("/accounts/") || pathname.startsWith("/counterparties/")) {
    return "Relationships";
  }
  return "Workspace";
}

function resolveHeaderTitle(pathname: string): string {
  const dynamicMatch = NAV_ITEMS
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (dynamicMatch) return dynamicMatch.name;
  if (pathname.startsWith("/contracts/new")) return "New contract";
  if (pathname.startsWith("/contracts/bulk")) return "Bulk import";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/more")) return "Tools";
  return coreProductContextLine(pathname);
}

export function Header({ fullName, email, navSurface, showUtilitiesLink = true }: HeaderProps) {
  const pathname = usePathname();
  const displayName = fullName || email || "User";
  const initial = (fullName?.[0] || email?.[0] || "?").toUpperCase();
  const currentTitle = useMemo(() => resolveHeaderTitle(pathname), [pathname]);
  const context = useMemo(() => {
    if (navSurface?.mode === "core") {
      return `${coreProductContextLine(pathname)} · Execution workspace`;
    }

    const dynamicMatch = NAV_ITEMS
      .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0];
    if (dynamicMatch) {
      return `${WORKFLOW_AREA_LABELS[getWorkflowAreaForNavItem(dynamicMatch)]} · ${dynamicMatch.name}`;
    }

    if (isContractsRoot(pathname)) return "Workflows · Contracts";
    if (pathname.startsWith("/settings")) return "Workspace · Settings";
    if (pathname.startsWith("/contracts/new")) return "New contract";
    if (pathname.startsWith("/contracts/bulk")) return "Bulk import";
    if (CONTRACTS_SUBROUTES.some((prefix) => pathname.startsWith(prefix))) return "Workflows · Contracts";
    if (pathname.startsWith("/more")) return "Workspace · Tools";
    return "Monitor · Dashboard";
  }, [pathname, navSurface?.mode]);

  return (
    <header className="ui-footer-shell relative z-20 shrink-0 px-4 py-3.5 md:px-6 md:py-4">
      <div className="flex flex-col gap-3.5 xl:flex-row xl:items-center xl:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="ui-icon-button hidden lg:flex">
            <PanelLeftOpen size={16} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="ui-meta truncate">
                {context}
              </p>
              <span className="hidden h-1 w-1 rounded-full bg-[var(--border-strong)] md:block" />
              <span className="hidden items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_74%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)] md:inline-flex">
                <Sparkles size={11} aria-hidden />
                {navSurface?.mode ?? "core"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="ui-page-title truncate text-[1.3rem] sm:text-[1.55rem]">
                  {currentTitle}
                </p>
                <p className="ui-support-copy mt-1 hidden max-w-2xl sm:block">
                  Search pages, queues, reports, and tools from anywhere in the workspace.
                </p>
              </div>
              <div className="ui-toolbar flex items-center gap-2 xl:hidden">
                <span className="inline-flex items-center gap-1">
                  <Command size={12} aria-hidden />
                  Cmd/Ctrl + K
                </span>
                {showUtilitiesLink ? (
                  <Link
                    href="/more"
                    prefetch={false}
                    className="ui-icon-button min-h-9 min-w-9 gap-1 px-2 py-1.5 text-[10px]"
                    aria-label="Open tools index"
                  >
                    <Command size={11} aria-hidden />
                    Tools
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3 xl:max-w-[52rem]">
          <form
            role="search"
            aria-label="Search workspace"
            className="min-w-0 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const q = String(fd.get("q") ?? "").trim();
              window.dispatchEvent(
                new CustomEvent<CommandPaletteOpenDetail>(COMMAND_PALETTE_OPEN_EVENT, {
                  detail: { query: q },
                })
              );
            }}
          >
            <label className="sr-only" htmlFor="workspace-header-search">
              Search workspace
            </label>
            <div className="ui-input grid min-h-11 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 text-sm shadow-[var(--shadow-1)] focus-within:border-[color:color-mix(in_oklab,var(--accent)_44%,var(--border-strong))] focus-within:shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_35%,transparent),0_0_0_4px_color-mix(in_oklab,var(--accent)_18%,transparent)] sm:grid-cols-[auto_minmax(0,1fr)_auto]">
              <Search className="pointer-events-none h-4 w-4 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
              <input
                data-testid={shellTestIds.headerSearch}
                id="workspace-header-search"
                name="q"
                type="text"
                inputMode="search"
                enterKeyHint="search"
                placeholder="Search pages, queues, reports, tools"
                className="min-h-0 min-w-0 w-full appearance-none border-0 bg-transparent py-0 pl-0 pr-1.5 text-sm text-[var(--text-primary)] shadow-none outline-none ring-0 placeholder:text-[var(--text-tertiary)] focus-visible:ring-0"
                autoComplete="off"
              />
              <span className="pointer-events-none hidden shrink-0 items-center gap-1 justify-self-end text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)] sm:inline-flex">
                <span className="ui-kbd">⌘</span>
                <span className="ui-kbd">K</span>
              </span>
            </div>
          </form>
          {showUtilitiesLink ? (
            <Link
              href="/more"
              prefetch={false}
              className="ui-btn-secondary hidden min-h-10 shrink-0 px-3 py-2 text-[12px] xl:inline-flex"
            >
              Tools
            </Link>
          ) : null}
          <div className="ui-toolbar-strong shrink-0 justify-between gap-3 px-3 py-2.5 xl:min-w-[13.5rem]" aria-label={`Signed in as ${displayName}`}>
            <div className="text-right">
              <p className="max-w-[14rem] truncate text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
                {displayName}
              </p>
              {fullName && email && (
                <p className="max-w-[14rem] truncate text-[11px] text-[var(--text-tertiary)]">{email}</p>
              )}
            </div>
            <div className="ui-avatar-tile text-sm font-semibold" aria-hidden>
              {initial}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
