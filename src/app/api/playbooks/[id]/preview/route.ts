import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { toSafeString } from "@/lib/decision-intelligence/api";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { previewPlaybookRun } from "@/lib/assurance/playbooks";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/playbooks/[id]/preview";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AdaptivePlaybooks");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/playbooks/[id]/preview",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.playbooks.id.preview",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/playbooks/[id]/preview",
    method: "POST",
  }).catch(() => undefined);

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const playbookId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: playbookId }, ["id"], "/api/playbooks/[id]/preview");

  if (routeParamRejection) return routeParamRejection;
  const result = await previewPlaybookRun(ctx.admin, ctx.orgId, playbookId, ctx.userId);
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "playbook_preview_failed",
      diagnostic_id: "playbook_preview_failed",
      route: ROUTE,
    });
  }
  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_post_playbook_preview_total", 1).catch(() => undefined);
  return NextResponse.json({ run: result.data }, { status: 201 });
}
