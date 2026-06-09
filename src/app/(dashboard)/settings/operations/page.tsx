import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { SETTINGS_NOTIFICATIONS_STRINGS } from "@/lib/settings/spec-strings";
import { isWorkspaceAdminRole } from "@/lib/roles";
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
  const canEdit = isWorkspaceAdminRole(ctx.role);

  return <OperationsSettingsView data={data} canEdit={canEdit} />;
}
