import {
  V10_ACCEPTANCE_GATES,
  V10_CORE_REPORT_FAMILIES,
  V10_GA_SAMPLE_SIZES,
  V10_JOB_CLASSES,
  V10_NOTIFICATION_CLASSES,
  V10_RELEASE_FIXTURE_MINIMUMS,
  V10_SOURCE_OBJECT_TYPES,
} from "./v10-release-contract";
import {
  V10_ACCEPTANCE_MATRIX,
  V10_REQUIRED_ACCEPTANCE_IDS,
  buildV10AcceptanceGateClosureLedger,
  validateV10AcceptanceGateClosureLedger,
  validateV10AcceptanceMatrix,
} from "./v10-acceptance-matrix";
import {
  V10_REQUIRED_MUTATION_CONTRACTS,
  validateV10RequiredMutationContracts,
} from "./v10-mutation-envelope";
import {
  V10_READ_MODEL_RUNTIME_CONTRACTS,
  V10_REQUIRED_READ_MODEL_KEYS,
  validateV10ReadModelRuntimeContracts,
} from "./v10-read-models";
import {
  buildV10RouteActionInventory,
  buildV10RouteApiInventory,
  getV10RouteRuntimeArtifact,
  getV10RouteTestArtifact,
  validateV10RouteActionInventory,
  validateV10RouteApiInventory,
} from "./v10-route-api-catalog";
import {
  V10_SOURCE_OBJECT_INVENTORY,
  buildV10SourceObjectCoverageMatrix,
  validateV10SourceObjectCoverageMatrix,
  validateV10SourceObjectInventory,
} from "./v10-source-object-inventory";
import {
  V10_OBJECTIVE_MEASUREMENT_RULES,
  V10_RC_FIXTURE_CATEGORIES,
  V10_RC_FIXTURE_MANIFESTS,
  V10_RC_METRIC_CAPTURE_PLANS,
  V10_SYNTHETIC_METRIC_DESCRIPTORS,
  V10_OBJECTIVE_METRIC_CAPTURE_PATHS,
  V10_OBJECTIVE_PROMOTION_EVIDENCE_CAPTURE,
  validateV10ObjectiveMetricCapturePaths,
  validateV10ObjectivePromotionEvidenceCapture,
  validateV10RcFixtureCategoryDescriptors,
  validateV10RcFixtureManifestSet,
  validateV10RcMetricCapturePlans,
  validateV10SyntheticMetricDescriptors,
} from "./v10-objective-measurements";
import {
  V10_ROUTE_STATE_MATRIX,
  V10_UI_STATE_CONTRACTS,
  V10_VISUAL_REGRESSION_STATE_CONTRACTS,
  validateV10RouteStateMatrix,
  validateV10VisualRegressionStateContracts,
} from "./v10-ui-state-contracts";
import {
  V10_GA_METRIC_EVIDENCE_REQUIREMENTS,
  V10_NON_AUTONOMOUS_EVIDENCE_GATES,
  validateV10NonAutonomousEvidenceGateSet,
} from "./v10-release-evidence";
import {
  buildV10NoExclusionsMatrix,
  validateV10NoExclusionsMatrix,
} from "./v10-no-exclusions-matrix";
import {
  V10_JOB_NOTIFICATION_RUNTIME_CONTRACTS,
  validateV10JobNotificationRuntimeContracts,
} from "./v10-job-visibility";
import {
  V10_COMPATIBILITY_BOUNDARIES,
  V10_DEPRECATION_CANDIDATES,
  V10_DEPRECATION_CLEANUP_DECISIONS,
  validateV10DeprecationCleanupDecisions,
} from "./v10-final-gap-audit";
import {
  V10_OPS_RELEASE_READINESS_CONTRACTS,
  V10_PROVIDER_BOUNDARIES,
  validateV10OpsReleaseReadinessContracts,
  validateV10ProviderBoundaries,
} from "./v10-operational-contracts";

