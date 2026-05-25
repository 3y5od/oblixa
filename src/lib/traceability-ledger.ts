import { PRODUCT_TELEMETRY_ACTIONS } from "./product-telemetry";
import { V10_ACCEPTANCE_MATRIX, getV10AcceptanceProof } from "./acceptance-matrix";
import {
  V10_ACCEPTANCE_GATES,
  V10_CORE_REPORT_FAMILIES,
  V10_MUTATION_CATALOG,
  V10_RELEASE_FIXTURE_MINIMUMS,
  V10_RELEASE_PRIORITY_TIERS,
} from "./release-contract";
import { V10_REQUIRED_READ_MODEL_KEYS } from "./read-models";
import { V10_ROUTE_API_CATALOG } from "./route-api-catalog";
import { V10_SPEC_TRACE } from "./spec-trace-map";

export type V10ImplementationStatus =
  | "implemented"
  | "codified"
  | "externally_verified"
  | "requires_release_candidate";

export type V10TraceabilityLedgerRow = {
  id: string;
  priority: "P0" | "P1" | "P2";
  artifact: "constant" | "helper" | "catalog" | "script" | "test" | "release_evidence";
  status: V10ImplementationStatus;
  automatedProof: string;
  releaseEvidence: string;
};

export type V10RuntimeCoverageKind =
  | "spec_section"
  | "acceptance_gate"
  | "route"
  | "mutation"
  | "read_model"
  | "telemetry_event"
  | "audit_action"
  | "fixture"
  | "report_family"
  | "job_class"
  | "notification_class"
  | "non_autonomous_blocker";

export type V10RuntimeCoverageStatus =
  | "runtime_backed"
  | "contract_only"
  | "release_check_required"
  | "environment_gated"
  | "external_blocker";

export type V10RuntimeCoverageLedgerRow = {
  coverageKey: string;
  coverageKind: V10RuntimeCoverageKind;
  priority: "P0" | "P1" | "P2" | "release_blocker";
  owner: "product" | "engineering" | "security" | "support" | "release";
  sourceArtifact: string;
  authorizationRule: string;
  dataClassification: "public_metadata" | "support_safe" | "customer_private" | "synthetic_release_evidence";
  runtimeStatus: V10RuntimeCoverageStatus;
  testProof: string;
  releaseEvidence: string;
  rollbackPath: string;
  freshness: "fresh" | "stale" | "partial" | "failed" | "missing" | "unknown";
  residualRisk: string;
};

export type V10QueryableCoverageLedgerRow = V10RuntimeCoverageLedgerRow & {
  sourceKey: string;
  queryKey: string;
};

export type V10DocRuntimeProofRow = {
  specSection: string;
  queryKey: string;
  codeArtifacts: readonly string[];
  testArtifacts: readonly string[];
  acceptanceIds: readonly string[];
  ciChecks: readonly string[];
  releaseEvidence: readonly string[];
};

const LEDGER_IDS = [
  "p1-p2-continuity",
  "mutation-rollout",
  "release-fixtures",
  "route-api-map",
  "ui-state-a11y",
  "objective-telemetry",
  "failure-recovery",
  "traceability-ledger",
  "ci-verification",
  "source-taxonomy",
  "db-rls-contracts",
  "edge-case-matrix",
  "rollout-ratchets",
  "e2e-release-harness",
  "diagnostics-observability",
  "state-machines",
  "api-contracts",
  "seed-backfill",
  "client-server-boundaries",
  "consistency-reconciliation",
  "test-tiering",
  "contract-versioning",
  "instrumentation-catalog",
  "selector-artifact-hygiene",
  "type-enforcement",
  "release-readiness-scorecard",
  "journey-coverage",
  "query-performance",
  "synthetic-monitoring",
  "runtime-ownership",
  "integration-boundaries",
  "tenant-provenance",
  "release-runbooks",
  "retention-compliance",
  "resumability-recovery",
  "data-integrity",
  "route-state-matrix",
  "concurrency-locking",
  "cache-storage-files",
  "plan-limit-enforcement",
  "threat-modeling",
  "change-control",
  "ai-extraction-safety",
  "rate-limit-incidents",
  "compliance-exports",
  "artifact-acceptance-contracts",
  "post-release-ops",
  "naming-placement",
  "review-packaging",
  "proof-mapping",
  "risk-decisions",
  "env-prerequisites",
  "data-quality-depth",
  "count-formula-ownership",
  "filters-saved-views",
  "import-row-depth",
  "audit-query-depth",
  "test-oracles",
  "self-explanation",
  "preference-confirmation",
  "metadata-i18n-lineage",
  "dependency-lifecycle",
  "stakeholder-readiness",
  "existing-gate-reuse",
  "command-risk-map",
  "sla-calendars",
  "generated-work-rules",
  "degradation-chaos",
  "source-of-truth",
  "mocks-thresholds",
  "external-responder-privacy",
  "vocabulary-copy-catalog",
  "strictness-modes",
  "evidence-dependencies",
  "requirement-ids",
  "invariant-generation",
  "adversarial-property-tests",
  "persona-workspace-coverage",
  "reconciliation-jobs",
  "api-snapshots",
  "notification-dedupe",
  "error-budget-audit-immutability",
  "search-index-freshness",
  "http-cache-policy",
  "component-contracts",
] as const;

