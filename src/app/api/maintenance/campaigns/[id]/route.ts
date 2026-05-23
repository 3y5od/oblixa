import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/maintenance/campaigns/[id]";

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
    apiPath: "/api/maintenance/campaigns/[id]",
  });
  if (modeGate) return modeGate;

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/maintenance/campaigns/[id]");

  if (routeParamRejection) return routeParamRejection;
  const [{ data: campaign }, { data: rows }] = await Promise.all([
    ctx.admin
      .from("maintenance_campaigns")
      .select("id, name, campaign_type, status, filter_json, summary_json, started_at, completed_at, created_at")
      .eq("organization_id", ctx.orgId)
      .eq("id", id)
      .maybeSingle(),
    ctx.admin
      .from("maintenance_campaign_rows")
      .select("id, contract_id, row_key, status, error_message, processed_at")
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", id)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);
  if (!campaign) return jsonNotFound(ROUTE);

  return NextResponse.json({ campaign, rows: rows ?? [] });
}
