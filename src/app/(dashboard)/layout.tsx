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
import { getFeatureFlags } from "@/lib/feature-flags";

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

  const navBadges = user && orgId ? await loadNavBadges(orgId, user.id) : {};
  const v5Flags = getFeatureFlags();

  return (
    <div className="flex h-screen bg-[linear-gradient(180deg,rgba(255,255,255,0.55),rgba(248,248,246,0.9))]">
      <Sidebar role={role} navBadges={navBadges} v5Flags={v5Flags} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
        <Header
          fullName={user?.user_metadata?.full_name}
          email={user?.email}
        />
        <CommandPaletteLoader role={role} v5Flags={v5Flags} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto px-4 py-5 outline-none md:px-7 md:py-6"
        >
          <div className="ui-page-stack mx-auto max-w-[1680px]">{children}</div>
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}
