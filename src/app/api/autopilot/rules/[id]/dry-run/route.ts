import { NextResponse } from "next/server";
import { toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { dryRunAutopilotRule } from "@/lib/v6/autopilot";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6Autopilot");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const ruleId = toSafeString((await params).id);
  const result = await dryRunAutopilotRule(ctx.admin, ctx.orgId, ruleId, ctx.userId);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_autopilot_dry_run_total", 1).catch(() => undefined);
  return NextResponse.json({ rule: result.rule, run: result.run });
}
