import {
  V10_ACCEPTANCE_MATRIX,
  getV10AcceptanceProof,
  type V10AcceptanceReleaseStateImpact,
} from "./v10-acceptance-matrix";
import {
  V10_AUTONOMOUS_COVERAGE_CONTRACTS,
  classifyV10CoveragePromotionState,
  type V10CoveragePromotionState,
} from "./v10-autonomous-coverage";
import {
  V10_GA_METRIC_EVIDENCE_REQUIREMENTS,
  V10_NON_AUTONOMOUS_EVIDENCE_GATES,
  V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS,
  type V10ReleaseCandidateEvidenceRequirement,
  type V10ReleaseStateImpact,
} from "./v10-release-evidence";

export type V10PromotabilityStage = "beta" | "GA" | "complete";

export type V10PromotabilityProofKind =
  | "runtime_backed"
  | "static_or_contract_only"
  | "release_check_required"
  | "environment_gated"
  | "descriptor_fixture_only"
  | "external_blocker";

export type V10PromotabilityStageImpact = "blocks_beta" | "blocks_ga" | "blocks_complete" | "holds_promotion";

export type V10PromotabilitySource =
  | "acceptance_matrix"
  | "autonomous_coverage"
  | "metric_evidence"
  | "release_candidate_evidence"
  | "non_autonomous_evidence";

export type V10PromotabilityBaselineRow = {
  key: string;
  source: V10PromotabilitySource;
  proofKind: V10PromotabilityProofKind;
  stageImpact: V10PromotabilityStageImpact;
  evidenceKeys: readonly string[];
  promotedEvidenceSatisfied: boolean;
  blocker: string | null;
};

export type V10PromotabilityEvaluation = {
  stage: V10PromotabilityStage;
  canPromote: boolean;
  rows: readonly V10PromotabilityBaselineRow[];
  blockingRows: readonly V10PromotabilityBaselineRow[];
  blockers: readonly string[];
  counts: Record<V10PromotabilityProofKind, number>;
};

const V10_STAGE_RANK: Record<V10PromotabilityStage, number> = {
  beta: 0,
  GA: 1,
  complete: 2,
};

function stageImpactApplies(stage: V10PromotabilityStage, impact: V10PromotabilityStageImpact): boolean {
  if (impact === "holds_promotion") return true;
  const minimumStage = impact === "blocks_beta" ? "beta" : impact === "blocks_ga" ? "GA" : "complete";
  return V10_STAGE_RANK[stage] >= V10_STAGE_RANK[minimumStage];
}

function stageImpactFromAcceptance(impact: V10AcceptanceReleaseStateImpact): V10PromotabilityStageImpact {
  if (impact === "blocks_beta") return "blocks_beta";
  if (impact === "blocks_ga") return "blocks_ga";
  if (impact === "blocks_complete") return "blocks_complete";
  return "holds_promotion";
}

function stageImpactFromReleaseRequirement(
  releaseState: V10ReleaseCandidateEvidenceRequirement["release_state"]
): V10PromotabilityStageImpact {
  if (releaseState === "beta") return "blocks_beta";
  if (releaseState === "GA") return "blocks_ga";
  return "blocks_complete";
}

function stageImpactFromNonAutonomousGate(impact: V10ReleaseStateImpact): V10PromotabilityStageImpact {
  if (impact === "blocks_beta") return "blocks_beta";
  if (impact === "blocks_GA") return "blocks_ga";
  if (impact === "blocks_complete") return "blocks_complete";
  return "holds_promotion";
}

function proofKindFromCoveragePromotionState(state: V10CoveragePromotionState): V10PromotabilityProofKind {
  if (state === "runtime_backed") return "runtime_backed";
  if (state === "static_or_contract_only") return "static_or_contract_only";
  if (state === "environment_gated") return "environment_gated";
  return "release_check_required";
}

