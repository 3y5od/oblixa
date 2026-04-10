import { NextResponse } from "next/server";
import { toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { approveAndContinuePlaybookRun } from "@/lib/v6/playbooks";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AdaptivePlaybooks");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const runId = toSafeString((await params).id);
  const result = await approveAndContinuePlaybookRun(ctx.admin, ctx.orgId, ctx.userId, runId);
  if (result.error) {
    const msg =
      typeof result.error === "object" && result.error && "message" in result.error
        ? String((result.error as { message: string }).message)
        : "Approve failed";
    const status = msg === "run_not_found" ? 404 : msg === "run_not_awaiting_approval" ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_playbook_run_approve_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ run: result.data }, { status: 200 });
}
