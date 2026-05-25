import { NextResponse } from "next/server";
import { jsonNotFound, jsonProblem } from "@/lib/http/problem";
import { toSafeString } from "@/lib/decision-intelligence/api";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/assurance/findings/[id]/events";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/assurance/findings/[id]/events",
  });
  if (modeGate) return modeGate;

  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_get_assurance_finding_events_total", 1).catch(
    () => undefined
  );

  const findingId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: findingId }, ["id"], "/api/assurance/findings/[id]/events");

  if (routeParamRejection) return routeParamRejection;
  const { data: finding } = await ctx.admin
    .from("assurance_findings")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("id", findingId)
    .maybeSingle();
  if (!finding) {
    return jsonNotFound(ROUTE);
  }

  const { data: events, error } = await ctx.admin
    .from("assurance_finding_events")
    .select("id, event_type, payload_json, actor_user_id, created_at")
    .eq("organization_id", ctx.orgId)
    .eq("finding_id", findingId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "assurance_finding_events_list_failed",
      diagnostic_id: "assurance_finding_events_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ events: events ?? [] });
}