const P0_LEDGER_IDS = new Set<(typeof LEDGER_IDS)[number]>([
  "p1-p2-continuity",
  "mutation-rollout",
  "route-api-map",
  "ui-state-a11y",
  "objective-telemetry",
  "failure-recovery",
  "traceability-ledger",
  "ci-verification",
  "source-taxonomy",
  "db-rls-contracts",
  "state-machines",
  "api-contracts",
  "source-of-truth",
  "http-cache-policy",
  "component-contracts",
]);

const P2_LEDGER_IDS = new Set<(typeof LEDGER_IDS)[number]>([
  "review-packaging",
  "risk-decisions",
  "env-prerequisites",
  "stakeholder-readiness",
  "command-risk-map",
  "sla-calendars",
  "degradation-chaos",
  "mocks-thresholds",
  "strictness-modes",
  "evidence-dependencies",
  "adversarial-property-tests",
  "persona-workspace-coverage",
]);

const RELEASE_CANDIDATE_LEDGER_IDS = new Set<(typeof LEDGER_IDS)[number]>([
  "release-fixtures",
  "e2e-release-harness",
  "synthetic-monitoring",
  "release-runbooks",
  "stakeholder-readiness",
  "evidence-dependencies",
]);

const EXTERNAL_LEDGER_IDS = new Set<(typeof LEDGER_IDS)[number]>([
  "post-release-ops",
  "stakeholder-readiness",
  "env-prerequisites",
]);

function getLedgerPriority(id: (typeof LEDGER_IDS)[number]): V10TraceabilityLedgerRow["priority"] {
  if (P0_LEDGER_IDS.has(id)) return "P0";
  if (P2_LEDGER_IDS.has(id)) return "P2";
  return "P1";
}

function getLedgerArtifact(id: (typeof LEDGER_IDS)[number]): V10TraceabilityLedgerRow["artifact"] {
  if (id.includes("script") || id.includes("command")) return "script";
  if (id.includes("test") || id.includes("oracle") || id.includes("invariant")) return "test";
  if (id.includes("evidence") || id.includes("readiness") || id.includes("risk")) return "release_evidence";
  if (id.includes("helper") || id.includes("state") || id.includes("formula")) return "helper";
  if (id.includes("constant") || id.includes("vocabulary")) return "constant";
  return "catalog";
}

function getLedgerStatus(id: (typeof LEDGER_IDS)[number]): V10ImplementationStatus {
  if (EXTERNAL_LEDGER_IDS.has(id)) return "externally_verified";
  if (RELEASE_CANDIDATE_LEDGER_IDS.has(id)) return "requires_release_candidate";
  if (P0_LEDGER_IDS.has(id)) return "implemented";
  return "codified";
}

