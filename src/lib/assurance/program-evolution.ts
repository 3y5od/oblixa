import type { AdminClient } from "@/lib/assurance/service";
import { createRow, listRows, updateRowById } from "@/lib/assurance/service";

const DIFF_LIMIT = 60;

function diffLeafPaths(
  base: unknown,
  cand: unknown,
  prefix: string,
  out: { path: string; baseline: unknown; candidate: unknown }[]
) {
  if (out.length >= DIFF_LIMIT) return;
  if (base === cand) return;
  if (base == null && cand == null) return;
  if (typeof base !== "object" || typeof cand !== "object" || base === null || cand === null) {
    out.push({ path: prefix || "(root)", baseline: base, candidate: cand });
    return;
  }
  if (Array.isArray(base) || Array.isArray(cand)) {
    if (JSON.stringify(base) !== JSON.stringify(cand)) {
      out.push({ path: prefix || "(array)", baseline: base, candidate: cand });
    }
    return;
  }
  const bk = new Set([...Object.keys(base as object), ...Object.keys(cand as object)]);
  for (const k of bk) {
    if (out.length >= DIFF_LIMIT) break;
    const p = prefix ? `${prefix}.${k}` : k;
    diffLeafPaths(
      (base as Record<string, unknown>)[k],
      (cand as Record<string, unknown>)[k],
      p,
      out
    );
  }
}

export function diffProgramDefinitionsDeep(
  a?: Record<string, unknown> | null,
  b?: Record<string, unknown> | null
): Record<string, unknown> {
  const keysA = new Set(Object.keys(a ?? {}));
  const keysB = new Set(Object.keys(b ?? {}));
  const valueChanges: { path: string; baseline: unknown; candidate: unknown }[] = [];
  diffLeafPaths(a ?? {}, b ?? {}, "", valueChanges);
  return {
    keys_only_in_baseline: [...keysA].filter((k) => !keysB.has(k)).slice(0, 40),
    keys_only_in_candidate: [...keysB].filter((k) => !keysA.has(k)).slice(0, 40),
    shared_key_count: [...keysA].filter((k) => keysB.has(k)).length,
    value_changes_sample: valueChanges.slice(0, DIFF_LIMIT),
  };
}

export function listProgramEvolutionExperiments(admin: AdminClient, orgId: string) {
  return listRows(
    admin,
    "program_evolution_experiments",
    orgId,
    "id, program_id, baseline_program_version_id, candidate_program_version_id, target_segment_id, status, hypothesis, simulation_summary_json, rollout_plan_json, updated_at"
  );
}

export function createProgramEvolutionExperiment(
  admin: AdminClient,
  orgId: string,
  userId: string,
  payload: {
    hypothesis?: string;
    programId?: string;
    baselineVersionId?: string;
    candidateVersionId?: string;
    targetSegmentId?: string;
  }
) {
  return createRow(admin, "program_evolution_experiments", orgId, {
    program_id: payload.programId ?? null,
    baseline_program_version_id: payload.baselineVersionId ?? null,
    candidate_program_version_id: payload.candidateVersionId ?? null,
    target_segment_id: payload.targetSegmentId ?? null,
    status: "draft",
    hypothesis: payload.hypothesis ?? "Candidate improves operational outcomes",
    simulation_summary_json: {},
    rollout_plan_json: { stage: "draft" },
    created_by: userId,
  });
}

