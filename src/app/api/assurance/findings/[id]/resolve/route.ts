import { NextResponse } from "next/server";
import { jsonNotFound, jsonProblem } from "@/lib/http/problem";
import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { dismissFinding, resolveFinding } from "@/lib/v6/assurance";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/assurance/findings/[id]/resolve";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/assurance/findings/[id]/resolve",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.assurance.findings.id.resolve",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/assurance/findings/[id]/resolve",
    method: "POST",
  }).catch(() => undefined);

  const parsedBody = await parseJsonBodyWithLimit(request, (raw) =>
    readJsonBody<{ note?: string; action?: string; signalFeedback?: string }>(raw ?? {}, {})
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;
  const findingId = toSafeString((await params).id);
  const routeParamRejection = rejectUnsafeRouteParams({ id: findingId }, ["id"], "/api/assurance/findings/[id]/resolve");
  if (routeParamRejection) return routeParamRejection;
  if (!findingId) {
    return jsonProblem(400, {
      error: "id is required",
      code: "id_required",
      diagnostic_id: "assurance_finding_id_required",
      route: ROUTE,
    });
  }

  if (body.action && !["resolve", "dismiss"].includes(body.action)) {
    return jsonProblem(400, {
      error: "Invalid action",
      code: "invalid_action",
      diagnostic_id: "assurance_finding_action_invalid",
      route: ROUTE,
    });
  }

  const note = toSafeString(body.note);
  const feedbackRaw = toSafeString(body.signalFeedback).trim().toLowerCase();
  const allowed = new Set(["false_positive", "not_actionable", "confirmed_true"]);
  const signalFeedback = feedbackRaw && allowed.has(feedbackRaw) ? feedbackRaw : null;

  const result =
    body.action === "dismiss"
      ? await dismissFinding(ctx.admin, ctx.orgId, ctx.userId, findingId, note || undefined, signalFeedback)
      : await resolveFinding(ctx.admin, ctx.orgId, ctx.userId, findingId, note || undefined, signalFeedback);
  if (result.error) {
    const inactive = result.error.message === "finding_not_active";
    return jsonProblem(inactive ? 409 : 400, {
      error: inactive ? "Finding is already resolved or dismissed" : result.error.message,
      code: inactive ? "assurance_finding_not_active" : "assurance_finding_resolution_failed",
      diagnostic_id: inactive ? "assurance_finding_not_active" : "assurance_finding_resolution_failed",
      route: ROUTE,
    });
  }
  if (!result.data) return jsonNotFound(ROUTE);
  if (signalFeedback === "false_positive") {
    await incrementV6QualityCounter(ctx.admin, ctx.orgId, "findings_labeled_false_positive_total", 1).catch(
      () => undefined
    );
  }
  return NextResponse.json({ finding: result.data });
}
