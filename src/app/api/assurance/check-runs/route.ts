import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { parsePositiveIntParam } from "@/lib/security/validation";

const ROUTE = "/api/assurance/check-runs";

export async function GET(request: Request) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/assurance/check-runs",
  });
  if (modeGate) return modeGate;

  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_get_assurance_check_runs_list_total", 1).catch(
    () => undefined
  );

  const url = new URL(request.url);
  const limit = parsePositiveIntParam(url.searchParams.get("limit"), { defaultValue: 30, max: 80 });

  const { data, error } = await ctx.admin
    .from("assurance_check_runs")
    .select(
      "id, check_type, trigger_type, status, created_at, completed_at, watch_signals_json, recommended_interventions_json, risk_delta_json, summary_json"
    )
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "assurance_check_runs_list_failed",
      diagnostic_id: "assurance_check_runs_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ checkRuns: data ?? [] });
}
