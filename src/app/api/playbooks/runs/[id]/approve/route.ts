import { NextResponse } from "next/server";
import { jsonNotFound, jsonProblem } from "@/lib/http/problem";
import { toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { approveAndContinuePlaybookRun } from "@/lib/v6/playbooks";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/playbooks/runs/[id]/approve";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AdaptivePlaybooks");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/playbooks/runs/[id]/approve",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.playbooks.runs.id.approve",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/playbooks/runs/[id]/approve",
    method: "POST",
  }).catch(() => undefined);

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const runId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: runId }, ["id"], "/api/playbooks/runs/[id]/approve");

  if (routeParamRejection) return routeParamRejection;
  const result = await approveAndContinuePlaybookRun(ctx.admin, ctx.orgId, ctx.userId, runId);
  if (result.error) {
    const msg =
      typeof result.error === "object" && result.error && "message" in result.error
        ? String((result.error as { message: string }).message)
        : "Approve failed";
    const status = msg === "run_not_found" ? 404 : msg === "run_not_awaiting_approval" ? 409 : 400;
    if (status === 404) return jsonNotFound(ROUTE);
    return jsonProblem(status, {
      error: msg,
      code: status === 409 ? "run_not_awaiting_approval" : "playbook_run_approve_failed",
      diagnostic_id: status === 409 ? "playbook_run_not_awaiting_approval" : "playbook_run_approve_failed",
      route: ROUTE,
    });
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_playbook_run_approve_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ run: result.data }, { status: 200 });
}
