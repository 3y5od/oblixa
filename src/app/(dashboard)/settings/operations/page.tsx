import { createAdminClient, getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { SETTINGS_NOTIFICATIONS_STRINGS } from "@/lib/settings/spec-strings";
import { loadOperationsSettingsData } from "./load-operations-settings-data";
import { OperationsSettingsView } from "./operations-settings-view";

// V3 cross-page parity: force-dynamic + robots:noindex (matches
// billing/security). V3 T8.7 adds canEdit prop based on actor's
// workspace role (admin or owner).
export const dynamic = "force-dynamic";

export const metadata = {
  title: SETTINGS_NOTIFICATIONS_STRINGS.title,
  description: SETTINGS_NOTIFICATIONS_STRINGS.lead,
  robots: { index: false, follow: false },
};

export default async function OperationsSettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const data = await loadOperationsSettingsData(ctx.admin, ctx.orgId);

  // V3 T8.7 — read actor's workspace role to decide canEdit. Server
  // action duplicates this check at write-time (defense in depth);
  // the page-level flag drives the view's disabled cascade + the
  // read-only banner.
  const admin = await createAdminClient();
  const { data: { user } = { user: null } } = await ctx.admin.auth.getUser();
  let canEdit = false;
  if (user) {
    const { data: membership } = await admin
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    const role = typeof membership?.role === "string" ? membership.role : "";
    canEdit = role === "admin" || role === "owner";
  }

  return <OperationsSettingsView data={data} canEdit={canEdit} />;
}
