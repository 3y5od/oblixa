import { NextResponse } from "next/server";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { createReviewBoard, listReviewBoards } from "@/lib/v6/review-boards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

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

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_review_boards_list_total", 1).catch(
    () => undefined
  );

  const { data, error } = await listReviewBoards(ctx.admin, ctx.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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

  const body = readJsonBody<{ name?: string; boardType?: string; cadence?: string }>(await request.json().catch(() => ({})), {});
  const name = toSafeString(body.name);
  const boardType = toSafeString(body.boardType) || "weekly_portfolio_health";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const result = await createReviewBoard(ctx.admin, ctx.orgId, ctx.userId, { name, boardType, cadence: toSafeString(body.cadence) || undefined });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({ reviewBoard: result.data }, { status: 201 });
}
