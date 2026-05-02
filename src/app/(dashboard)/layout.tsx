import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { CommandPaletteLoader } from "@/components/layout/command-palette-loader";
import { RefetchOnWindowFocus } from "@/components/layout/refetch-on-window-focus";
import { V9PageLoadReporter } from "@/components/layout/v9-page-load-reporter";
import { createClient, getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import { getFeatureFlags, isFeatureEnabled } from "@/lib/feature-flags";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { moreToolsIndexHasVisibleEntries } from "@/lib/product-surface/more-index-visibility";
import { toNavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { OBLIXA_PATHNAME_HEADER } from "@/lib/product-surface/v8-request-pathname";
import { assertPagePathEligibleForContextOrNotFound } from "@/lib/product-surface/route-guard";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";

type NavBadges = {
  reviewQueue: number;
  approvals: number;
  obligations: number;
  watchlists: number;
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
  const user = ctx?.user ?? null;
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
  const navBadges: Partial<Record<keyof NavBadges, number>> = {};
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
    <div className="flex h-dvh max-h-dvh min-h-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,var(--canvas-glow)_118%,transparent),transparent_30%),radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--canvas-glow-secondary)_128%,transparent),transparent_24%),linear-gradient(180deg,color-mix(in_oklab,var(--canvas)_86%,white),var(--canvas-strong))]">
      <RefetchOnWindowFocus />
      <V9PageLoadReporter />
      <Sidebar role={role} navBadges={navBadges} v5Flags={v5Flags} navSurface={navSurface} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
        <Header
          fullName={user?.user_metadata?.full_name}
          email={user?.email}
          navSurface={navSurface}
          showUtilitiesLink={showHeaderUtilitiesLink}
        />
        <CommandPaletteLoader
          role={role}
          v5Flags={v5Flags}
          navSurface={navSurface}
        />
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-5 outline-none md:px-6 md:py-6 xl:px-8"
        >
          <div className="ui-page-stack mx-auto max-w-[1780px] pb-2">{children}</div>
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}
