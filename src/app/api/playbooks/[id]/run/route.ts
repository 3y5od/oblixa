import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/decision-intelligence/api";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/assurance/assurance-checks";
import { runPlaybook } from "@/lib/assurance/playbooks";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/playbooks/[id]/run";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AdaptivePlaybooks");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/playbooks/[id]/run",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.playbooks.id.run",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/playbooks/[id]/run",
    method: "POST",
  }).catch(() => undefined);

  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = readJsonBody<{ sourceFindingId?: string }>(_lb_body.body ?? {}, {});
  const playbookId = toSafeString((await params).id);
  const routeParamRejection = rejectUnsafeRouteParams({ id: playbookId }, ["id"], "/api/playbooks/[id]/run");
  if (routeParamRejection) return routeParamRejection;
  const result = await runPlaybook(ctx.admin, ctx.orgId, playbookId, ctx.userId, {
    sourceFindingId: body.sourceFindingId ? toSafeString(body.sourceFindingId) : null,
  });
  if (result.error) {
    const msg =
      typeof result.error === "object" && result.error && "message" in result.error
        ? String((result.error as { message: string }).message)
        : "Playbook run failed";
    return jsonProblem(400, {
      error: msg,
      code: "playbook_run_failed",
      diagnostic_id: "playbook_run_failed",
      route: ROUTE,
    });
  }
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_post_playbook_run_total", 1).catch(() => undefined);
  return NextResponse.json({ run: result.data }, { status: 201 });
}
