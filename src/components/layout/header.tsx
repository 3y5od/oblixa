"use client";

/** Appendix B — Utilities header link is gated by `showUtilitiesLink` (see `more-index-visibility.ts`) so Core empty `/more` stays honest. */
import Link from "next/link";
import { Wrench } from "lucide-react";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { shellTestIds } from "@/lib/qa/test-ids";
import { AccountMenu } from "./account-menu";
import { TopbarBreadcrumb } from "./topbar/topbar-breadcrumb";
import { TopbarSearch } from "./topbar/topbar-search";

interface HeaderProps {
  fullName?: string | null;
  email?: string | null;
  navSurface?: NavSurfaceInput | null;
  /** Appendix B — hide when `/more` would be empty for this surface. */
  showUtilitiesLink?: boolean;
}

/** Resolve a chrome-safe account identity. An email local-part is NOT a name:
 *  with no real profile name we show a neutral "Account" label in the topbar and
 *  let the dropdown body carry the real email + role. `title` exposes the full
 *  name/email on hover for inspection. */
function resolveAccountIdentity(
  fullName?: string | null,
  email?: string | null,
): { displayName: string; initial: string; title: string } {
  const trimmed = fullName?.trim();
  const hasRealName = !!trimmed && trimmed.toLowerCase() !== "name" && trimmed !== "—";
  const realName = hasRealName ? trimmed! : null;
  const displayName = realName ?? "Account";
  const initialSource = realName ?? email ?? "";
  const initial = initialSource.length > 0 ? initialSource[0]!.toUpperCase() : "?";
  const title = realName ?? email ?? "Account";
  return { displayName, initial, title };
}

export function Header({ fullName, email, navSurface, showUtilitiesLink = true }: HeaderProps) {
  const { displayName, initial, title } = resolveAccountIdentity(fullName, email);
  // Tools is a non-Core utility surface; it stays hidden for Core users.
  const showTools = showUtilitiesLink && navSurface?.mode !== "core";

  return (
    <header
      data-testid={shellTestIds.headerTopbar}
      className="ui-topbar sticky top-0 z-30 shrink-0 px-4 md:px-6 xl:px-8"
    >
      <div className="mx-auto flex h-[var(--shell-topbar-h)] w-full max-w-[var(--shell-content-max)] items-center gap-3 pl-12 md:gap-4 lg:pl-0">
        <TopbarBreadcrumb />

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <TopbarSearch />
          {showTools ? (
            <Link
              href="/more"
              prefetch={false}
              className="ui-btn-ghost hidden h-10 shrink-0 items-center gap-1.5 px-3 py-0 text-[12.5px] font-semibold md:inline-flex"
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
            title={title}
            role={navSurface?.role}
          />
        </div>
      </div>
    </header>
  );
}
