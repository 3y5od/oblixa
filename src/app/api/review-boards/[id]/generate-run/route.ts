import { NextResponse } from "next/server";
import { toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { generateReviewBoardRun } from "@/lib/v6/review-boards";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6ReviewBoards");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const boardId = toSafeString((await params).id);
  const result = await generateReviewBoardRun(ctx.admin, ctx.orgId, boardId, ctx.userId);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "review_board_manual_generate_run_total", 1).catch(
    () => undefined
  );
  return NextResponse.json({ run: result.data }, { status: 201 });
}
