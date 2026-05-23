import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { simulateProgramEvolutionExperiment } from "@/lib/v6/program-evolution";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/program-evolution/experiments/[id]/simulate";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/program-evolution/experiments/[id]/simulate",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.program-evolution.experiments.id.simulate",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/program-evolution/experiments/[id]/simulate",
    method: "POST",
  }).catch(() => undefined);

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const id = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/program-evolution/experiments/[id]/simulate");

  if (routeParamRejection) return routeParamRejection;
  const result = await simulateProgramEvolutionExperiment(ctx.admin, ctx.orgId, ctx.userId, id);
  if (result.error) {
    return jsonProblem(400, {
      error: (result.error as { message?: string }).message ?? "simulation failed",
      code: "program_evolution_simulation_failed",
      diagnostic_id: "program_evolution_simulation_failed",
      route: ROUTE,
    });
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_program_evolution_simulate_total", 1).catch(
    () => undefined
  );
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json(result);
}
