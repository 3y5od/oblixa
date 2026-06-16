"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  BarChart3,
  CalendarClock,
  ChevronRight,
  FileCheck2,
  FileText,
  LayoutDashboard,
  ListChecks,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  NAV_ITEMS,
  WORKFLOW_AREA_LABELS,
  getWorkflowAreaForNavItem,
  isContractsRoot,
} from "@/lib/navigation";

type Crumb = { label: string; href?: string };

const CONTRACTS: Crumb = { label: "Contracts", href: "/contracts" };
const TASKS: Crumb = { label: "Tasks", href: "/work" };
const REPORTS: Crumb = { label: "Reports", href: "/reports" };
const SETTINGS: Crumb = { label: "Settings", href: "/settings" };

/** Neutral page-area medallion icon for the leading breadcrumb crumb — a quiet
 *  orientation cue, not a status signal. Only the known Core areas get one. */
const AREA_ICON: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Contracts: FileText,
  Tasks: ListChecks,
  Renewals: CalendarClock,
  Evidence: FileCheck2,
  Reports: BarChart3,
  Settings: SettingsIcon,
  Tools: Wrench,
  Search: SearchIcon,
};

const SETTINGS_LEAF: Record<string, string> = {
  "/settings/security": "Security",
  "/settings/billing": "Billing",
  "/settings/operations": "Operations",
  "/settings/product": "Product",
  "/settings/health": "System health",
  "/settings/policy": "Policy",
};

/** Route-aware breadcrumb trail. Uses real product hierarchy ("Contracts /
 *  Confirm details") — never the workspace mode, never a duplicate of the page's
 *  own canonical h1. The last crumb is the current location; earlier crumbs are
 *  links to their parent area. */
function resolveBreadcrumb(pathname: string): Crumb[] {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return [{ label: "Dashboard" }];

  // Contract sub-surfaces resolve to their real parent area before the generic
  // /contracts inventory root so the leaf is specific.
  if (pathname.startsWith("/contracts/new")) return [CONTRACTS, { label: "New contract" }];
  if (pathname.startsWith("/contracts/bulk")) return [CONTRACTS, { label: "Import contracts" }];
  if (pathname.startsWith("/contracts/review")) return [CONTRACTS, { label: "Review queue" }];
  if (pathname.startsWith("/renewals") || pathname.startsWith("/contracts/renewals")) return [{ label: "Renewals" }];
  if (pathname.startsWith("/evidence") || pathname.startsWith("/contracts/evidence-studio")) return [{ label: "Evidence" }];
  if (pathname.startsWith("/contracts/exceptions")) return [TASKS, { label: "Issues" }];
  if (pathname.startsWith("/contracts/tasks")) return [TASKS, { label: "Tasks" }];
  if (pathname.startsWith("/contracts/obligations")) return [TASKS, { label: "Requirements" }];
  if (pathname.startsWith("/contracts/approvals")) return [TASKS, { label: "Approvals" }];
  if (pathname.startsWith("/contracts/reports")) return [REPORTS, { label: "Report history" }];
  if (pathname === "/contracts") return [{ label: "Contracts" }];
  if (isContractsRoot(pathname)) return [CONTRACTS, { label: "Contract" }];

  if (pathname === "/work" || pathname.startsWith("/work/")) return [{ label: "Tasks" }];
  if (pathname === "/reports") return [{ label: "Reports" }];

  if (pathname === "/settings") return [{ label: "Settings" }];
  if (pathname.startsWith("/settings/health/diagnostics")) {
    return [SETTINGS, { label: "System health", href: "/settings/health" }, { label: "Diagnostics" }];
  }
  if (pathname.startsWith("/settings/")) {
    const leaf =
      Object.entries(SETTINGS_LEAF).find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "Settings";
    return [SETTINGS, { label: leaf }];
  }

  if (pathname.startsWith("/more")) return [{ label: "Tools" }];
  if (pathname.startsWith("/search")) return [{ label: "Search" }];
  if (pathname.startsWith("/onboarding")) return [{ label: "Set up workspace" }];

  // Advanced / Assurance fallback — derive the area + destination from the nav
  // registry so private modes still get a coherent trail.
  const navMatch = NAV_ITEMS.filter(
    (item) => item.section === "primary" && (pathname === item.href || pathname.startsWith(`${item.href}/`))
  ).sort((a, b) => b.href.length - a.href.length)[0];
  if (navMatch) {
    const area = WORKFLOW_AREA_LABELS[getWorkflowAreaForNavItem(navMatch)];
    return area && area !== navMatch.name ? [{ label: area }, { label: navMatch.name }] : [{ label: navMatch.name }];
  }
  return [{ label: "Workspace" }];
}

export function TopbarBreadcrumb() {
  const pathname = usePathname();
  const crumbs = useMemo(() => resolveBreadcrumb(pathname), [pathname]);
  const AreaIcon = AREA_ICON[crumbs[0]?.label ?? ""] ?? null;

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 shrink items-center gap-2 lg:flex">
      {AreaIcon ? (
        <span
          aria-hidden
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--border-strong)_40%,var(--border-subtle))] bg-[var(--surface-raised)] text-[var(--text-secondary)] shadow-[var(--shadow-1)]"
        >
          <AreaIcon className="h-4 w-4" strokeWidth={1.85} />
        </span>
      ) : null}
      <ol className="flex min-w-0 items-center gap-1.5">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${idx}`} className="flex min-w-0 items-center gap-1.5">
              {idx > 0 ? (
                <ChevronRight
                  className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]"
                  strokeWidth={2}
                  aria-hidden
                />
              ) : null}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  prefetch={false}
                  className="ui-nowrap-safe max-w-[12rem] truncate rounded-md px-1.5 py-0.5 text-[12.5px] font-medium leading-[1.1] text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_55%,transparent)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className="max-w-[14rem] truncate text-[12.5px] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)]"
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