export type V10CompleteClosureDomain =
  | "acceptance"
  | "source_object"
  | "read_model"
  | "mutation"
  | "route"
  | "ui_state"
  | "objective_measurement"
  | "release_evidence"
  | "no_exclusions"
  | "job_notification_report_fixture";

export type V10CompleteClosureStatus = "closed" | "open";

export type V10CompleteClosureRow = {
  domain: V10CompleteClosureDomain;
  key: string;
  status: V10CompleteClosureStatus;
  owner: "engineering" | "product" | "operations" | "security" | "release" | "support";
  proofArtifacts: readonly string[];
  gates: readonly string[];
  releaseEvidenceId: string;
  failures: readonly string[];
};

export type V10CompleteClosureReport = {
  generatedAt: string;
  status: V10CompleteClosureStatus;
  rows: readonly V10CompleteClosureRow[];
  openRows: readonly V10CompleteClosureRow[];
  failures: readonly string[];
  counts: Record<V10CompleteClosureDomain, number>;
};

function row(input: Omit<V10CompleteClosureRow, "status">): V10CompleteClosureRow {
  return {
    ...input,
    status: input.failures.length === 0 ? "closed" : "open",
  };
}

function domainCounts(rows: readonly V10CompleteClosureRow[]): Record<V10CompleteClosureDomain, number> {
  const counts: Record<V10CompleteClosureDomain, number> = {
    acceptance: 0,
    source_object: 0,
    read_model: 0,
    mutation: 0,
    route: 0,
    ui_state: 0,
    objective_measurement: 0,
    release_evidence: 0,
    no_exclusions: 0,
    job_notification_report_fixture: 0,
  };
  for (const item of rows) counts[item.domain] += 1;
  return counts;
}

function requireCoverage(
  actual: readonly string[],
  required: readonly string[],
  prefix: string
): string[] {
  const actualSet = new Set(actual);
  return required
    .filter((key) => !actualSet.has(key))
    .map((key) => `${prefix}:${key}`);
}

