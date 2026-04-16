import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { CommandPaletteLoader } from "@/components/layout/command-palette-loader";
import {
  createAdminClient,
  createClient,
  getOrEnsureDeterministicMembership,
} from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import { fetchNavBadgeCounts } from "@/lib/dashboard-data";
import { getFeatureFlags, isFeatureEnabled } from "@/lib/feature-flags";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { moreToolsIndexHasVisibleEntries } from "@/lib/product-surface/more-index-visibility";
import {
  filterNavBadgesForSurface,
  toNavSurfaceInput,
} from "@/lib/product-surface/nav-visibility";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { OBLIXA_PATHNAME_HEADER } from "@/lib/product-surface/v8-request-pathname";
import { assertPagePathEligibleOrNotFound } from "@/lib/product-surface/route-guard";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";

type NavBadges = {
  reviewQueue: number;
  approvals: number;
  obligations: number;
  watchlists: number;
};

const NAV_BADGES_TTL_MS = 30_000;
const navBadgesCache = new Map<
  string,
  { expiresAt: number; value: NavBadges }
>();

async function loadNavBadges(orgId: string, userId: string): Promise<NavBadges> {
  const cacheKey = `${orgId}:${userId}`;
  const cached = navBadgesCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const value = await fetchNavBadgeCounts(orgId, userId);
  navBadgesCache.set(cacheKey, {
    expiresAt: now + NAV_BADGES_TTL_MS,
    value,
  });
  return value;
}

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
  await assertPagePathEligibleOrNotFound(pathname);

  // Use the user-scoped client here instead of cached getAuthContext so the layout can still
  // access the concrete user object needed by nav/header rendering while sharing membership
  // provisioning semantics with route guards and auth actions.
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: WorkspaceRole = "viewer";
  let orgId: string | null = null;

  if (user) {
    const membership = await getOrEnsureDeterministicMembership(admin, user);
    orgId = membership?.organization_id ?? null;
    role = (membership?.role as WorkspaceRole | null) ?? "viewer";
  }

  const v5Flags = getFeatureFlags();

  let navSurface: NavSurfaceInput | null = null;
  let navBadges: Partial<Record<keyof NavBadges, number>> = {};
  let showHeaderUtilitiesLink = true;
  if (user && orgId) {
    // Independent IO once orgId + role are resolved (after membership / ensureUserOrg).
    const [rawNavBadges, surface] = await Promise.all([
      loadNavBadges(orgId, user.id),
      loadProductSurfaceContext(admin, orgId, role),
    ]);
    navSurface = toNavSurfaceInput(surface);
    navBadges = filterNavBadgesForSurface(rawNavBadges, navSurface);
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
    <div className="flex h-dvh max-h-dvh min-h-0 bg-[radial-gradient(circle_at_top_left,var(--canvas-glow),transparent_30%),radial-gradient(circle_at_top_right,var(--canvas-glow-secondary),transparent_26%),linear-gradient(180deg,color-mix(in_oklab,var(--canvas)_90%,white),var(--canvas-strong))]">
      <Sidebar role={role} navBadges={navBadges} v5Flags={v5Flags} navSurface={navSurface} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
        <Header
          fullName={user?.user_metadata?.full_name}
          email={user?.email}
          navSurface={navSurface}
          showUtilitiesLink={showHeaderUtilitiesLink}
        />
        <CommandPaletteLoader role={role} v5Flags={v5Flags} navSurface={navSurface} />
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 outline-none md:px-6 md:py-5 xl:px-7"
        >
          <div className="ui-page-stack mx-auto max-w-[1760px]">{children}</div>
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}
