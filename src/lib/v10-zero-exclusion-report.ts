import {
  V10_OBJECTIVE_PROMOTION_EVIDENCE_CAPTURE,
  V10_RC_FIXTURE_CATEGORIES,
  V10_RC_METRIC_CAPTURE_PLANS,
} from "./v10-objective-measurements";
import {
  V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS,
  V10_GA_METRIC_EVIDENCE_REQUIREMENTS,
} from "./v10-release-evidence";
import {
  V10_API_ENVIRONMENT_INTEGRATION_CONTRACTS,
  V10_DATA_LIFECYCLE_COMPLIANCE_CONTRACTS,
  V10_FINAL_CUTOVER_CHECKLIST,
  V10_LEGACY_BRIDGE_DECOMMISSION_CONTRACTS,
  V10_OBSERVABILITY_PERFORMANCE_A11Y_CONTRACTS,
  V10_OPS_RELEASE_READINESS_CONTRACTS,
  V10_POST_GA_DRIFT_CONTROLS,
  V10_QUALITY_MATRIX,
} from "./v10-operational-contracts";
import {
  V10_COMPATIBILITY_BOUNDARIES,
  V10_DEPRECATION_CLEANUP_DECISIONS,
} from "./v10-final-gap-audit";
import {
  buildV10CompleteClosureRows,
  type V10CompleteClosureRow,
} from "./v10-complete-closure";

export type V10ZeroExclusionCategory =
  | "complete_closure"
  | "fixture_measurement"
  | "compatibility_boundary"
  | "post_ga_drift"
  | "verification_gate"
  | "domain_matrix"
  | "release_handoff"
  | "cleanup_decision";

export type V10ZeroExclusionStatus =
  | "shipped"
  | "automated_gate"
  | "release_evidence_required"
  | "external_blocker"
  | "compatibility_preserved";

export type V10ZeroExclusionManifestRow = {
  coverageKey: string;
  category: V10ZeroExclusionCategory;
  owner: "engineering" | "product" | "operations" | "security" | "support" | "release";
  priority: "P0" | "P1" | "P2" | "release_blocker";
  status: V10ZeroExclusionStatus;
  runtimeArtifact: string;
  testArtifacts: readonly string[];
  releaseEvidenceKey: string;
  blockerState: string | null;
  residualRisk: string | null;
  supportBoundary: string;
  rollbackPath: string;
  promotionState: "beta" | "GA" | "complete" | "post_ga" | "blocked_until_evidence";
};

export type V10ReleaseHandoffPacket = {
  packetKey: "beta" | "GA" | "complete" | "support" | "operations" | "security" | "rollback" | "post_ga";
  owner: V10ZeroExclusionManifestRow["owner"];
  releaseState: V10ZeroExclusionManifestRow["promotionState"];
  requiredManifestCategories: readonly V10ZeroExclusionCategory[];
  evidenceKeys: readonly string[];
  gateCommands: readonly string[];
  supportSafe: boolean;
};

export type V10DomainCoverageMatrix = {
  domainKey:
    | "activation"
    | "work"
    | "contract_record"
    | "review_data_quality"
    | "renewal"
    | "evidence"
    | "approval_exception"
    | "reporting_export"
    | "search"
    | "settings_governance"
    | "jobs_notifications"
    | "advanced_assurance"
    | "support"
    | "release";
  requiredCategories: readonly V10ZeroExclusionCategory[];
  primaryEvidenceKey: string;
  owner: V10ZeroExclusionManifestRow["owner"];
};

function priorityForClosureRow(row: V10CompleteClosureRow): V10ZeroExclusionManifestRow["priority"] {
  if (row.domain === "release_evidence" || row.domain === "objective_measurement") return "release_blocker";
  if (row.domain === "source_object" || row.domain === "route" || row.domain === "mutation") return "P0";
  return "P1";
}

function statusForClosureRow(row: V10CompleteClosureRow): V10ZeroExclusionStatus {
  if (row.status === "closed") return row.domain === "release_evidence" ? "automated_gate" : "shipped";
  return "release_evidence_required";
}