function getLedgerAutomatedProof(id: (typeof LEDGER_IDS)[number]): string {
  if (id.includes("db") || id.includes("rls")) return "npm run check:migrations && src/lib/data-contracts.test.ts";
  if (id.includes("route") || id.includes("api") || id.includes("http-cache")) return "src/lib/route-api-catalog.test.ts";
  if (id.includes("ui") || id.includes("component")) return "src/lib/ui-state-contracts.test.ts";
  if (id.includes("readiness") || id.includes("evidence") || id.includes("risk")) return "src/lib/release-evidence.test.ts";
  if (id.includes("traceability") || id.includes("proof")) return "src/lib/traceability-ledger.test.ts";
  if (id.includes("command") || id.includes("search")) return "src/components/layout/command-palette.ui.test.tsx";
  return "npm run check:release-suite-current";
}

function getLedgerReleaseEvidence(id: (typeof LEDGER_IDS)[number], status: V10ImplementationStatus): string {
  if (status === "externally_verified") return "external release-owner evidence required";
  if (status === "requires_release_candidate") return "release-candidate fixture or metric evidence required";
  if (id.includes("evidence")) return "release evidence schema and blocker record";
  return "automated local proof plus release ledger review";
}

export const V10_TRACEABILITY_LEDGER: readonly V10TraceabilityLedgerRow[] = LEDGER_IDS.map((id) => {
  const status = getLedgerStatus(id);
  return {
    id,
    priority: getLedgerPriority(id),
    artifact: getLedgerArtifact(id),
    status,
    automatedProof: getLedgerAutomatedProof(id),
    releaseEvidence: getLedgerReleaseEvidence(id, status),
  };
});

export function getV10TraceabilityLedgerRow(id: string): V10TraceabilityLedgerRow | null {
  return V10_TRACEABILITY_LEDGER.find((row) => row.id === id) ?? null;
}

export function summarizeV10TraceabilityByStatus(
  rows: readonly V10TraceabilityLedgerRow[] = V10_TRACEABILITY_LEDGER
): Record<V10ImplementationStatus, number> {
  const summary: Record<V10ImplementationStatus, number> = {
    implemented: 0,
    codified: 0,
    externally_verified: 0,
    requires_release_candidate: 0,
  };
  for (const row of rows) summary[row.status] += 1;
  return summary;
}

function runtimeStatusForLedgerStatus(status: V10ImplementationStatus): V10RuntimeCoverageStatus {
  if (status === "implemented") return "runtime_backed";
  if (status === "requires_release_candidate") return "release_check_required";
  if (status === "externally_verified") return "external_blocker";
  return "contract_only";
}

function ownerForLedgerRow(row: V10TraceabilityLedgerRow): V10RuntimeCoverageLedgerRow["owner"] {
  if (row.id.includes("security") || row.id.includes("privacy") || row.id.includes("tenant") || row.id.includes("threat")) {
    return "security";
  }
  if (row.id.includes("support") || row.id.includes("diagnostic") || row.id.includes("incident")) return "support";
  if (row.artifact === "release_evidence" || row.status === "requires_release_candidate" || row.status === "externally_verified") {
    return "release";
  }
  if (row.id.includes("ui") || row.id.includes("journey") || row.id.includes("copy") || row.id.includes("preference")) {
    return "product";
  }
  return "engineering";
}

function coverageKindForLedgerRow(row: V10TraceabilityLedgerRow): V10RuntimeCoverageKind {
  if (row.id.includes("route") || row.id.includes("api") || row.id.includes("http-cache")) return "route";
  if (row.id.includes("mutation") || row.id.includes("idempotency")) return "mutation";
  if (row.id.includes("read") || row.id.includes("reconciliation") || row.id.includes("lineage")) return "read_model";
  if (row.id.includes("telemetry") || row.id.includes("instrumentation")) return "telemetry_event";
  if (row.id.includes("audit")) return "audit_action";
  if (row.id.includes("fixture") || row.id.includes("seed")) return "fixture";
  if (row.id.includes("report")) return "report_family";
  if (row.id.includes("job") || row.id.includes("cron")) return "job_class";
  if (row.id.includes("notification")) return "notification_class";
  if (row.status === "externally_verified") return "non_autonomous_blocker";
  return "acceptance_gate";
}

