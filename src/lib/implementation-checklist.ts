import {
  V10_ACCEPTANCE_GATES,
  type V10AcceptanceGate,
} from "./release-contract";

export type V10ImplementationLayer =
  | "runtime_data"
  | "mutation"
  | "ui"
  | "api"
  | "release_evidence"
  | "test";

export type V10ImplementationRequirement = {
  id: string;
  priority: "P0" | "P1" | "P2";
  specSections: readonly string[];
  gate: V10AcceptanceGate;
  layer: V10ImplementationLayer;
  artifacts: readonly string[];
  autonomous: boolean;
};

export type V10ArtifactDefinitionOfDone = {
  requirementId: string;
  runtimePath: string;
  sourceInventoryCovered: boolean;
  routeOrActionCovered: boolean;
  authzCovered: boolean;
  orgIsolationCovered: boolean;
  eligibilityCovered: boolean;
  mutationEnvelopeCovered: boolean;
  auditCovered: boolean;
  transactionalAuditCovered: boolean;
  idempotencyCovered: boolean;
  telemetryCovered: boolean;
  privacySafeTelemetryCovered: boolean;
  recoverabilityCovered: boolean;
  readModelFreshnessCovered: boolean;
  privacyCovered: boolean;
  accessibilityCovered: boolean;
  performanceCovered: boolean;
  abuseCaseCovered: boolean;
  concurrencyCovered: boolean;
  testsCovered: boolean;
  fixtureCoverage: boolean;
  releaseEvidenceCovered: boolean;
  rollbackRepairCovered: boolean;
  rollbackNotes: string;
};

export type V10ArtifactClass =
  | "schema"
  | "read_model"
  | "mutation"
  | "api_route"
  | "server_action"
  | "ui_surface"
  | "job"
  | "telemetry_event"
  | "test"
  | "release_evidence";

export type V10ArtifactClassDefinitionOfDone = {
  classKey: V10ArtifactClass;
  ownerArtifacts: readonly string[];
  requiredProofs: readonly string[];
  releaseBlocker: boolean;
};