function closureRows(): V10ZeroExclusionManifestRow[] {
  return buildV10CompleteClosureRows().map((row) => ({
    coverageKey: `${row.domain}:${row.key}`,
    category: "complete_closure",
    owner: row.owner,
    priority: priorityForClosureRow(row),
    status: statusForClosureRow(row),
    runtimeArtifact: row.proofArtifacts[0] ?? "src/lib/v10-complete-closure.ts",
    testArtifacts: row.gates,
    releaseEvidenceKey: row.releaseEvidenceKey,
    blockerState: row.failures.length > 0 ? row.failures.join(",") : null,
    residualRisk: row.failures.length > 0 ? "closure_row_open" : null,
    supportBoundary: row.domain === "release_evidence" ? "support_safe_release_evidence" : "support_safe_diagnostics",
    rollbackPath: row.gates.find((gate) => gate.startsWith("npm run ")) ?? "npm run check:v10-complete-closure",
    promotionState: row.domain === "release_evidence" ? "blocked_until_evidence" : "complete",
  }));
}

function fixtureMeasurementRows(): V10ZeroExclusionManifestRow[] {
  const fixtureRows = V10_RC_FIXTURE_CATEGORIES.map((fixture) => ({
    coverageKey: `fixture-category:${fixture.category}`,
    category: "fixture_measurement" as const,
    owner: "release" as const,
    priority: "release_blocker" as const,
    status: "automated_gate" as const,
    runtimeArtifact: "src/lib/v10-objective-measurements.ts",
    testArtifacts: ["src/lib/v10-objective-measurements.v10.test.ts", "npm run check:v10-privacy-scan"],
    releaseEvidenceKey: `v10-release:fixture-category:${fixture.category}`,
    blockerState: null,
    residualRisk: null,
    supportBoundary: "synthetic_fixture_data_only",
    rollbackPath: "npm run check:v10-suite -- --cleanup-fixture all",
    promotionState: "beta" as const,
  }));
  const metricRows = V10_RC_METRIC_CAPTURE_PLANS.map((plan) => {
    const promotion = V10_OBJECTIVE_PROMOTION_EVIDENCE_CAPTURE.find((row) => row.metricKey === plan.metricKey);
    return {
      coverageKey: `metric-capture:${plan.metricKey}`,
      category: "fixture_measurement" as const,
      owner: "release" as const,
      priority: "release_blocker" as const,
      status: "release_evidence_required" as const,
      runtimeArtifact: "src/lib/v10-release-evidence.ts",
      testArtifacts: ["src/lib/v10-release-evidence.v10.test.ts", plan.captureCommand],
      releaseEvidenceKey: promotion?.releaseEvidenceKey ?? `v10-release:objective-metric:${plan.metricKey}`,
      blockerState: "release_candidate_capture_required",
      residualRisk: "Metric pass/fail counts must be captured with the locked denominator in a release-candidate workspace.",
      supportBoundary: "synthetic_metric_counts_only",
      rollbackPath: plan.teardownCommand,
      promotionState: "blocked_until_evidence" as const,
    };
  });
  const evidenceRows = V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS.map((requirement) => ({
    coverageKey: `rc-evidence:${requirement.key}`,
    category: "fixture_measurement" as const,
    owner: requirement.owner,
    priority: "release_blocker" as const,
    status: "release_evidence_required" as const,
    runtimeArtifact: "src/lib/v10-release-evidence.ts",
    testArtifacts: ["src/lib/v10-release-evidence.v10.test.ts"],
    releaseEvidenceKey: requirement.persistence_key,
    blockerState: requirement.promotion_blocker ? "promotion_blocker" : null,
    residualRisk: "External release evidence must be persisted before promotion.",
    supportBoundary: "release_owner_evidence_only",
    rollbackPath: "npm run check:v10-release-evidence",
    promotionState: requirement.release_state === "complete" ? "post_ga" as const : requirement.release_state,
  }));
  const metricRequirementRows = V10_GA_METRIC_EVIDENCE_REQUIREMENTS.map((requirement) => ({
    coverageKey: `metric-requirement:${requirement.metric_key}`,
    category: "fixture_measurement" as const,
    owner: "release" as const,
    priority: "release_blocker" as const,
    status: "release_evidence_required" as const,
    runtimeArtifact: "src/lib/v10-release-evidence.ts",
    testArtifacts: ["src/lib/v10-release-evidence.v10.test.ts"],
    releaseEvidenceKey: `v10-release:objective-metric:${requirement.metric_key}`,
    blockerState: "fixed_denominator_required",
    residualRisk: `${requirement.metric_key} requires ${requirement.fixed_sample_size} denominator-locked samples.`,
    supportBoundary: "aggregate_metric_counts_only",
    rollbackPath: "npm run check:v10-release-evidence",
    promotionState: "blocked_until_evidence" as const,
  }));
  return [...fixtureRows, ...metricRows, ...evidenceRows, ...metricRequirementRows];
}