export const V10_RUNTIME_COVERAGE_LEDGER: readonly V10RuntimeCoverageLedgerRow[] = V10_TRACEABILITY_LEDGER.map((row) => ({
  coverageKey: row.id,
  coverageKind: coverageKindForLedgerRow(row),
  priority: row.status === "externally_verified" ? "release_blocker" : row.priority,
  owner: ownerForLedgerRow(row),
  sourceArtifact: row.automatedProof,
  authorizationRule: row.id.includes("tenant") || row.id.includes("route") || row.id.includes("api")
    ? "organization_membership_and_feature_eligibility"
    : "service_role_writes_member_safe_reads",
  dataClassification: row.artifact === "release_evidence" ? "synthetic_release_evidence" : "support_safe",
  runtimeStatus: runtimeStatusForLedgerStatus(row.status),
  testProof: row.automatedProof,
  releaseEvidence: row.releaseEvidence,
  rollbackPath: row.id.includes("rollout") || row.id.includes("rollback")
    ? "src/lib/mutation-rollout.ts"
    : "scripts/check-release-suite-current.mjs",
  freshness: row.status === "implemented" ? "fresh" : row.status === "codified" ? "unknown" : "missing",
  residualRisk: row.status === "implemented" ? "none_known" : row.releaseEvidence,
}));

export function getV10RuntimeCoverageLedgerRow(
  coverageKey: string,
  rows: readonly V10RuntimeCoverageLedgerRow[] = V10_RUNTIME_COVERAGE_LEDGER
): V10RuntimeCoverageLedgerRow | null {
  return rows.find((row) => row.coverageKey === coverageKey) ?? null;
}

