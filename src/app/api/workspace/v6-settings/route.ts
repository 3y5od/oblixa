import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6Context } from "@/lib/v6/api-auth";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { getV6OrgSettingsJson, mergeV6OrgSettingsJson, type V6OrgSettingsJson } from "@/lib/v6/org-settings";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function GET() {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_workspace_v6_settings_total", 1).catch(() => undefined);

  const settings = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const body = readJsonBody<{
    autopilotAllowExecution?: boolean;
    reviewBoardNotificationEmails?: string[];
  }>(await request.json().catch(() => ({})), {});

  const patch: Partial<V6OrgSettingsJson> = {};
  if (typeof body.autopilotAllowExecution === "boolean") {
    patch.autopilot_allow_execution = body.autopilotAllowExecution;
  }
  if (Array.isArray(body.reviewBoardNotificationEmails)) {
    patch.review_board_notification_emails = body.reviewBoardNotificationEmails.map((e) => String(e).trim());
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { data, error } = await mergeV6OrgSettingsJson(ctx.admin, ctx.orgId, patch);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_patch_workspace_v6_settings_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ settings: data });
}
