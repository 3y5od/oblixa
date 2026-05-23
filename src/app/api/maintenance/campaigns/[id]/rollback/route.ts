import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { createClient } from "@/lib/supabase/server";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";
import { hasSensitiveActionProof } from "@/lib/security/sensitive-action-proof";
import { recordSecurityAuditEvent } from "@/lib/security/audit-write";

const ROUTE = "/api/maintenance/campaigns/[id]/rollback";

/**
 * Marks a campaign as rolled back for audit visibility. Row-level reversal
 * depends on campaign-specific before_json snapshots when populated by runners.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/maintenance/campaigns/[id]/rollback",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return jsonForbidden(ROUTE);
  }

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/maintenance/campaigns/[id]/rollback");

  if (routeParamRejection) return routeParamRejection;
  const supabase = await createClient();
  const duplicate = await enforceIdempotency(request, {
    scope: "api.maintenance.campaigns.id.rollback",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

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
        maintenance_action: "rollback_maintenance_campaign",
      },
    }).catch(() => undefined);
    return jsonProblem(403, {
      error: "Step-up required",
      code: "step_up_required",
      diagnostic_id: "maintenance_campaign_rollback_step_up_required",
      route: ROUTE,
    });
  }

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/maintenance/campaigns/[id]/rollback",
    method: "POST",
  }).catch(() => undefined);

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;
  const { data: campaign } = await ctx.admin
    .from("maintenance_campaigns")
    .select("id, status, summary_json, rolled_back_at")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return jsonNotFound(ROUTE);
  if (campaign.rolled_back_at) {
    return jsonProblem(409, {
      error: "Maintenance campaign was already rolled back",
      code: "maintenance_campaign_already_rolled_back",
      diagnostic_id: "maintenance_campaign_already_rolled_back",
      route: ROUTE,
    });
  }

  const now = new Date().toISOString();
  const prevSummary = (campaign.summary_json as Record<string, unknown> | null) ?? {};
  const { data: updated, error: updateError } = await ctx.admin
    .from("maintenance_campaigns")
    .update({
      rolled_back_at: now,
      status: "canceled",
      summary_json: {
        ...prevSummary,
        rollback_marked_at: now,
        rollback_note: "Marked rolled back via API; verify data manually if before_json not populated.",
      },
    })
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .is("rolled_back_at", null)
    .select("id, rolled_back_at")
    .maybeSingle();
  if (updateError) {
    return jsonProblem(400, {
      error: updateError.message,
      code: "maintenance_campaign_rollback_failed",
      diagnostic_id: "maintenance_campaign_rollback_failed",
      route: ROUTE,
    });
  }
  if (!updated) {
    return jsonProblem(409, {
      error: "Maintenance campaign was already rolled back",
      code: "maintenance_campaign_already_rolled_back",
      diagnostic_id: "maintenance_campaign_already_rolled_back",
      route: ROUTE,
    });
  }

  return NextResponse.json({ ok: true, rolled_back_at: now });
}