function compatibilityRows(): V10ZeroExclusionManifestRow[] {
  const boundaryRows = V10_COMPATIBILITY_BOUNDARIES.map((boundary) => ({
    coverageKey: `compatibility:${boundary.key}`,
    category: "compatibility_boundary" as const,
    owner: boundary.boundary === "support_diagnostic"
      ? "support" as const
      : boundary.boundary === "provider_config" || boundary.boundary === "artifact"
        ? "operations" as const
        : boundary.boundary === "public_url" || boundary.boundary === "browser_support"
          ? "product" as const
          : boundary.boundary === "stable_command" || boundary.boundary === "migration_version"
            ? "release" as const
            : "security" as const,
    priority: "release_blocker" as const,
    status: boundary.compatibilityPolicy === "cleanup_after_backfill" ? "automated_gate" as const : "compatibility_preserved" as const,
    runtimeArtifact: boundary.owningArtifact,
    testArtifacts: ["src/lib/v10-final-gap-audit.v10.test.ts", "npm run check:v10-suite"],
    releaseEvidenceKey: `v10-release:compatibility:${boundary.key}`,
    blockerState: null,
    residualRisk: `${boundary.boundary}:${boundary.compatibilityPolicy}`,
    supportBoundary: `compatibility_boundary:${boundary.boundary}`,
    rollbackPath: boundary.compatibilityPolicy === "cleanup_after_backfill"
      ? "node scripts/rebuild-v10-read-models.mjs --dry-run"
      : "npm run check:v10-suite",
    promotionState: boundary.compatibilityPolicy === "cleanup_after_backfill" ? "GA" as const : "complete" as const,
  }));
  const cleanupRows = V10_DEPRECATION_CLEANUP_DECISIONS.map((decision) => ({
    coverageKey: `cleanup:${decision.candidateKey}`,
    category: "cleanup_decision" as const,
    owner: "release" as const,
    priority: "release_blocker" as const,
    status: decision.action === "preserve_boundary" ? "compatibility_preserved" as const : "automated_gate" as const,
    runtimeArtifact: decision.runtimeReplacementProof,
    testArtifacts: [decision.cleanupCommand, "src/lib/v10-final-gap-audit.v10.test.ts"],
    releaseEvidenceKey: decision.releaseEvidenceKey,
    blockerState: null,
    residualRisk: decision.action === "preserve_boundary" ? "Preserved only under an explicit compatibility boundary." : null,
    supportBoundary: decision.compatibilityBoundaryKey,
    rollbackPath: decision.cleanupCommand,
    promotionState: "complete" as const,
  }));
  return [...boundaryRows, ...cleanupRows];
}

function driftRows(): V10ZeroExclusionManifestRow[] {
  return V10_POST_GA_DRIFT_CONTROLS.map((control) => ({
    coverageKey: `post-ga-drift:${control.key}`,
    category: "post_ga_drift",
    owner: control.owner,
    priority: "release_blocker",
    status: "release_evidence_required",
    runtimeArtifact: "src/lib/v10-operational-contracts.ts",
    testArtifacts: ["src/lib/v10-operational-contracts.v10.test.ts", control.checkCommand],
    releaseEvidenceKey: `v10-release:post-ga-drift:${control.key}`,
    blockerState: "post_ga_window_required",
    residualRisk: "Requires post-GA window evidence before complete promotion.",
    supportBoundary: control.supportSafeEscalation,
    rollbackPath: control.rollbackCommand,
    promotionState: "post_ga",
  }));
}