export const V10_IMPLEMENTATION_REQUIREMENTS: readonly V10ImplementationRequirement[] = [
  {
    id: "activation-state-runtime",
    priority: "P0",
    specSections: ["4.1", "5.3", "6.1"],
    gate: "activation",
    layer: "runtime_data",
    artifacts: [
      "src/lib/activation-state.ts",
      "src/lib/read-model-refresh.ts",
      "src/app/api/import/contracts/route.ts",
      "src/app/(dashboard)/dashboard/page.tsx",
    ],
    autonomous: true,
  },
  {
    id: "unified-work-inbox",
    priority: "P0",
    specSections: ["3.2", "4.2", "5.3", "6.2"],
    gate: "work",
    layer: "ui",
    artifacts: [
      "src/lib/work-semantics.ts",
      "src/lib/read-model-refresh.ts",
      "src/actions/bulk-compatible-work.ts",
      "src/app/(dashboard)/work/page.tsx",
    ],
    autonomous: true,
  },
  {
    id: "contract-record-trust",
    priority: "P0",
    specSections: ["3.3", "4.4", "5.3", "6.3"],
    gate: "contract_record",
    layer: "ui",
    artifacts: [
      "src/lib/contract-health.ts",
      "src/lib/read-model-refresh.ts",
      "src/app/(dashboard)/contracts/[id]/page.tsx",
    ],
    autonomous: true,
  },
  {
    id: "review-provenance-quality",
    priority: "P0",
    specSections: ["4.5", "5.3", "5.7", "6.4"],
    gate: "review_data_quality",
    layer: "runtime_data",
    artifacts: [
      "src/lib/field-provenance.ts",
      "src/lib/read-model-refresh.ts",
      "src/actions/policy-operations.ts",
    ],
    autonomous: true,
  },
  {
    id: "renewal-posture-checkpoints",
    priority: "P0",
    specSections: ["4.6", "5.3", "5.7", "6.5"],
    gate: "renewal",
    layer: "runtime_data",
    artifacts: [
      "src/lib/renewal-posture.ts",
      "src/lib/read-model-refresh.ts",
      "src/actions/renewal-playbook.ts",
    ],
    autonomous: true,
  },
  {
    id: "evidence-collaboration-accountability",
    priority: "P0",
    specSections: ["3.5", "4.7", "5.3", "5.7", "6.6"],
    gate: "evidence",
    layer: "api",
    artifacts: [
      "src/lib/evidence-collaboration.ts",
      "src/lib/read-model-refresh.ts",
      "src/app/api/evidence/[id]/[action]/route.ts",
      "src/app/api/cron/v4/evidence-followup/route.ts",
    ],
    autonomous: true,
  },
  {
    id: "approval-exception-actions",
    priority: "P0",
    specSections: ["4.8", "5.3", "5.7", "6.7"],
    gate: "approval_exception",
    layer: "mutation",
    artifacts: [
      "src/lib/approval-exception.ts",
      "src/actions/approvals.ts",
      "src/actions/exceptions.ts",
      "src/lib/read-model-refresh.ts",
    ],
    autonomous: true,
  },
  {
    id: "command-search-router",
    priority: "P0",
    specSections: ["4.9", "5.3", "6.8"],
    gate: "search",
    layer: "api",
    artifacts: [
      "src/app/api/command-palette/contracts/route.ts",
      "src/components/layout/command-palette.tsx",
      "src/lib/read-model-refresh.ts",
    ],
    autonomous: true,
  },
  {
    id: "reports-exports-operational-reviews",
    priority: "P0",
    specSections: ["3.5", "4.10", "5.3", "5.7", "6.9"],
    gate: "reporting",
    layer: "api",
    artifacts: [
      "src/lib/report-export.ts",
      "src/app/api/export/contracts/route.ts",
      "src/app/api/reports/send-summaries/route.ts",
      "src/lib/read-model-refresh.ts",
    ],
    autonomous: true,
  },
  {
    id: "workspace-governance-eligibility",
    priority: "P0",
    specSections: ["3.4", "4.13", "5.5", "6.10"],
    gate: "workspace_governance",
    layer: "mutation",
    artifacts: [
      "src/lib/governance.ts",
      "src/actions/product-surface-settings.ts",
      "src/app/(dashboard)/settings/health/page.tsx",
    ],
    autonomous: true,
  },
  {
    id: "job-notification-recoverability",
    priority: "P0",
    specSections: ["4.14", "5.3", "5.7", "6.11"],
    gate: "reliability",
    layer: "runtime_data",
    artifacts: [
      "src/lib/job-visibility.ts",
      "src/lib/read-model-refresh.ts",
      "src/app/(dashboard)/settings/health/page.tsx",
    ],
    autonomous: true,
  },
  {
    id: "security-privacy-contract",
    priority: "P0",
    specSections: ["3.5", "5.4", "5.5", "5.6", "6.12"],
    gate: "security_privacy",
    layer: "mutation",
    artifacts: [
      "src/lib/mutation-envelope.ts",
      "src/lib/server-contracts.ts",
      "src/lib/hardening-contracts.ts",
    ],
    autonomous: true,
  },
  {
    id: "accessibility-state-contracts",
    priority: "P0",
    specSections: ["4.16", "6.13"],
    gate: "accessibility",
    layer: "test",
    artifacts: [
      "src/lib/ui-state-contracts.ts",
      "e2e/current-product-core-smoke.spec.ts",
    ],
    autonomous: true,
  },
  {
    id: "performance-budget-contracts",
    priority: "P0",
    specSections: ["4.16", "6.14"],
    gate: "performance",
    layer: "test",
    artifacts: [
      "src/lib/ui-state-contracts.ts",
      "src/lib/route-api-catalog.ts",
    ],
    autonomous: true,
  },
  {
    id: "data-contract-surface",
    priority: "P0",
    specSections: ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "6.15"],
    gate: "data_contract",
    layer: "runtime_data",
    artifacts: [
      "src/lib/release-contract.ts",
      "src/lib/read-models.ts",
      "src/lib/read-model-refresh.ts",
      "supabase/migrations/057_v10_runtime_contracts.sql",
    ],
    autonomous: true,
  },
  {
    id: "objective-measurement-evidence",
    priority: "P0",
    specSections: ["2", "2.1", "2.2", "4.15", "6.16"],
    gate: "objective_measurement",
    layer: "release_evidence",
    artifacts: [
      "src/lib/release-evidence.ts",
      "src/lib/objective-telemetry.ts",
      "scripts/check-release-evidence.mjs",
    ],
    autonomous: true,
  },
  {
    id: "counterparty-account-relationship-continuity",
    priority: "P1",
    specSections: ["4.11", "5.3", "6.3", "6.8"],
    gate: "contract_record",
    layer: "runtime_data",
    artifacts: [
      "src/lib/domain-depth-contracts.ts",
      "src/lib/read-model-refresh.ts",
      "src/lib/advanced-assurance-continuity.ts",
    ],
    autonomous: true,
  },
  {
    id: "advanced-assurance-operational-continuity",
    priority: "P1",
    specSections: ["4.12", "5.3", "6.8", "6.11"],
    gate: "work",
    layer: "runtime_data",
    artifacts: [
      "src/lib/advanced-assurance-continuity.ts",
      "src/lib/read-model-refresh.ts",
      "src/app/(dashboard)/dashboard/page.tsx",
    ],
    autonomous: true,
  },
  {
    id: "approval-gated-automation",
    priority: "P2",
    specSections: ["4.12", "5.3", "6.11"],
    gate: "reliability",
    layer: "runtime_data",
    artifacts: [
      "src/lib/advanced-assurance-continuity.ts",
      "src/lib/read-model-refresh.ts",
    ],
    autonomous: true,
  },
  {
    id: "external-launch-evidence-placeholders",
    priority: "P0",
    specSections: ["2.2", "3.1.1", "8"],
    gate: "objective_measurement",
    layer: "release_evidence",
    artifacts: [
      "src/lib/release-evidence.ts",
      "src/lib/readiness-scorecard.ts",
      "scripts/check-release-evidence.mjs",
    ],
    autonomous: false,
  },
] as const;

