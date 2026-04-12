"use client";

/** Appendix B — Utilities header link is gated by `showUtilitiesLink` (see `more-index-visibility.ts`) so Core empty `/more` stays honest. */
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Command } from "lucide-react";
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
    <header className="flex h-[3.5rem] shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-surface/95 px-4 backdrop-blur md:gap-4 md:px-6">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {context}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500 sm:mt-0">
          <span>Cmd/Ctrl + K</span>
          {showUtilitiesLink ? (
            <>
              <span className="h-1 w-1 rounded-full bg-zinc-300" />
              <Link
                href="/more"
                className="font-semibold text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline"
              >
                Utilities
              </Link>
              <Link
                href="/more"
                className="inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-md border border-zinc-200 px-2 py-1.5 text-[10px] font-semibold text-zinc-700 sm:hidden"
                aria-label="Open utilities index"
              >
                <Command size={11} aria-hidden />
                Utilities
              </Link>
            </>
          ) : null}
        </div>
      </div>
      <form
        role="search"
        aria-label="Search workspace"
        className="hidden min-w-0 max-w-md flex-1 md:block"
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
        <input
          data-testid="workspace-header-search"
          name="q"
          type="search"
          enterKeyHint="search"
          placeholder="Search workspace…"
          className="ui-input w-full py-1.5 text-sm"
          autoComplete="off"
        />
      </form>
      <div
        className="flex shrink-0 items-center gap-3.5"
        aria-label={`Signed in as ${displayName}`}
      >
        <div className="text-right">
          <p className="max-w-[16rem] truncate text-[13px] font-semibold tracking-tight text-zinc-900">
            {displayName}
          </p>
          {fullName && email && (
            <p className="max-w-[16rem] truncate text-[11px] text-zinc-500">{email}</p>
          )}
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200/85 bg-zinc-50 text-sm font-semibold text-zinc-700 shadow-[var(--shadow-1)] transition-[box-shadow,border-color] duration-200 ease-out"
          aria-hidden
        >
          {initial}
        </div>
      </div>
    </header>
  );
}
