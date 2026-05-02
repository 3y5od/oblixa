import {
  V10_ACCEPTANCE_GATES,
  V10_CORE_REPORT_FAMILIES,
  V10_GA_SAMPLE_SIZES,
  V10_JOB_CLASSES,
  V10_NAVIGATION_FAMILIES,
  V10_NOTIFICATION_CLASSES,
  V10_RELEASE_FIXTURE_MINIMUMS,
  V10_SOURCE_OBJECT_TYPES,
  type V10AcceptanceGate,
} from "./v10-release-contract";
import { PRODUCT_TELEMETRY_ACTIONS } from "./product-telemetry";
import { V10_NON_AUTONOMOUS_EVIDENCE_GATES } from "./v10-release-evidence";
import { V10_ACCEPTANCE_MATRIX } from "./v10-acceptance-matrix";
import { V10_REQUIRED_MUTATION_CONTRACTS } from "./v10-mutation-envelope";
import { V10_REQUIRED_READ_MODEL_KEYS } from "./v10-read-models";
import {
  V10_ROUTE_API_CATALOG,
  getV10RouteRuntimeArtifact,
  getV10RouteTestArtifact,
} from "./v10-route-api-catalog";
import { V10_SOURCE_OBJECT_INVENTORY } from "./v10-source-object-inventory";
import { V10_SPEC_TRACE } from "./v10-spec-trace-map";
import { V10_UI_STATE_CONTRACTS } from "./v10-ui-state-contracts";
import {
  V10_AUDIT_VOCABULARY_TAXONOMY,
  V10_COMPATIBILITY_BOUNDARIES,
  V10_SOURCE_INVENTORY,
} from "./v10-final-gap-audit";
import { V10_OPS_RELEASE_READINESS_CONTRACTS, V10_PROVIDER_BOUNDARIES } from "./v10-operational-contracts";

export type V10NoExclusionsCoverageKind =
  | "spec_section"
  | "inventory_file"
  | "source_object"
  | "navigation_family"
  | "mutation"
  | "route"
  | "read_model"
  | "job_class"
  | "notification_class"
  | "report_family"
  | "recoverable_state"
  | "acceptance_gate"
  | "compatibility_boundary"
  | "objective_metric"
  | "fixture"
  | "external_evidence_gate"
  | "provider_boundary"
  | "ops_release_readiness"
  | "telemetry_event"
  | "audit_action"
  | "ci_release_gate";

export type V10NoExclusionsCoverageStatus =
  | "runtime_backed"
  | "automated_gate"
  | "release_evidence_required"
  | "environment_gated"
  | "non_autonomous_blocker";

export type V10NoExclusionsDimension =
  | "database_or_source"
  | "read_model"
  | "route_or_action"
  | "authorization"
  | "idempotency"
  | "audit"
  | "telemetry"
  | "privacy"
  | "recoverable_ui"
  | "work_visibility"
  | "command_search"
  | "fixture"
  | "test"
  | "release_evidence"
  | "compatibility"
  | "operations"
  | "provider_boundary"
  | "environment"
  | "support";

export type V10NoExclusionsMatrixRow = {
  coverageKey: string;
  coverageKind: V10NoExclusionsCoverageKind;
  priority: "P0" | "P1" | "P2" | "release_blocker";
  status: V10NoExclusionsCoverageStatus;
  owner: "product" | "engineering" | "security" | "support" | "release" | "operations";
  dimensions: readonly V10NoExclusionsDimension[];
  sourceArtifacts: readonly string[];
  testArtifacts: readonly string[];
  releaseEvidenceKey: string;
  residualRisk: string | null;
};

const NAVIGATION_FAMILY_ARTIFACTS: Record<(typeof V10_NAVIGATION_FAMILIES)[number], string> = {
  Home: "src/app/(dashboard)/dashboard/page.tsx",
  Contracts: "src/app/(dashboard)/contracts/page.tsx",
  Review: "src/app/(dashboard)/contracts/review/page.tsx",
  Work: "src/app/(dashboard)/work/page.tsx",
  Renewals: "src/app/(dashboard)/contracts/renewals/page.tsx",
  Exceptions: "src/app/(dashboard)/contracts/exceptions/page.tsx",
  Evidence: "src/app/(dashboard)/contracts/evidence-studio/page.tsx",
  Reports: "src/app/(dashboard)/contracts/reports/page.tsx",
  Settings: "src/app/(dashboard)/settings/health/page.tsx",
  Advanced: "src/lib/v10-advanced-assurance-continuity.ts",
  Assurance: "src/lib/v10-advanced-assurance-continuity.ts",
};