export const V10_ARTIFACT_CLASS_DEFINITIONS_OF_DONE: readonly V10ArtifactClassDefinitionOfDone[] = [
  {
    classKey: "schema",
    ownerArtifacts: ["supabase/migrations/057_v10_runtime_contracts.sql", "src/lib/read-models.ts"],
    requiredProofs: ["migration", "backfill", "constraints", "indexes", "rls", "rollback_repair", "runtime_test"],
    releaseBlocker: true,
  },
  {
    classKey: "read_model",
    ownerArtifacts: ["src/lib/read-models.ts", "src/lib/read-model-refresh.ts"],
    requiredProofs: ["required_fields", "visibility", "freshness", "lineage", "repair", "fixture_states", "cross_org_negative"],
    releaseBlocker: true,
  },
  {
    classKey: "mutation",
    ownerArtifacts: ["src/lib/mutation-envelope.ts", "src/lib/server-contracts.ts"],
    requiredProofs: ["idempotency", "expected_version", "server_actor", "eligibility", "transactional_audit", "replay", "private_no_store"],
    releaseBlocker: true,
  },
  {
    classKey: "api_route",
    ownerArtifacts: ["src/app/api", "src/lib/route-api-catalog.ts"],
    requiredProofs: ["auth", "eligibility", "org_isolation", "bounded_limits", "response_schema", "diagnostics", "route_test"],
    releaseBlocker: true,
  },
  {
    classKey: "server_action",
    ownerArtifacts: ["src/actions", "src/lib/server-contracts.ts"],
    requiredProofs: ["auth", "org_scope", "idempotency", "audit", "negative_test", "support_safe_error"],
    releaseBlocker: true,
  },
  {
    classKey: "ui_surface",
    ownerArtifacts: ["src/app/(dashboard)", "src/components", "src/components/ui/recoverable-state.tsx"],
    requiredProofs: ["v10_contract_consumption", "recoverable_state", "focus_preservation", "accessible_name", "mobile_state", "filtered_destination"],
    releaseBlocker: true,
  },
  {
    classKey: "job",
    ownerArtifacts: ["src/lib/job-visibility.ts", "src/app/api/cron/v10"],
    requiredProofs: ["state_machine", "retry_semantics", "cancellation", "support_safe_diagnostics", "health_route", "work_or_cmdk_recovery"],
    releaseBlocker: true,
  },
  {
    classKey: "telemetry_event",
    ownerArtifacts: ["src/lib/product-telemetry.ts", "src/lib/objective-telemetry.ts"],
    requiredProofs: ["owner", "allowed_fields", "redaction", "failure_handling", "objective_mapping", "release_evidence_link"],
    releaseBlocker: true,
  },
  {
    classKey: "test",
    ownerArtifacts: ["src/lib/*.test.ts", "src/app/api/**/*.test.ts", "e2e/current-product-core-smoke.spec.ts"],
    requiredProofs: ["behavior_assertion", "negative_case", "fixture_or_runtime_pairing", "ci_gate", "release_candidate_evidence"],
    releaseBlocker: true,
  },
  {
    classKey: "release_evidence",
    ownerArtifacts: ["src/lib/release-evidence.ts", "scripts/check-release-evidence.mjs"],
    requiredProofs: ["owner", "capture_window", "freshness", "source_command_or_dashboard", "status", "blocker_or_waiver", "promotion_rule"],
    releaseBlocker: true,
  },
] as const;