function verificationRows(): V10ZeroExclusionManifestRow[] {
  const apiRows = V10_API_ENVIRONMENT_INTEGRATION_CONTRACTS.map((contract) => ({
    coverageKey: `api-env:${contract.key}`,
    category: "verification_gate" as const,
    owner: contract.owner,
    priority: "release_blocker" as const,
    status: "automated_gate" as const,
    runtimeArtifact: contract.runtimeArtifact,
    testArtifacts: [contract.negativeTestArtifact, contract.releaseGate],
    releaseEvidenceKey: `v10-release:api-env:${contract.key}`,
    blockerState: null,
    residualRisk: null,
    supportBoundary: contract.compatibilityBoundary,
    rollbackPath: contract.releaseGate,
    promotionState: "GA" as const,
  }));
  const qualityRows = V10_QUALITY_MATRIX.map((row) => ({
    coverageKey: `quality:${row.surface}`,
    category: "verification_gate" as const,
    owner: "product" as const,
    priority: "P1" as const,
    status: "automated_gate" as const,
    runtimeArtifact: "src/lib/v10-operational-contracts.ts",
    testArtifacts: ["src/lib/v10-operational-contracts.v10.test.ts", "npm run test:e2e:v10"],
    releaseEvidenceKey: `v10-release:${row.evidenceKey}`,
    blockerState: null,
    residualRisk: null,
    supportBoundary: "accessibility_performance_browser_support",
    rollbackPath: "npm run check:v10-suite",
    promotionState: "GA" as const,
  }));
  const obsRows = V10_OBSERVABILITY_PERFORMANCE_A11Y_CONTRACTS.map((row) => ({
    coverageKey: `observability:${row.surface}`,
    category: "verification_gate" as const,
    owner: "operations" as const,
    priority: "P1" as const,
    status: "automated_gate" as const,
    runtimeArtifact: "src/lib/v10-operational-contracts.ts",
    testArtifacts: ["src/lib/v10-operational-contracts.v10.test.ts"],
    releaseEvidenceKey: `v10-release:observability:${row.surface}`,
    blockerState: null,
    residualRisk: null,
    supportBoundary: row.supportDiagnosticFields.join(","),
    rollbackPath: "npm run check:v10-release-evidence",
    promotionState: "GA" as const,
  }));
  return [...apiRows, ...qualityRows, ...obsRows];
}

function lifecycleRows(): V10ZeroExclusionManifestRow[] {
  const dataRows = V10_DATA_LIFECYCLE_COMPLIANCE_CONTRACTS.map((contract) => ({
    coverageKey: `data-lifecycle:${contract.operation}`,
    category: "compatibility_boundary" as const,
    owner: "security" as const,
    priority: "release_blocker" as const,
    status: "automated_gate" as const,
    runtimeArtifact: "src/lib/v10-operational-contracts.ts",
    testArtifacts: ["src/lib/v10-operational-contracts.v10.test.ts", contract.cleanupCommand],
    releaseEvidenceKey: `v10-release:${contract.complianceEvidenceKey}`,
    blockerState: null,
    residualRisk: null,
    supportBoundary: contract.supportBoundary,
    rollbackPath: contract.cleanupCommand,
    promotionState: "GA" as const,
  }));
  const bridgeRows = V10_LEGACY_BRIDGE_DECOMMISSION_CONTRACTS.map((bridge) => ({
    coverageKey: `legacy-bridge:${bridge.bridge}`,
    category: "cleanup_decision" as const,
    owner: bridge.owner,
    priority: "release_blocker" as const,
    status: "compatibility_preserved" as const,
    runtimeArtifact: bridge.replacementArtifact,
    testArtifacts: [bridge.runtimeUsageCheck],
    releaseEvidenceKey: `v10-release:legacy-bridge:${bridge.bridge}`,
    blockerState: bridge.removalGate,
    residualRisk: "Preserved until removal gate closes.",
    supportBoundary: bridge.compatibilityBoundary,
    rollbackPath: bridge.rollbackPlan,
    promotionState: "complete" as const,
  }));
  return [...dataRows, ...bridgeRows];
}

