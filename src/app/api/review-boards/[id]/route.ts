import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/decision-intelligence/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/assurance/assurance-checks";
import { patchReviewBoard } from "@/lib/assurance/review-boards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { requireExpectedVersionForMutation, staleExpectedVersionResponse } from "@/lib/security/stale-write-guard";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/review-boards/[id]";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6ReviewBoards");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/review-boards/[id]",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.review-boards.id",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  const expectedVersionResult = requireExpectedVersionForMutation(request, {
    route: ROUTE,
    diagnosticPrefix: "review_board",
  });
  if (!expectedVersionResult.ok) return expectedVersionResult.response;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/review-boards/[id]",
    method: "PATCH",
  }).catch(() => undefined);

  const boardId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: boardId }, ["id"], "/api/review-boards/[id]");

  if (routeParamRejection) return routeParamRejection;
  const parsedBody = await parseJsonBodyWithLimit(request, (raw) =>
    readJsonBody<{
      subscriptions?: unknown[];
      agendaTemplate?: Record<string, unknown>;
      active?: boolean;
      cadence?: string;
    }>(raw ?? {}, {})
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const result = await patchReviewBoard(
    ctx.admin,
    ctx.orgId,
    boardId,
    {
      subscriptions: body.subscriptions,
      agendaTemplate: body.agendaTemplate,
      active: body.active,
      cadence: body.cadence,
    },
    expectedVersionResult.expectedVersion
  );

  if (result.error) {
    const msg =
      typeof result.error === "object" && result.error && "message" in result.error
        ? String((result.error as { message: string }).message)
        : "Update failed";
    return jsonProblem(400, {
      error: msg,
      code: "review_board_update_failed",
      diagnostic_id: "review_board_update_failed",
      route: ROUTE,
    });
  }
  if (!result.data) {
    return staleExpectedVersionResponse({
      route: ROUTE,
      diagnosticPrefix: "review_board",
    });
  }

  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }

  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_patch_review_board_total", 1).catch(() => undefined);

  return NextResponse.json({ reviewBoard: result.data });
}
