import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { clampConfidence, readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/decisions/[id]/recommend";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/decisions/[id]/recommend",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.decisions.id.recommend",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/decisions/[id]/recommend",
    method: "POST",
  }).catch(() => undefined);

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{
    recommendationType?: string;
    recommendationText?: string;
    reasons?: unknown[];
    sourceObjectRefs?: unknown[];
    confidence?: number;
  }>(raw, {});
  const recommendationText = toSafeString(body.recommendationText);
  if (!recommendationText) {
    return jsonProblem(400, {
      error: "recommendationText is required",
      code: "recommendation_text_required",
      diagnostic_id: "decision_recommendation_text_required",
      route: ROUTE,
    });
  }
  const { id } = await params;
  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/decisions/[id]/recommend");
  if (routeParamRejection) return routeParamRejection;
  const { data: workspace } = await ctx.admin
    .from("decision_workspaces")
    .select("id")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!workspace) return jsonNotFound(ROUTE);

  const reasons = Array.isArray(body.reasons) ? body.reasons : [];
  const sourceObjectRefs = Array.isArray(body.sourceObjectRefs) ? body.sourceObjectRefs : [];
  if (reasons.length === 0) {
    return jsonProblem(400, {
      error: "reasons must include at least one grounded reason",
      code: "reasons_required",
      diagnostic_id: "decision_recommendation_reasons_required",
      route: ROUTE,
    });
  }
  if (sourceObjectRefs.length === 0) {
    return jsonProblem(400, {
      error: "sourceObjectRefs must include at least one linked object reference",
      code: "source_object_refs_required",
      diagnostic_id: "decision_recommendation_source_refs_required",
      route: ROUTE,
    });
  }

  const { data, error } = await ctx.admin
    .from("decision_recommendations")
    .insert({
      organization_id: ctx.orgId,
      decision_workspace_id: id,
      recommendation_type: toSafeString(body.recommendationType) || "review_priority_suggestion",
      recommendation_text: recommendationText,
      reasons_json: reasons,
      source_object_refs_json: sourceObjectRefs,
      confidence: clampConfidence(body.confidence),
    })
    .select(
      "id, recommendation_type, recommendation_text, confidence, reasons_json, source_object_refs_json, created_at"
    )
    .single();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "decision_recommendation_create_failed",
      diagnostic_id: "decision_recommendation_create_failed",
      route: ROUTE,
    });
  }

  await ctx.admin
    .from("decision_workspaces")
    .update({
      recommendation_json: {
        latest_recommendation_id: data.id,
        summary: recommendationText.slice(0, 500),
        updated_at: new Date().toISOString(),
      },
    })
    .eq("organization_id", ctx.orgId)
    .eq("id", id);

  await ctx.admin.from("decision_workspace_events").insert({
    organization_id: ctx.orgId,
    decision_workspace_id: id,
    event_type: "decision.recommendation_added",
    payload_json: { recommendation_id: data.id },
    actor_user_id: ctx.userId,
  });

  return NextResponse.json({ recommendation: data }, { status: 201 });
}