export const V10_DOMAIN_COVERAGE_MATRICES: readonly V10DomainCoverageMatrix[] = [
  { domainKey: "activation", owner: "product", primaryEvidenceKey: "v10-release:domain:activation", requiredCategories: ["complete_closure", "fixture_measurement", "verification_gate"] },
  { domainKey: "work", owner: "product", primaryEvidenceKey: "v10-release:domain:work", requiredCategories: ["complete_closure", "verification_gate"] },
  { domainKey: "contract_record", owner: "product", primaryEvidenceKey: "v10-release:domain:contract-record", requiredCategories: ["complete_closure", "verification_gate"] },
  { domainKey: "review_data_quality", owner: "product", primaryEvidenceKey: "v10-release:domain:review-data-quality", requiredCategories: ["complete_closure", "verification_gate"] },
  { domainKey: "renewal", owner: "product", primaryEvidenceKey: "v10-release:domain:renewal", requiredCategories: ["complete_closure", "fixture_measurement"] },
  { domainKey: "evidence", owner: "product", primaryEvidenceKey: "v10-release:domain:evidence", requiredCategories: ["complete_closure", "fixture_measurement", "compatibility_boundary"] },
  { domainKey: "approval_exception", owner: "product", primaryEvidenceKey: "v10-release:domain:approval-exception", requiredCategories: ["complete_closure", "verification_gate"] },
  { domainKey: "reporting_export", owner: "operations", primaryEvidenceKey: "v10-release:domain:reporting-export", requiredCategories: ["complete_closure", "fixture_measurement", "compatibility_boundary"] },
  { domainKey: "search", owner: "product", primaryEvidenceKey: "v10-release:domain:search", requiredCategories: ["complete_closure", "verification_gate"] },
  { domainKey: "settings_governance", owner: "security", primaryEvidenceKey: "v10-release:domain:settings-governance", requiredCategories: ["complete_closure", "compatibility_boundary", "verification_gate"] },
  { domainKey: "jobs_notifications", owner: "operations", primaryEvidenceKey: "v10-release:domain:jobs-notifications", requiredCategories: ["complete_closure", "post_ga_drift"] },
  { domainKey: "advanced_assurance", owner: "product", primaryEvidenceKey: "v10-release:domain:advanced-assurance", requiredCategories: ["complete_closure", "verification_gate"] },
  { domainKey: "support", owner: "support", primaryEvidenceKey: "v10-release:domain:support", requiredCategories: ["release_handoff", "post_ga_drift"] },
  { domainKey: "release", owner: "release", primaryEvidenceKey: "v10-release:domain:release", requiredCategories: ["fixture_measurement", "release_handoff", "cleanup_decision"] },
] as const;

function domainRows(): V10ZeroExclusionManifestRow[] {
  return V10_DOMAIN_COVERAGE_MATRICES.map((matrix) => ({
    coverageKey: `domain:${matrix.domainKey}`,
    category: "domain_matrix",
    owner: matrix.owner,
    priority: matrix.domainKey === "release" || matrix.domainKey === "support" ? "release_blocker" : "P0",
    status: "automated_gate",
    runtimeArtifact: "src/lib/v10-zero-exclusion-report.ts",
    testArtifacts: ["src/lib/v10-zero-exclusion-report.v10.test.ts"],
    releaseEvidenceKey: matrix.primaryEvidenceKey,
    blockerState: null,
    residualRisk: null,
    supportBoundary: "domain_support_boundary",
    rollbackPath: "npm run check:v10-complete-closure",
    promotionState: matrix.domainKey === "release" || matrix.domainKey === "support" ? "complete" : "GA",
  }));
}

