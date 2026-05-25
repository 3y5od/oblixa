import { NextResponse } from "next/server";
import { jsonForbidden, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/contract-operations/api-auth";
import { readJsonBody, toSafeString } from "@/lib/decision-intelligence/api";
import { isValidPacketType, packetTypeValidationError } from "@/lib/decision-intelligence/packet-types";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

const ROUTE = "/api/decisions/packet-templates";

export async function GET() {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/decisions/packet-templates",
  });
  if (modeGate) return modeGate;

  const { data, error } = await ctx.admin
    .from("decision_packet_templates")
    .select("id, name, packet_type, template_json, created_at, updated_at")
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "packet_templates_list_failed",
      diagnostic_id: "packet_templates_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: Request) {
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
    apiPath: "/api/decisions/packet-templates",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.decisions.packet-templates",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/decisions/packet-templates",
    method: "POST",
  }).catch(() => undefined);

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{
    name?: string;
    packetType?: string;
    template?: Record<string, unknown>;
  }>(raw, {});
  const name = toSafeString(body.name);
  if (!name) {
    return jsonProblem(400, {
      error: "name is required",
      code: "name_required",
      diagnostic_id: "packet_template_name_required",
      route: ROUTE,
    });
  }
  const rawPt = toSafeString(body.packetType) || "renewal_packet";
  if (!isValidPacketType(rawPt)) {
    return jsonProblem(400, {
      error: packetTypeValidationError(),
      code: "invalid_packet_type",
      diagnostic_id: "packet_template_type_invalid",
      route: ROUTE,
    });
  }
  const packetType = rawPt;
  const templateJson = body.template && typeof body.template === "object" ? body.template : {};

  const { data, error } = await ctx.admin
    .from("decision_packet_templates")
    .insert({
      organization_id: ctx.orgId,
      name,
      packet_type: packetType,
      template_json: templateJson,
      created_by: ctx.userId,
    })
    .select("id, name, packet_type, template_json, created_at")
    .single();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "packet_template_create_failed",
      diagnostic_id: "packet_template_create_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ template: data }, { status: 201 });
}
