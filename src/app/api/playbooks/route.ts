import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/decision-intelligence/api";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { createPlaybook, listPlaybooks } from "@/lib/assurance/playbooks";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

const ROUTE = "/api/playbooks";

export async function GET() {
  const disabled = requireV6ApiFeature("v6AdaptivePlaybooks");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/playbooks",
  });
  if (modeGate) return modeGate;

  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_get_playbooks_list_total", 1).catch(() => undefined);

  const { data, error } = await listPlaybooks(ctx.admin, ctx.orgId);
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "playbooks_list_failed",
      diagnostic_id: "playbooks_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ playbooks: data ?? [] });
}

export async function POST(request: Request) {
  const disabled = requireV6ApiFeature("v6AdaptivePlaybooks");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/playbooks",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.playbooks",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/playbooks",
    method: "POST",
  }).catch(() => undefined);

  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = readJsonBody<{ name?: string; playbookType?: string }>(_lb_body.body ?? {}, {});
  const name = toSafeString(body.name);
  const playbookType = toSafeString(body.playbookType) || "custom";
  if (!name) {
    return jsonProblem(400, {
      error: "name is required",
      code: "name_required",
      diagnostic_id: "playbook_name_required",
      route: ROUTE,
    });
  }

  const result = await createPlaybook(ctx.admin, ctx.orgId, ctx.userId, { name, playbookType });
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "playbook_create_failed",
      diagnostic_id: "playbook_create_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ playbook: result.data }, { status: 201 });
}