export function buildV10ReleaseHandoffPackets(
  rows: readonly V10ZeroExclusionManifestRow[] = buildV10ZeroExclusionManifest()
): V10ReleaseHandoffPacket[] {
  const evidenceKeysFor = (...categories: V10ZeroExclusionCategory[]) =>
    rows
      .filter((row) => categories.includes(row.category))
      .map((row) => row.releaseEvidenceKey)
      .slice(0, 40);
  return [
    {
      packetKey: "beta",
      owner: "release",
      releaseState: "beta",
      requiredManifestCategories: ["complete_closure", "fixture_measurement", "verification_gate"],
      evidenceKeys: evidenceKeysFor("fixture_measurement", "complete_closure"),
      gateCommands: ["npm run check:v10-suite", "npm run check:v10-release-evidence"],
      supportSafe: true,
    },
    {
      packetKey: "GA",
      owner: "release",
      releaseState: "GA",
      requiredManifestCategories: ["complete_closure", "compatibility_boundary", "verification_gate"],
      evidenceKeys: evidenceKeysFor("compatibility_boundary", "verification_gate"),
      gateCommands: ["npm run check:v10-complete-closure", "npm run test:e2e:v10"],
      supportSafe: true,
    },
    {
      packetKey: "complete",
      owner: "release",
      releaseState: "complete",
      requiredManifestCategories: ["complete_closure", "post_ga_drift", "cleanup_decision", "release_handoff"],
      evidenceKeys: evidenceKeysFor("post_ga_drift", "cleanup_decision"),
      gateCommands: ["npm run check:v10-complete-closure", "npm run verify"],
      supportSafe: true,
    },
    {
      packetKey: "support",
      owner: "support",
      releaseState: "complete",
      requiredManifestCategories: ["post_ga_drift", "release_handoff"],
      evidenceKeys: evidenceKeysFor("post_ga_drift"),
      gateCommands: ["npm run check:v10-release-evidence"],
      supportSafe: true,
    },
    {
      packetKey: "operations",
      owner: "operations",
      releaseState: "post_ga",
      requiredManifestCategories: ["post_ga_drift", "verification_gate"],
      evidenceKeys: evidenceKeysFor("post_ga_drift", "verification_gate"),
      gateCommands: V10_OPS_RELEASE_READINESS_CONTRACTS.map((row) => row.rollbackCommand),
      supportSafe: true,
    },
    {
      packetKey: "security",
      owner: "security",
      releaseState: "GA",
      requiredManifestCategories: ["compatibility_boundary", "verification_gate"],
      evidenceKeys: evidenceKeysFor("compatibility_boundary", "verification_gate"),
      gateCommands: ["npm run check:v10-privacy-scan", "npm run check:v10-release-evidence"],
      supportSafe: true,
    },
    {
      packetKey: "rollback",
      owner: "operations",
      releaseState: "post_ga",
      requiredManifestCategories: ["post_ga_drift", "cleanup_decision"],
      evidenceKeys: evidenceKeysFor("post_ga_drift", "cleanup_decision"),
      gateCommands: V10_FINAL_CUTOVER_CHECKLIST.map((row) => row.gateCommand),
      supportSafe: true,
    },
    {
      packetKey: "post_ga",
      owner: "operations",
      releaseState: "post_ga",
      requiredManifestCategories: ["post_ga_drift", "release_handoff"],
      evidenceKeys: evidenceKeysFor("post_ga_drift"),
      gateCommands: V10_POST_GA_DRIFT_CONTROLS.map((row) => row.checkCommand),
      supportSafe: true,
    },
  ];
}

function releaseHandoffRows(): V10ZeroExclusionManifestRow[] {
  return buildV10ReleaseHandoffPackets([]).map((packet) => ({
    coverageKey: `handoff:${packet.packetKey}`,
    category: "release_handoff",
    owner: packet.owner,
    priority: "release_blocker",
    status: "release_evidence_required",
    runtimeArtifact: "src/lib/v10-zero-exclusion-report.ts",
    testArtifacts: ["src/lib/v10-zero-exclusion-report.v10.test.ts", ...packet.gateCommands],
    releaseEvidenceKey: `v10-release:handoff:${packet.packetKey}`,
    blockerState: "release_owner_packet_required",
    residualRisk: "Release handoff packet must be attached by the owning audience before promotion.",
    supportBoundary: packet.supportSafe ? "support_safe_packet" : "restricted_packet",
    rollbackPath: packet.gateCommands[0] ?? "npm run check:v10-release-evidence",
    promotionState: packet.releaseState,
  }));
}

