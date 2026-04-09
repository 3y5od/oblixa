"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { NAV_ITEMS, CONTRACTS_SUBROUTES, isContractsRoot } from "@/lib/navigation";

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
    if (dynamicMatch) return dynamicMatch.name;

    if (isContractsRoot(pathname)) return "Contracts";
    if (pathname.startsWith("/settings")) return "Workspace settings";
    if (pathname.startsWith("/contracts/new")) return "New contract";
    if (pathname.startsWith("/contracts/bulk")) return "Bulk import";
    if (CONTRACTS_SUBROUTES.some((prefix) => pathname.startsWith(prefix))) return "Contracts";
    if (pathname.startsWith("/more")) return "More tools";
    return "Dashboard";
  }, [pathname]);

  return (
    <header className="flex h-[3.5rem] shrink-0 items-center justify-between border-b border-zinc-200/70 bg-white/88 px-4 backdrop-blur-md md:px-6">
      <div className="hidden min-w-0 items-center gap-3 sm:flex">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {context}
        </p>
        <span className="h-1 w-1 rounded-full bg-zinc-300" />
        <p className="text-xs text-zinc-600">Cmd/Ctrl + K</p>
        <Link href="/more" className="text-xs font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline">
          Quick open
        </Link>
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
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200/80 bg-gradient-to-br from-zinc-50 to-zinc-100/80 text-sm font-semibold text-zinc-700 shadow-sm transition-[box-shadow,border-color] duration-200 ease-out"
          aria-hidden
        >
          {initial}
        </div>
      </div>
    </header>
  );
}