function acceptanceProofKind(row: (typeof V10_ACCEPTANCE_MATRIX)[number]): V10PromotabilityProofKind {
  const proof = getV10AcceptanceProof(row);
  if (proof.runtimeStatus === "runtime_verified" || proof.runtimeStatus === "runtime_mapped") return "runtime_backed";
  if (proof.runtimeStatus === "typed_contract_only") return "static_or_contract_only";
  if (proof.runtimeStatus === "non_autonomous_blocker") return "external_blocker";
  if (row.disposition === "environment_gated") return "environment_gated";
  return "release_check_required";
}

function evidenceSatisfied(evidenceKeys: readonly string[], promotedEvidenceKeys: ReadonlySet<string>): boolean {
  return evidenceKeys.length > 0 && evidenceKeys.every((key) => promotedEvidenceKeys.has(key));
}

function blockerFor(row: Omit<V10PromotabilityBaselineRow, "promotedEvidenceSatisfied" | "blocker">): string | null {
  if (row.proofKind === "runtime_backed") return null;
  if (row.proofKind === "static_or_contract_only") return `${row.key}:runtime_proof_required`;
  if (row.proofKind === "descriptor_fixture_only") return `${row.key}:promoted_runtime_metric_evidence_required`;
  if (row.proofKind === "environment_gated") return `${row.key}:environment_gate_must_resolve`;
  if (row.proofKind === "external_blocker") return `${row.key}:external_evidence_must_be_promoted`;
  return `${row.key}:release_evidence_must_be_promoted`;
}

function finalizeRow(
  row: Omit<V10PromotabilityBaselineRow, "promotedEvidenceSatisfied" | "blocker">,
  promotedEvidenceKeys: ReadonlySet<string>
): V10PromotabilityBaselineRow {
  const promotedEvidenceSatisfied = evidenceSatisfied(row.evidenceKeys, promotedEvidenceKeys);
  return {
    ...row,
    promotedEvidenceSatisfied,
    blocker: row.proofKind === "runtime_backed" || promotedEvidenceSatisfied ? null : blockerFor(row),
  };
}

export function buildV10PromotabilityBaseline(input?: {
  promotedEvidenceKeys?: readonly string[];
}): V10PromotabilityBaselineRow[] {
  const promotedEvidenceKeys = new Set(input?.promotedEvidenceKeys ?? []);
  const rows: V10PromotabilityBaselineRow[] = [];

  for (const acceptance of V10_ACCEPTANCE_MATRIX) {
    const proof = getV10AcceptanceProof(acceptance);
    const proofKind = acceptanceProofKind(acceptance);
    const evidenceKeys =
      proofKind === "runtime_backed" || proofKind === "static_or_contract_only"
        ? []
        : proof.releaseEvidence.filter((item) => item.startsWith("v10-"));
    rows.push(
      finalizeRow(
        {
          key: `acceptance:${acceptance.id}`,
          source: "acceptance_matrix",
          proofKind,
          stageImpact: stageImpactFromAcceptance(proof.releaseStateImpact),
          evidenceKeys: evidenceKeys.length > 0 ? evidenceKeys : [`v10-acceptance:${acceptance.id}`],
        },
        promotedEvidenceKeys
      )
    );
  }

  for (const contract of V10_AUTONOMOUS_COVERAGE_CONTRACTS) {
    const proofKind = proofKindFromCoveragePromotionState(classifyV10CoveragePromotionState(contract));
    rows.push(
      finalizeRow(
        {
          key: `coverage:${contract.planTodoId}`,
          source: "autonomous_coverage",
          proofKind,
          stageImpact: proofKind === "static_or_contract_only" ? "blocks_complete" : "holds_promotion",
          evidenceKeys:
            proofKind === "release_check_required" || proofKind === "environment_gated"
              ? [`v10-autonomous:${contract.planTodoId}`]
              : [],
        },
        promotedEvidenceKeys
      )
    );
  }

  for (const requirement of V10_GA_METRIC_EVIDENCE_REQUIREMENTS) {
    const proofKind =
      requirement.autonomous_local_proof === "contract_only" ||
      requirement.autonomous_local_proof === "synthetic_descriptor"
        ? "descriptor_fixture_only"
        : "release_check_required";
    rows.push(
      finalizeRow(
        {
          key: `metric:${requirement.metric_key}`,
          source: "metric_evidence",
          proofKind,
          stageImpact: "blocks_ga",
          evidenceKeys: [`v10-release:objective-metric:${requirement.metric_key}`],
        },
        promotedEvidenceKeys
      )
    );
  }

  for (const requirement of V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS) {
    rows.push(
      finalizeRow(
        {
          key: `rc-evidence:${requirement.key}`,
          source: "release_candidate_evidence",
          proofKind:
            requirement.required_runtime_source === "human_review" ||
            requirement.required_runtime_source === "provider_console" ||
            requirement.required_runtime_source === "production_dashboard"
              ? "external_blocker"
              : "release_check_required",
          stageImpact: stageImpactFromReleaseRequirement(requirement.release_state),
          evidenceKeys: [requirement.persistence_key],
        },
        promotedEvidenceKeys
      )
    );
  }

  for (const gate of V10_NON_AUTONOMOUS_EVIDENCE_GATES) {
    rows.push(
      finalizeRow(
        {
          key: `external:${gate.key}`,
          source: "non_autonomous_evidence",
          proofKind: "external_blocker",
          stageImpact: stageImpactFromNonAutonomousGate(gate.release_state_impact),
          evidenceKeys: [`v10-release:external-gate:${gate.key}`],
        },
        promotedEvidenceKeys
      )
    );
  }

  return rows;
}

