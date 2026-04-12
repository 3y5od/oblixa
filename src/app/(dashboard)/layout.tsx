import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { CommandPaletteLoader } from "@/components/layout/command-palette-loader";
import {
  createAdminClient,
  createClient,
  ensureUserOrg,
  getDeterministicMembership,
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

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use the user-scoped Supabase client here (not cached getAuthContext): we must run ensureUserOrg when
  // the user has no membership row; getAuthContext would return null and skip that provisioning path.
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: WorkspaceRole = "viewer";
  let orgId: string | null = null;

  if (user) {
    const membership = await getDeterministicMembership(admin, user.id);
    orgId = membership?.organization_id ?? null;
    role = (membership?.role as WorkspaceRole | null) ?? "viewer";
    if (!orgId) {
      const fullName = user.user_metadata?.full_name;
      await ensureUserOrg(
        user.id,
        fullName ? `${fullName}'s Organization` : "My Organization"
      );
      const ensuredMembership = await getDeterministicMembership(admin, user.id);
      orgId = ensuredMembership?.organization_id ?? null;
      role = (ensuredMembership?.role as WorkspaceRole | null) ?? role;
    }
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
    <div className="flex h-dvh max-h-dvh min-h-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.55),rgba(248,248,246,0.9))]">
      <Sidebar role={role} navBadges={navBadges} v5Flags={v5Flags} navSurface={navSurface} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
        <Header
          fullName={user?.user_metadata?.full_name}
          email={user?.email}
          navSurface={navSurface}
          showUtilitiesLink={showHeaderUtilitiesLink}
        />
        <CommandPaletteLoader role={role} v5Flags={v5Flags} navSurface={navSurface} />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-5 outline-none md:px-7 md:py-6"
        >
          <div className="ui-page-stack mx-auto max-w-[1680px]">{children}</div>
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}
