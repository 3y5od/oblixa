import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { getPlaybookRun } from "@/lib/v6/playbooks";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/playbooks/runs/[id]";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AdaptivePlaybooks");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/playbooks/runs/[id]",
  });
  if (modeGate) return modeGate;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_playbook_run_detail_total", 1).catch(
    () => undefined
  );

  const runId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: runId }, ["id"], "/api/playbooks/runs/[id]");

  if (routeParamRejection) return routeParamRejection;
  const result = await getPlaybookRun(ctx.admin, ctx.orgId, runId);
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "playbook_run_lookup_failed",
      diagnostic_id: "playbook_run_lookup_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({
    run: result.run,
    steps: result.steps,
    explainability_note: "Run output_json / success_assessment_json and step rows document execution rationale.",
  });
}