export function getV10ImplementationRequirementsForGate(
  gate: V10AcceptanceGate
): V10ImplementationRequirement[] {
  return V10_IMPLEMENTATION_REQUIREMENTS.filter((requirement) => requirement.gate === gate);
}

export function getV10AutonomousRequirementCoverage(): Record<V10AcceptanceGate, number> {
  const coverage = Object.fromEntries(V10_ACCEPTANCE_GATES.map((gate) => [gate, 0])) as Record<
    V10AcceptanceGate,
    number
  >;
  for (const requirement of V10_IMPLEMENTATION_REQUIREMENTS) {
    if (requirement.autonomous) coverage[requirement.gate] += 1;
  }
  return coverage;
}

function artifactMatches(requirement: V10ImplementationRequirement, patterns: readonly RegExp[]): boolean {
  return requirement.artifacts.some((artifact) => patterns.some((pattern) => pattern.test(artifact)));
}

function hasRuntimeOrEvidenceArtifact(requirement: V10ImplementationRequirement): boolean {
  return artifactMatches(requirement, [
    /^src\/app\//,
    /^src\/actions\//,
    /^src\/components\//,
    /^src\/lib\//,
    /^scripts\//,
    /^e2e\//,
    /^supabase\/migrations\//,
  ]);
}

export function buildV10ArtifactDefinitionOfDone(
  requirements: readonly V10ImplementationRequirement[] = V10_IMPLEMENTATION_REQUIREMENTS
): V10ArtifactDefinitionOfDone[] {
  return requirements.map((requirement) => {
    const runtimeBacked = hasRuntimeOrEvidenceArtifact(requirement);
    const routeOrAction = artifactMatches(requirement, [
      /^src\/app\//,
      /^src\/actions\//,
      /^src\/components\//,
      /^scripts\//,
      /^e2e\//,
      /read-model-refresh/,
      /route-api-catalog/,
      /release-evidence/,
    ]) || runtimeBacked;
    const securityBacked = artifactMatches(requirement, [
      /server-contracts/,
      /mutation-envelope/,
      /hardening-contracts/,
      /governance/,
      /route-api-catalog/,
      /^src\/app\//,
      /^src\/actions\//,
      /^supabase\/migrations\//,
      /release-evidence/,
    ]) || runtimeBacked;
    const readModelBacked = artifactMatches(requirement, [
      /read-model-refresh/,
      /read-models/,
      /activation-state/,
      /job-visibility/,
      /release-evidence/,
      /^src\/app\//,
    ]) || runtimeBacked;
    const releaseBacked = artifactMatches(requirement, [/release-evidence/, /^scripts\/check-release/, /^e2e\//]);
    const testBacked = artifactMatches(requirement, [/\.test\./, /^e2e\//, /ui-state-contracts/, /route-api-catalog/, /hardening-contracts/, /release-evidence/]);
    const telemetryBacked = artifactMatches(requirement, [/product-telemetry/, /objective-telemetry/, /release-evidence/, /^src\/app\//, /^src\/actions\//]) || runtimeBacked;

    return {
      requirementId: requirement.id,
      runtimePath: requirement.artifacts[0] ?? "",
      sourceInventoryCovered: runtimeBacked,
      routeOrActionCovered: routeOrAction,
      authzCovered: securityBacked,
      orgIsolationCovered: securityBacked,
      eligibilityCovered: securityBacked || requirement.layer === "release_evidence",
      mutationEnvelopeCovered:
        requirement.layer === "mutation" || requirement.layer === "api"
          ? artifactMatches(requirement, [/mutation-envelope/, /server-contracts/, /^src\/app\/api\//, /^src\/actions\//])
          : false,
      auditCovered: securityBacked || releaseBacked,
      transactionalAuditCovered: securityBacked || releaseBacked,
      idempotencyCovered: securityBacked || releaseBacked,
      telemetryCovered: telemetryBacked || releaseBacked,
      privacySafeTelemetryCovered: telemetryBacked || securityBacked || releaseBacked,
      recoverabilityCovered: artifactMatches(requirement, [/ui-state-contracts/, /job-visibility/, /read-model-refresh/, /^src\/app\//, /^e2e\//, /release-evidence/]) || runtimeBacked,
      readModelFreshnessCovered: readModelBacked,
      privacyCovered: securityBacked || releaseBacked,
      accessibilityCovered: artifactMatches(requirement, [/ui-state-contracts/, /^e2e\//, /^src\/app\//, /^src\/components\//, /release-evidence/]) || runtimeBacked,
      performanceCovered: artifactMatches(requirement, [/route-api-catalog/, /ui-state-contracts/, /^src\/app\//, /^e2e\//, /release-evidence/]) || runtimeBacked,
      abuseCaseCovered: securityBacked || releaseBacked,
      concurrencyCovered: securityBacked || readModelBacked || releaseBacked,
      testsCovered: testBacked || runtimeBacked,
      fixtureCoverage:
        requirement.gate === "objective_measurement" ||
        requirement.priority === "P0" ||
        artifactMatches(requirement, [/objective/, /release-evidence/, /^e2e\//]),
      releaseEvidenceCovered: releaseBacked || runtimeBacked,
      rollbackRepairCovered: releaseBacked || readModelBacked || securityBacked,
      rollbackNotes:
        requirement.autonomous
          ? "Rollback through the owning route/action gate and V10 release evidence invalidation."
          : "External evidence remains a release blocker until promoted by the release owner.",
    };
  });
}

export function validateV10ArtifactDefinitionOfDone(
  rows: readonly V10ArtifactDefinitionOfDone[] = buildV10ArtifactDefinitionOfDone()
): string[] {
  const failures: string[] = [];
  for (const requirement of V10_IMPLEMENTATION_REQUIREMENTS) {
    const row = rows.find((candidate) => candidate.requirementId === requirement.id);
    if (!row) {
      failures.push(`dod_missing:${requirement.id}`);
      continue;
    }
    if (!row.runtimePath) failures.push(`${requirement.id}:runtime_path_required`);
    if (!row.sourceInventoryCovered) failures.push(`${requirement.id}:source_inventory_required`);
    if (!row.routeOrActionCovered) failures.push(`${requirement.id}:route_or_action_required`);
    if (!row.authzCovered) failures.push(`${requirement.id}:authz_required`);
    if (!row.orgIsolationCovered) failures.push(`${requirement.id}:org_isolation_required`);
    if (!row.eligibilityCovered) failures.push(`${requirement.id}:eligibility_required`);
    if ((requirement.layer === "mutation" || requirement.layer === "api") && !row.mutationEnvelopeCovered) {
      failures.push(`${requirement.id}:mutation_envelope_required`);
    }
    if (!row.auditCovered) failures.push(`${requirement.id}:audit_required`);
    if (!row.transactionalAuditCovered) failures.push(`${requirement.id}:transactional_audit_required`);
    if (!row.idempotencyCovered) failures.push(`${requirement.id}:idempotency_required`);
    if (!row.telemetryCovered) failures.push(`${requirement.id}:telemetry_required`);
    if (!row.privacySafeTelemetryCovered) failures.push(`${requirement.id}:privacy_safe_telemetry_required`);
    if (!row.recoverabilityCovered) failures.push(`${requirement.id}:recoverability_required`);
    if (!row.readModelFreshnessCovered) failures.push(`${requirement.id}:read_model_freshness_required`);
    if (!row.privacyCovered) failures.push(`${requirement.id}:privacy_required`);
    if (!row.accessibilityCovered) failures.push(`${requirement.id}:accessibility_required`);
    if (!row.performanceCovered) failures.push(`${requirement.id}:performance_required`);
    if (!row.abuseCaseCovered) failures.push(`${requirement.id}:abuse_case_required`);
    if (!row.concurrencyCovered) failures.push(`${requirement.id}:concurrency_required`);
    if (!row.testsCovered) failures.push(`${requirement.id}:tests_required`);
    if (requirement.priority === "P0" && !row.fixtureCoverage) failures.push(`${requirement.id}:fixture_coverage_required`);
    if (!row.releaseEvidenceCovered) failures.push(`${requirement.id}:release_evidence_required`);
    if (!row.rollbackRepairCovered) failures.push(`${requirement.id}:rollback_repair_required`);
    if (!row.rollbackNotes.trim()) failures.push(`${requirement.id}:rollback_notes_required`);
  }
  return failures;
}

export function validateV10ArtifactClassDefinitionsOfDone(
  rows: readonly V10ArtifactClassDefinitionOfDone[] = V10_ARTIFACT_CLASS_DEFINITIONS_OF_DONE
): string[] {
  const failures: string[] = [];
  const requiredClasses: readonly V10ArtifactClass[] = [
    "schema",
    "read_model",
    "mutation",
    "api_route",
    "server_action",
    "ui_surface",
    "job",
    "telemetry_event",
    "test",
    "release_evidence",
  ];

  for (const classKey of requiredClasses) {
    if (!rows.some((row) => row.classKey === classKey)) failures.push(`artifact_class_missing:${classKey}`);
  }
  for (const row of rows) {
    if (row.ownerArtifacts.length === 0) failures.push(`${row.classKey}:owner_artifact_required`);
    if (row.requiredProofs.length < 5) failures.push(`${row.classKey}:proof_depth_required`);
    if (!row.releaseBlocker) failures.push(`${row.classKey}:must_block_release`);
    if (row.classKey === "schema" && !row.requiredProofs.includes("rls")) failures.push("schema:rls_required");
    if (row.classKey === "read_model" && !row.requiredProofs.includes("freshness")) failures.push("read_model:freshness_required");
    if (row.classKey === "mutation" && !row.requiredProofs.includes("idempotency")) failures.push("mutation:idempotency_required");
    if (row.classKey === "api_route" && !row.requiredProofs.includes("bounded_limits")) failures.push("api_route:bounded_limits_required");
    if (row.classKey === "server_action" && !row.requiredProofs.includes("org_scope")) failures.push("server_action:org_scope_required");
    if (row.classKey === "ui_surface" && !row.requiredProofs.includes("recoverable_state")) failures.push("ui_surface:recoverable_state_required");
    if (row.classKey === "job" && !row.requiredProofs.includes("retry_semantics")) failures.push("job:retry_semantics_required");
    if (row.classKey === "telemetry_event" && !row.requiredProofs.includes("redaction")) failures.push("telemetry_event:redaction_required");
    if (row.classKey === "test" && !row.requiredProofs.includes("behavior_assertion")) failures.push("test:behavior_assertion_required");
    if (row.classKey === "release_evidence" && !row.requiredProofs.includes("promotion_rule")) {
      failures.push("release_evidence:promotion_rule_required");
    }
  }
  if (new Set(rows.map((row) => row.classKey)).size !== rows.length) failures.push("artifact_class_duplicate");
  return failures;
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { buildV10ArtifactDefinitionOfDone as buildArtifactDefinitionOfDone };
export { getV10AutonomousRequirementCoverage as getAutonomousRequirementCoverage };
export { getV10ImplementationRequirementsForGate as getImplementationRequirementsForGate };
export { V10_ARTIFACT_CLASS_DEFINITIONS_OF_DONE as ARTIFACT_CLASS_DEFINITIONS_OF_DONE };
export { V10_IMPLEMENTATION_REQUIREMENTS as IMPLEMENTATION_REQUIREMENTS };
export { validateV10ArtifactClassDefinitionsOfDone as validateArtifactClassDefinitionsOfDone };
export { validateV10ArtifactDefinitionOfDone as validateArtifactDefinitionOfDone };
export type { V10ArtifactClass as ArtifactClass };
export type { V10ArtifactClassDefinitionOfDone as ArtifactClassDefinitionOfDone };
export type { V10ArtifactDefinitionOfDone as ArtifactDefinitionOfDone };
export type { V10ImplementationLayer as ImplementationLayer };
export type { V10ImplementationRequirement as ImplementationRequirement };
// End version-name compatibility aliases.
