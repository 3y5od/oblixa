"use client";

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

interface HeaderProps {
  fullName?: string | null;
  email?: string | null;
}

export function Header({ fullName, email }: HeaderProps) {
  const pathname = usePathname();
  const displayName = fullName || email || "User";
  const initial = (fullName?.[0] || email?.[0] || "?").toUpperCase();
  const context = useMemo(() => {
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
    if (pathname.startsWith("/more")) return "Workspace · Index";
    return "Monitor · Dashboard";
  }, [pathname]);

  return (
    <header className="flex h-[3.5rem] shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-surface/95 px-4 backdrop-blur md:px-6">
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {context}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500 sm:mt-0">
          <span>Cmd/Ctrl + K</span>
          <span className="h-1 w-1 rounded-full bg-zinc-300" />
          <Link
            href="/more"
            className="font-semibold text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline"
          >
            Open index
          </Link>
          <Link
            href="/more"
            className="inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-md border border-zinc-200 px-2 py-1.5 text-[10px] font-semibold text-zinc-700 sm:hidden"
            aria-label="Open workflow index"
          >
            <Command size={11} aria-hidden />
            Open
          </Link>
        </div>
      </div>
      <div
        className="flex items-center gap-3.5"
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
