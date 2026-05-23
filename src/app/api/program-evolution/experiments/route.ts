import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import {
  createProgramEvolutionExperiment,
  listProgramEvolutionExperiments,
} from "@/lib/v6/program-evolution";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

const ROUTE = "/api/program-evolution/experiments";

export async function GET() {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/program-evolution/experiments",
  });
  if (modeGate) return modeGate;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_program_evolution_experiments_list_total", 1).catch(
    () => undefined
  );

  const { data, error } = await listProgramEvolutionExperiments(ctx.admin, ctx.orgId);
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "program_evolution_experiments_list_failed",
      diagnostic_id: "program_evolution_experiments_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ experiments: data ?? [] });
}

export async function POST(request: Request) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/program-evolution/experiments",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.program-evolution.experiments",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/program-evolution/experiments",
    method: "POST",
  }).catch(() => undefined);

  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = readJsonBody<{
    hypothesis?: string;
    programId?: string;
    baselineVersionId?: string;
    candidateVersionId?: string;
    targetSegmentId?: string;
  }>(_lb_body.body ?? {}, {});

  const result = await createProgramEvolutionExperiment(ctx.admin, ctx.orgId, ctx.userId, {
    hypothesis: toSafeString(body.hypothesis) || undefined,
    programId: toSafeString(body.programId) || undefined,
    baselineVersionId: toSafeString(body.baselineVersionId) || undefined,
    candidateVersionId: toSafeString(body.candidateVersionId) || undefined,
    targetSegmentId: toSafeString(body.targetSegmentId) || undefined,
  });
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "program_evolution_experiment_create_failed",
      diagnostic_id: "program_evolution_experiment_create_failed",
      route: ROUTE,
    });
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_program_evolution_experiment_create_total", 1).catch(
    () => undefined
  );
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ experiment: result.data }, { status: 201 });
}
