import { NextResponse } from "next/server";
import { jsonForbidden, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/contract-operations/api-auth";
import { readJsonBody, toSafeString } from "@/lib/decision-intelligence/api";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";

const ROUTE = "/api/capacity/reassignment-plan";

export async function POST(request: Request) {
  const disabled = requireV5ApiFeature("v5SimulationAndIntelligence");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/capacity/reassignment-plan",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.capacity.reassignment-plan",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{
    teamKey?: string;
    currentLoad?: number;
    targetLoad?: number;
    notes?: string;
  }>(raw, {});
  const teamKey = toSafeString(body.teamKey);
  const currentLoad = Number(body.currentLoad ?? 0);
  const targetLoad = Number(body.targetLoad ?? 0);
  if (!teamKey) {
    return jsonProblem(400, {
      error: "teamKey is required",
      code: "team_key_required",
      diagnostic_id: "capacity_reassignment_plan_team_key_required",
      route: ROUTE,
    });
  }
  if (!Number.isFinite(currentLoad) || !Number.isFinite(targetLoad)) {
    return jsonProblem(400, {
      error: "currentLoad and targetLoad must be numbers",
      code: "invalid_load_values",
      diagnostic_id: "capacity_reassignment_plan_invalid_load_values",
      route: ROUTE,
    });
  }
  const overload = Math.max(0, Math.round(currentLoad - targetLoad));
  const suggestedMoves = overload > 0 ? overload : 0;

  await ctx.admin.from("audit_events").insert({
    organization_id: ctx.orgId,
    user_id: ctx.userId,
    action: "v5.capacity.reassignment_plan.generated",
    details: {
      team_key: teamKey,
      current_load: currentLoad,
      target_load: targetLoad,
      suggested_moves: suggestedMoves,
      notes: toSafeString(body.notes) || null,
    },
  });

  return NextResponse.json({
    plan: {
      team_key: teamKey,
      overload,
      suggested_moves: suggestedMoves,
      guidance:
        overload > 0
          ? "Reassign this many approval/task owners to reach target load."
          : "Current load is within target. No reassignment required.",
    },
  });
}
