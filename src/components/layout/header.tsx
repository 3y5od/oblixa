"use client";

/** Appendix B — Utilities header link is gated by `showUtilitiesLink` (see `more-index-visibility.ts`) so Core empty `/more` stays honest.
 *
 *  Search entry-point semantics (search-page-maximal-pass T6.5):
 *  - `⌘K` (anywhere)        → opens the cmd-K overlay via `command-palette-loader.tsx`.
 *  - Enter on chrome input  → navigates to `/search?q=…` (this file's SearchField `onSubmit`).
 *  - Overlay footer link    → navigates to `/search?q=…` (`command-palette.tsx`).
 *  - Click chrome input     → focuses the input; does NOT open the overlay.
 *  Keep these three callers in sync; the overlay remains the quick-jump
 *  surface, the page is the committed-search surface.
 */
import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Wrench } from "lucide-react";
import {
  NAV_ITEMS,
  WORKFLOW_AREA_LABELS,
  getWorkflowAreaForNavItem,
  isContractsRoot,
} from "@/lib/navigation";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { shellTestIds } from "@/lib/qa/test-ids";
import { SearchField } from "@/components/search/search-field";
import { AccountMenu } from "./account-menu";

interface HeaderProps {
  fullName?: string | null;
  email?: string | null;
  navSurface?: NavSurfaceInput | null;
  /** Appendix B — hide when `/more` would be empty for this surface. */
  showUtilitiesLink?: boolean;
}

type Crumb = { label: string; href?: string };

const CONTRACTS: Crumb = { label: "Contracts", href: "/contracts" };
const WORK: Crumb = { label: "Work", href: "/work" };
const REPORTS: Crumb = { label: "Reports", href: "/reports" };
const SETTINGS: Crumb = { label: "Settings", href: "/settings" };

const SETTINGS_LEAF: Record<string, string> = {
  "/settings/security": "Security",
  "/settings/billing": "Billing",
  "/settings/operations": "Operations",
  "/settings/product": "Product",
  "/settings/health": "System health",
  "/settings/policy": "Policy",
};

/** Route-aware breadcrumb trail. Uses real product hierarchy ("Contracts /
 *  Review fields") — never the workspace mode, never a duplicate of the page's
 *  own canonical h1. The last crumb is the current location; earlier crumbs are
 *  links to their parent area. */
function resolveBreadcrumb(pathname: string): Crumb[] {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return [{ label: "Dashboard" }];

  // Contract sub-surfaces resolve to their real parent area before the generic
  // /contracts inventory root so the leaf is specific.
  if (pathname.startsWith("/contracts/new")) return [CONTRACTS, { label: "New contract" }];
  if (pathname.startsWith("/contracts/bulk")) return [CONTRACTS, { label: "Import contracts" }];
  if (pathname.startsWith("/contracts/review")) return [CONTRACTS, { label: "Review fields" }];
  if (pathname.startsWith("/renewals") || pathname.startsWith("/contracts/renewals")) return [{ label: "Renewals" }];
  if (pathname.startsWith("/evidence") || pathname.startsWith("/contracts/evidence-studio")) return [{ label: "Evidence" }];
  if (pathname.startsWith("/contracts/exceptions")) return [WORK, { label: "Exceptions" }];
  if (pathname.startsWith("/contracts/tasks")) return [WORK, { label: "Tasks" }];
  if (pathname.startsWith("/contracts/obligations")) return [WORK, { label: "Obligations" }];
  if (pathname.startsWith("/contracts/approvals")) return [WORK, { label: "Approvals" }];
  if (pathname.startsWith("/contracts/reports")) return [REPORTS, { label: "Report history" }];
  if (pathname === "/contracts") return [{ label: "Contracts" }];
  if (isContractsRoot(pathname)) return [CONTRACTS, { label: "Contract" }];

  if (pathname === "/work" || pathname.startsWith("/work/")) return [{ label: "Work" }];
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

function safeDisplayName(fullName?: string | null, email?: string | null): string {
  // Guard against unset / placeholder values bleeding into chrome.
  const trimmed = fullName?.trim();
  if (trimmed && trimmed.toLowerCase() !== "name" && trimmed !== "—") return trimmed;
  if (email) {
    const local = email.split("@")[0];
    if (local && local.length > 0) return local;
    return email;
  }
  return "User";
}

function safeInitial(fullName?: string | null, email?: string | null): string {
  const trimmed = fullName?.trim();
  if (trimmed && trimmed.toLowerCase() !== "name") return trimmed[0]!.toUpperCase();
  if (email && email.length > 0) return email[0]!.toUpperCase();
  return "?";
}

export function Header({ fullName, email, navSurface, showUtilitiesLink = true }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const displayName = safeDisplayName(fullName, email);
  const initial = safeInitial(fullName, email);
  const hasRealFullName = !!fullName?.trim() && fullName.trim().toLowerCase() !== "name";
  const crumbs = useMemo(() => resolveBreadcrumb(pathname), [pathname]);
  // Tools is a non-Core utility surface; it stays hidden for Core users.
  const showTools = showUtilitiesLink && navSurface?.mode !== "core";

  return (
    <header className="ui-topbar sticky top-0 z-30 shrink-0 px-4 py-2.5 md:px-6 md:py-3">
      <div className="flex items-center gap-3 md:gap-4">
        <nav
          aria-label="Breadcrumb"
          className="hidden min-w-0 shrink items-center lg:flex"
        >
          <ol className="flex min-w-0 items-center gap-1.5">
            {crumbs.map((crumb, idx) => {
              const isLast = idx === crumbs.length - 1;
              return (
                <li key={`${crumb.label}-${idx}`} className="flex min-w-0 items-center gap-1.5">
                  {idx > 0 ? (
                    <ChevronRight
                      className="h-3 w-3 shrink-0 text-[var(--text-tertiary)] opacity-70"
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : null}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      prefetch={false}
                      className="ui-caps-2 truncate rounded-sm text-[11px] leading-none text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent-strong)] focus-visible:text-[var(--accent-strong)] focus-visible:outline-none"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={isLast ? "page" : undefined}
                      className="ui-caps-2 truncate text-[11px] leading-none text-[var(--text-secondary)]"
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 md:gap-3">
          <div className="min-w-0 flex-1 sm:max-w-[22rem] md:max-w-[26rem]">
            <SearchField
              variant="chrome"
              name="q"
              testId={shellTestIds.headerSearch}
              ariaLabel="Search workspace"
              placeholder="Search contracts, work, reports…"
              kbdHint={{ meta: "⌘", key: "K" }}
              ariaKeyShortcuts="Meta+K Control+K"
              // Enter on the header search commits to the dedicated /search page.
              // ⌘K still opens the quick-jump command palette overlay (bound in
              // command-palette-loader.tsx).
              onSubmit={(q) => {
                const trimmed = q.trim().slice(0, 200);
                router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
              }}
            />
          </div>
          {showTools ? (
            <Link
              href="/more"
              prefetch={false}
              className="ui-btn-ghost hidden min-h-9 shrink-0 items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold md:inline-flex"
              aria-label="Open tools"
            >
              <Wrench className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              Tools
            </Link>
          ) : null}
          <AccountMenu
            displayName={displayName}
            email={email}
            initial={initial}
            showEmail={hasRealFullName}
          />
        </div>
      </div>
    </header>
  );
}
