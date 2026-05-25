import {
  V10_ACCEPTANCE_MATRIX,
  V10_REQUIRED_ACCEPTANCE_IDS,
  getV10AcceptanceProof,
  type V10AcceptanceMatrixRow,
} from "./acceptance-matrix";
import { V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS } from "./release-evidence";
import {
  V10_OPERATOR_RUNBOOKS,
  V10_OPS_RELEASE_READINESS_CONTRACTS,
} from "./operational-contracts";

export type V10ReadinessStage = "beta" | "GA" | "complete";
export type V10ReadinessEvidenceState =
  | "promoted"
  | "candidate"
  | "pending_external"
  | "stale"
  | "invalid"
  | "not_required";

export type V10ReadinessSignal = {
  key: string;
  priority: "P0" | "P1" | "P2";
  structuralGatesDefined?: boolean;
  localAutomationPassed: boolean;
  releaseEvidencePromoted: boolean;
  evidenceState?: V10ReadinessEvidenceState;
};

export type V10ReadinessScore = {
  stage: V10ReadinessStage;
  total: number;
  passed: number;
  requiredPassed: boolean;
  missingRequiredKeys: readonly string[];
  pendingExternalEvidenceKeys: readonly string[];
  invalidEvidenceKeys: readonly string[];
};

export type V10ReleaseHandoffArtifact = {
  stage: V10ReadinessStage;
  canPromote: boolean;
  score: V10ReadinessScore;
  releaseBlockers: readonly string[];
  externalEvidenceBlockers: readonly string[];
  verificationCommands: readonly string[];
  rollbackRunbooks: readonly string[];
  operationalHandoffArtifacts: readonly V10OperationalHandoffArtifact[];
  generatedAt: string;
};

export type V10OperationalHandoffKind =
  | "support"
  | "operations"
  | "release"
  | "rollback"
  | "incident"
  | "canary"
  | "provider_readiness"
  | "post_release";

export type V10OperationalHandoffArtifact = {
  artifactKind: V10OperationalHandoffKind;
  owner: "engineering" | "operations" | "support" | "security" | "release";
  freshnessHours: number;
  runbookKey: string;
  verificationCommand: string;
  recoveryDestination: string;
  releaseEvidenceKey: string;
};

function v10ReadinessEvidenceKeysForAcceptance(row: V10AcceptanceMatrixRow): readonly string[] {
  const requirements = V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS;
  const keys = new Set<string>();
  const addKind = (...kinds: readonly (typeof requirements)[number]["evidence_kind"][]) => {
    for (const requirement of requirements) {
      if (kinds.includes(requirement.evidence_kind)) keys.add(requirement.persistence_key);
    }
  };
  if (row.category === "measurement" || row.id === "fixture-measurement-gates") {
    addKind("release_candidate_metric", "human_usability_study", "post_ga_dashboard", "operational_slo_window");
  }
  if (row.category === "security") addKind("canary_review");
  if (row.category === "operations") {
    addKind("provider_configuration", "support_readiness_review", "post_ga_dashboard", "operational_slo_window");
  }
  if (row.category === "release") {
    addKind("release_owner_signoff", "canary_review", "support_readiness_review");
  }
  if (row.blockerType === "human_study") addKind("human_usability_study");
  if (row.blockerType === "provider_configuration") addKind("provider_configuration");
  if (row.blockerType === "external_dashboard") addKind("post_ga_dashboard", "operational_slo_window", "canary_review");
  if (row.blockerType === "release_owner_signoff") addKind("release_owner_signoff");
  return [...keys];
}

export function scoreV10Readiness(stage: V10ReadinessStage, signals: readonly V10ReadinessSignal[]): V10ReadinessScore {
  const requiredPriorities =
    stage === "beta" ? ["P0"] : stage === "GA" ? ["P0", "P1"] : ["P0", "P1", "P2"];
  const required = signals.filter((signal) => requiredPriorities.includes(signal.priority));
  const missingRequiredKeys = required
    .filter((signal) => !signal.localAutomationPassed || !signal.releaseEvidencePromoted)
    .map((signal) => signal.key);
  const pendingExternalEvidenceKeys = required
    .filter((signal) => signal.evidenceState === "pending_external")
    .map((signal) => signal.key);
  const invalidEvidenceKeys = required
    .filter((signal) => signal.evidenceState === "invalid" || signal.evidenceState === "stale")
    .map((signal) => signal.key);
  return {
    stage,
    total: signals.length,
    passed: signals.filter((signal) => signal.localAutomationPassed && signal.releaseEvidencePromoted).length,
    requiredPassed: missingRequiredKeys.length === 0,
    missingRequiredKeys,
    pendingExternalEvidenceKeys,
    invalidEvidenceKeys,
  };
}

