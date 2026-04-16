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
  if (pathname.startsWith("/more")) return "Utilities";
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

export function Header({ fullName, email, navSurface, showUtilitiesLink = true }: HeaderProps) {
  const pathname = usePathname();
  const displayName = fullName || email || "User";
  const initial = (fullName?.[0] || email?.[0] || "?").toUpperCase();
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
    if (pathname.startsWith("/more")) return "Workspace · Utilities";
    return "Monitor · Dashboard";
  }, [pathname, navSurface?.mode]);

  return (
    <header className="relative z-20 shrink-0 border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_86%,transparent)] px-4 py-3 backdrop-blur-md md:px-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="hidden rounded-[1rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_72%,transparent)] p-2 text-[var(--text-secondary)] shadow-[var(--shadow-1)] lg:flex">
            <PanelLeftOpen size={16} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                {context}
              </p>
              <span className="hidden h-1 w-1 rounded-full bg-[var(--border-strong)] sm:block" />
              <span className="hidden items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_70%,transparent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)] sm:inline-flex">
                <Sparkles size={11} aria-hidden />
                {navSurface?.mode ?? "core"}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
              <span className="inline-flex items-center gap-1">
                <Command size={12} aria-hidden />
                Cmd/Ctrl + K
              </span>
              {showUtilitiesLink ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-[var(--border-strong)]" />
                  <Link
                    href="/more"
                    prefetch={false}
                    className="font-semibold text-[var(--accent-strong)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
                  >
                    Tools index
                  </Link>
                  <Link
                    href="/more"
                    prefetch={false}
                    className="inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-[0.85rem] border border-[var(--border-subtle)] px-2 py-1.5 text-[10px] font-semibold text-[var(--text-secondary)] sm:hidden"
                    aria-label="Open utilities index"
                  >
                    <Command size={11} aria-hidden />
                    Tools
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3 xl:max-w-[48rem]">
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
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" aria-hidden />
              <input
                data-testid={shellTestIds.headerSearch}
                id="workspace-header-search"
                name="q"
                type="search"
                enterKeyHint="search"
                placeholder="Search queues, pages, reports, or tools"
                className="ui-input w-full py-2.5 pl-10 pr-4 text-sm sm:pr-20 lg:pr-24"
                autoComplete="off"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 hidden max-w-[4.5rem] -translate-y-1/2 items-center justify-end gap-1 overflow-hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)] sm:inline-flex">
                <span className="ui-kbd">⌘</span>
                <span className="ui-kbd">K</span>
              </span>
            </div>
          </form>
          <div
            className="flex shrink-0 items-center gap-3 rounded-[1.15rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_86%,white)] px-3 py-2.5 shadow-[var(--shadow-1)]"
            aria-label={`Signed in as ${displayName}`}
          >
            <div className="text-right">
              <p className="max-w-[14rem] truncate text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
                {displayName}
              </p>
              {fullName && email && (
                <p className="max-w-[14rem] truncate text-[11px] text-[var(--text-tertiary)]">{email}</p>
              )}
            </div>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-[0.95rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--accent-soft)_50%,transparent)] text-sm font-semibold text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
              aria-hidden
            >
              {initial}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