export function buildV10ZeroExclusionManifest(): V10ZeroExclusionManifestRow[] {
  return [
    ...closureRows(),
    ...fixtureMeasurementRows(),
    ...compatibilityRows(),
    ...driftRows(),
    ...verificationRows(),
    ...lifecycleRows(),
    ...domainRows(),
    ...releaseHandoffRows(),
  ];
}

export function validateV10DomainCoverageMatrices(
  matrices: readonly V10DomainCoverageMatrix[] = V10_DOMAIN_COVERAGE_MATRICES
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const matrix of matrices) {
    if (seen.has(matrix.domainKey)) failures.push(`duplicate_domain:${matrix.domainKey}`);
    seen.add(matrix.domainKey);
    if (!matrix.primaryEvidenceKey.startsWith("v10-release:")) failures.push(`${matrix.domainKey}:release_evidence_key_required`);
    if (matrix.requiredCategories.length === 0) failures.push(`${matrix.domainKey}:required_categories_required`);
  }
  for (const required of [
    "activation",
    "work",
    "contract_record",
    "review_data_quality",
    "renewal",
    "evidence",
    "approval_exception",
    "reporting_export",
    "search",
    "settings_governance",
    "jobs_notifications",
    "advanced_assurance",
    "support",
    "release",
  ] as const) {
    if (!seen.has(required)) failures.push(`domain_missing:${required}`);
  }
  return failures;
}

export function validateV10ReleaseHandoffPackets(
  packets: readonly V10ReleaseHandoffPacket[] = buildV10ReleaseHandoffPackets()
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const packet of packets) {
    if (seen.has(packet.packetKey)) failures.push(`duplicate_packet:${packet.packetKey}`);
    seen.add(packet.packetKey);
    if (packet.requiredManifestCategories.length === 0) failures.push(`${packet.packetKey}:required_categories_required`);
    if (packet.evidenceKeys.length === 0) failures.push(`${packet.packetKey}:evidence_key_required`);
    if (packet.gateCommands.length === 0) failures.push(`${packet.packetKey}:gate_command_required`);
    if (!packet.supportSafe) failures.push(`${packet.packetKey}:support_safe_required`);
  }
  for (const required of ["beta", "GA", "complete", "support", "operations", "security", "rollback", "post_ga"] as const) {
    if (!seen.has(required)) failures.push(`handoff_packet_missing:${required}`);
  }
  return failures;
}

export function validateV10ZeroExclusionManifest(
  rows: readonly V10ZeroExclusionManifestRow[] = buildV10ZeroExclusionManifest()
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.coverageKey)) failures.push(`duplicate_row:${row.coverageKey}`);
    seen.add(row.coverageKey);
    if (!row.owner) failures.push(`${row.coverageKey}:owner_required`);
    if (!row.runtimeArtifact) failures.push(`${row.coverageKey}:runtime_artifact_required`);
    if (row.testArtifacts.length === 0) failures.push(`${row.coverageKey}:test_artifact_required`);
    if (!row.releaseEvidenceKey.startsWith("v10-")) failures.push(`${row.coverageKey}:release_evidence_key_required`);
    if (!row.supportBoundary.trim()) failures.push(`${row.coverageKey}:support_boundary_required`);
    if (!row.rollbackPath.trim()) failures.push(`${row.coverageKey}:rollback_path_required`);
    if (row.status === "shipped" && row.blockerState) failures.push(`${row.coverageKey}:shipped_row_blocked`);
    if (row.status === "release_evidence_required" && !row.blockerState) failures.push(`${row.coverageKey}:release_blocker_state_required`);
  }
  for (const category of [
    "complete_closure",
    "fixture_measurement",
    "compatibility_boundary",
    "post_ga_drift",
    "verification_gate",
    "domain_matrix",
    "release_handoff",
    "cleanup_decision",
  ] as const) {
    if (!rows.some((row) => row.category === category)) failures.push(`category_missing:${category}`);
  }
  failures.push(...validateV10DomainCoverageMatrices());
  failures.push(...validateV10ReleaseHandoffPackets());
  return failures;
}