export function createV10ReadinessSignalsFromAcceptanceMatrix(
  rows: readonly V10AcceptanceMatrixRow[] = V10_ACCEPTANCE_MATRIX,
  promotedEvidenceKeys: readonly string[] = []
): V10ReadinessSignal[] {
  const promoted = new Set(promotedEvidenceKeys);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const orderedRows = V10_REQUIRED_ACCEPTANCE_IDS.map((id) => byId.get(id)).filter((row): row is V10AcceptanceMatrixRow => Boolean(row));
  return orderedRows.map((row) => {
    const proof = getV10AcceptanceProof(row);
    const external = row.disposition === "environment_gated" || row.disposition === "non_autonomous_blocker";
    const releaseEvidenceRequired = external || row.disposition === "release_evidence";
    const releaseEvidenceKeys = v10ReadinessEvidenceKeysForAcceptance(row);
    const releaseEvidencePromoted = releaseEvidenceRequired
      ? releaseEvidenceKeys.length > 0
        ? releaseEvidenceKeys.every((key) => promoted.has(key))
        : promoted.has(row.id)
      : true;
    const structuralGatesDefined = row.gates.length > 0 && row.artifacts.length > 0;
    return {
      key: row.id,
      priority: proof.priority === "release_blocker" ? "P1" : proof.priority,
      structuralGatesDefined,
      localAutomationPassed: structuralGatesDefined,
      releaseEvidencePromoted,
      evidenceState: releaseEvidencePromoted ? "promoted" : releaseEvidenceRequired ? "pending_external" : "candidate",
    };
  });
}

export function createV10ReleaseHandoffArtifact(input: {
  stage: V10ReadinessStage;
  signals?: readonly V10ReadinessSignal[];
  promotedEvidenceKeys?: readonly string[];
  generatedAt: string;
}): V10ReleaseHandoffArtifact {
  const signals =
    input.signals ?? createV10ReadinessSignalsFromAcceptanceMatrix(undefined, input.promotedEvidenceKeys ?? []);
  const score = scoreV10Readiness(input.stage, signals);
  return {
    stage: input.stage,
    canPromote: score.requiredPassed && score.invalidEvidenceKeys.length === 0 && score.pendingExternalEvidenceKeys.length === 0,
    score,
    releaseBlockers: [...new Set([...score.missingRequiredKeys, ...score.invalidEvidenceKeys])],
    externalEvidenceBlockers: score.pendingExternalEvidenceKeys,
    verificationCommands: [
      "npm run check:release-evidence",
      "npm run check:release-suite-current",
      "npm run typecheck",
      "npm run test:e2e:current-product",
    ],
    rollbackRunbooks: [
      "read_model_refresh_repair",
      "job_visibility_retry",
      "release_evidence_hold",
      "runtime_artifact_revocation",
      "incident_kill_switch",
    ],
    operationalHandoffArtifacts: buildV10OperationalHandoffArtifacts(),
    generatedAt: input.generatedAt,
  };
}

