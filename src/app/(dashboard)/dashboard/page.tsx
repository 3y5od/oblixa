import { CoreDashboard } from "@/components/dashboard/core-dashboard";
import { CursorGlow } from "@/components/dashboard/cursor-glow";
import { DashboardKeyboardShortcuts } from "@/components/dashboard/dashboard-keyboard-shortcuts";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { loadCoreDashboardModel } from "@/lib/dashboard/core-dashboard-model";
import { DASHBOARD_TITLE } from "@/lib/dashboard/spec-strings";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { getAuthContext } from "@/lib/supabase/server";

export const metadata = { title: DASHBOARD_TITLE };

export default async function DashboardPage(props: { searchParams: Promise<{ view?: string; qf?: string }> }) {
  const { view: legacyView, qf: legacyQuickFilter } = await props.searchParams;
  void legacyView;
  void legacyQuickFilter;

  const ctx = await getAuthContext();
  if (!ctx) {
    return <WorkspaceRequiredState />;
  }

  const { orgId, user, role, admin } = ctx;
  const workspaceRole = role as WorkspaceRole;
  const productSurface = await loadProductSurfaceContext(admin, orgId, workspaceRole);
  const model = await loadCoreDashboardModel({
    admin,
    orgId,
    userId: user.id,
    role,
    workspaceMode: productSurface.mode,
  });

  return (
    <>
      <CoreDashboard model={model} />
      <DashboardKeyboardShortcuts />
      <CursorGlow />
    </>
  );
}
