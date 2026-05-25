import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext, canManageCapability } from "@/lib/contract-operations/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/maintenance/campaigns/[id]/preview";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/maintenance/campaigns/[id]/preview",
  });
  if (modeGate) return modeGate;

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/maintenance/campaigns/[id]/preview");

  if (routeParamRejection) return routeParamRejection;
  const { data: campaign } = await ctx.admin
    .from("maintenance_campaigns")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return jsonNotFound(ROUTE);

  const [{ count: pending }, { count: processed }, { count: failed }] = await Promise.all([
    ctx.admin
      .from("maintenance_campaign_rows")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", id)
      .eq("status", "pending"),
    ctx.admin
      .from("maintenance_campaign_rows")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", id)
      .eq("status", "processed"),
    ctx.admin
      .from("maintenance_campaign_rows")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", id)
      .eq("status", "failed"),
  ]);

  const summary = {
    pending_rows: pending ?? 0,
    processed_rows: processed ?? 0,
    failed_rows: failed ?? 0,
    previewed_at: new Date().toISOString(),
  };

  await ctx.admin
    .from("maintenance_campaigns")
    .update({
      preview_summary_json: summary,
      last_preview_at: new Date().toISOString(),
    })
    .eq("organization_id", ctx.orgId)
    .eq("id", id);

  return NextResponse.json({ preview: summary });
}