export function buildV10CompleteClosureRows(): V10CompleteClosureRow[] {
  const acceptanceLedger = buildV10AcceptanceGateClosureLedger();
  const sourceObjectMatrix = buildV10SourceObjectCoverageMatrix();
  const routeInventory = buildV10RouteApiInventory();
  const routeActionInventory = buildV10RouteActionInventory();
  const noExclusions = buildV10NoExclusionsMatrix();

  const rows: V10CompleteClosureRow[] = [
    row({
      domain: "acceptance",
      key: "acceptance_matrix",
      owner: "release",
      proofArtifacts: ["src/lib/v10-acceptance-matrix.ts"],
      gates: ["src/lib/v10-acceptance-matrix.v10.test.ts"],
      releaseEvidenceId: "v10-complete:acceptance-matrix",
      failures: [
        ...validateV10AcceptanceMatrix(),
        ...validateV10AcceptanceGateClosureLedger(acceptanceLedger),
        ...requireCoverage(
          V10_ACCEPTANCE_MATRIX.map((item) => item.id),
          V10_REQUIRED_ACCEPTANCE_IDS,
          "acceptance_id_missing"
        ),
      ],
    }),
    row({
      domain: "source_object",
      key: "source_object_inventory",
      owner: "engineering",
      proofArtifacts: ["src/lib/v10-source-object-inventory.ts"],
      gates: ["src/lib/v10-source-object-inventory.v10.test.ts"],
      releaseEvidenceId: "v10-complete:source-object-inventory",
      failures: [
        ...validateV10SourceObjectInventory(),
        ...validateV10SourceObjectCoverageMatrix(sourceObjectMatrix),
        ...requireCoverage(
          V10_SOURCE_OBJECT_INVENTORY.map((item) => item.sourceObjectType),
          V10_SOURCE_OBJECT_TYPES,
          "source_object_missing"
        ),
      ],
    }),
    row({
      domain: "read_model",
      key: "read_model_runtime_contracts",
      owner: "engineering",
      proofArtifacts: ["src/lib/v10-read-models.ts", "src/lib/v10-read-model-refresh.ts"],
      gates: ["src/lib/v10-data-contracts.v10.test.ts", "src/lib/v10-read-model-refresh.v10.test.ts"],
      releaseEvidenceId: "v10-complete:read-model-runtime-contracts",
      failures: [
        ...validateV10ReadModelRuntimeContracts(),
        ...requireCoverage(
          V10_READ_MODEL_RUNTIME_CONTRACTS.map((item) => item.key),
          V10_REQUIRED_READ_MODEL_KEYS,
          "read_model_missing"
        ),
      ],
    }),
    row({
      domain: "mutation",
      key: "mutation_contracts",
      owner: "engineering",
      proofArtifacts: ["src/lib/v10-mutation-envelope.ts", "src/lib/v10-server-contracts.ts"],
      gates: ["src/lib/v10-semantics.v10.test.ts", "src/lib/v10-mutation-rollout.v10.test.ts"],
      releaseEvidenceId: "v10-complete:mutation-contracts",
      failures: [
        ...validateV10RequiredMutationContracts(),
        ...validateV10RouteActionInventory(routeActionInventory),
      ],
    }),
    row({
      domain: "route",
      key: "route_api_catalog",
      owner: "engineering",
      proofArtifacts: ["src/lib/v10-route-api-catalog.ts", "src/app"],
      gates: ["src/lib/v10-route-api-catalog.v10.test.ts"],
      releaseEvidenceId: "v10-complete:route-api-catalog",
      failures: validateV10RouteApiInventory(routeInventory),
    }),
    row({
      domain: "ui_state",
      key: "route_state_matrix",
      owner: "product",
      proofArtifacts: ["src/lib/v10-ui-state-contracts.ts", "src/components/ui/v10-recoverable-state.tsx"],
      gates: ["src/lib/v10-ui-state-contracts.v10.test.ts", "src/components/ui/v10-recoverable-state.test.tsx"],
      releaseEvidenceId: "v10-complete:route-state-matrix",
      failures: [
        ...validateV10RouteStateMatrix(),
        ...validateV10VisualRegressionStateContracts(V10_VISUAL_REGRESSION_STATE_CONTRACTS),
      ],
    }),
    row({
      domain: "objective_measurement",
      key: "objective_measurement_contracts",
      owner: "release",
      proofArtifacts: ["src/lib/v10-objective-measurements.ts", "scripts/check-v10-release-evidence.mjs"],
      gates: ["src/lib/v10-objective-measurements.v10.test.ts", "npm run check:v10-release-evidence"],
      releaseEvidenceId: "v10-complete:objective-measurement-contracts",
      failures: [
        ...validateV10RcFixtureManifestSet(V10_RC_FIXTURE_MANIFESTS),
        ...validateV10SyntheticMetricDescriptors(V10_SYNTHETIC_METRIC_DESCRIPTORS),
        ...validateV10RcMetricCapturePlans(V10_RC_METRIC_CAPTURE_PLANS),
        ...validateV10ObjectivePromotionEvidenceCapture(V10_OBJECTIVE_PROMOTION_EVIDENCE_CAPTURE),
        ...validateV10ObjectiveMetricCapturePaths(V10_OBJECTIVE_METRIC_CAPTURE_PATHS),
        ...requireCoverage(
          V10_OBJECTIVE_MEASUREMENT_RULES.map((item) => item.metricKey),
          Object.keys(V10_GA_SAMPLE_SIZES),
          "objective_metric_missing"
        ),
      ],
    }),
    row({
      domain: "release_evidence",
      key: "release_evidence_requirements",
      owner: "release",
      proofArtifacts: ["src/lib/v10-release-evidence.ts", "src/lib/v10-readiness-scorecard.ts"],
      gates: ["src/lib/v10-release-evidence.v10.test.ts", "src/lib/v10-readiness-scorecard.v10.test.ts"],
      releaseEvidenceId: "v10-complete:release-evidence-requirements",
      failures: [
        ...V10_GA_METRIC_EVIDENCE_REQUIREMENTS.flatMap((requirement) => [
          requirement.fixed_sample_size === V10_GA_SAMPLE_SIZES[requirement.metric_key]
            ? null
            : `${requirement.metric_key}:fixed_sample_size_mismatch`,
          requirement.release_check_kind ? null : `${requirement.metric_key}:release_check_kind_required`,
          requirement.locked_window ? null : `${requirement.metric_key}:locked_window_required`,
        ].filter((item): item is string => Boolean(item))),
        ...validateV10NonAutonomousEvidenceGateSet(V10_NON_AUTONOMOUS_EVIDENCE_GATES),
        ...validateV10OpsReleaseReadinessContracts(V10_OPS_RELEASE_READINESS_CONTRACTS),
        ...validateV10ProviderBoundaries(V10_PROVIDER_BOUNDARIES),
      ],
    }),
    row({
      domain: "no_exclusions",
      key: "no_exclusions_matrix",
      owner: "release",
      proofArtifacts: ["src/lib/v10-no-exclusions-matrix.ts"],
      gates: ["src/lib/v10-no-exclusions-matrix.v10.test.ts"],
      releaseEvidenceId: "v10-complete:no-exclusions-matrix",
      failures: [
        ...validateV10NoExclusionsMatrix(noExclusions),
        ...validateV10DeprecationCleanupDecisions({
          candidates: V10_DEPRECATION_CANDIDATES,
          decisions: V10_DEPRECATION_CLEANUP_DECISIONS,
          compatibilityBoundaries: V10_COMPATIBILITY_BOUNDARIES,
        }),
      ],
    }),
    row({
      domain: "job_notification_report_fixture",
      key: "job_notification_report_fixture_enums",
      owner: "operations",
      proofArtifacts: ["src/lib/v10-release-contract.ts", "src/lib/v10-final-gap-audit.ts"],
      gates: ["src/lib/v10-final-gap-audit.v10.test.ts"],
      releaseEvidenceId: "v10-complete:job-notification-report-fixture-enums",
      failures: [
        ...validateV10JobNotificationRuntimeContracts(),
        ...validateV10RcFixtureCategoryDescriptors(V10_RC_FIXTURE_CATEGORIES),
        ...requireCoverage(V10_JOB_CLASSES, V10_JOB_CLASSES, "job_class_missing"),
        ...requireCoverage(V10_NOTIFICATION_CLASSES, V10_NOTIFICATION_CLASSES, "notification_class_missing"),
        ...requireCoverage(V10_CORE_REPORT_FAMILIES, V10_CORE_REPORT_FAMILIES, "report_family_missing"),
        ...requireCoverage(V10_ACCEPTANCE_GATES, V10_ACCEPTANCE_GATES, "acceptance_gate_missing"),
        ...requireCoverage(
          Object.keys(V10_RELEASE_FIXTURE_MINIMUMS),
          Object.keys(V10_RELEASE_FIXTURE_MINIMUMS),
          "fixture_minimum_missing"
        ),
      ],
    }),
  ];

  for (const acceptance of acceptanceLedger) {
    rows.push(
      row({
        domain: "acceptance",
        key: acceptance.id,
        owner: "release",
        proofArtifacts: acceptance.proofArtifacts,
        gates: acceptance.executableGates,
        releaseEvidenceId: `v10-complete:acceptance:${acceptance.id}`,
        failures: [
          acceptance.openGap,
          acceptance.proofArtifacts.length === 0 ? "proof_artifact_required" : null,
          acceptance.executableGates.length === 0 ? "executable_gate_required" : null,
          acceptance.releaseEvidence.length === 0 ? "release_evidence_required" : null,
          acceptance.closureKind === "runtime_proof" && acceptance.runtimeStatus === "typed_contract_only"
            ? "runtime_proof_required"
            : null,
          acceptance.closureKind === "external_blocker" && !acceptance.blockerStatus.startsWith("blocked:")
            ? "external_blocker_status_required"
            : null,
        ].filter((item): item is string => Boolean(item)),
      })
    );
  }

  for (const sourceObject of sourceObjectMatrix) {
    const inventoryRow = V10_SOURCE_OBJECT_INVENTORY.find(
      (item) => item.sourceObjectType === sourceObject.sourceObjectType
    );
    rows.push(
      row({
        domain: "source_object",
        key: sourceObject.sourceObjectType,
        owner: sourceObject.auditCoverage === "external_blocker" ? "release" : "engineering",
        proofArtifacts: [
          "src/lib/v10-source-object-inventory.ts",
          "src/lib/v10-read-model-refresh.ts",
          ...(inventoryRow?.tests ?? []),
        ],
        gates: inventoryRow?.tests ?? ["src/lib/v10-source-object-inventory.v10.test.ts"],
        releaseEvidenceId: `v10-complete:${sourceObject.releaseEvidenceKey}`,
        failures: [
          sourceObject.primaryReadModel === "missing" ? "primary_read_model_required" : null,
          sourceObject.generatesWork && !sourceObject.workItemType ? "work_item_type_required" : null,
          sourceObject.commandSearchCoverage === "required" && !inventoryRow?.readModels.includes("command_search_index")
            ? "command_search_index_required"
            : null,
          sourceObject.auditCoverage === "runtime_audited" && (inventoryRow?.auditActions.length ?? 0) === 0
            ? "audit_action_required"
            : null,
          sourceObject.telemetryCoverage !== "objective_mapped" ? "telemetry_objective_required" : null,
          sourceObject.proofTests.length === 0 ? "proof_test_required" : null,
        ].filter((item): item is string => Boolean(item)),
      })
    );
  }

  for (const metric of V10_OBJECTIVE_MEASUREMENT_RULES) {
    const manifest = V10_RC_FIXTURE_MANIFESTS.find((item) => item.metricKey === metric.metricKey);
    const capturePlan = V10_RC_METRIC_CAPTURE_PLANS.find((item) => item.metricKey === metric.metricKey);
    const promotion = V10_OBJECTIVE_PROMOTION_EVIDENCE_CAPTURE.find((item) => item.metricKey === metric.metricKey);
    const capturePath = V10_OBJECTIVE_METRIC_CAPTURE_PATHS.find((item) => item.metricKey === metric.metricKey);
    rows.push(
      row({
        domain: "objective_measurement",
        key: metric.metricKey,
        owner: "release",
        proofArtifacts: [
          "src/lib/v10-objective-measurements.ts",
          "src/lib/v10-release-evidence.ts",
          "scripts/check-v10-release-evidence.mjs",
        ],
        gates: [
          "src/lib/v10-objective-measurements.v10.test.ts",
          capturePlan?.captureCommand ?? "npm run check:v10-release-evidence",
        ],
        releaseEvidenceId: `v10-complete:objective:${metric.metricKey}:${promotion?.releaseEvidenceId ?? "missing"}`,
        failures: [
          manifest ? null : "fixture_manifest_required",
          capturePlan ? null : "metric_capture_plan_required",
          promotion ? null : "promotion_evidence_required",
          capturePath ? null : "metric_capture_path_required",
          manifest && manifest.sampleSize !== metric.fixedSampleSize ? "fixture_sample_size_mismatch" : null,
          capturePlan && capturePlan.denominatorLockId !== `v10-rc:${metric.metricKey}:${metric.fixedSampleSize}`
            ? "denominator_lock_mismatch"
            : null,
          promotion && promotion.fixedSampleSize !== metric.fixedSampleSize ? "promotion_sample_size_mismatch" : null,
          metric.allowedExclusions.length === 0 ? "exclusion_policy_required" : null,
          metric.promotionThreshold <= 0 || metric.promotionThreshold > 1 ? "promotion_threshold_invalid" : null,
          !metric.window ? "measurement_window_required" : null,
        ].filter((item): item is string => Boolean(item)),
      })
    );
  }

  for (const runtime of V10_JOB_NOTIFICATION_RUNTIME_CONTRACTS) {
    rows.push(
      row({
        domain: "job_notification_report_fixture",
        key: `${runtime.kind}:${runtime.classKey}`,
        owner: "operations",
        proofArtifacts: ["src/lib/v10-job-visibility.ts", "src/lib/v10-read-model-refresh.ts"],
        gates: ["src/lib/v10-job-visibility.v10.test.ts", "src/lib/v10-read-model-refresh.v10.test.ts"],
        releaseEvidenceId: `v10-complete:${runtime.kind}:${runtime.classKey}`,
        failures: [
          runtime.diagnosticRequired ? null : "diagnostic_required",
          runtime.deepLinkRequired ? null : "deep_link_required",
          runtime.auditAction.includes(".") ? null : "audit_action_required",
          runtime.kind === "job" && runtime.visibilityModel !== "v10_job_run_visibility" ? "job_visibility_required" : null,
          runtime.kind === "notification" && runtime.visibilityModel !== "v10_notification_deliveries"
            ? "notification_visibility_required"
            : null,
          runtime.kind === "notification" && runtime.retryOrCancelPolicy !== "suppression_or_preference"
            ? "notification_preference_policy_required"
            : null,
        ].filter((item): item is string => Boolean(item)),
      })
    );
  }

  for (const fixture of V10_RC_FIXTURE_CATEGORIES) {
    rows.push(
      row({
        domain: "job_notification_report_fixture",
        key: `fixture:${fixture.category}`,
        owner: "release",
        proofArtifacts: ["src/lib/v10-objective-measurements.ts", "scripts/check-v10-release-evidence.mjs"],
        gates: ["src/lib/v10-objective-measurements.v10.test.ts", "npm run check:v10-privacy-scan"],
        releaseEvidenceId: `v10-complete:fixture:${fixture.category}`,
        failures: [
          fixture.sourceShape.trim() ? null : "source_shape_required",
          fixture.minimumRecords > 0 ? null : "minimum_records_required",
          fixture.generatedDataOnly ? null : "generated_data_only_required",
          fixture.privacyScanRequired ? null : "privacy_scan_required",
          fixture.resetBehavior ? null : "reset_behavior_required",
        ].filter((item): item is string => Boolean(item)),
      })
    );
  }

  for (const decision of V10_DEPRECATION_CLEANUP_DECISIONS) {
    const candidate = V10_DEPRECATION_CANDIDATES.find((item) => item.key === decision.candidateId);
    const boundary = V10_COMPATIBILITY_BOUNDARIES.find((item) => item.key === decision.compatibilityBoundaryKey);
    rows.push(
      row({
        domain: "no_exclusions",
        key: `legacy:${decision.candidateId}`,
        owner: "release",
        proofArtifacts: [
          "src/lib/v10-final-gap-audit.ts",
          candidate?.artifact ?? "src/lib/v10-final-gap-audit.ts",
          decision.runtimeReplacementProof,
          boundary?.owningArtifact ?? "src/lib/v10-final-gap-audit.ts",
        ],
        gates: ["src/lib/v10-final-gap-audit.v10.test.ts", decision.cleanupCommand],
        releaseEvidenceId: `v10-complete:${decision.releaseEvidenceId}`,
        failures: [
          candidate ? null : "deprecation_candidate_required",
          boundary ? null : "compatibility_boundary_required",
          decision.supersededBy.trim() ? null : "replacement_required",
          decision.runtimeReplacementProof.trim() ? null : "runtime_replacement_proof_required",
          decision.testsPreserved ? null : "tests_preserved_required",
          decision.cleanupCommand.startsWith("npm run ") ? null : "cleanup_command_required",
        ].filter((item): item is string => Boolean(item)),
      })
    );
  }

  for (const ops of V10_OPS_RELEASE_READINESS_CONTRACTS) {
    rows.push(
      row({
        domain: "release_evidence",
        key: `ops_dashboard:${ops.key}`,
        owner: ops.owner,
        proofArtifacts: [
          "src/lib/v10-operational-contracts.ts",
          "src/app/(dashboard)/settings/health/page.tsx",
          ops.cronRoute ?? "src/lib/v10-readiness-scorecard.ts",
        ],
        gates: ["src/lib/v10-operational-contracts.v10.test.ts", ops.rollbackCommand],
        releaseEvidenceId: `v10-complete:${ops.releaseEvidenceKey}`,
        failures: [
          ops.diagnosticPrefix.startsWith("v10_") ? null : "diagnostic_prefix_required",
          ops.retentionDays > 0 ? null : "retention_required",
          ops.sloDashboardKey ? null : "slo_dashboard_required",
          ops.rollbackCommand.trim() ? null : "rollback_command_required",
          ops.recoveryDestination.startsWith("/settings/health") ? null : "settings_health_recovery_required",
          ops.releaseEvidenceKey.startsWith("ops:") ? null : "release_evidence_key_required",
        ].filter((item): item is string => Boolean(item)),
      })
    );
  }

  for (const provider of V10_PROVIDER_BOUNDARIES) {
    rows.push(
      row({
        domain: "release_evidence",
        key: `provider:${provider.provider}`,
        owner: "operations",
        proofArtifacts: ["src/lib/v10-operational-contracts.ts", "src/app/(dashboard)/settings/health/page.tsx"],
        gates: ["src/lib/v10-operational-contracts.v10.test.ts", "npm run check:v10-release-evidence -- --external-blockers"],
        releaseEvidenceId: `v10-complete:provider:${provider.provider}`,
        failures: [
          provider.requiredServerEnv.length > 0 ? null : "required_server_env_required",
          provider.outageState.trim() ? null : "outage_state_required",
          provider.privacyBoundary ? null : "privacy_boundary_required",
          provider.publicEnvAllowed.every((key) => key.startsWith("NEXT_PUBLIC_")) ? null : "public_env_boundary_required",
        ].filter((item): item is string => Boolean(item)),
      })
    );
  }

  for (const mutation of V10_REQUIRED_MUTATION_CONTRACTS) {
    rows.push(
      row({
        domain: "mutation",
        key: mutation.key,
        owner: "engineering",
        proofArtifacts: [mutation.runtimeArtifact, "src/lib/v10-mutation-envelope.ts"],
        gates: ["src/lib/v10-semantics.v10.test.ts"],
        releaseEvidenceId: `v10-complete:mutation:${mutation.key}`,
        failures: [
          mutation.requiresIdempotency ? null : `${mutation.key}:idempotency_required`,
          mutation.requiresAudit ? null : `${mutation.key}:audit_required`,
          mutation.runtimeArtifact ? null : `${mutation.key}:runtime_artifact_required`,
          mutation.auditAction.includes(".") ? null : `${mutation.key}:audit_action_required`,
        ].filter((item): item is string => Boolean(item)),
      })
    );
  }

  for (const route of routeInventory) {
    const runtimeArtifact = getV10RouteRuntimeArtifact(route.path);
    const testArtifact = getV10RouteTestArtifact(route.path);
    const routeState = route.responseSchema === "page_html"
      ? V10_ROUTE_STATE_MATRIX.find((entry) => entry.route === route.path)
      : null;
    rows.push(
      row({
        domain: "route",
        key: `${route.path}:${route.methods.join("+")}`,
        owner: route.surface === "settings" ? "security" : route.surface === "reports" || route.surface === "exports" ? "release" : "engineering",
        proofArtifacts: ["src/lib/v10-route-api-catalog.ts", runtimeArtifact, testArtifact],
        gates: [testArtifact, "src/lib/v10-route-api-catalog.v10.test.ts"],
        releaseEvidenceId: `v10-complete:route:${route.path}:${route.methods.join("+")}`,
        failures: [
          route.path.startsWith("/") ? null : `${route.path}:absolute_path_required`,
          route.privateCacheRequired ? null : `${route.path}:private_cache_required`,
          route.methods.length > 0 ? null : `${route.path}:method_required`,
          route.minimumMode && route.minimumRole && route.minimumPlan ? null : `${route.path}:eligibility_metadata_required`,
          route.cachePolicy === "private_no_store" ? null : `${route.path}:private_no_store_required`,
          route.diagnosticPrefix.startsWith("v10_") ? null : `${route.path}:diagnostic_prefix_required`,
          route.responseSchema === "page_html" && !routeState ? `${route.path}:route_state_matrix_required` : null,
          routeState && routeState.accessibilityAssertions.length === 0 ? `${route.path}:accessibility_assertion_required` : null,
          routeState && routeState.responsiveProfiles.length === 0 ? `${route.path}:responsive_profile_required` : null,
          routeState && !routeState.performanceBudgetKind ? `${route.path}:performance_budget_required` : null,
          route.idempotencyRequired && !route.auditRequired ? `${route.path}:idempotency_requires_audit` : null,
        ].filter((item): item is string => Boolean(item)),
      })
    );
  }

  for (const state of V10_UI_STATE_CONTRACTS) {
    rows.push(
      row({
        domain: "ui_state",
        key: state.state,
        owner: "product",
        proofArtifacts: ["src/lib/v10-ui-state-contracts.ts", "src/components/ui/v10-recoverable-state.tsx"],
        gates: ["src/lib/v10-ui-state-contracts.v10.test.ts", "src/components/ui/v10-recoverable-state.test.tsx"],
        releaseEvidenceId: `v10-complete:ui-state:${state.state}`,
        failures: [
          V10_ROUTE_STATE_MATRIX.some((entry) => entry.requiredStates.includes(state.state))
            ? null
            : `${state.state}:route_state_uncovered`,
          state.requiresAccessibleName ? null : `${state.state}:accessible_name_required`,
          state.requiresNextActionOrExplanation ? null : `${state.state}:next_action_or_explanation_required`,
        ].filter((item): item is string => Boolean(item)),
      })
    );
  }

  return rows;
}

