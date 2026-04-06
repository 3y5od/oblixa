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
      className={`flex flex-col border-r border-zinc-200/90 bg-surface transition-all duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-14 items-center justify-between border-b border-zinc-200/90 px-3">
        {!collapsed && (
          <Link
            href="/dashboard"
            className="text-[15px] font-bold tracking-tight text-zinc-900"
          >
            ContractOps
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-4">
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
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-100 text-zinc-900 ring-1 ring-zinc-200/80"
                  : "text-zinc-600 hover:bg-zinc-50/80 hover:text-zinc-900"
              }`}
              title={collapsed ? item.name : undefined}
            >
              <item.icon size={18} strokeWidth={1.75} className="shrink-0 opacity-90" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-200/90 p-2">
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut size={18} strokeWidth={1.75} className="shrink-0 opacity-90" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}
