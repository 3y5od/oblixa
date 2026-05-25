import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { getApiAuthContext, canManageCapability } from "@/lib/contract-operations/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/attestations/[id]/respond";

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
    apiPath: "/api/attestations/[id]/respond",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.attestations.id.respond",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/attestations/[id]/respond",
    method: "POST",
  }).catch(() => undefined);
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return jsonForbidden(ROUTE);
  }

  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as {
    responseType?: "confirm" | "reject" | "needs_follow_up";
    note?: string;
    payload?: Record<string, unknown>;
  };
  const responseType = body.responseType ?? "confirm";

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/attestations/[id]/respond");

  if (routeParamRejection) return routeParamRejection;
  const { data: reqRow } = await ctx.admin
    .from("attestation_requests")
    .select("id, status")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!reqRow) return jsonNotFound(ROUTE);
  if (!["open", "overdue"].includes(reqRow.status)) {
    return jsonProblem(409, {
      error: `Cannot respond to an attestation request with status "${reqRow.status}"`,
      code: "attestation_invalid_status",
      diagnostic_id: "attestation_response_invalid_status",
      route: ROUTE,
    });
  }

  const nextStatus = responseType === "reject" ? "rejected" : "responded";
  const { data: claimedRequest, error: claimError } = await ctx.admin
    .from("attestation_requests")
    .update({ status: nextStatus })
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .in("status", ["open", "overdue"])
    .select("id, status")
    .maybeSingle();
  if (claimError) {
    return jsonProblem(400, {
      error: claimError.message,
      code: "attestation_response_claim_failed",
      diagnostic_id: "attestation_response_claim_failed",
      route: ROUTE,
    });
  }
  if (!claimedRequest) {
    return jsonProblem(409, {
      error: "Attestation request status changed before response",
      code: "attestation_response_stale_status",
      diagnostic_id: "attestation_response_stale_status",
      route: ROUTE,
    });
  }

  const { error } = await ctx.admin.from("attestation_responses").insert({
    organization_id: ctx.orgId,
    request_id: id,
    responder_id: ctx.userId,
    response_type: responseType,
    response_note: body.note?.trim() || null,
    payload_json: body.payload ?? {},
  });
  if (error) {
    await ctx.admin
      .from("attestation_requests")
      .update({ status: reqRow.status })
      .eq("id", id)
      .eq("organization_id", ctx.orgId)
      .eq("status", nextStatus);
    return jsonProblem(400, {
      error: error.message,
      code: "attestation_response_create_failed",
      diagnostic_id: "attestation_response_create_failed",
      route: ROUTE,
    });
  }

  return NextResponse.json({ ok: true });
}
