import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { toSafeString } from "@/lib/decision-intelligence/api";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { generateReviewBoardRun } from "@/lib/assurance/review-boards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/review-boards/[id]/generate-run";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6ReviewBoards");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/review-boards/[id]/generate-run",
  });
  if (modeGate) return modeGate;

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;
  const duplicate = await enforceIdempotency(request, {
    scope: "review-boards.generate-run",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/review-boards/[id]/generate-run",
    method: "POST",
  }).catch(() => undefined);

  const boardId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: boardId }, ["id"], "/api/review-boards/[id]/generate-run");

  if (routeParamRejection) return routeParamRejection;
  const result = await generateReviewBoardRun(ctx.admin, ctx.orgId, boardId, ctx.userId);
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "review_board_generate_run_failed",
      diagnostic_id: "review_board_generate_run_failed",
      route: ROUTE,
    });
  }
  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "review_board_manual_generate_run_total", 1).catch(
    () => undefined
  );
  return NextResponse.json({ run: result.data }, { status: 201 });
}
