import { createAdminClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import { workspaceModeAllowsReportType } from "@/lib/product-surface/feature-registry";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";

type V4SurfaceContext = {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  orgId: string;
  role: WorkspaceRole;
};

function roleSeesAdvancedNavByDefault(role: WorkspaceRole): boolean {
  return (
    role === "admin" ||
    role === "editor" ||
    role === "ops_manager" ||
    role === "manager"
  );
}

export async function ensureProgramsSurfaceAccess(ctx: V4SurfaceContext) {
  const v6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  const mode = parseWorkspaceMode(v6);
  if (mode === "core") {
    return { error: "Programs are not available in Core mode." as const };
  }
  if ((v6.advanced_modules_hidden ?? []).includes("programs")) {
    return { error: "Programs are hidden for this workspace." as const };
  }
  if (Array.isArray(v6.advanced_nav_roles)) {
    if (v6.advanced_nav_roles.length === 0 && ctx.role !== "admin") {
      return { error: "Programs are restricted to admins for this workspace." as const };
    }
    if (v6.advanced_nav_roles.length > 0 && !v6.advanced_nav_roles.includes(ctx.role)) {
      return { error: "Your role cannot access Programs in this workspace." as const };
    }
  } else if (!roleSeesAdvancedNavByDefault(ctx.role)) {
    return { error: "Your role cannot access Programs in this workspace." as const };
  }
  return null;
}

export async function ensureReportPackReportTypeAllowed(
  ctx: V4SurfaceContext,
  reportType: string
) {
  const v6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  const mode = parseWorkspaceMode(v6);
  if (!workspaceModeAllowsReportType(mode, reportType)) {
    return { error: "This report type is not available in the current workspace mode." as const };
  }
  return null;
}
