import { NextResponse } from "next/server";
import { toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { revertAutopilotRunLog } from "@/lib/v6/autopilot-revert";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6Autopilot");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const logId = toSafeString((await params).id);
  const result = await revertAutopilotRunLog(ctx.admin, ctx.orgId, logId, ctx.userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === "log_not_found" ? 404 : 400 });
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_autopilot_revert_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