const V10_ACCEPTANCE_GATE_ACCEPTANCE_IDS: Record<V10AcceptanceGate, readonly string[]> = {
  activation: ["activation-intake"],
  work: ["unified-work", "journey-contracts"],
  contract_record: ["contract-record"],
  review_data_quality: ["review-provenance-quality", "data-quality-remediation-loop"],
  renewal: ["renewals-critical-dates"],
  evidence: ["evidence-obligations-collaboration"],
  approval_exception: ["approvals-decisions-exceptions"],
  search: ["complete-search-router"],
  reporting: ["reports-exports-reviews", "report-export-redaction"],
  workspace_governance: ["governance-health-reliability"],
  reliability: ["governance-health-reliability", "rollout-backfill-recovery", "concurrency-cache-time"],
  security_privacy: ["security-privacy-data", "authorization-data-classification", "privacy-lifecycle-requests", "tenant-isolation-proof"],
  accessibility: ["accessibility-performance-responsive", "route-state-a11y-performance", "browser-device-support"],
  performance: ["accessibility-performance-responsive", "api-pagination-filtering", "deterministic-ordering-contracts"],
  data_contract: ["fix-runtime-migration", "read-model-foundation", "database-constraint-index-budget", "data-lineage-invariants"],
  objective_measurement: ["telemetry-objectives", "fixture-measurement-gates", "measurement-governance"],
};

const V10_REQUIRED_CI_RELEASE_COMMANDS = [
  "npm run check:v10-suite",
  "npm run check:v10-inventory-lock",
  "npm run check:v10-release-evidence",
  "npm run check:v10-migration-smoke",
  "npm run check:v10-privacy-scan",
  "npm run check:v10-complete-closure",
  "npm run check:v10-zero-exclusion-report",
  "npm run test:e2e:v10",
  "npm run lint",
  "npm run typecheck",
] as const;

const V10_PRODUCT_TELEMETRY_ACTIONS = PRODUCT_TELEMETRY_ACTIONS.filter((action) =>
  action.startsWith("product.v10.")
);

function acceptanceGatePriority(gate: V10AcceptanceGate): V10NoExclusionsMatrixRow["priority"] {
  return gate === "objective_measurement" ? "release_blocker" : "P0";
}

function sourceObjectDimensions(row: (typeof V10_SOURCE_OBJECT_INVENTORY)[number]): V10NoExclusionsDimension[] {
  const dimensions: V10NoExclusionsDimension[] = [
    "database_or_source",
    "read_model",
    "authorization",
    "audit",
    "telemetry",
    "test",
    "release_evidence",
  ];
  if (row.workItemType) dimensions.push("work_visibility");
  if (row.commandSearch !== "not_applicable") dimensions.push("command_search");
  if (row.organizationScope === "external_token_scoped") dimensions.push("compatibility");
  return dimensions;
}

function sourceObjectStatus(row: (typeof V10_SOURCE_OBJECT_INVENTORY)[number]): V10NoExclusionsCoverageStatus {
  if (row.autonomousStatus === "external_evidence") return "release_evidence_required";
  if (row.autonomousStatus === "typed_contract") return "automated_gate";
  return "runtime_backed";
}

function routeDimensions(row: (typeof V10_ROUTE_API_CATALOG)[number]): V10NoExclusionsDimension[] {
  const dimensions: V10NoExclusionsDimension[] = [
    "route_or_action",
    "authorization",
    "recoverable_ui",
    "test",
    "release_evidence",
  ];
  if (row.idempotencyRequired) dimensions.push("idempotency");
  if (row.auditRequired) dimensions.push("audit");
  return dimensions;
}

