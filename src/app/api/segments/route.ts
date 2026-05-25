import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { BODY_LIMIT_MEDIUM_JSON, parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/decision-intelligence/api";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/assurance/assurance-checks";
import { createSegment, listSegments } from "@/lib/assurance/segments";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

const ALLOWED_SEGMENT_TYPES = new Set([
  "business_unit",
  "region",
  "product_line",
  "contract_class",
  "customer_tier",
  "operational_tier",
  "control_sensitivity_tier",
  "custom",
]);
const ROUTE = "/api/segments";

export async function GET() {
  const disabled = requireV6ApiFeature("v6Segments");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/segments",
  });
  if (modeGate) return modeGate;

  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_get_segments_list_total", 1).catch(() => undefined);

  const { data, error } = await listSegments(ctx.admin, ctx.orgId);
  if (error) {
    console.error("[api/segments] GET error:", error.message);
    return jsonProblem(400, {
      error: "Failed to process request",
      code: "segments_list_failed",
      diagnostic_id: "segments_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ segments: data ?? [] });
}

export async function POST(request: Request) {
  const disabled = requireV6ApiFeature("v6Segments");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/segments",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.segments",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/segments",
    method: "POST",
  }).catch(() => undefined);

  const parsedBody = await parseJsonBodyWithLimit(
    request,
    (raw) =>
      readJsonBody<{ segmentType?: string; key?: string; name?: string; criteria?: Record<string, unknown> }>(
        raw ?? {},
        {}
      ),
    BODY_LIMIT_MEDIUM_JSON
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const segmentType = toSafeString(body.segmentType) || "custom";
  if (!ALLOWED_SEGMENT_TYPES.has(segmentType)) {
    return jsonProblem(400, {
      error: `segmentType must be one of: ${[...ALLOWED_SEGMENT_TYPES].join(", ")}`,
      code: "invalid_segment_type",
      diagnostic_id: "segment_type_invalid",
      route: ROUTE,
    });
  }
  const key = toSafeString(body.key);
  const name = toSafeString(body.name);
  if (!key || !name) {
    return jsonProblem(400, {
      error: "key and name are required",
      code: "key_name_required",
      diagnostic_id: "segment_key_name_required",
      route: ROUTE,
    });
  }

  const result = await createSegment(ctx.admin, ctx.orgId, ctx.userId, {
    segmentType,
    key,
    name,
    criteria: body.criteria,
  });
  if (result.error) {
    console.error("[api/segments] POST error:", result.error.message);
    return jsonProblem(400, {
      error: "Failed to process request",
      code: "segment_create_failed",
      diagnostic_id: "segment_create_failed",
      route: ROUTE,
    });
  }
  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_post_segment_create_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ segment: result.data }, { status: 201 });
}
