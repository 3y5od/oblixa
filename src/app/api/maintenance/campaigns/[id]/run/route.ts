import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { createClient } from "@/lib/supabase/server";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";
import { hasSensitiveActionProof } from "@/lib/security/sensitive-action-proof";
import { recordSecurityAuditEvent } from "@/lib/security/audit-write";

const ROUTE = "/api/maintenance/campaigns/[id]/run";

export async function POST(
  request: Request,
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
    apiPath: "/api/maintenance/campaigns/[id]/run",
  });
  if (modeGate) return modeGate;

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/maintenance/campaigns/[id]/run");

  if (routeParamRejection) return routeParamRejection;
  const supabase = await createClient();
  if (!(await hasSensitiveActionProof(supabase, ctx.userId))) {
    void recordSecurityAuditEvent(ctx.admin, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      action: "security.maintenance_destructive_action_blocked",
      targetType: "maintenance_campaign",
      targetId: id,
      outcome: "forbidden",
      safeMetadata: {
        reason: "sensitive_action_proof_required",
        route: ROUTE,
        maintenance_action: "run_maintenance_campaign",
      },
    }).catch(() => undefined);
    return jsonProblem(403, {
      error: "Step-up required",
      code: "step_up_required",
      diagnostic_id: "maintenance_campaign_run_step_up_required",
      route: ROUTE,
    });
  }

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: ROUTE,
    method: "POST",
  }).catch(() => undefined);

  const { data: campaign } = await ctx.admin
    .from("maintenance_campaigns")
    .select("id, status")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return jsonNotFound(ROUTE);

  await ctx.admin
    .from("maintenance_campaigns")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("organization_id", ctx.orgId)
    .eq("id", id);

  const { data: rows } = await ctx.admin
    .from("maintenance_campaign_rows")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("campaign_id", id)
    .eq("status", "pending")
    .limit(1000);

  if ((rows?.length ?? 0) > 0) {
    await ctx.admin
      .from("maintenance_campaign_rows")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", id)
      .eq("status", "pending");
  }

  const { count: processedCount } = await ctx.admin
    .from("maintenance_campaign_rows")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.orgId)
    .eq("campaign_id", id)
    .eq("status", "processed");

  const actualProcessed = processedCount ?? 0;

  await ctx.admin
    .from("maintenance_campaigns")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      summary_json: { processed: actualProcessed },
    })
    .eq("organization_id", ctx.orgId)
    .eq("id", id);

  return NextResponse.json({ ok: true, processed: actualProcessed });
}