export function validateV10RuntimeCoverageLedger(
  rows: readonly V10RuntimeCoverageLedgerRow[] = V10_RUNTIME_COVERAGE_LEDGER
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.coverageKind}:${row.coverageKey}`;
    if (seen.has(key)) failures.push(`duplicate:${key}`);
    seen.add(key);
    if (!row.sourceArtifact.trim()) failures.push(`missing_source:${key}`);
    if (!row.authorizationRule.trim()) failures.push(`missing_authz:${key}`);
    if (!row.testProof.trim()) failures.push(`missing_test:${key}`);
    if (!row.releaseEvidence.trim()) failures.push(`missing_release_evidence:${key}`);
    if (!row.rollbackPath.trim()) failures.push(`missing_rollback:${key}`);
    if (row.runtimeStatus === "external_blocker" && row.priority !== "release_blocker") {
      failures.push(`external_not_blocking:${key}`);
    }
    if (row.runtimeStatus === "runtime_backed" && row.freshness !== "fresh") {
      failures.push(`runtime_backed_not_fresh:${key}`);
    }
  }
  return failures;
}

function buildQueryableCoverageRow(input: {
  coverageKind: V10RuntimeCoverageKind;
  coverageKey: string;
  priority?: V10QueryableCoverageLedgerRow["priority"];
  owner?: V10QueryableCoverageLedgerRow["owner"];
  sourceArtifact: string;
  authorizationRule?: string;
  dataClassification?: V10QueryableCoverageLedgerRow["dataClassification"];
  sourceKey?: string;
}): V10QueryableCoverageLedgerRow {
  return {
    coverageKey: input.coverageKey,
    coverageKind: input.coverageKind,
    priority: input.priority ?? "P1",
    owner: input.owner ?? "engineering",
    sourceArtifact: input.sourceArtifact,
    authorizationRule: input.authorizationRule ?? "organization_membership_and_feature_eligibility",
    dataClassification: input.dataClassification ?? "support_safe",
    runtimeStatus: "runtime_backed",
    testProof: input.sourceArtifact,
    releaseEvidence: "queryable_v10_runtime_coverage_ledger",
    rollbackPath: "scripts/check-release-suite-current.mjs",
    freshness: "fresh",
    residualRisk: "none_known",
    sourceKey: input.sourceKey ?? input.coverageKey,
    queryKey: `${input.coverageKind}:${input.coverageKey}`,
  };
}

export function buildV10QueryableCoverageLedger(): V10QueryableCoverageLedgerRow[] {
  const rows: V10QueryableCoverageLedgerRow[] = [];
  for (const [section, artifacts] of Object.entries(V10_SPEC_TRACE)) {
    rows.push(
      buildQueryableCoverageRow({
        coverageKind: "spec_section",
        coverageKey: section,
        sourceArtifact: artifacts.join(","),
        sourceKey: `spec:${section}`,
      })
    );
  }
  for (const gate of V10_ACCEPTANCE_GATES) {
    rows.push(buildQueryableCoverageRow({ coverageKind: "acceptance_gate", coverageKey: gate, sourceArtifact: "src/lib/acceptance-matrix.ts" }));
  }
  for (const [priority, keys] of Object.entries(V10_RELEASE_PRIORITY_TIERS) as Array<["P0" | "P1" | "P2", readonly string[]]>) {
    for (const key of keys) {
      rows.push(
        buildQueryableCoverageRow({
          coverageKind: "acceptance_gate",
          coverageKey: `release_priority:${key}`,
          priority,
          owner: "product",
          sourceArtifact: "src/lib/release-contract.ts",
        })
      );
    }
  }
  for (const route of V10_ROUTE_API_CATALOG) {
    rows.push(
      buildQueryableCoverageRow({
        coverageKind: "route",
        coverageKey: `${route.path}:${route.methods.join(",")}`,
        priority: route.surface === "advanced" || route.surface === "assurance" ? "P1" : "P0",
        sourceArtifact: "src/lib/route-api-catalog.ts",
      })
    );
  }
  for (const mutation of V10_MUTATION_CATALOG) {
    rows.push(
      buildQueryableCoverageRow({
        coverageKind: "mutation",
        coverageKey: mutation.name,
        priority: "P0",
        sourceArtifact: "src/lib/mutation-rollout.ts",
      })
    );
    rows.push(
      buildQueryableCoverageRow({
        coverageKind: "audit_action",
        coverageKey: mutation.auditAction,
        priority: "P0",
        owner: "security",
        dataClassification: "support_safe",
        sourceArtifact: "src/lib/release-contract.ts",
      })
    );
  }
  for (const key of V10_REQUIRED_READ_MODEL_KEYS) {
    rows.push(buildQueryableCoverageRow({ coverageKind: "read_model", coverageKey: key, priority: "P0", sourceArtifact: "src/lib/read-models.ts" }));
  }
  for (const action of PRODUCT_TELEMETRY_ACTIONS.filter((action) => action.startsWith("product.v10."))) {
    rows.push(
      buildQueryableCoverageRow({
        coverageKind: "telemetry_event",
        coverageKey: action,
        sourceArtifact: "src/lib/product-telemetry.ts",
        dataClassification: "support_safe",
      })
    );
  }
  for (const fixture of Object.keys(V10_RELEASE_FIXTURE_MINIMUMS)) {
    rows.push(
      buildQueryableCoverageRow({
        coverageKind: "fixture",
        coverageKey: fixture,
        priority: "P0",
        owner: "release",
        dataClassification: "synthetic_release_evidence",
        sourceArtifact: "src/lib/release-contract.ts",
      })
    );
  }
  for (const family of V10_CORE_REPORT_FAMILIES) {
    rows.push(buildQueryableCoverageRow({ coverageKind: "report_family", coverageKey: family, sourceArtifact: "src/lib/report-export.ts" }));
  }
  return rows;
}

export const V10_QUERYABLE_COVERAGE_LEDGER: readonly V10QueryableCoverageLedgerRow[] = buildV10QueryableCoverageLedger();

export function validateV10TraceabilityClosure(
  rows: readonly V10QueryableCoverageLedgerRow[] = V10_QUERYABLE_COVERAGE_LEDGER
): string[] {
  const failures = validateV10RuntimeCoverageLedger(rows);
  const seen = new Set<string>();
  const requiredKinds: readonly V10RuntimeCoverageKind[] = [
    "spec_section",
    "acceptance_gate",
    "route",
    "mutation",
    "read_model",
    "telemetry_event",
    "audit_action",
    "fixture",
    "report_family",
  ];
  for (const row of rows) {
    if (seen.has(row.queryKey)) failures.push(`duplicate_query_key:${row.queryKey}`);
    seen.add(row.queryKey);
    if (row.queryKey !== `${row.coverageKind}:${row.coverageKey}`) failures.push(`query_key_mismatch:${row.queryKey}`);
    if (!row.sourceKey.trim()) failures.push(`missing_source_key:${row.queryKey}`);
  }
  for (const kind of requiredKinds) {
    if (!rows.some((row) => row.coverageKind === kind)) failures.push(`missing_coverage_kind:${kind}`);
  }
  return failures;
}

export function buildV10DocRuntimeProofRows(): V10DocRuntimeProofRow[] {
  return Object.entries(V10_SPEC_TRACE).map(([specSection, artifacts]) => {
    const linkedAcceptance = V10_ACCEPTANCE_MATRIX.filter((row) => {
      const proof = getV10AcceptanceProof(row);
      return proof.docSpecSections.includes(specSection) || row.artifacts.some((artifact) => artifacts.includes(artifact));
    });
    return {
      specSection,
      queryKey: `spec_section:${specSection}`,
      codeArtifacts: artifacts.filter((artifact) => !artifact.endsWith(".test.ts") && !artifact.endsWith(".test.tsx")),
      testArtifacts: artifacts.filter((artifact) => artifact.endsWith(".test.ts") || artifact.endsWith(".test.tsx")),
      acceptanceIds: linkedAcceptance.map((row) => row.id),
      ciChecks: [...new Set(linkedAcceptance.flatMap((row) => getV10AcceptanceProof(row).verificationCommands))],
      releaseEvidence: [...new Set(linkedAcceptance.flatMap((row) => getV10AcceptanceProof(row).releaseEvidence))],
    };
  });
}

export function validateV10DocRuntimeProofRows(rows: readonly V10DocRuntimeProofRow[] = buildV10DocRuntimeProofRows()): string[] {
  const failures: string[] = [];
  const queryableKeys = new Set(V10_QUERYABLE_COVERAGE_LEDGER.map((row) => row.queryKey));
  for (const row of rows) {
    if (!queryableKeys.has(row.queryKey)) failures.push(`${row.specSection}:queryable_ledger_missing`);
    if (row.codeArtifacts.length === 0) failures.push(`${row.specSection}:code_artifact_required`);
    if (row.testArtifacts.length === 0) failures.push(`${row.specSection}:test_artifact_required`);
    if (row.acceptanceIds.length === 0) failures.push(`${row.specSection}:acceptance_id_required`);
    if (row.ciChecks.length === 0) failures.push(`${row.specSection}:ci_check_required`);
    if (row.releaseEvidence.length === 0) failures.push(`${row.specSection}:release_evidence_required`);
  }
  return failures;
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { buildV10DocRuntimeProofRows as buildDocRuntimeProofRows };
export { buildV10QueryableCoverageLedger as buildQueryableCoverageLedger };
export { getV10RuntimeCoverageLedgerRow as getRuntimeCoverageLedgerRow };
export { getV10TraceabilityLedgerRow as getTraceabilityLedgerRow };
export { summarizeV10TraceabilityByStatus as summarizeTraceabilityByStatus };
export { V10_QUERYABLE_COVERAGE_LEDGER as QUERYABLE_COVERAGE_LEDGER };
export { V10_RUNTIME_COVERAGE_LEDGER as RUNTIME_COVERAGE_LEDGER };
export { V10_TRACEABILITY_LEDGER as TRACEABILITY_LEDGER };
export { validateV10DocRuntimeProofRows as validateDocRuntimeProofRows };
export { validateV10RuntimeCoverageLedger as validateRuntimeCoverageLedger };
export { validateV10TraceabilityClosure as validateTraceabilityClosure };
export type { V10DocRuntimeProofRow as DocRuntimeProofRow };
export type { V10ImplementationStatus as ImplementationStatus };
export type { V10QueryableCoverageLedgerRow as QueryableCoverageLedgerRow };
export type { V10RuntimeCoverageKind as RuntimeCoverageKind };
export type { V10RuntimeCoverageLedgerRow as RuntimeCoverageLedgerRow };
export type { V10RuntimeCoverageStatus as RuntimeCoverageStatus };
export type { V10TraceabilityLedgerRow as TraceabilityLedgerRow };
// End version-name compatibility aliases.