function inventoryFileStatus(row: (typeof V10_SOURCE_INVENTORY)[number]): V10NoExclusionsCoverageStatus {
  if (row.runtimeStatus === "external_blocker") return "non_autonomous_blocker";
  if (row.runtimeStatus === "contract_only") return "automated_gate";
  return "runtime_backed";
}

function normalizeNoExclusionsOwner(owner: string): V10NoExclusionsMatrixRow["owner"] {
  if (owner === "product" || owner === "engineering" || owner === "security" || owner === "support" || owner === "release" || owner === "operations") {
    return owner;
  }
  return "release";
}

export function buildV10NoExclusionsMatrix(): V10NoExclusionsMatrixRow[] {
  const rows: V10NoExclusionsMatrixRow[] = [];

  for (const [section, artifacts] of Object.entries(V10_SPEC_TRACE)) {
    rows.push({
      coverageKey: `spec_section:${section}`,
      coverageKind: "spec_section",
      priority: section.startsWith("6.") || section === "8" ? "release_blocker" : "P0",
      status: "automated_gate",
      owner: "product",
      dimensions: ["test", "release_evidence", "compatibility"],
      sourceArtifacts: ["docs/v10.md", ...artifacts],
      testArtifacts: artifacts.filter((artifact) => artifact.endsWith(".test.ts") || artifact.endsWith(".test.tsx") || artifact.startsWith("e2e/")),
      releaseEvidenceKey: `v10-release:spec-section:${section.replace(/\./g, "_")}`,
      residualRisk: null,
    });
  }

  for (const row of V10_SOURCE_INVENTORY) {
    rows.push({
      coverageKey: `inventory_file:${row.category}:${row.key}`,
      coverageKind: "inventory_file",
      priority: row.runtimeStatus === "external_blocker" ? "release_blocker" : "P1",
      status: inventoryFileStatus(row),
      owner: row.owner,
      dimensions: ["test", "release_evidence", "operations"],
      sourceArtifacts: [row.artifact],
      testArtifacts: row.testStatus === "release_check" ? ["src/lib/v10-release-evidence.v10.test.ts"] : ["src/lib/v10-final-gap-audit.v10.test.ts"],
      releaseEvidenceKey: `v10-release:inventory-file:${row.category}:${row.key}`,
      residualRisk:
        row.runtimeStatus === "external_blocker"
          ? `${row.category}:${row.key} requires promoted release evidence before completion.`
          : null,
    });
  }

  for (const row of V10_SOURCE_OBJECT_INVENTORY) {
    rows.push({
      coverageKey: `source_object:${row.sourceObjectType}`,
      coverageKind: "source_object",
      priority: row.minimumMode === "core" ? "P0" : row.minimumMode === "advanced" || row.minimumMode === "assurance" ? "P1" : "P2",
      status: sourceObjectStatus(row),
      owner: row.autonomousStatus === "external_evidence" ? "release" : "engineering",
      dimensions: sourceObjectDimensions(row),
      sourceArtifacts: [row.sourceTable, ...row.readModels.map((model) => `v10_${model}`)],
      testArtifacts: row.tests,
      releaseEvidenceKey: `v10-release:source-object:${row.sourceObjectType}`,
      residualRisk: row.autonomousStatus === "external_evidence" ? "External evidence must be promoted before GA." : null,
    });
  }

  for (const family of V10_NAVIGATION_FAMILIES) {
    rows.push({
      coverageKey: `navigation:${family.toLowerCase()}`,
      coverageKind: "navigation_family",
      priority: family === "Advanced" || family === "Assurance" ? "P1" : "P0",
      status: "runtime_backed",
      owner: "product",
      dimensions: ["route_or_action", "authorization", "recoverable_ui", "telemetry", "test", "release_evidence"],
      sourceArtifacts: [NAVIGATION_FAMILY_ARTIFACTS[family]],
      testArtifacts: ["e2e/v10-core-smoke.spec.ts", "src/lib/v10-ui-state-contracts.v10.test.ts"],
      releaseEvidenceKey: `v10-release:navigation:${family.toLowerCase()}`,
      residualRisk: null,
    });
  }

  for (const mutation of V10_REQUIRED_MUTATION_CONTRACTS) {
    rows.push({
      coverageKey: `mutation:${mutation.key}`,
      coverageKind: "mutation",
      priority: "P0",
      status: "runtime_backed",
      owner: "engineering",
      dimensions: [
        "route_or_action",
        "authorization",
        ...(mutation.requiresIdempotency ? (["idempotency"] as const) : []),
        ...(mutation.requiresAudit ? (["audit"] as const) : []),
        "telemetry",
        "test",
        "release_evidence",
      ],
      sourceArtifacts: [mutation.runtimeArtifact],
      testArtifacts: ["src/lib/v10-semantics.v10.test.ts", "src/lib/v10-route-api-catalog.v10.test.ts"],
      releaseEvidenceKey: `v10-release:mutation:${mutation.key}`,
      residualRisk: null,
    });
  }

  for (const route of V10_ROUTE_API_CATALOG) {
    const runtimeArtifact = getV10RouteRuntimeArtifact(route.path);
    rows.push({
      coverageKey: `route:${route.path}:${route.methods.join("+")}`,
      coverageKind: "route",
      priority: route.surface === "advanced" || route.surface === "assurance" ? "P1" : "P0",
      status: "runtime_backed",
      owner: "engineering",
      dimensions: routeDimensions(route),
      sourceArtifacts: ["src/lib/v10-route-api-catalog.ts", runtimeArtifact],
      testArtifacts: ["src/lib/v10-route-api-catalog.v10.test.ts", getV10RouteTestArtifact(route.path)],
      releaseEvidenceKey: `v10-release:route:${route.path.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
      residualRisk: null,
    });
  }

  for (const modelKey of V10_REQUIRED_READ_MODEL_KEYS) {
    rows.push({
      coverageKey: `read_model:${modelKey}`,
      coverageKind: "read_model",
      priority: "P0",
      status: "automated_gate",
      owner: "engineering",
      dimensions: ["database_or_source", "read_model", "authorization", "test", "release_evidence", "operations"],
      sourceArtifacts: ["src/lib/v10-read-models.ts", "src/lib/v10-read-model-refresh.ts"],
      testArtifacts: ["src/lib/v10-data-contracts.v10.test.ts", "src/lib/v10-read-model-refresh.v10.test.ts"],
      releaseEvidenceKey: `v10-release:read-model:${modelKey}`,
      residualRisk: null,
    });
  }

  for (const jobClass of V10_JOB_CLASSES) {
    rows.push({
      coverageKey: `job_class:${jobClass}`,
      coverageKind: "job_class",
      priority: jobClass === "billing_sync" ? "release_blocker" : "P0",
      status: jobClass === "billing_sync" ? "release_evidence_required" : "runtime_backed",
      owner: "operations",
      dimensions: ["database_or_source", "read_model", "recoverable_ui", "telemetry", "test", "release_evidence", "operations"],
      sourceArtifacts: ["src/lib/v10-job-visibility.ts", "src/lib/v10-read-model-refresh.ts"],
      testArtifacts: ["src/lib/v10-read-model-refresh.v10.test.ts", "src/lib/v10-operational-contracts.v10.test.ts"],
      releaseEvidenceKey: `v10-release:job-class:${jobClass}`,
      residualRisk: jobClass === "billing_sync" ? "Billing sync requires provider/release evidence." : null,
    });
  }

  for (const notificationClass of V10_NOTIFICATION_CLASSES) {
    rows.push({
      coverageKey: `notification_class:${notificationClass}`,
      coverageKind: "notification_class",
      priority: "P0",
      status: "runtime_backed",
      owner: "operations",
      dimensions: ["database_or_source", "read_model", "authorization", "audit", "telemetry", "test", "release_evidence", "operations"],
      sourceArtifacts: ["src/lib/v10-read-model-refresh.ts"],
      testArtifacts: ["src/lib/v10-read-model-refresh.v10.test.ts", "src/lib/v10-operational-contracts.v10.test.ts"],
      releaseEvidenceKey: `v10-release:notification-class:${notificationClass}`,
      residualRisk: null,
    });
  }

  for (const reportFamily of V10_CORE_REPORT_FAMILIES) {
    rows.push({
      coverageKey: `report_family:${reportFamily}`,
      coverageKind: "report_family",
      priority: "P0",
      status: "runtime_backed",
      owner: "operations",
      dimensions: ["database_or_source", "route_or_action", "audit", "telemetry", "fixture", "test", "release_evidence"],
      sourceArtifacts: ["src/lib/v10-report-export.ts", "src/lib/v10-read-model-refresh.ts"],
      testArtifacts: ["src/lib/v10-report-export.v10.test.ts", "src/lib/v10-read-model-refresh.v10.test.ts"],
      releaseEvidenceKey: `v10-release:report-family:${reportFamily}`,
      residualRisk: null,
    });
  }

  for (const state of V10_UI_STATE_CONTRACTS) {
    rows.push({
      coverageKey: `recoverable_state:${state.state}`,
      coverageKind: "recoverable_state",
      priority: "P0",
      status: "automated_gate",
      owner: "product",
      dimensions: ["recoverable_ui", "test", "release_evidence"],
      sourceArtifacts: ["src/components/ui/v10-recoverable-state.tsx", "src/lib/v10-ui-state-contracts.ts"],
      testArtifacts: ["src/components/ui/v10-recoverable-state.test.tsx", "src/lib/v10-ui-state-contracts.v10.test.ts"],
      releaseEvidenceKey: `v10-release:recoverable-state:${state.state}`,
      residualRisk: null,
    });
  }

  for (const gate of V10_ACCEPTANCE_GATES) {
    const scopedAcceptanceIds = V10_ACCEPTANCE_GATE_ACCEPTANCE_IDS[gate];
    const acceptanceRows = V10_ACCEPTANCE_MATRIX.filter((row) => scopedAcceptanceIds.includes(row.id));
    rows.push({
      coverageKey: `acceptance_gate:${gate}`,
      coverageKind: "acceptance_gate",
      priority: acceptanceGatePriority(gate),
      status: gate === "objective_measurement" ? "release_evidence_required" : "automated_gate",
      owner: gate === "objective_measurement" ? "release" : "engineering",
      dimensions: ["test", "release_evidence", "operations"],
      sourceArtifacts: ["src/lib/v10-acceptance-matrix.ts"],
      testArtifacts: ["src/lib/v10-acceptance-matrix.v10.test.ts"],
      releaseEvidenceKey: `v10-release:acceptance-gate:${gate}`,
      residualRisk:
        gate === "objective_measurement"
          ? "Objective measurements require release-candidate capture and promoted evidence."
          : acceptanceRows.length === 0
            ? "Acceptance matrix rows are required."
            : null,
    });
  }

  for (const row of V10_COMPATIBILITY_BOUNDARIES) {
    rows.push({
      coverageKey: `compatibility:${row.key}`,
      coverageKind: "compatibility_boundary",
      priority: "release_blocker",
      status: "automated_gate",
      owner: "release",
      dimensions: ["compatibility", "test", "release_evidence", "operations"],
      sourceArtifacts: [row.owningArtifact],
      testArtifacts: ["src/lib/v10-final-gap-audit.v10.test.ts"],
      releaseEvidenceKey: `v10-release:compatibility:${row.key}`,
      residualRisk: null,
    });
  }

  for (const metricKey of Object.keys(V10_GA_SAMPLE_SIZES)) {
    rows.push({
      coverageKey: `objective_metric:${metricKey}`,
      coverageKind: "objective_metric",
      priority: "release_blocker",
      status: "release_evidence_required",
      owner: "release",
      dimensions: ["telemetry", "fixture", "test", "release_evidence", "operations"],
      sourceArtifacts: ["src/lib/v10-objective-measurements.ts", "src/lib/v10-objective-telemetry.ts", "scripts/check-v10-release-evidence.mjs"],
      testArtifacts: ["src/lib/v10-objective-measurements.v10.test.ts", "src/lib/v10-objective-telemetry.v10.test.ts", "src/lib/v10-release-evidence.v10.test.ts"],
      releaseEvidenceKey: `v10-release:objective-metric:${metricKey}`,
      residualRisk: "Objective metric requires denominator-locked release-candidate evidence capture before promotion.",
    });
  }

  for (const fixtureKey of Object.keys(V10_RELEASE_FIXTURE_MINIMUMS)) {
    rows.push({
      coverageKey: `fixture:${fixtureKey}`,
      coverageKind: "fixture",
      priority: "release_blocker",
      status: "release_evidence_required",
      owner: "release",
      dimensions: ["database_or_source", "fixture", "test", "release_evidence", "operations"],
      sourceArtifacts: ["src/lib/v10-release-contract.ts", "scripts/check-v10-suite.mjs"],
      testArtifacts: ["src/lib/v10-release-evidence.v10.test.ts"],
      releaseEvidenceKey: `v10-release:fixture:${fixtureKey}`,
      residualRisk: "Fixture minimum must be seeded, locked, captured, and torn down in a release-candidate workspace.",
    });
  }

  for (const gate of V10_NON_AUTONOMOUS_EVIDENCE_GATES) {
    rows.push({
      coverageKey: `external_evidence_gate:${gate.key}`,
      coverageKind: "external_evidence_gate",
      priority: "release_blocker",
      status: "non_autonomous_blocker",
      owner: normalizeNoExclusionsOwner(gate.owner),
      dimensions: ["test", "release_evidence", "operations"],
      sourceArtifacts: ["src/lib/v10-release-evidence.ts"],
      testArtifacts: ["src/lib/v10-release-evidence.v10.test.ts"],
      releaseEvidenceKey: `v10-release:external-evidence-gate:${gate.key}`,
      residualRisk: gate.blocker_reason,
    });
  }

  for (const boundary of V10_PROVIDER_BOUNDARIES) {
    rows.push({
      coverageKey: `provider_boundary:${boundary.provider}`,
      coverageKind: "provider_boundary",
      priority: boundary.releaseBlockerWhenMissing ? "release_blocker" : "P1",
      status: boundary.releaseBlockerWhenMissing ? "release_evidence_required" : "automated_gate",
      owner: "operations",
      dimensions: ["provider_boundary", "environment", "authorization", "test", "release_evidence", "operations"],
      sourceArtifacts: ["src/lib/v10-operational-contracts.ts"],
      testArtifacts: ["src/lib/v10-operational-contracts.v10.test.ts"],
      releaseEvidenceKey: `v10-release:provider-boundary:${boundary.provider}`,
      residualRisk: boundary.releaseBlockerWhenMissing
        ? `${boundary.provider} provider readiness must be proven without leaking private data.`
        : null,
    });
  }

  for (const contract of V10_OPS_RELEASE_READINESS_CONTRACTS) {
    rows.push({
      coverageKey: `ops_release_readiness:${contract.key}`,
      coverageKind: "ops_release_readiness",
      priority: "release_blocker",
      status: "release_evidence_required",
      owner: contract.owner === "engineering" ? "engineering" : contract.owner,
      dimensions: ["operations", "support", "provider_boundary", "test", "release_evidence"],
      sourceArtifacts: [
        "src/lib/v10-operational-contracts.ts",
        ...(contract.cronRoute ? [contract.cronRoute] : []),
      ],
      testArtifacts: ["src/lib/v10-operational-contracts.v10.test.ts"],
      releaseEvidenceKey: `v10-release:ops-readiness:${contract.key}`,
      residualRisk: `${contract.key} requires operational evidence, recovery destination, and provider readiness before promotion.`,
    });
  }

  for (const action of V10_PRODUCT_TELEMETRY_ACTIONS) {
    rows.push({
      coverageKey: `telemetry_event:${action}`,
      coverageKind: "telemetry_event",
      priority: "P0",
      status: "automated_gate",
      owner: "product",
      dimensions: ["telemetry", "test", "release_evidence"],
      sourceArtifacts: ["src/lib/product-telemetry.ts", "src/lib/v10-objective-telemetry.ts"],
      testArtifacts: ["src/lib/product-telemetry.v10.test.ts", "src/lib/v10-objective-telemetry.v10.test.ts"],
      releaseEvidenceKey: `v10-release:telemetry-event:${action.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
      residualRisk: null,
    });
  }

  for (const audit of V10_AUDIT_VOCABULARY_TAXONOMY) {
    rows.push({
      coverageKey: `audit_action:${audit.action}`,
      coverageKind: "audit_action",
      priority: "P0",
      status: "automated_gate",
      owner: "security",
      dimensions: ["audit", "test", "release_evidence", "privacy"],
      sourceArtifacts: ["src/lib/v10-final-gap-audit.ts", "src/lib/v10-status-action-vocabulary.ts"],
      testArtifacts: ["src/lib/v10-final-gap-audit.v10.test.ts", "src/lib/v10-status-action-vocabulary.v10.test.ts"],
      releaseEvidenceKey: `v10-release:audit-action:${audit.action.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
      residualRisk: null,
    });
  }

  for (const command of V10_REQUIRED_CI_RELEASE_COMMANDS) {
    rows.push({
      coverageKey: `ci_release_gate:${command}`,
      coverageKind: "ci_release_gate",
      priority: "release_blocker",
      status: command.includes("e2e") ? "release_evidence_required" : "automated_gate",
      owner: "release",
      dimensions: ["test", "release_evidence", "operations"],
      sourceArtifacts: ["package.json", ".github/workflows/ci.yml", "scripts/check-v10-suite.mjs"],
      testArtifacts: ["src/lib/v10-release-evidence.v10.test.ts", "src/lib/v10-final-gap-audit.v10.test.ts"],
      releaseEvidenceKey: `v10-release:ci-release-gate:${command.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
      residualRisk: command.includes("e2e") ? "Browser evidence requires an authenticated release-candidate run." : null,
    });
  }

  return rows;
}

export function validateV10NoExclusionsMatrix(
  rows: readonly V10NoExclusionsMatrixRow[] = buildV10NoExclusionsMatrix()
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.coverageKey)) failures.push(`duplicate_coverage_key:${row.coverageKey}`);
    seen.add(row.coverageKey);
    if (row.dimensions.length === 0) failures.push(`${row.coverageKey}:dimension_required`);
    if (row.sourceArtifacts.length === 0) failures.push(`${row.coverageKey}:source_artifact_required`);
    if (row.testArtifacts.length === 0) failures.push(`${row.coverageKey}:test_artifact_required`);
    if (!row.releaseEvidenceKey.startsWith("v10-release:")) failures.push(`${row.coverageKey}:release_evidence_key_required`);
    if (row.status === "release_evidence_required" && !row.residualRisk) {
      failures.push(`${row.coverageKey}:release_evidence_risk_required`);
    }
    if (row.coverageKind === "mutation" && !row.dimensions.includes("route_or_action")) {
      failures.push(`${row.coverageKey}:mutation_route_or_action_required`);
    }
    if (row.coverageKind === "route" && !row.dimensions.includes("authorization")) {
      failures.push(`${row.coverageKey}:route_authorization_required`);
    }
    if (row.coverageKind === "route" && !row.sourceArtifacts.some((artifact) => artifact.startsWith("src/app/"))) {
      failures.push(`${row.coverageKey}:route_runtime_artifact_required`);
    }
    if (row.coverageKind === "read_model" && !row.dimensions.includes("read_model")) {
      failures.push(`${row.coverageKey}:read_model_dimension_required`);
    }
    if (row.coverageKind === "objective_metric" && (!row.dimensions.includes("telemetry") || !row.dimensions.includes("fixture"))) {
      failures.push(`${row.coverageKey}:objective_metric_telemetry_fixture_required`);
    }
    if (row.coverageKind === "fixture" && !row.dimensions.includes("fixture")) {
      failures.push(`${row.coverageKey}:fixture_dimension_required`);
    }
    if (row.coverageKind === "external_evidence_gate" && !row.dimensions.includes("release_evidence")) {
      failures.push(`${row.coverageKey}:external_evidence_release_evidence_required`);
    }
    if (row.coverageKind === "provider_boundary" && !row.dimensions.includes("environment")) {
      failures.push(`${row.coverageKey}:provider_environment_required`);
    }
    if (row.coverageKind === "ops_release_readiness" && !row.dimensions.includes("operations")) {
      failures.push(`${row.coverageKey}:ops_release_readiness_operations_required`);
    }
  }

  const requireKeys = (kind: V10NoExclusionsCoverageKind, keys: readonly string[]) => {
    for (const key of keys) {
      if (!seen.has(`${kind}:${key}`)) failures.push(`missing_${kind}:${key}`);
    }
  };

  requireKeys("spec_section", Object.keys(V10_SPEC_TRACE));
  for (const row of V10_SOURCE_INVENTORY) {
    if (!seen.has(`inventory_file:${row.category}:${row.key}`)) {
      failures.push(`missing_inventory_file:${row.category}:${row.key}`);
    }
  }
  requireKeys("source_object", V10_SOURCE_OBJECT_TYPES);
  requireKeys("read_model", V10_REQUIRED_READ_MODEL_KEYS);
  requireKeys("job_class", V10_JOB_CLASSES);
  requireKeys("notification_class", V10_NOTIFICATION_CLASSES);
  requireKeys("report_family", V10_CORE_REPORT_FAMILIES);
  requireKeys("acceptance_gate", V10_ACCEPTANCE_GATES);
  for (const family of V10_NAVIGATION_FAMILIES) {
    if (!seen.has(`navigation:${family.toLowerCase()}`)) failures.push(`missing_navigation_family:${family}`);
  }
  for (const mutation of V10_REQUIRED_MUTATION_CONTRACTS) {
    if (!seen.has(`mutation:${mutation.key}`)) failures.push(`missing_mutation:${mutation.key}`);
  }
  for (const state of V10_UI_STATE_CONTRACTS) {
    if (!seen.has(`recoverable_state:${state.state}`)) failures.push(`missing_recoverable_state:${state.state}`);
  }
  for (const boundary of V10_COMPATIBILITY_BOUNDARIES) {
    if (!seen.has(`compatibility:${boundary.key}`)) failures.push(`missing_compatibility_boundary:${boundary.key}`);
  }
  for (const route of V10_ROUTE_API_CATALOG) {
    const key = `route:${route.path}:${route.methods.join("+")}`;
    if (!seen.has(key)) failures.push(`missing_route:${route.path}:${route.methods.join("+")}`);
  }
  for (const metricKey of Object.keys(V10_GA_SAMPLE_SIZES)) {
    if (!seen.has(`objective_metric:${metricKey}`)) failures.push(`missing_objective_metric:${metricKey}`);
  }
  for (const fixtureKey of Object.keys(V10_RELEASE_FIXTURE_MINIMUMS)) {
    if (!seen.has(`fixture:${fixtureKey}`)) failures.push(`missing_fixture:${fixtureKey}`);
  }
  for (const gate of V10_NON_AUTONOMOUS_EVIDENCE_GATES) {
    if (!seen.has(`external_evidence_gate:${gate.key}`)) failures.push(`missing_external_evidence_gate:${gate.key}`);
  }
  for (const boundary of V10_PROVIDER_BOUNDARIES) {
    if (!seen.has(`provider_boundary:${boundary.provider}`)) failures.push(`missing_provider_boundary:${boundary.provider}`);
  }
  for (const contract of V10_OPS_RELEASE_READINESS_CONTRACTS) {
    if (!seen.has(`ops_release_readiness:${contract.key}`)) {
      failures.push(`missing_ops_release_readiness:${contract.key}`);
    }
  }
  for (const action of V10_PRODUCT_TELEMETRY_ACTIONS) {
    if (!seen.has(`telemetry_event:${action}`)) failures.push(`missing_telemetry_event:${action}`);
  }
  for (const audit of V10_AUDIT_VOCABULARY_TAXONOMY) {
    if (!seen.has(`audit_action:${audit.action}`)) failures.push(`missing_audit_action:${audit.action}`);
  }
  for (const command of V10_REQUIRED_CI_RELEASE_COMMANDS) {
    if (!seen.has(`ci_release_gate:${command}`)) failures.push(`missing_ci_release_gate:${command}`);
  }

  return failures;
}
