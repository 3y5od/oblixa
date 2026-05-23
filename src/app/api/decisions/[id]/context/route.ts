import { NextResponse } from "next/server";
import { jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext } from "@/lib/v4/api-auth";
import { buildDecisionExecutionContext } from "@/lib/v5/decision-context";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/decisions/[id]/context";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/decisions/[id]/context",
  });
  if (modeGate) return modeGate;

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/decisions/[id]/context");

  if (routeParamRejection) return routeParamRejection;
  const { data: decision, error } = await ctx.admin
    .from("decision_workspaces")
    .select("id, linked_contract_ids")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "decision_context_lookup_failed",
      diagnostic_id: "decision_context_lookup_failed",
      route: ROUTE,
    });
  }
  if (!decision) return jsonNotFound(ROUTE);

  const context = await buildDecisionExecutionContext(
    ctx.admin,
    ctx.orgId,
    decision.linked_contract_ids
  );

  return NextResponse.json({ decisionId: id, context });
}
