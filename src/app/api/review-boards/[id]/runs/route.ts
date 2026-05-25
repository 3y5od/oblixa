import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { toSafeString } from "@/lib/decision-intelligence/api";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { listReviewBoardRuns } from "@/lib/assurance/review-boards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/review-boards/[id]/runs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6ReviewBoards");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/review-boards/[id]/runs",
  });
  if (modeGate) return modeGate;

  const boardId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: boardId }, ["id"], "/api/review-boards/[id]/runs");

  if (routeParamRejection) return routeParamRejection;
  const result = await listReviewBoardRuns(ctx.admin, ctx.orgId, boardId);
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "review_board_runs_list_failed",
      diagnostic_id: "review_board_runs_list_failed",
      route: ROUTE,
    });
  }
  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_get_review_board_runs_list_total");
  return NextResponse.json({ runs: result.data });
}