export function buildV10OperationalHandoffArtifacts(): V10OperationalHandoffArtifact[] {
  const opsByKey = new Map(V10_OPS_RELEASE_READINESS_CONTRACTS.map((contract) => [contract.key, contract]));
  const runbookKeys = new Set(V10_OPERATOR_RUNBOOKS.map((runbook) => runbook.key));
  const fromOps = (input: {
    artifactKind: V10OperationalHandoffKind;
    opsKey: (typeof V10_OPS_RELEASE_READINESS_CONTRACTS)[number]["key"];
    runbookKey: string;
    verificationCommand?: string;
  }): V10OperationalHandoffArtifact => {
    const contract = opsByKey.get(input.opsKey);
    return {
      artifactKind: input.artifactKind,
      owner: contract?.owner ?? "operations",
      freshnessHours: Math.max(1, Math.min(168, (contract?.retentionDays ?? 1) * 24)),
      runbookKey: runbookKeys.has(input.runbookKey) ? input.runbookKey : "release_rollback",
      verificationCommand: input.verificationCommand ?? contract?.rollbackCommand ?? "npm run check:release-evidence",
      recoveryDestination: contract?.recoveryDestination ?? "/settings/health",
      releaseEvidenceKey: contract?.releaseEvidenceKey ?? `ops:${input.artifactKind}`,
    };
  };
  return [
    fromOps({ artifactKind: "support", opsKey: "support_handoff", runbookKey: "failed_job_retry" }),
    fromOps({ artifactKind: "operations", opsKey: "read_model_refresh", runbookKey: "read_model_repair" }),
    fromOps({ artifactKind: "release", opsKey: "slo_canary", runbookKey: "canary_hold", verificationCommand: "npm run check:release-evidence" }),
    fromOps({ artifactKind: "rollback", opsKey: "rollback_repair", runbookKey: "release_rollback" }),
    fromOps({ artifactKind: "incident", opsKey: "provider_readiness", runbookKey: "provider_outage" }),
    fromOps({ artifactKind: "canary", opsKey: "slo_canary", runbookKey: "canary_hold" }),
    fromOps({ artifactKind: "provider_readiness", opsKey: "provider_readiness", runbookKey: "provider_outage" }),
    {
      artifactKind: "post_release",
      owner: "operations",
      freshnessHours: 24,
      runbookKey: "release_rollback",
      verificationCommand: "npm run check:release-evidence",
      recoveryDestination: "/settings/health#support",
      releaseEvidenceKey: "ops:post_release_review",
    },
  ];
}

export function validateV10OperationalHandoffArtifacts(
  artifacts: readonly V10OperationalHandoffArtifact[] = buildV10OperationalHandoffArtifacts()
): string[] {
  const failures: string[] = [];
  const seen = new Set<V10OperationalHandoffKind>();
  const runbookKeys = new Set(V10_OPERATOR_RUNBOOKS.map((runbook) => runbook.key));
  for (const artifact of artifacts) {
    if (seen.has(artifact.artifactKind)) failures.push(`duplicate_handoff_artifact:${artifact.artifactKind}`);
    seen.add(artifact.artifactKind);
    if (!artifact.owner) failures.push(`${artifact.artifactKind}:owner_required`);
    if (artifact.freshnessHours <= 0) failures.push(`${artifact.artifactKind}:freshness_required`);
    if (!runbookKeys.has(artifact.runbookKey)) failures.push(`${artifact.artifactKind}:runbook_unknown`);
    if (!artifact.verificationCommand.startsWith("npm run ") && !artifact.verificationCommand.startsWith("node ")) {
      failures.push(`${artifact.artifactKind}:verification_command_required`);
    }
    if (!artifact.recoveryDestination.startsWith("/settings/health")) failures.push(`${artifact.artifactKind}:settings_health_destination_required`);
    if (!artifact.releaseEvidenceKey.startsWith("ops:")) failures.push(`${artifact.artifactKind}:release_evidence_key_required`);
  }
  for (const kind of ["support", "operations", "release", "rollback", "incident", "canary", "provider_readiness", "post_release"] as const) {
    if (!seen.has(kind)) failures.push(`handoff_artifact_missing:${kind}`);
  }
  return failures;
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { buildV10OperationalHandoffArtifacts as buildOperationalHandoffArtifacts };
export { createV10ReadinessSignalsFromAcceptanceMatrix as createReadinessSignalsFromAcceptanceMatrix };
export { createV10ReleaseHandoffArtifact as createReleaseHandoffArtifact };
export { scoreV10Readiness as scoreReadiness };
export { validateV10OperationalHandoffArtifacts as validateOperationalHandoffArtifacts };
export type { V10OperationalHandoffArtifact as OperationalHandoffArtifact };
export type { V10OperationalHandoffKind as OperationalHandoffKind };
export type { V10ReadinessEvidenceState as ReadinessEvidenceState };
export type { V10ReadinessScore as ReadinessScore };
export type { V10ReadinessSignal as ReadinessSignal };
export type { V10ReadinessStage as ReadinessStage };
export type { V10ReleaseHandoffArtifact as ReleaseHandoffArtifact };
// End version-name compatibility aliases.
