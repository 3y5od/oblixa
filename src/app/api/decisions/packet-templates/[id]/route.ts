import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited, rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { isValidPacketType, packetTypeValidationError } from "@/lib/v5/packet-types";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { requireExpectedVersionForMutation, staleExpectedVersionResponse } from "@/lib/security/stale-write-guard";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/decisions/packet-templates/[id]";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/decisions/packet-templates/[id]",
  });
  if (modeGate) return modeGate;

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/decisions/packet-templates/[id]");

  if (routeParamRejection) return routeParamRejection;
  const { data, error } = await ctx.admin
    .from("decision_packet_templates")
    .select("id, name, packet_type, template_json, created_at, updated_at")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "packet_template_lookup_failed",
      diagnostic_id: "packet_template_lookup_failed",
      route: ROUTE,
    });
  }
  if (!data) return jsonNotFound(ROUTE);
  return NextResponse.json({ template: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    apiPath: "/api/decisions/packet-templates/[id]",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.decisions.packet-templates.id",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/decisions/packet-templates/[id]",
    method: "PATCH",
  }).catch(() => undefined);

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{
    name?: string;
    packetType?: string;
    template?: Record<string, unknown>;
  }>(raw, {});

  const patch: Record<string, unknown> = {};
  const { id } = await params;
  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/decisions/packet-templates/[id]");
  if (routeParamRejection) return routeParamRejection;
  if (body.name !== undefined) {
    const n = toSafeString(body.name);
    if (!n) {
      return jsonProblem(400, {
        error: "name cannot be empty",
        code: "name_empty",
        diagnostic_id: "packet_template_name_empty",
        route: ROUTE,
      });
    }
    patch.name = n;
  }
  if (body.packetType !== undefined) {
    const pt = toSafeString(body.packetType);
    if (!pt || !isValidPacketType(pt)) {
      return jsonProblem(400, {
        error: packetTypeValidationError(),
        code: "invalid_packet_type",
        diagnostic_id: "packet_template_type_invalid",
        route: ROUTE,
      });
    }
    patch.packet_type = pt;
  }
  if (body.template !== undefined) {
    patch.template_json =
      body.template && typeof body.template === "object" ? body.template : {};
  }
  if (Object.keys(patch).length === 0) {
    return jsonProblem(400, {
      error: "No valid fields to update",
      code: "no_valid_fields",
      diagnostic_id: "packet_template_no_valid_fields",
      route: ROUTE,
    });
  }

  const expectedVersionResult = requireExpectedVersionForMutation(request, {
    route: ROUTE,
    diagnosticPrefix: "packet_template",
  });
  if (!expectedVersionResult.ok) return expectedVersionResult.response;

  const { data, error } = await ctx.admin
    .from("decision_packet_templates")
    .update(patch)
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .eq("updated_at", expectedVersionResult.expectedVersion)
    .select("id, name, packet_type, template_json, updated_at")
    .maybeSingle();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "packet_template_update_failed",
      diagnostic_id: "packet_template_update_failed",
      route: ROUTE,
    });
  }
  if (!data) {
    return staleExpectedVersionResponse({
      route: ROUTE,
      diagnosticPrefix: "packet_template",
    });
  }
  return NextResponse.json({ template: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    apiPath: "/api/decisions/packet-templates/[id]",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.decisions.packet-templates.id",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/decisions/packet-templates/[id]",
    method: "DELETE",
  }).catch(() => undefined);

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/decisions/packet-templates/[id]");

  if (routeParamRejection) return routeParamRejection;
  const { error } = await ctx.admin
    .from("decision_packet_templates")
    .delete()
    .eq("organization_id", ctx.orgId)
    .eq("id", id);
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "packet_template_delete_failed",
      diagnostic_id: "packet_template_delete_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ ok: true });
}
