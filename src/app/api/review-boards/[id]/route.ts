import { NextResponse } from "next/server";
import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { patchReviewBoard } from "@/lib/v6/review-boards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

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

  const boardId = toSafeString((await params).id);
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

  const result = await patchReviewBoard(ctx.admin, ctx.orgId, boardId, {
    subscriptions: body.subscriptions,
    agendaTemplate: body.agendaTemplate,
    active: body.active,
    cadence: body.cadence,
  });

  if (result.error) {
    const msg =
      typeof result.error === "object" && result.error && "message" in result.error
        ? String((result.error as { message: string }).message)
        : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_patch_review_board_total", 1).catch(() => undefined);

  return NextResponse.json({ reviewBoard: result.data });
}