export function summarizeV10PromotabilityRows(
  rows: readonly V10PromotabilityBaselineRow[]
): Record<V10PromotabilityProofKind, number> {
  const counts: Record<V10PromotabilityProofKind, number> = {
    runtime_backed: 0,
    static_or_contract_only: 0,
    release_check_required: 0,
    environment_gated: 0,
    descriptor_fixture_only: 0,
    external_blocker: 0,
  };
  for (const row of rows) counts[row.proofKind] += 1;
  return counts;
}

export function evaluateV10Promotability(input: {
  stage: V10PromotabilityStage;
  promotedEvidenceKeys?: readonly string[];
  rows?: readonly V10PromotabilityBaselineRow[];
}): V10PromotabilityEvaluation {
  const rows = input.rows ?? buildV10PromotabilityBaseline({ promotedEvidenceKeys: input.promotedEvidenceKeys });
  const blockingRows = rows.filter(
    (row) => row.blocker && stageImpactApplies(input.stage, row.stageImpact)
  );
  return {
    stage: input.stage,
    canPromote: blockingRows.length === 0,
    rows,
    blockingRows,
    blockers: blockingRows.map((row) => row.blocker).filter((blocker): blocker is string => Boolean(blocker)),
    counts: summarizeV10PromotabilityRows(rows),
  };
}

export function validateV10PromotabilityBaseline(
  rows: readonly V10PromotabilityBaselineRow[] = buildV10PromotabilityBaseline()
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.key)) failures.push(`duplicate:${row.key}`);
    seen.add(row.key);
    if (!row.key.trim()) failures.push("key_required");
    if (!row.source) failures.push(`${row.key}:source_required`);
    if (!row.proofKind) failures.push(`${row.key}:proof_kind_required`);
    if (!row.stageImpact) failures.push(`${row.key}:stage_impact_required`);
    if (row.proofKind !== "runtime_backed" && row.proofKind !== "static_or_contract_only" && row.evidenceKeys.length === 0) {
      failures.push(`${row.key}:evidence_key_required`);
    }
    if (row.proofKind === "static_or_contract_only" && row.blocker !== `${row.key}:runtime_proof_required`) {
      failures.push(`${row.key}:static_row_must_block_runtime_promotion`);
    }
    if (row.proofKind === "runtime_backed" && row.blocker) failures.push(`${row.key}:runtime_row_blocked`);
  }
  return failures;
}
