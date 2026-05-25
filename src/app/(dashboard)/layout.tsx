import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { CommandPaletteLoader } from "@/components/layout/command-palette-loader";
import { RefetchOnWindowFocus } from "@/components/layout/refetch-on-window-focus";
import { UiRouteProgress } from "@/components/ui/ui-route-progress";
import { V9PageLoadReporter } from "@/components/layout/page-load-reporter";
import { createClient, getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import { getFeatureFlags, isFeatureEnabled } from "@/lib/feature-flags";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { moreToolsIndexHasVisibleEntries } from "@/lib/product-surface/more-index-visibility";
import { toNavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { OBLIXA_PATHNAME_HEADER } from "@/lib/product-surface/request-pathname";
import { assertPagePathEligibleForContextOrNotFound } from "@/lib/product-surface/route-guard";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function normalizePathnameFromHeader(raw: string | null): string | null {
  if (raw == null || raw === "") return null;
  const pathOnly = raw.split("?")[0]?.split("#")[0] ?? raw;
  const withLeading = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  return withLeading.replace(/\/+/g, "/");
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const pathname = normalizePathnameFromHeader(h.get(OBLIXA_PATHNAME_HEADER));
  if (!pathname) {
    notFound();
  }

  const ctx = await getAuthContext();
  const guardedSurface = await assertPagePathEligibleForContextOrNotFound(pathname, ctx);
  const role = (ctx?.role as WorkspaceRole | undefined) ?? "viewer";

  if (ctx?.mfaRequired && pathname && !pathname.startsWith("/settings/security")) {
    const supabase = await createClient();
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.currentLevel !== "aal2") {
      redirect("/settings/security?mfa=required");
    }
  }

  const v5Flags = getFeatureFlags();

  let navSurface: NavSurfaceInput | null = null;
  let showHeaderUtilitiesLink = true;
  if (ctx) {
    const surface =
      guardedSurface ??
      (await loadProductSurfaceContext(ctx.admin, ctx.orgId, role));
    navSurface = toNavSurfaceInput(surface);
    const v6Any =
      isFeatureEnabled("v6AssuranceCore") ||
      isFeatureEnabled("v6ControlPolicies") ||
      isFeatureEnabled("v6AdaptivePlaybooks") ||
      isFeatureEnabled("v6ReviewBoards") ||
      isFeatureEnabled("v6Autopilot") ||
      isFeatureEnabled("v6Segments");
    showHeaderUtilitiesLink = moreToolsIndexHasVisibleEntries(navSurface, v6Any);
  }

  return (
    <div className="ui-app-shell flex min-h-dvh">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only fixed left-3 top-3 z-[var(--z-modal,50)] focus:not-sr-only focus:inline-flex focus:items-center focus:rounded-md focus:bg-[var(--surface-raised)] focus:px-3 focus:py-2 focus:text-[12.5px] focus:font-semibold focus:text-[var(--accent-strong)] focus:shadow-[var(--shadow-2)] focus:outline-none focus-visible:shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_50%,var(--surface-raised)),0_0_0_4px_color-mix(in_oklab,var(--accent)_18%,transparent)]"
      >
        Skip to main content
      </a>
      <UiRouteProgress />
      <RefetchOnWindowFocus />
      <V9PageLoadReporter />
      <Sidebar
        role={role}
        v5Flags={v5Flags}
        navSurface={navSurface}
        showToolsLink={showHeaderUtilitiesLink}
      />
      <div data-app-content className="flex min-h-dvh min-w-0 flex-1 flex-col bg-transparent">
        <Header
          fullName={ctx?.user?.user_metadata?.full_name}
          email={ctx?.user?.email}
          navSurface={navSurface}
          showUtilitiesLink={showHeaderUtilitiesLink}
        />
        <CommandPaletteLoader
          role={role}
          v5Flags={v5Flags}
          navSurface={navSurface}
          showToolsLink={showHeaderUtilitiesLink}
        />
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="flex-1 px-4 py-5 outline-none md:px-6 md:py-6 xl:px-8"
        >
          <div className="ui-page-stack mx-auto max-w-[1440px] pb-2">{children}</div>
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}
