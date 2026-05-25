import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/decision-intelligence/api";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { createReviewBoard, listReviewBoards } from "@/lib/assurance/review-boards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

const ROUTE = "/api/review-boards";

export async function GET() {
  const disabled = requireV6ApiFeature("v6ReviewBoards");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/review-boards",
  });
  if (modeGate) return modeGate;

  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_get_review_boards_list_total", 1).catch(
    () => undefined
  );

  const { data, error } = await listReviewBoards(ctx.admin, ctx.orgId);
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "review_boards_list_failed",
      diagnostic_id: "review_boards_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ reviewBoards: data ?? [] });
}

export async function POST(request: Request) {
  const disabled = requireV6ApiFeature("v6ReviewBoards");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/review-boards",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.review-boards",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/review-boards",
    method: "POST",
  }).catch(() => undefined);

  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = readJsonBody<{ name?: string; boardType?: string; cadence?: string }>(_lb_body.body ?? {}, {});
  const name = toSafeString(body.name);
  const boardType = toSafeString(body.boardType) || "weekly_portfolio_health";
  if (!name) {
    return jsonProblem(400, {
      error: "name is required",
      code: "name_required",
      diagnostic_id: "review_board_name_required",
      route: ROUTE,
    });
  }

  const result = await createReviewBoard(ctx.admin, ctx.orgId, ctx.userId, { name, boardType, cadence: toSafeString(body.cadence) || undefined });
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "review_board_create_failed",
      diagnostic_id: "review_board_create_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ reviewBoard: result.data }, { status: 201 });
}