export function buildV10CompleteClosureReport(generatedAt = new Date().toISOString()): V10CompleteClosureReport {
  const rows = buildV10CompleteClosureRows();
  const openRows = rows.filter((item) => item.status === "open");
  const failures = openRows.flatMap((item) => item.failures.map((failure) => `${item.domain}:${item.key}:${failure}`));
  return {
    generatedAt,
    status: failures.length === 0 ? "closed" : "open",
    rows,
    openRows,
    failures,
    counts: domainCounts(rows),
  };
}

export function validateV10CompleteClosureReport(
  report: V10CompleteClosureReport = buildV10CompleteClosureReport()
): string[] {
  const failures: string[] = [];
  if (!report.generatedAt.trim()) failures.push("generated_at_required");
  if (report.rows.length === 0) failures.push("closure_rows_required");
  if (report.openRows.length !== report.rows.filter((item) => item.status === "open").length) {
    failures.push("open_row_count_mismatch");
  }
  for (const domain of Object.keys(report.counts) as V10CompleteClosureDomain[]) {
    if (report.counts[domain] <= 0) failures.push(`domain_missing:${domain}`);
  }
  for (const item of report.rows) {
    if (!item.key.trim()) failures.push(`${item.domain}:key_required`);
    if (item.proofArtifacts.length === 0) failures.push(`${item.domain}:${item.key}:proof_artifact_required`);
    if (item.gates.length === 0) failures.push(`${item.domain}:${item.key}:gate_required`);
    if (!item.releaseEvidenceId.startsWith("v10-complete:")) {
      failures.push(`${item.domain}:${item.key}:release_evidence_key_required`);
    }
    if (item.status === "closed" && item.failures.length > 0) {
      failures.push(`${item.domain}:${item.key}:closed_with_failures`);
    }
    if (item.status === "open" && item.failures.length === 0) {
      failures.push(`${item.domain}:${item.key}:open_without_failure`);
    }
  }
  return failures;
}
