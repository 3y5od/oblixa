import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { listAutopilotRuns } from "@/lib/assurance/autopilot";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { requireAssuranceWorkspaceForAutopilotApi } from "@/lib/assurance/require-assurance-workspace-for-autopilot-api";

const ROUTE = "/api/autopilot/runs";

export async function GET() {
  const disabled = requireV6ApiFeature("v6Autopilot");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/autopilot/runs",
  });
  if (modeGate) return modeGate;

  const modeBlock = await requireAssuranceWorkspaceForAutopilotApi(ctx.admin, ctx.orgId);
  if (modeBlock) return modeBlock;

  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_get_autopilot_runs_list_total", 1).catch(
    () => undefined
  );

  const { data, error } = await listAutopilotRuns(ctx.admin, ctx.orgId);
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "autopilot_runs_list_failed",
      diagnostic_id: "autopilot_runs_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ runs: data ?? [] });
}
