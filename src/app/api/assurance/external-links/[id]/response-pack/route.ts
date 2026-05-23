import { NextResponse } from "next/server";
import { jsonNotFound, jsonProblem } from "@/lib/http/problem";
import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { mergeExternalResponsePack } from "@/lib/v6/external-collaboration";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/assurance/external-links/[id]/response-pack";

function routeFailure(input: {
  status: number;
  error: string;
  code: string;
  diagnosticId: string;
  phase: string;
}) {
  return jsonProblem(input.status, {
    error: input.error,
    code: input.code,
    diagnostic_id: input.diagnosticId,
    route: ROUTE,
    details: { phase: input.phase },
  });
}

/**
 * Internal merge for counterparty response pack metadata (v6.md §9.9).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/assurance/external-links/[id]/response-pack",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.assurance.external-links.id.response-pack",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/assurance/external-links/[id]/response-pack",
    method: "POST",
  }).catch(() => undefined);

  const linkId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: linkId }, ["id"], "/api/assurance/external-links/[id]/response-pack");

  if (routeParamRejection) return routeParamRejection;
  const parsedBody = await parseJsonBodyWithLimit(request, (raw) =>
    readJsonBody<{ pack?: Record<string, unknown> }>(raw ?? {}, {})
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;
  const pack = body.pack && typeof body.pack === "object" ? body.pack : null;
  if (!pack || Object.keys(pack).length === 0) {
    return jsonProblem(400, {
      error: "pack object is required",
      code: "pack_required",
      diagnostic_id: "external_response_pack_required",
      route: ROUTE,
    });
  }

  const { data: link, error: linkError } = await ctx.admin
    .from("external_action_links")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("id", linkId)
    .maybeSingle();
  if (linkError) {
    return routeFailure({
      status: 500,
      error: "Failed to load external link",
      code: "data_source_failed",
      diagnosticId: "external_response_pack_link_load_failed",
      phase: "source_query",
    });
  }
  if (!link) return jsonNotFound(ROUTE);

  const { data, error } = await mergeExternalResponsePack(ctx.admin, ctx.orgId, linkId, pack);
  if (error) {
    return routeFailure({
      status: 500,
      error: "Failed to merge external response pack",
      code: "persistence_failed",
      diagnosticId: "external_response_pack_merge_failed",
      phase: "persist",
    });
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "external_response_pack_merges_total", 1).catch(
    () => undefined
  );
  return NextResponse.json({ externalAction: data });
}
