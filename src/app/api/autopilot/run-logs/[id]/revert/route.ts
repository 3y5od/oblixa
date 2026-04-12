import { NextResponse } from "next/server";
import { toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { revertAutopilotRunLog } from "@/lib/v6/autopilot-revert";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { isOrgAutopilotExecutionAllowed } from "@/lib/v6/org-settings";
import { requireAssuranceWorkspaceForAutopilotApi } from "@/lib/v6/require-assurance-workspace-for-autopilot-api";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6Autopilot");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/autopilot/run-logs/[id]/revert",
  });
  if (modeGate) return modeGate;

  const modeBlock = await requireAssuranceWorkspaceForAutopilotApi(ctx.admin, ctx.orgId);
  if (modeBlock) return modeBlock;

  const executionOk = await isOrgAutopilotExecutionAllowed(ctx.admin, ctx.orgId);
  if (!executionOk) {
    return NextResponse.json(
      { error: "Mutating autopilot is disabled for this workspace (Assurance + org opt-in only)." },
      { status: 403 }
    );
  }

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