export async function simulateProgramEvolutionExperiment(
  admin: AdminClient,
  orgId: string,
  userId: string,
  experimentId: string
) {
  const { data: exp } = await admin
    .from("program_evolution_experiments")
    .select("id, baseline_program_version_id, candidate_program_version_id, program_id, target_segment_id")
    .eq("organization_id", orgId)
    .eq("id", experimentId)
    .maybeSingle();

  const { data: scores } = await admin
    .from("assurance_scorecards")
    .select("overall_score")
    .eq("organization_id", orgId)
    .limit(100);

  let avg: number | null =
    (scores ?? []).length > 0
      ? (scores as { overall_score?: number }[]).reduce((s, r) => s + Number(r.overall_score ?? 0), 0) /
        (scores ?? []).length
      : null;

  let segmentMemberCount: number | null = null;
  const targetSegId = exp?.target_segment_id as string | null | undefined;
  if (targetSegId) {
    const { count } = await admin
      .from("segment_memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("segment_definition_id", targetSegId);
    segmentMemberCount = count ?? 0;
    const { data: segRow } = await admin
      .from("segment_definitions")
      .select("key")
      .eq("organization_id", orgId)
      .eq("id", targetSegId)
      .maybeSingle();
    const segKey = segRow ? String((segRow as { key: string }).key) : "";
    if (segKey) {
      const { data: segScore } = await admin
        .from("assurance_scorecards")
        .select("overall_score")
        .eq("organization_id", orgId)
        .eq("scorecard_type", "segment")
        .eq("entity_ref_id", segKey)
        .maybeSingle();
      if (segScore && typeof (segScore as { overall_score?: number }).overall_score === "number") {
        avg = Number((segScore as { overall_score: number }).overall_score) as number;
      }
    }
  }

  const cohortFactor =
    segmentMemberCount != null && segmentMemberCount > 0
      ? Math.max(0.88, 1 - Math.min(0.12, segmentMemberCount / 800))
      : 1;
  const projectedDelta = avg != null
    ? Math.max(-15, Math.min(15, Number((85 - avg).toFixed(2)) * cohortFactor))
    : null;

  let versionDiff: Record<string, unknown> = {};
  const baseId = exp?.baseline_program_version_id as string | null | undefined;
  const candId = exp?.candidate_program_version_id as string | null | undefined;
  if (baseId && candId) {
    const { data: rows } = await admin
      .from("contract_program_versions")
      .select("id, version_number, definition_json")
      .eq("organization_id", orgId)
      .in("id", [baseId, candId]);
    const a = rows?.find((r) => String((r as { id: string }).id) === baseId) as
      | { definition_json?: Record<string, unknown> }
      | undefined;
    const b = rows?.find((r) => String((r as { id: string }).id) === candId) as
      | { definition_json?: Record<string, unknown> }
      | undefined;
    versionDiff = diffProgramDefinitionsDeep(
      (a?.definition_json ?? {}) as Record<string, unknown>,
      (b?.definition_json ?? {}) as Record<string, unknown>
    );
  }

  const sim = await createRow(admin, "change_simulations", orgId, {
    simulation_type: "program_evolution",
    name: `Program evolution ${experimentId.slice(0, 8)}`,
    input_json: {
      experiment_id: experimentId,
      v6_scope_json: {
        baseline_avg_scorecard: avg,
        program_id: exp?.program_id ?? null,
        target_segment_id: exp?.target_segment_id ?? null,
        version_diff: versionDiff,
      },
    },
    created_by: userId,
  });
  if (!sim.data?.id) return { error: sim.error, experiment: null };

  const run = await createRow(admin, "change_simulation_runs", orgId, {
    simulation_id: sim.data.id,
    status: "completed",
    result_json: {
      experiment_id: experimentId,
      projected_health_delta: projectedDelta,
      mode: "what_if",
      inputs: {
        avg_assurance_score: avg,
        version_diff: versionDiff,
        target_segment_member_count: segmentMemberCount,
        cohort_factor: cohortFactor,
      },
    },
    created_by: userId,
  });

  const updated = await updateRowById(admin, "program_evolution_experiments", orgId, experimentId, {
    status: "simulated",
    simulation_summary_json: {
      simulation_id: sim.data.id,
      run_id: run.data?.id,
      projected_health_delta: projectedDelta,
      baseline_avg_scorecard: avg,
      version_diff: versionDiff,
      target_segment_member_count: segmentMemberCount,
      cohort_factor: cohortFactor,
    },
  });

  return { simulation: sim.data, run: run.data, experiment: updated.data, error: updated.error ?? run.error };
}

export function addProgramEvolutionResult(
  admin: AdminClient,
  orgId: string,
  experimentId: string,
  payload: {
    periodStart?: string;
    periodEnd?: string;
    healthImpact?: Record<string, unknown>;
    scorecardDelta?: Record<string, unknown>;
    decisionSlippageDelta?: number;
    recommendation?: Record<string, unknown>;
  }
) {
  return createRow(admin, "program_evolution_results", orgId, {
    experiment_id: experimentId,
    period_start: payload.periodStart ?? null,
    period_end: payload.periodEnd ?? null,
    health_impact_json: payload.healthImpact ?? {},
    scorecard_delta_json: payload.scorecardDelta ?? {},
    decision_slippage_delta: payload.decisionSlippageDelta ?? null,
    recommendation_json: payload.recommendation ?? {},
  });
}

export async function advanceExperimentRollout(
  admin: AdminClient,
  orgId: string,
  experimentId: string,
  stage: string
) {
  const { data: current } = await admin
    .from("program_evolution_experiments")
    .select("status")
    .eq("organization_id", orgId)
    .eq("id", experimentId)
    .maybeSingle();

  const status = current?.status as string | undefined;
  if (status !== "draft" && status !== "running") {
    return { data: null, error: { message: `Cannot advance experiment with status "${status ?? "unknown"}"` } };
  }

  return updateRowById(admin, "program_evolution_experiments", orgId, experimentId, {
    status: "running",
    rollout_plan_json: { stage, updated_at: new Date().toISOString() },
  });
}
