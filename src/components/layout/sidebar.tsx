"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ListChecks,
  Settings,
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { signOut } from "@/actions/auth";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Review queue", href: "/contracts/review", icon: ListChecks },
  { name: "Contracts", href: "/contracts", icon: FileText },
  { name: "Billing", href: "/settings/billing", icon: CreditCard },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      aria-label="Workspace"
      className={`flex flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out ${
        collapsed ? "w-[4.25rem]" : "w-64"
      }`}
    >
      <div className="flex h-[3.75rem] items-center justify-between border-b border-white/[0.06] px-3">
        {!collapsed && (
          <Link
            href="/dashboard"
            className="pl-1 text-[15px] font-semibold tracking-tight text-white"
          >
            ContractOps
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={`rounded-lg p-2 text-zinc-400 transition-[background-color,color] duration-200 ease-out hover:bg-white/[0.08] hover:text-zinc-200 ${collapsed ? "mx-auto" : ""}`}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight size={18} aria-hidden />
          ) : (
            <ChevronLeft size={18} aria-hidden />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2.5 py-5" aria-label="Primary navigation">
        {navigation.map((item) => {
          const isActive =
            item.href === "/settings"
              ? pathname === "/settings"
              : item.href === "/contracts"
                ? pathname.startsWith("/contracts") &&
                  pathname !== "/contracts/review" &&
                  !pathname.startsWith("/contracts/review/")
                : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`ui-sidebar-link ${
                isActive ? "ui-sidebar-link-active" : "ui-sidebar-link-idle"
              }`}
              title={collapsed ? item.name : undefined}
            >
              <item.icon
                size={18}
                strokeWidth={1.65}
                className="shrink-0 opacity-90"
                aria-hidden
              />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] p-2.5">
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-zinc-400 transition-[background-color,color] duration-200 ease-out hover:bg-white/[0.06] hover:text-zinc-100"
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut size={18} strokeWidth={1.65} className="shrink-0 opacity-90" aria-hidden />
            {!collapsed && <span>Sign out</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}
