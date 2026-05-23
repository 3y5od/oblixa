import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { listReviewBoardRuns } from "@/lib/v6/review-boards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
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
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_review_board_runs_list_total");
  return NextResponse.json({ runs: result.data });
}
