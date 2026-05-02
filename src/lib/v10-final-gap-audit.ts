import {
  V10_CORE_REPORT_FAMILIES,
  V10_JOB_CLASSES,
  V10_JOB_STATUSES,
  V10_NOTIFICATION_CLASSES,
  V10_SOURCE_OBJECT_TYPES,
  V10_WORK_ACTIONS,
  V10_WORK_ITEM_TYPES,
  type V10JobStatus,
} from "./v10-release-contract";
import {
  V10_ACCEPTANCE_MATRIX,
  getV10AcceptanceProof,
  type V10AcceptanceRuntimeStatus,
} from "./v10-acceptance-matrix";
import { V10_IMPLEMENTATION_REQUIREMENTS } from "./v10-implementation-checklist";
import { V10_REQUIRED_MUTATION_CONTRACTS } from "./v10-mutation-envelope";
import { V10_ROUTE_API_CATALOG } from "./v10-route-api-catalog";
import { V10_SOURCE_OBJECT_INVENTORY } from "./v10-source-object-inventory";

export type V10ProofKind =
  | "shipped_behavior"
  | "typed_contract"
  | "automated_gate"
  | "release_evidence"
  | "environment_gated"
  | "non_autonomous_blocker";

export type V10PlanTodoProof = {
  planTodoId: string;
  proofKind: V10ProofKind;
  owner: "engineering" | "product" | "security" | "support" | "release" | "operations";
  artifacts: readonly string[];
  blocker: string | null;
};

export type V10WorkSourceActionContract = {
  workItemType: (typeof V10_WORK_ITEM_TYPES)[number];
  sourceTable: string;
  sourceObjectType: (typeof V10_SOURCE_OBJECT_TYPES)[number];
  primaryAction: (typeof V10_WORK_ACTIONS)[number];
  auditAction: string;
  refreshArtifact: string;
};

export type V10JobClassContract = {
  jobClass: (typeof V10_JOB_CLASSES)[number];
  sourceTable: string;
  visibilityModel: "v10_job_run_visibility" | "v10_report_run_visibility" | "release_evidence";
  retryableStatuses: readonly V10JobStatus[];
  terminalStatuses: readonly V10JobStatus[];
  diagnosticPrefix: string;
};

export type V10CommandQuerySample = {
  id: string;
  query: string;
  expectedRecordType:
    | "contract"
    | "work_item"
    | "obligation"
    | "approval"
    | "evidence_request"
    | "report_run"
    | "saved_view"
    | "setting"
    | "exception"
    | "renewal_checkpoint"
    | "import_job"
    | "export_job"
    | "account"
    | "counterparty"
    | "finding";
  expectedBehavior: "exact_or_prefix_match" | "alias_match" | "recovery_zero_result" | "hidden_record_non_leakage";
  proofArtifact: string;
};

export type V10AuditVocabularyContract = {
  action: string;
  targetType: (typeof V10_SOURCE_OBJECT_TYPES)[number];
  outcomeRequired: boolean;
  diagnosticRequiredOnFailure: boolean;
  safeMetadataOnly: boolean;
};

export type V10SourceInventoryEntry = {
  category:
    | "page"
    | "component"
    | "api_route"
    | "api_contract"
    | "server_action"
    | "cron"
    | "database_table"
    | "migration"
    | "read_model"
    | "telemetry_event"
    | "audit_action"
    | "report_family"
    | "job_class"
    | "notification_class"
    | "release_artifact"
    | "script"
    | "ci_workflow"
    | "semgrep_rule"
    | "fixture"
    | "external_evidence_gate"
    | "runbook"
    | "environment_config"
    | "support_boundary"
    | "verification_matrix";
  key: string;
  artifact: string;
  owner: "engineering" | "product" | "operations" | "security" | "release" | "support";
  runtimeStatus: "implemented" | "contract_only" | "external_blocker";
  testStatus: "unit" | "api" | "ui" | "e2e" | "release_check";
};

export type V10MasterPlanTodoId =
  | "phase-0-inventory-lock"
  | "phase-0-baseline"
  | "phase-1-read-models"
  | "phase-2-security"
  | "phase-3-mutations"
  | "phase-4-core-surfaces"
  | "phase-5-domain-workflows"
  | "phase-6-routing-reporting"
  | "phase-7-ops-governance"
  | "phase-8-p1-p2"
  | "phase-9-ui-quality"
  | "phase-10-release"
  | "phase-11-post-ga-drift"
  | "phase-12-api-env-integrations"
  | "phase-13-data-lifecycle-compliance"
  | "phase-14-verification-matrix"
  | "foundation-schema-types"
  | "foundation-mutations"
  | "foundation-refresh"
  | "foundation-security-privacy"
  | "artifact-definition-of-done"
  | "migration-rollout-safety"
  | "core-work-home-contracts"
  | "core-domain-workflows"
  | "cmdk-reports-jobs-telemetry"
  | "p1-p2-continuity"
  | "tests-ci-release"
  | "objective-measurement"
  | "deprecation-cleanup"
  | "ops-support-release";

export type V10AttachedPlanTodoId =
  | "phase-0-proof-ledger"
  | "phase-1-db-contracts"
  | "phase-2-read-models"
  | "phase-3-mutations"
  | "phase-4-api-routes"
  | "phase-5-surfaces"
  | "phase-6-contract-record"
  | "phase-7-domains"
  | "phase-8-p1-p2"
  | "phase-9-security-telemetry"
  | "phase-10-ci-evidence"
  | "phase-11-cleanup"
  | "phase-12-release-env"
  | "phase-13-objective-metrics"
  | "phase-14-ops-support"
  | "phase-15-data-lifecycle"
  | "phase-16-quality-matrix"
  | "phase-17-final-cutover"
  | "baseline-gap-ledger"
  | "source-object-closure"
  | "route-surface-closure"
  | "data-runtime"
  | "read-models"
  | "mutation-layer"
  | "core-routes-actions"
  | "cron-ops"
  | "product-surfaces"
  | "p1-p2-continuity"
  | "telemetry-evidence"
  | "security-privacy-abuse"
  | "performance-accessibility"
  | "rc-fixtures-measurement"
  | "data-lifecycle-compliance"
  | "integrations-environment"
  | "tests-ci-release"
  | "cleanup-handoff";

export type V10ProofDimension =
  | "runtime_behavior"
  | "functional_coverage"
  | "data_contract"
  | "api_contract"
  | "authorization"
  | "audit"
  | "idempotency"
  | "read_model_freshness"
  | "telemetry"
  | "privacy"
  | "recoverable_ui"
  | "accessibility"
  | "performance"
  | "fixture_or_e2e"
  | "release_evidence"
  | "operations"
  | "environment_config"
  | "integration_boundary"
  | "data_lifecycle"
  | "support_boundary"
  | "compatibility"
  | "post_ga_drift"
  | "verification_matrix";

export type V10FrozenImplementationMatrixRow = {
  todoId: V10MasterPlanTodoId;
  requiredDimensions: readonly V10ProofDimension[];
  primaryArtifacts: readonly string[];
  acceptanceIds: readonly string[];
  blockerPolicy: "must_be_runtime_backed" | "external_evidence_allowed" | "cleanup_after_replacement";
};

export type V10FileOwnershipArea =
  | "spec"
  | "database"
  | "read_models"
  | "mutations"
  | "api"
  | "server_actions"
  | "dashboard_surfaces"
  | "components"
  | "telemetry"
  | "audit"
  | "testing"
  | "fixtures"
  | "ci_scripts"
  | "security"
  | "release"
  | "operations"
  | "environment"
  | "integrations"
  | "support"
  | "compliance"
  | "runbooks"
  | "verification";

export type V10FileOwnershipRow = {
  area: V10FileOwnershipArea;
  pathPrefix: string;
  owner: "engineering" | "product" | "security" | "support" | "release" | "operations";
  requiredProof: readonly V10ProofDimension[];
};

export type V10ClaimVsProofRow = {
  id: string;
  claim: "shipped" | "automated_gate" | "release_evidence" | "environment_gated" | "non_autonomous_blocker";
  runtimeStatus: V10AcceptanceRuntimeStatus;
  proofState: "runtime_backed" | "static_or_contract_only" | "release_evidence_required" | "external_blocker";
  artifacts: readonly string[];
  gates: readonly string[];
  failingGap: string | null;
};

export type V10DeprecationCandidate = {
  key: string;
  category: "duplicate_queue" | "legacy_audit" | "v9_label" | "placeholder_gate" | "descriptor_fixture" | "duplicate_e2e" | "metadata_only_claim";
  artifact: string;
  replacement: string;
  removalGate: V10MasterPlanTodoId;
};

export type V10DeprecationCleanupDecision = {
  candidateKey: string;
  action: "retire" | "quarantine" | "preserve_boundary";
  supersededBy: string;
  runtimeReplacementProof: string;
  releaseEvidenceKey: string;
  compatibilityBoundaryKey: string;
  testsPreserved: boolean;
  cleanupCommand: string;
};

export type V10CompatibilityBoundary = {
  key: string;
  boundary:
    | "public_url"
    | "external_link"
    | "artifact"
    | "report_export_format"
    | "audit_action"
    | "telemetry_event"
    | "migration_version"
    | "stable_command"
    | "persisted_data"
    | "api_schema"
    | "cache_policy"
    | "provider_config"
    | "entitlement_state"
    | "support_diagnostic"
    | "browser_support";
  compatibilityPolicy: "preserve" | "additive_only" | "cleanup_after_backfill";
  owningArtifact: string;
};

export type V10NoExclusionsMatrixKind =
  | "requirement"
  | "file"
  | "source_object"
  | "route"
  | "mutation"
  | "telemetry_audit"
  | "ci_release_gate";

export type V10NoExclusionsVerificationMatrixRow = {
  matrix: V10NoExclusionsMatrixKind;
  key: string;
  priority: "P0" | "P1" | "P2" | "release" | "operations";
  owner: "engineering" | "product" | "security" | "support" | "release" | "operations";
  runtimeArtifact: string;
  dataArtifact: string;
  uiArtifact: string;
  mutationApiArtifact: string;
  testArtifact: string;
  releaseEvidenceKey: string;
  telemetryEvent: `product.v10.${string}`;
  auditAction: string;
  privacyClassification: "client_safe" | "server_safe" | "audit_safe" | "telemetry_safe" | "export_safe" | "diagnostic_safe" | "synthetic_only";
  rollbackPlan: string;
  status: "runtime_backed" | "release_evidence_required" | "external_blocker";
};

export const V10_MASTER_PLAN_TODO_IDS: readonly V10MasterPlanTodoId[] = [
  "phase-0-inventory-lock",
  "phase-0-baseline",
  "phase-1-read-models",
  "phase-2-security",
  "phase-3-mutations",
  "phase-4-core-surfaces",
  "phase-5-domain-workflows",
  "phase-6-routing-reporting",
  "phase-7-ops-governance",
  "phase-8-p1-p2",
  "phase-9-ui-quality",
  "phase-10-release",
  "phase-11-post-ga-drift",
  "phase-12-api-env-integrations",
  "phase-13-data-lifecycle-compliance",
  "phase-14-verification-matrix",
  "foundation-schema-types",
  "foundation-mutations",
  "foundation-refresh",
  "foundation-security-privacy",
  "artifact-definition-of-done",
  "migration-rollout-safety",
  "core-work-home-contracts",
  "core-domain-workflows",
  "cmdk-reports-jobs-telemetry",
  "p1-p2-continuity",
  "tests-ci-release",
  "objective-measurement",
  "deprecation-cleanup",
  "ops-support-release",
] as const;

export const V10_ATTACHED_PLAN_TODO_IDS: readonly V10AttachedPlanTodoId[] = [
  "phase-0-proof-ledger",
  "phase-1-db-contracts",
  "phase-2-read-models",
  "phase-3-mutations",
  "phase-4-api-routes",
  "phase-5-surfaces",
  "phase-6-contract-record",
  "phase-7-domains",
  "phase-8-p1-p2",
  "phase-9-security-telemetry",
  "phase-10-ci-evidence",
  "phase-11-cleanup",
  "phase-12-release-env",
  "phase-13-objective-metrics",
  "phase-14-ops-support",
  "phase-15-data-lifecycle",
  "phase-16-quality-matrix",
  "phase-17-final-cutover",
  "baseline-gap-ledger",
  "source-object-closure",
  "route-surface-closure",
  "data-runtime",
  "read-models",
  "mutation-layer",
  "core-routes-actions",
  "cron-ops",
  "product-surfaces",
  "p1-p2-continuity",
  "telemetry-evidence",
  "security-privacy-abuse",
  "performance-accessibility",
  "rc-fixtures-measurement",
  "data-lifecycle-compliance",
  "integrations-environment",
  "tests-ci-release",
  "cleanup-handoff",
] as const;

const PLAN_TODO_PROOF_ROWS: readonly V10PlanTodoProof[] = [
  {
    planTodoId: "baseline-gap-ledger",
    proofKind: "automated_gate",
    owner: "release",
    artifacts: ["src/lib/v10-final-gap-audit.ts", "src/lib/v10-no-exclusions-matrix.ts", "src/lib/v10-implementation-checklist.ts"],
    blocker: null,
  },
  {
    planTodoId: "source-object-closure",
    proofKind: "automated_gate",
    owner: "engineering",
    artifacts: ["src/lib/v10-source-object-inventory.ts", "src/lib/v10-read-model-refresh.ts", "src/lib/v10-traceability-ledger.ts"],
    blocker: null,
  },
  {
    planTodoId: "route-surface-closure",
    proofKind: "automated_gate",
    owner: "product",
    artifacts: ["src/lib/v10-route-api-catalog.ts", "src/lib/v10-ui-state-contracts.ts", "src/lib/v10-route-api-catalog.v10.test.ts"],
    blocker: null,
  },
  {
    planTodoId: "data-runtime",
    proofKind: "automated_gate",
    owner: "engineering",
    artifacts: ["supabase/migrations/057_v10_runtime_contracts.sql", "scripts/check-v10-migration-smoke.mjs", "src/lib/v10-data-contracts.v10.test.ts"],
    blocker: null,
  },
  {
    planTodoId: "read-models",
    proofKind: "automated_gate",
    owner: "engineering",
    artifacts: ["src/lib/v10-read-models.ts", "src/lib/v10-read-model-refresh.ts", "scripts/rebuild-v10-read-models.mjs"],
    blocker: null,
  },
  {
    planTodoId: "mutation-layer",
    proofKind: "automated_gate",
    owner: "engineering",
    artifacts: ["src/lib/v10-mutation-envelope.ts", "src/lib/v10-server-contracts.ts", "src/lib/v10-server-contracts.v10.test.ts"],
    blocker: null,
  },
  {
    planTodoId: "core-routes-actions",
    proofKind: "shipped_behavior",
    owner: "engineering",
    artifacts: ["src/app/api/approvals/[id]/[action]/route.ts", "src/app/api/evidence/requests/route.ts", "src/actions/tasks.ts"],
    blocker: null,
  },
  {
    planTodoId: "cron-ops",
    proofKind: "automated_gate",
    owner: "operations",
    artifacts: ["src/app/api/cron/v10/read-model-refresh/route.ts", "src/lib/v10-operational-contracts.ts", "vercel.json"],
    blocker: null,
  },
  {
    planTodoId: "product-surfaces",
    proofKind: "shipped_behavior",
    owner: "product",
    artifacts: ["src/app/(dashboard)/dashboard/page.tsx", "src/app/(dashboard)/work/page.tsx", "src/components/ui/v10-recoverable-state.tsx"],
    blocker: null,
  },
  {
    planTodoId: "p1-p2-continuity",
    proofKind: "automated_gate",
    owner: "product",
    artifacts: ["src/lib/v10-advanced-assurance-continuity.ts", "src/lib/v10-domain-depth-contracts.ts", "src/lib/v10-continuity.v10.test.ts"],
    blocker: null,
  },
  {
    planTodoId: "telemetry-evidence",
    proofKind: "automated_gate",
    owner: "release",
    artifacts: ["src/lib/v10-objective-telemetry.ts", "src/lib/v10-release-evidence.ts", "src/lib/v10-readiness-scorecard.ts"],
    blocker: null,
  },
  {
    planTodoId: "security-privacy-abuse",
    proofKind: "automated_gate",
    owner: "security",
    artifacts: ["src/lib/v10-hardening-contracts.ts", "src/lib/v10-hardening-contracts.v10.test.ts", "semgrep/oblixa-v10-surface.yml"],
    blocker: null,
  },
  {
    planTodoId: "performance-accessibility",
    proofKind: "automated_gate",
    owner: "product",
    artifacts: ["src/lib/v10-ui-state-contracts.ts", "src/lib/v10-operational-contracts.ts", "e2e/v10-core-smoke.spec.ts"],
    blocker: null,
  },
  {
    planTodoId: "rc-fixtures-measurement",
    proofKind: "release_evidence",
    owner: "release",
    artifacts: ["src/lib/v10-release-evidence.ts", "src/lib/v10-objective-measurements.ts", "scripts/check-v10-suite.mjs"],
    blocker: "Release-candidate fixture capture, denominator locks, dashboards, and promoted metric evidence require release-owner promotion.",
  },
  {
    planTodoId: "data-lifecycle-compliance",
    proofKind: "release_evidence",
    owner: "security",
    artifacts: ["src/lib/v10-hardening-contracts.ts", "src/lib/v10-report-export.ts", "src/lib/v10-operational-contracts.ts"],
    blocker: "Retention, deletion, support-access, and compliance evidence require security/support owner signoff before complete promotion.",
  },
  {
    planTodoId: "integrations-environment",
    proofKind: "environment_gated",
    owner: "operations",
    artifacts: ["src/lib/v10-operational-contracts.ts", "src/lib/v10-hardening-contracts.ts", "scripts/check-v10-release-evidence.mjs"],
    blocker: "Provider readiness, environment parity, billing sync, and external integration evidence require deployed-environment capture.",
  },
  {
    planTodoId: "tests-ci-release",
    proofKind: "automated_gate",
    owner: "release",
    artifacts: ["scripts/check-v10-suite.mjs", "scripts/check-v10-release-evidence.mjs", ".github/workflows/ci.yml"],
    blocker: null,
  },
  {
    planTodoId: "cleanup-handoff",
    proofKind: "automated_gate",
    owner: "release",
    artifacts: ["src/lib/v10-final-gap-audit.ts", "src/lib/v10-release-contract.ts", "scripts/release-preflight.mjs"],
    blocker: null,
  },
  {
    planTodoId: "read-model-refresh",
    proofKind: "automated_gate",
    owner: "engineering",
    artifacts: ["src/lib/v10-read-model-refresh.ts", "src/lib/v10-read-model-refresh.v10.test.ts"],
    blocker: null,
  },
  {
    planTodoId: "core-surfaces",
    proofKind: "shipped_behavior",
    owner: "product",
    artifacts: [
      "src/app/(dashboard)/dashboard/page.tsx",
      "src/app/(dashboard)/work/page.tsx",
      "src/app/(dashboard)/contracts/[id]/page.tsx",
      "src/components/layout/command-palette.tsx",
    ],
    blocker: null,
  },
  {
    planTodoId: "mutation-audit-idempotency",
    proofKind: "automated_gate",
    owner: "engineering",
    artifacts: ["src/lib/v10-server-contracts.ts", "src/actions/tasks.ts", "src/actions/product-surface-settings.ts", "src/lib/v10-route-api-catalog.v10.test.ts"],
    blocker: null,
  },
  {
    planTodoId: "search-report-job-notification",
    proofKind: "automated_gate",
    owner: "operations",
    artifacts: [
      "src/app/api/command-palette/contracts/route.ts",
      "src/app/api/command-palette/contracts/route.v10.test.ts",
      "src/lib/v10-job-visibility.ts",
      "src/lib/v10-report-export.ts",
      "src/lib/v10-final-gap-audit.ts",
    ],
    blocker: null,
  },
  {
    planTodoId: "governance-security-privacy",
    proofKind: "typed_contract",
    owner: "security",
    artifacts: ["src/lib/v10-hardening-contracts.ts", "src/lib/v10-server-contracts.ts"],
    blocker: null,
  },
  {
    planTodoId: "release-evidence-blockers",
    proofKind: "release_evidence",
    owner: "release",
    artifacts: ["src/lib/v10-release-evidence.ts", "src/lib/v10-readiness-scorecard.ts"],
    blocker: "release-candidate metrics, dashboards, provider credentials, and human studies remain external evidence.",
  },
  {
    planTodoId: "command-query-sample-set",
    proofKind: "automated_gate",
    owner: "product",
    artifacts: ["src/lib/v10-final-gap-audit.ts", "src/app/api/command-palette/contracts/route.ts"],
    blocker: null,
  },
  {
    planTodoId: "work-source-action-matrix",
    proofKind: "automated_gate",
    owner: "product",
    artifacts: ["src/lib/v10-final-gap-audit.ts", "src/lib/v10-work-semantics.ts"],
    blocker: null,
  },
  {
    planTodoId: "job-class-matrix",
    proofKind: "automated_gate",
    owner: "operations",
    artifacts: ["src/lib/v10-final-gap-audit.ts", "src/lib/v10-job-visibility.ts"],
    blocker: null,
  },
  {
    planTodoId: "final-gap-audit-mechanics",
    proofKind: "automated_gate",
    owner: "release",
    artifacts: ["src/lib/v10-final-gap-audit.ts", "src/lib/v10-final-gap-audit.v10.test.ts"],
    blocker: null,
  },
  {
    planTodoId: "exhaustive-artifact-sweep",
    proofKind: "automated_gate",
    owner: "release",
    artifacts: [
      "scripts/check-v10-release-evidence.mjs",
      "src/lib/v10-autonomous-coverage.ts",
      "src/lib/v10-final-gap-audit.ts",
      "src/lib/v10-traceability-ledger.ts",
    ],
    blocker: null,
  },
  {
    planTodoId: "non-autonomous-proof",
    proofKind: "non_autonomous_blocker",
    owner: "release",
    artifacts: ["src/lib/v10-release-evidence.ts", "src/lib/v10-readiness-scorecard.ts"],
    blocker: "Human, provider, dashboard, canary, release-owner, support, and post-GA evidence must be promoted or remain release blockers.",
  },
  {
    planTodoId: "phase-0-proof-ledger",
    proofKind: "automated_gate",
    owner: "release",
    artifacts: ["src/lib/v10-final-gap-audit.ts", "src/lib/v10-no-exclusions-matrix.ts", "src/lib/v10-acceptance-matrix.ts"],
    blocker: null,
  },
  {
    planTodoId: "phase-1-db-contracts",
    proofKind: "automated_gate",
    owner: "engineering",
    artifacts: ["supabase/migrations/057_v10_runtime_contracts.sql", "src/lib/v10-read-models.ts", "scripts/check-v10-migration-smoke.mjs"],
    blocker: null,
  },
  {
    planTodoId: "phase-2-read-models",
    proofKind: "automated_gate",
    owner: "engineering",
    artifacts: ["src/lib/v10-read-model-refresh.ts", "src/lib/v10-read-models.ts", "scripts/rebuild-v10-read-models.mjs"],
    blocker: null,
  },
  {
    planTodoId: "phase-4-api-routes",
    proofKind: "automated_gate",
    owner: "engineering",
    artifacts: ["src/lib/v10-route-api-catalog.ts", "src/lib/v10-server-contracts.ts", "src/app/api/command-palette/contracts/route.ts"],
    blocker: null,
  },
  {
    planTodoId: "phase-5-surfaces",
    proofKind: "shipped_behavior",
    owner: "product",
    artifacts: ["src/app/(dashboard)/dashboard/page.tsx", "src/app/(dashboard)/work/page.tsx", "src/components/ui/v10-recoverable-state.tsx"],
    blocker: null,
  },
  {
    planTodoId: "phase-6-contract-record",
    proofKind: "shipped_behavior",
    owner: "product",
    artifacts: ["src/app/(dashboard)/contracts/[id]/page.tsx", "src/lib/v10-contract-health.ts", "src/lib/v10-field-provenance.ts"],
    blocker: null,
  },
  {
    planTodoId: "phase-7-domains",
    proofKind: "automated_gate",
    owner: "product",
    artifacts: ["src/lib/v10-core-workflow-contracts.ts", "src/lib/v10-evidence-collaboration.ts", "src/lib/v10-approval-exception.ts"],
    blocker: null,
  },
  {
    planTodoId: "phase-9-security-telemetry",
    proofKind: "automated_gate",
    owner: "security",
    artifacts: ["src/lib/v10-hardening-contracts.ts", "src/lib/v10-objective-telemetry.ts", "semgrep/oblixa-v10-surface.yml"],
    blocker: null,
  },
  {
    planTodoId: "phase-10-ci-evidence",
    proofKind: "automated_gate",
    owner: "release",
    artifacts: ["scripts/check-v10-suite.mjs", "scripts/check-v10-release-evidence.mjs", ".github/workflows/ci.yml"],
    blocker: null,
  },
  {
    planTodoId: "phase-11-cleanup",
    proofKind: "automated_gate",
    owner: "release",
    artifacts: ["src/lib/v10-final-gap-audit.ts", "src/lib/v9-release-contract.ts", "scripts/check-v10-suite.mjs"],
    blocker: null,
  },
  {
    planTodoId: "phase-12-release-env",
    proofKind: "environment_gated",
    owner: "release",
    artifacts: ["src/lib/v10-release-evidence.ts", "src/lib/v10-readiness-scorecard.ts", "scripts/check-v10-release-evidence.mjs"],
    blocker: "Release-candidate metric capture, denominator locks, external blocker resolution, and promotion records require deployed release environment evidence.",
  },
  {
    planTodoId: "phase-13-objective-metrics",
    proofKind: "release_evidence",
    owner: "release",
    artifacts: ["src/lib/v10-objective-measurements.ts", "src/lib/v10-objective-telemetry.ts", "src/lib/v10-release-evidence.ts"],
    blocker: "Objective metrics require fixed release-candidate samples, captured windows, and persisted measurement records before complete promotion.",
  },
  {
    planTodoId: "phase-14-ops-support",
    proofKind: "release_evidence",
    owner: "operations",
    artifacts: ["src/lib/v10-operational-contracts.ts", "src/app/(dashboard)/settings/health/page.tsx", "src/lib/v10-readiness-scorecard.ts"],
    blocker: "Operations, support diagnostics, rollback/repair, and post-GA drift monitoring require owner signoff and dashboard evidence.",
  },
  {
    planTodoId: "phase-15-data-lifecycle",
    proofKind: "release_evidence",
    owner: "security",
    artifacts: ["src/lib/v10-hardening-contracts.ts", "src/lib/v10-report-export.ts", "src/lib/v10-release-evidence.ts"],
    blocker: "Privacy lifecycle, retention, deletion, redaction, disaster recovery, and tenant-isolation evidence require security promotion.",
  },
  {
    planTodoId: "phase-16-quality-matrix",
    proofKind: "automated_gate",
    owner: "product",
    artifacts: ["src/lib/v10-ui-state-contracts.ts", "e2e/v10-core-smoke.spec.ts", "src/components/ui/v10-recoverable-state.tsx"],
    blocker: null,
  },
  {
    planTodoId: "phase-17-final-cutover",
    proofKind: "release_evidence",
    owner: "release",
    artifacts: ["src/lib/v10-final-gap-audit.ts", "src/lib/v10-release-evidence.ts", "src/lib/v10-readiness-scorecard.ts"],
    blocker: "Complete-state promotion requires final no-exclusions cutover, release signoff, compatibility cleanup, and fresh release evidence.",
  },
  {
    planTodoId: "phase-0-inventory-lock",
    proofKind: "automated_gate",
    owner: "release",
    artifacts: ["src/lib/v10-final-gap-audit.ts", "src/lib/v10-final-gap-audit.v10.test.ts"],
    blocker: null,
  },
  {
    planTodoId: "phase-0-baseline",
    proofKind: "automated_gate",
    owner: "engineering",
    artifacts: ["supabase/migrations/057_v10_runtime_contracts.sql", "scripts/check-v10-migration-smoke.mjs", "scripts/check-v10-release-evidence.mjs"],
    blocker: null,
  },
  {
    planTodoId: "phase-1-read-models",
    proofKind: "automated_gate",
    owner: "engineering",
    artifacts: ["src/lib/v10-read-models.ts", "src/lib/v10-read-model-refresh.ts", "scripts/rebuild-v10-read-models.mjs"],
    blocker: null,
  },
  {
    planTodoId: "phase-2-security",
    proofKind: "automated_gate",
    owner: "security",
    artifacts: ["src/lib/v10-visibility.ts", "src/lib/v10-hardening-contracts.ts", "semgrep/oblixa-v10-surface.yml"],
    blocker: null,
  },
  {
    planTodoId: "phase-3-mutations",
    proofKind: "automated_gate",
    owner: "engineering",
    artifacts: ["src/lib/v10-mutation-envelope.ts", "src/lib/v10-server-contracts.ts", "src/lib/v10-route-api-catalog.ts"],
    blocker: null,
  },
  {
    planTodoId: "phase-4-core-surfaces",
    proofKind: "shipped_behavior",
    owner: "product",
    artifacts: ["src/app/(dashboard)/dashboard/page.tsx", "src/app/(dashboard)/work/page.tsx", "src/app/(dashboard)/contracts/[id]/page.tsx"],
    blocker: null,
  },
  {
    planTodoId: "phase-5-domain-workflows",
    proofKind: "automated_gate",
    owner: "product",
    artifacts: ["src/actions/renewal-playbook.ts", "src/app/api/evidence/requests/route.ts", "src/app/api/approvals/[id]/[action]/route.ts"],
    blocker: null,
  },
  {
    planTodoId: "phase-6-routing-reporting",
    proofKind: "automated_gate",
    owner: "operations",
    artifacts: ["src/app/api/command-palette/contracts/route.ts", "src/lib/v10-report-export.ts", "src/lib/v10-job-visibility.ts"],
    blocker: null,
  },
  {
    planTodoId: "phase-7-ops-governance",
    proofKind: "environment_gated",
    owner: "operations",
    artifacts: ["src/app/(dashboard)/settings/health/page.tsx", "src/lib/v10-governance.ts", "src/lib/v10-operational-contracts.ts"],
    blocker: "Provider readiness, canary, rollback, and support checks require deployment environment evidence.",
  },
  {
    planTodoId: "phase-8-p1-p2",
    proofKind: "automated_gate",
    owner: "product",
    artifacts: ["src/lib/v10-advanced-assurance-continuity.ts", "src/lib/v10-domain-depth-contracts.ts", "src/lib/v10-continuity.v10.test.ts"],
    blocker: null,
  },
  {
    planTodoId: "phase-9-ui-quality",
    proofKind: "automated_gate",
    owner: "product",
    artifacts: ["src/components/ui/v10-recoverable-state.tsx", "src/lib/v10-ui-state-contracts.ts", "e2e/v10-core-smoke.spec.ts"],
    blocker: null,
  },
  {
    planTodoId: "phase-10-release",
    proofKind: "release_evidence",
    owner: "release",
    artifacts: ["src/lib/v10-release-evidence.ts", "src/lib/v10-objective-measurements.ts", "scripts/check-v10-suite.mjs"],
    blocker: "Release candidate fixture captures and metric denominators must be promoted by the release owner.",
  },
  {
    planTodoId: "phase-11-post-ga-drift",
    proofKind: "release_evidence",
    owner: "operations",
    artifacts: ["src/lib/v10-objective-telemetry.ts", "src/lib/v10-operational-contracts.ts", "src/lib/v10-readiness-scorecard.ts"],
    blocker: "Post-GA SLO and drift evidence requires time-windowed production observation.",
  },
  {
    planTodoId: "phase-12-api-env-integrations",
    proofKind: "automated_gate",
    owner: "operations",
    artifacts: ["src/lib/v10-route-api-catalog.ts", "src/lib/v10-operational-contracts.ts", "scripts/check-v10-release-evidence.mjs"],
    blocker: null,
  },
  {
    planTodoId: "phase-13-data-lifecycle-compliance",
    proofKind: "release_evidence",
    owner: "security",
    artifacts: ["src/lib/v10-hardening-contracts.ts", "src/lib/v10-report-export.ts", "src/lib/v10-release-evidence.ts"],
    blocker: "Privacy lifecycle, compliance, and support-access evidence require owner signoff before release promotion.",
  },
  {
    planTodoId: "phase-14-verification-matrix",
    proofKind: "automated_gate",
    owner: "release",
    artifacts: ["src/lib/v10-final-gap-audit.ts", "src/lib/v10-no-exclusions-matrix.ts", "src/lib/v10-traceability-ledger.ts"],
    blocker: null,
  },
] as const;

export const V10_FROZEN_IMPLEMENTATION_MATRIX: readonly V10FrozenImplementationMatrixRow[] = [
  {
    todoId: "phase-0-inventory-lock",
    requiredDimensions: ["functional_coverage", "runtime_behavior", "release_evidence", "operations", "verification_matrix"],
    primaryArtifacts: ["src/lib/v10-final-gap-audit.ts", "src/lib/v10-acceptance-matrix.ts", "src/lib/v10-source-object-inventory.ts", "src/lib/v10-route-api-catalog.ts"],
    acceptanceIds: ["acceptance-matrix", "final-gap-audit-protocol", "trace-release-evidence"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "phase-0-baseline",
    requiredDimensions: ["runtime_behavior", "data_contract", "release_evidence", "operations"],
    primaryArtifacts: ["supabase/migrations/057_v10_runtime_contracts.sql", "scripts/check-v10-migration-smoke.mjs", "scripts/check-v10-release-evidence.mjs", "src/lib/v10-acceptance-matrix.ts"],
    acceptanceIds: ["fix-runtime-migration", "ci-quality-ratchets", "verification-gates"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "phase-1-read-models",
    requiredDimensions: ["data_contract", "read_model_freshness", "runtime_behavior", "operations"],
    primaryArtifacts: ["src/lib/v10-read-models.ts", "src/lib/v10-read-model-refresh.ts", "scripts/rebuild-v10-read-models.mjs"],
    acceptanceIds: ["read-model-foundation", "data-lineage-invariants", "seed-backfill-tooling"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "phase-2-security",
    requiredDimensions: ["authorization", "privacy", "audit", "release_evidence"],
    primaryArtifacts: ["src/lib/v10-visibility.ts", "src/lib/v10-hardening-contracts.ts", "semgrep/oblixa-v10-surface.yml"],
    acceptanceIds: ["security-privacy-data", "authorization-data-classification", "tenant-isolation-proof"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "phase-3-mutations",
    requiredDimensions: ["api_contract", "idempotency", "audit", "telemetry", "compatibility"],
    primaryArtifacts: ["src/lib/v10-mutation-envelope.ts", "src/lib/v10-server-contracts.ts", "src/lib/v10-route-api-catalog.ts"],
    acceptanceIds: ["mutation-contracts", "api-response-schemas", "concurrency-cache-time"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "phase-4-core-surfaces",
    requiredDimensions: ["functional_coverage", "recoverable_ui", "accessibility", "performance", "fixture_or_e2e"],
    primaryArtifacts: ["src/app/(dashboard)/dashboard/page.tsx", "src/app/(dashboard)/work/page.tsx", "src/app/(dashboard)/contracts/[id]/page.tsx"],
    acceptanceIds: ["activation-intake", "home-daily-brief", "unified-work", "contract-record", "journey-contracts"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "phase-5-domain-workflows",
    requiredDimensions: ["functional_coverage", "authorization", "audit", "telemetry", "recoverable_ui"],
    primaryArtifacts: ["src/actions/renewal-playbook.ts", "src/app/api/evidence/requests/route.ts", "src/app/api/approvals/[id]/[action]/route.ts"],
    acceptanceIds: ["review-provenance-quality", "renewals-critical-dates", "evidence-obligations-collaboration", "approvals-decisions-exceptions", "data-quality-remediation-loop"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "phase-6-routing-reporting",
    requiredDimensions: ["api_contract", "telemetry", "operations", "release_evidence", "compatibility"],
    primaryArtifacts: ["src/app/api/command-palette/contracts/route.ts", "src/lib/v10-report-export.ts", "src/lib/v10-job-visibility.ts"],
    acceptanceIds: ["complete-search-router", "reports-exports-reviews", "api-pagination-filtering", "report-export-redaction", "notification-consent-compliance"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "phase-7-ops-governance",
    requiredDimensions: ["operations", "environment_config", "integration_boundary", "release_evidence", "support_boundary"],
    primaryArtifacts: ["src/app/(dashboard)/settings/health/page.tsx", "src/lib/v10-governance.ts", "src/lib/v10-operational-contracts.ts"],
    acceptanceIds: ["governance-health-reliability", "environment-config-parity", "entitlement-billing-sync", "fixture-runbooks-observability"],
    blockerPolicy: "external_evidence_allowed",
  },
  {
    todoId: "phase-8-p1-p2",
    requiredDimensions: ["functional_coverage", "authorization", "audit", "telemetry", "recoverable_ui"],
    primaryArtifacts: ["src/lib/v10-advanced-assurance-continuity.ts", "src/lib/v10-domain-depth-contracts.ts", "src/lib/v10-read-model-refresh.ts"],
    acceptanceIds: ["p1-p2-continuity", "lifecycle-provider-boundaries", "progressive-rollout-canary"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "phase-9-ui-quality",
    requiredDimensions: ["recoverable_ui", "accessibility", "performance", "fixture_or_e2e", "support_boundary"],
    primaryArtifacts: ["src/components/ui/v10-recoverable-state.tsx", "src/lib/v10-ui-state-contracts.ts", "e2e/v10-core-smoke.spec.ts"],
    acceptanceIds: ["accessibility-performance-responsive", "route-state-a11y-performance", "component-copy-contracts", "browser-device-support"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "phase-10-release",
    requiredDimensions: ["fixture_or_e2e", "release_evidence", "telemetry", "operations", "verification_matrix"],
    primaryArtifacts: ["src/lib/v10-release-evidence.ts", "src/lib/v10-objective-measurements.ts", "scripts/check-v10-suite.mjs"],
    acceptanceIds: ["fixture-measurement-gates", "measurement-governance", "trace-release-evidence", "synthetic-fixture-safety"],
    blockerPolicy: "external_evidence_allowed",
  },
  {
    todoId: "phase-11-post-ga-drift",
    requiredDimensions: ["post_ga_drift", "operations", "telemetry", "release_evidence", "support_boundary"],
    primaryArtifacts: ["src/lib/v10-objective-telemetry.ts", "src/lib/v10-operational-contracts.ts", "src/lib/v10-readiness-scorecard.ts"],
    acceptanceIds: ["adoption-operational-feedback", "disaster-recovery-resilience", "operational-evidence-ownership"],
    blockerPolicy: "external_evidence_allowed",
  },
  {
    todoId: "phase-12-api-env-integrations",
    requiredDimensions: ["api_contract", "environment_config", "integration_boundary", "compatibility", "performance"],
    primaryArtifacts: ["src/lib/v10-route-api-catalog.ts", "src/lib/v10-operational-contracts.ts", "scripts/check-v10-release-evidence.mjs"],
    acceptanceIds: ["api-response-schemas", "environment-config-parity", "entitlement-billing-sync", "contract-versioning-compatibility"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "phase-13-data-lifecycle-compliance",
    requiredDimensions: ["data_lifecycle", "privacy", "audit", "support_boundary", "operations"],
    primaryArtifacts: ["src/lib/v10-hardening-contracts.ts", "src/lib/v10-report-export.ts", "src/lib/v10-release-evidence.ts"],
    acceptanceIds: ["privacy-lifecycle-requests", "support-admin-boundaries", "support-docs-boundaries", "threat-abuse-model"],
    blockerPolicy: "external_evidence_allowed",
  },
  {
    todoId: "phase-14-verification-matrix",
    requiredDimensions: ["verification_matrix", "release_evidence", "operations", "compatibility", "fixture_or_e2e"],
    primaryArtifacts: ["src/lib/v10-final-gap-audit.ts", "src/lib/v10-no-exclusions-matrix.ts", "src/lib/v10-traceability-ledger.ts"],
    acceptanceIds: ["verification-gates", "file-level-gap-closure", "acceptance-matrix", "final-gap-audit-protocol"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "foundation-schema-types",
    requiredDimensions: ["runtime_behavior", "authorization", "read_model_freshness", "fixture_or_e2e"],
    primaryArtifacts: ["supabase/migrations/057_v10_runtime_contracts.sql", "src/lib/v10-read-models.ts", "src/lib/v10-data-contracts.v10.test.ts"],
    acceptanceIds: ["fix-runtime-migration", "read-model-foundation", "database-constraint-index-budget"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "foundation-mutations",
    requiredDimensions: ["runtime_behavior", "authorization", "audit", "idempotency", "fixture_or_e2e"],
    primaryArtifacts: ["src/lib/v10-mutation-envelope.ts", "src/lib/v10-server-contracts.ts", "src/lib/v10-route-api-catalog.ts"],
    acceptanceIds: ["mutation-contracts", "api-response-schemas", "concurrency-cache-time"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "foundation-refresh",
    requiredDimensions: ["runtime_behavior", "read_model_freshness", "recoverable_ui", "operations"],
    primaryArtifacts: ["src/lib/v10-read-model-refresh.ts", "scripts/rebuild-v10-read-models.mjs"],
    acceptanceIds: ["read-model-foundation", "data-lineage-invariants", "seed-backfill-tooling"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "foundation-security-privacy",
    requiredDimensions: ["authorization", "audit", "telemetry", "release_evidence"],
    primaryArtifacts: ["src/lib/v10-hardening-contracts.ts", "src/lib/v10-governance.ts", "src/lib/v10-server-contracts.ts"],
    acceptanceIds: ["security-privacy-data", "authorization-data-classification", "tenant-isolation-proof"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "artifact-definition-of-done",
    requiredDimensions: ["runtime_behavior", "fixture_or_e2e", "release_evidence", "operations"],
    primaryArtifacts: ["src/lib/v10-implementation-checklist.ts", "src/lib/v10-final-gap-audit.ts"],
    acceptanceIds: ["artifact-definition-of-done", "artifact-contracts", "verification-gates"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "migration-rollout-safety",
    requiredDimensions: ["authorization", "read_model_freshness", "operations", "release_evidence"],
    primaryArtifacts: ["src/lib/v10-mutation-rollout.ts", "src/lib/v10-read-model-refresh.ts", "scripts/rebuild-v10-read-models.mjs"],
    acceptanceIds: ["rollout-backfill-recovery", "progressive-rollout-canary", "contract-versioning-compatibility"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "core-work-home-contracts",
    requiredDimensions: ["runtime_behavior", "recoverable_ui", "fixture_or_e2e", "telemetry"],
    primaryArtifacts: ["src/app/(dashboard)/work/page.tsx", "src/app/(dashboard)/dashboard/page.tsx", "src/app/(dashboard)/contracts/[id]/page.tsx"],
    acceptanceIds: ["home-daily-brief", "unified-work", "contract-record"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "core-domain-workflows",
    requiredDimensions: ["runtime_behavior", "authorization", "audit", "recoverable_ui", "telemetry"],
    primaryArtifacts: ["src/actions/contracts.ts", "src/actions/renewal-playbook.ts", "src/app/api/evidence/requests/route.ts"],
    acceptanceIds: ["activation-intake", "review-provenance-quality", "renewals-critical-dates", "evidence-obligations-collaboration", "approvals-decisions-exceptions"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "cmdk-reports-jobs-telemetry",
    requiredDimensions: ["runtime_behavior", "telemetry", "recoverable_ui", "release_evidence"],
    primaryArtifacts: ["src/app/api/command-palette/contracts/route.ts", "src/lib/v10-report-export.ts", "src/lib/product-telemetry.ts"],
    acceptanceIds: ["complete-search-router", "reports-exports-reviews", "telemetry-objectives"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "p1-p2-continuity",
    requiredDimensions: ["runtime_behavior", "authorization", "audit", "telemetry", "recoverable_ui"],
    primaryArtifacts: ["src/lib/v10-advanced-assurance-continuity.ts", "src/lib/v10-domain-depth-contracts.ts"],
    acceptanceIds: ["p1-p2-continuity", "lifecycle-provider-boundaries"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "tests-ci-release",
    requiredDimensions: ["fixture_or_e2e", "release_evidence", "operations"],
    primaryArtifacts: ["scripts/check-v10-suite.mjs", "scripts/check-v10-release-evidence.mjs", ".github/workflows/ci.yml"],
    acceptanceIds: ["ci-quality-ratchets", "negative-adversarial-coverage", "failure-injection-qa"],
    blockerPolicy: "must_be_runtime_backed",
  },
  {
    todoId: "objective-measurement",
    requiredDimensions: ["fixture_or_e2e", "telemetry", "release_evidence", "operations"],
    primaryArtifacts: ["src/lib/v10-objective-measurements.ts", "src/lib/v10-release-evidence.ts", "src/lib/v10-readiness-scorecard.ts"],
    acceptanceIds: ["fixture-measurement-gates", "measurement-governance", "operational-evidence-ownership"],
    blockerPolicy: "external_evidence_allowed",
  },
  {
    todoId: "deprecation-cleanup",
    requiredDimensions: ["runtime_behavior", "release_evidence", "operations"],
    primaryArtifacts: ["src/lib/v10-final-gap-audit.ts", "scripts/check-v10-release-evidence.mjs"],
    acceptanceIds: ["deprecation-cleanup-policy", "compatibility-regression-boundaries"],
    blockerPolicy: "cleanup_after_replacement",
  },
  {
    todoId: "ops-support-release",
    requiredDimensions: ["operations", "release_evidence", "recoverable_ui", "telemetry"],
    primaryArtifacts: ["src/lib/v10-release-evidence.ts", "src/lib/v10-readiness-scorecard.ts", "src/app/(dashboard)/settings/health/page.tsx"],
    acceptanceIds: ["fixture-runbooks-observability", "support-admin-boundaries", "disaster-recovery-resilience"],
    blockerPolicy: "external_evidence_allowed",
  },
] as const;

export const V10_FILE_OWNERSHIP_MAP: readonly V10FileOwnershipRow[] = [
  { area: "spec", pathPrefix: "docs/v10.md", owner: "product", requiredProof: ["release_evidence"] },
  { area: "database", pathPrefix: "supabase/migrations/", owner: "engineering", requiredProof: ["authorization", "read_model_freshness", "fixture_or_e2e"] },
  { area: "read_models", pathPrefix: "src/lib/v10-read-model", owner: "engineering", requiredProof: ["read_model_freshness", "runtime_behavior"] },
  { area: "mutations", pathPrefix: "src/lib/v10-mutation", owner: "engineering", requiredProof: ["idempotency", "audit", "authorization"] },
  { area: "api", pathPrefix: "src/app/api/", owner: "engineering", requiredProof: ["runtime_behavior", "authorization", "audit"] },
  { area: "server_actions", pathPrefix: "src/actions/", owner: "engineering", requiredProof: ["runtime_behavior", "authorization", "audit"] },
  { area: "dashboard_surfaces", pathPrefix: "src/app/(dashboard)/", owner: "product", requiredProof: ["recoverable_ui", "telemetry", "fixture_or_e2e"] },
  { area: "components", pathPrefix: "src/components/", owner: "product", requiredProof: ["recoverable_ui", "fixture_or_e2e"] },
  { area: "telemetry", pathPrefix: "src/lib/product-telemetry.ts", owner: "product", requiredProof: ["telemetry", "privacy", "release_evidence"] },
  { area: "audit", pathPrefix: "src/lib/v10-status-action-vocabulary.ts", owner: "security", requiredProof: ["audit", "privacy", "compatibility"] },
  { area: "testing", pathPrefix: "e2e/", owner: "release", requiredProof: ["fixture_or_e2e"] },
  { area: "fixtures", pathPrefix: "scripts/check-v10-suite.mjs", owner: "release", requiredProof: ["fixture_or_e2e", "release_evidence"] },
  { area: "ci_scripts", pathPrefix: "scripts/", owner: "release", requiredProof: ["release_evidence", "operations"] },
  { area: "security", pathPrefix: "semgrep/", owner: "security", requiredProof: ["authorization", "release_evidence"] },
  { area: "release", pathPrefix: "src/lib/v10-release", owner: "release", requiredProof: ["release_evidence", "operations"] },
  { area: "operations", pathPrefix: "src/app/api/cron/", owner: "operations", requiredProof: ["operations", "release_evidence"] },
  { area: "environment", pathPrefix: "vercel.json", owner: "operations", requiredProof: ["environment_config", "operations"] },
  { area: "integrations", pathPrefix: "src/lib/v10-operational-contracts.ts", owner: "operations", requiredProof: ["integration_boundary", "release_evidence"] },
  { area: "support", pathPrefix: "src/app/(dashboard)/settings/health/page.tsx", owner: "support", requiredProof: ["support_boundary", "recoverable_ui"] },
  { area: "compliance", pathPrefix: "src/lib/v10-hardening-contracts.ts", owner: "security", requiredProof: ["privacy", "audit", "data_lifecycle"] },
  { area: "runbooks", pathPrefix: "scripts/rebuild-v10-read-models.mjs", owner: "operations", requiredProof: ["operations", "release_evidence"] },
  { area: "verification", pathPrefix: "src/lib/v10-final-gap-audit.ts", owner: "release", requiredProof: ["verification_matrix", "release_evidence"] },
] as const;

export const V10_DEPRECATION_CANDIDATES: readonly V10DeprecationCandidate[] = [
  {
    key: "work_legacy_queue_summary",
    category: "duplicate_queue",
    artifact: "src/app/(dashboard)/work/page.tsx",
    replacement: "v10_work_items authoritative Work index",
    removalGate: "core-work-home-contracts",
  },
  {
    key: "field_review_legacy_audit_details",
    category: "legacy_audit",
    artifact: "src/actions/contracts.ts",
    replacement: "v10_audit_events safe_metadata and hashed state",
    removalGate: "foundation-mutations",
  },
  {
    key: "legacy_exception_assigned_audit_alias",
    category: "legacy_audit",
    artifact: "src/actions/exceptions.ts",
    replacement: "exception.owner_changed V10 audit action with legacy audit_events retained only for compatibility",
    removalGate: "foundation-mutations",
  },
  {
    key: "report_pack_as_report_run",
    category: "metadata_only_claim",
    artifact: "src/app/api/report-packs/route.ts",
    replacement: "create_report_run mutation and report_run_visibility",
    removalGate: "cmdk-reports-jobs-telemetry",
  },
  {
    key: "descriptor_only_rc_fixtures",
    category: "descriptor_fixture",
    artifact: "scripts/check-v10-suite.mjs",
    replacement: "fixture-backed seed, denominator lock, capture, teardown",
    removalGate: "objective-measurement",
  },
  {
    key: "v10_semgrep_warning_only", // gitleaks:allow gap-audit catalog id, not a secret
    category: "placeholder_gate",
    artifact: "semgrep/oblixa-v10-surface.yml",
    replacement: "CI-failing V10 guardrails",
    removalGate: "tests-ci-release",
  },
  {
    key: "duplicate_v10_e2e_smoke_lane",
    category: "duplicate_e2e",
    artifact: ".github/workflows/ci.yml",
    replacement: "intentional smoke/workflow/release-candidate E2E split",
    removalGate: "tests-ci-release",
  },
  {
    key: "v9_release_contract_bridge",
    category: "v9_label",
    artifact: "src/lib/v9-release-contract.ts",
    replacement: "v10 release contract with V9 regression bridge preserved only for compatibility gates",
    removalGate: "deprecation-cleanup",
  },
] as const;

export const V10_COMPATIBILITY_BOUNDARIES: readonly V10CompatibilityBoundary[] = [
  { key: "dashboard_contract_urls", boundary: "public_url", compatibilityPolicy: "preserve", owningArtifact: "src/app/(dashboard)/contracts/[id]/page.tsx" },
  { key: "external_evidence_links", boundary: "external_link", compatibilityPolicy: "preserve", owningArtifact: "src/app/api/evidence/submit/route.ts" },
  { key: "report_export_artifacts", boundary: "artifact", compatibilityPolicy: "preserve", owningArtifact: "src/lib/v10-report-export.ts" },
  { key: "report_export_file_formats", boundary: "report_export_format", compatibilityPolicy: "additive_only", owningArtifact: "src/lib/v10-report-export.ts" },
  { key: "v10_audit_action_names", boundary: "audit_action", compatibilityPolicy: "additive_only", owningArtifact: "src/lib/v10-status-action-vocabulary.ts" },
  { key: "product_v10_telemetry_names", boundary: "telemetry_event", compatibilityPolicy: "additive_only", owningArtifact: "src/lib/product-telemetry.ts" },
  { key: "v10_runtime_migration_version", boundary: "migration_version", compatibilityPolicy: "additive_only", owningArtifact: "supabase/migrations/057_v10_runtime_contracts.sql" },
  { key: "package_v10_commands", boundary: "stable_command", compatibilityPolicy: "preserve", owningArtifact: "package.json" },
  { key: "v10_read_model_tables", boundary: "persisted_data", compatibilityPolicy: "cleanup_after_backfill", owningArtifact: "src/lib/v10-read-models.ts" },
  { key: "v10_api_response_schemas", boundary: "api_schema", compatibilityPolicy: "additive_only", owningArtifact: "src/lib/v10-mutation-envelope.ts" },
  { key: "v10_private_cache_policy", boundary: "cache_policy", compatibilityPolicy: "preserve", owningArtifact: "src/lib/v10-route-api-catalog.ts" },
  { key: "v10_provider_configuration", boundary: "provider_config", compatibilityPolicy: "additive_only", owningArtifact: "src/lib/v10-operational-contracts.ts" },
  { key: "v10_entitlement_state", boundary: "entitlement_state", compatibilityPolicy: "preserve", owningArtifact: "src/lib/v10-governance.ts" },
  { key: "v10_support_diagnostics", boundary: "support_diagnostic", compatibilityPolicy: "preserve", owningArtifact: "src/app/(dashboard)/settings/health/page.tsx" },
  { key: "v10_browser_support_matrix", boundary: "browser_support", compatibilityPolicy: "additive_only", owningArtifact: "e2e/v10-core-smoke.spec.ts" },
  { key: "v9_regression_bridge", boundary: "stable_command", compatibilityPolicy: "preserve", owningArtifact: "src/lib/v9-release-contract.ts" },
] as const;

export const V10_DEPRECATION_CLEANUP_DECISIONS: readonly V10DeprecationCleanupDecision[] = [
  {
    candidateKey: "work_legacy_queue_summary",
    action: "retire",
    supersededBy: "v10_work_items authoritative Work index",
    runtimeReplacementProof: "src/app/(dashboard)/work/page.tsx",
    releaseEvidenceKey: "v10-release:deprecation:work_legacy_queue_summary",
    compatibilityBoundaryKey: "v10_read_model_tables",
    testsPreserved: true,
    cleanupCommand: "npm run check:v10-suite -- --cleanup work_legacy_queue_summary",
  },
  {
    candidateKey: "field_review_legacy_audit_details",
    action: "quarantine",
    supersededBy: "v10_audit_events safe_metadata and hashed state",
    runtimeReplacementProof: "src/lib/v10-status-action-vocabulary.ts",
    releaseEvidenceKey: "v10-release:deprecation:field_review_legacy_audit_details",
    compatibilityBoundaryKey: "v10_audit_action_names",
    testsPreserved: true,
    cleanupCommand: "npm run check:v10-suite -- --cleanup field_review_legacy_audit_details",
  },
  {
    candidateKey: "legacy_exception_assigned_audit_alias",
    action: "quarantine",
    supersededBy: "exception.owner_changed V10 audit action with legacy audit_events retained only for compatibility",
    runtimeReplacementProof: "src/app/api/exceptions/[id]/[action]/route.ts",
    releaseEvidenceKey: "v10-release:deprecation:legacy_exception_assigned_audit_alias",
    compatibilityBoundaryKey: "v10_audit_action_names",
    testsPreserved: true,
    cleanupCommand: "npm run check:v10-suite -- --cleanup legacy_exception_assigned_audit_alias",
  },
  {
    candidateKey: "report_pack_as_report_run",
    action: "preserve_boundary",
    supersededBy: "create_report_run mutation and report_run_visibility",
    runtimeReplacementProof: "src/lib/v10-report-export.ts",
    releaseEvidenceKey: "v10-release:deprecation:report_pack_as_report_run",
    compatibilityBoundaryKey: "report_export_artifacts",
    testsPreserved: true,
    cleanupCommand: "npm run check:v10-suite -- --cleanup report_pack_as_report_run",
  },
  {
    candidateKey: "descriptor_only_rc_fixtures",
    action: "retire",
    supersededBy: "fixture-backed seed, denominator lock, capture, teardown",
    runtimeReplacementProof: "src/lib/v10-objective-measurements.ts",
    releaseEvidenceKey: "v10-release:deprecation:descriptor_only_rc_fixtures",
    compatibilityBoundaryKey: "package_v10_commands",
    testsPreserved: true,
    cleanupCommand: "npm run check:v10-suite -- --cleanup descriptor_only_rc_fixtures",
  },
  {
    candidateKey: "v10_semgrep_warning_only", // gitleaks:allow deprecation catalog id, not a secret
    action: "retire",
    supersededBy: "CI-failing V10 guardrails",
    runtimeReplacementProof: "semgrep/oblixa-v10-surface.yml",
    releaseEvidenceKey: "v10-release:deprecation:v10_semgrep_warning_only",
    compatibilityBoundaryKey: "package_v10_commands",
    testsPreserved: true,
    cleanupCommand: "npm run check:v10-release-evidence -- --cleanup v10_semgrep_warning_only",
  },
  {
    candidateKey: "duplicate_v10_e2e_smoke_lane",
    action: "quarantine",
    supersededBy: "intentional smoke/workflow/release-candidate E2E split",
    runtimeReplacementProof: ".github/workflows/ci.yml",
    releaseEvidenceKey: "v10-release:deprecation:duplicate_v10_e2e_smoke_lane",
    compatibilityBoundaryKey: "package_v10_commands",
    testsPreserved: true,
    cleanupCommand: "npm run check:v10-suite -- --cleanup duplicate_v10_e2e_smoke_lane",
  },
  {
    candidateKey: "v9_release_contract_bridge",
    action: "preserve_boundary",
    supersededBy: "v10 release contract with V9 regression bridge preserved only for compatibility gates",
    runtimeReplacementProof: "src/lib/v10-release-contract.ts",
    releaseEvidenceKey: "v10-release:deprecation:v9_release_contract_bridge",
    compatibilityBoundaryKey: "v9_regression_bridge",
    testsPreserved: true,
    cleanupCommand: "npm run check:v10-suite && npm run check:v9-suite",
  },
] as const;

export const V10_WORK_SOURCE_ACTION_MATRIX: readonly V10WorkSourceActionContract[] = [
  ["field_review", "extracted_fields", "field", "open_source_object", "field.reviewed"],
  ["contract_task", "contract_tasks", "work_item", "mark_done", "task.completed"],
  ["obligation", "contract_obligations", "obligation", "mark_done", "obligation.completed"],
  ["approval", "contract_approvals", "approval", "approve_approval", "approval.approved"],
  ["renewal_checkpoint", "contract_renewal_checkpoints", "renewal_checkpoint", "open_source_object", "renewal_checkpoint.opened"],
  ["exception", "exceptions", "exception", "resolve_exception", "exception.resolved"],
  ["evidence_request", "evidence_requirements", "evidence_request", "accept_evidence", "evidence_request.accepted"],
  ["report_failure", "report_runs", "report_run", "retry_failed_job", "report_run.retry_requested"],
  ["export_failure", "contract_export_jobs", "export_job", "retry_failed_job", "export_job.retry_requested"],
  ["import_failure", "contract_import_jobs", "import_job", "retry_failed_job", "import_job.retry_requested"],
  ["extraction_failure", "contract_import_jobs", "extraction_job", "retry_failed_job", "extraction_job.retry_requested"],
  ["automation_approval", "adaptive_playbook_runs", "automation_run", "approve_approval", "automation.approved"],
  ["unassigned_work", "contracts", "contract", "assign_owner", "owner.assigned"],
].map(([workItemType, sourceTable, sourceObjectType, primaryAction, auditAction]) => ({
  workItemType: workItemType as (typeof V10_WORK_ITEM_TYPES)[number],
  sourceTable,
  sourceObjectType: sourceObjectType as (typeof V10_SOURCE_OBJECT_TYPES)[number],
  primaryAction: primaryAction as (typeof V10_WORK_ACTIONS)[number],
  auditAction,
  refreshArtifact: "src/lib/v10-read-model-refresh.ts",
}));

export const V10_JOB_CLASS_MATRIX: readonly V10JobClassContract[] = [
  ["contract_import", "contract_import_jobs", "v10_job_run_visibility", "import"],
  ["file_upload", "contract_import_jobs", "v10_job_run_visibility", "upload"],
  ["extraction", "contract_import_jobs", "v10_job_run_visibility", "extraction"],
  ["export", "contract_export_jobs", "v10_job_run_visibility", "export"],
  ["report_generation", "report_runs", "v10_report_run_visibility", "report"],
  ["report_delivery", "report_runs", "v10_report_run_visibility", "report_delivery"],
  ["reminder_generation", "notification_deliveries", "v10_job_run_visibility", "reminder"],
  ["notification_delivery", "notification_deliveries", "v10_job_run_visibility", "notification"],
  ["automation_execution", "adaptive_playbook_runs", "v10_job_run_visibility", "automation"],
  ["billing_sync", "workspace_billing_events", "release_evidence", "billing"],
].map(([jobClass, sourceTable, visibilityModel, diagnosticPrefix]) => ({
  jobClass: jobClass as (typeof V10_JOB_CLASSES)[number],
  sourceTable,
  visibilityModel: visibilityModel as V10JobClassContract["visibilityModel"],
  retryableStatuses: ["failed_retryable", "partial"],
  terminalStatuses: ["succeeded", "failed_terminal", "canceled"],
  diagnosticPrefix,
}));

const COMMAND_QUERY_CATEGORIES = [
  { prefix: "contract", recordType: "contract", terms: ["acme", "msa", "vendor", "active", "owner"] },
  { prefix: "work", recordType: "work_item", terms: ["overdue", "blocked", "assigned", "unassigned", "high risk"] },
  { prefix: "obligation", recordType: "obligation", terms: ["certification deadline", "deliverable", "clause obligation", "evidence required", "remediation"] },
  { prefix: "account", recordType: "account", terms: ["account workspace", "relationship", "portfolio owner", "health summary", "advanced"] },
  { prefix: "counterparty", recordType: "counterparty", terms: ["counterparty", "relationship", "vendor profile", "account link", "advanced"] },
  { prefix: "approval", recordType: "approval", terms: ["legal approval", "finance approval", "pending approval", "delegated", "sla"] },
  { prefix: "evidence", recordType: "evidence_request", terms: ["soc 2", "rejected evidence", "external link", "resubmit", "follow up"] },
  { prefix: "report", recordType: "report_run", terms: ["workspace health", "failed report", "delivery", "summary", "run"] },
  { prefix: "saved-view", recordType: "saved_view", terms: ["renewal risk", "pinned", "saved view", "filtered contracts", "weekly"] },
  { prefix: "settings", recordType: "setting", terms: ["workspace health", "product settings", "roles", "plans", "notifications"] },
  { prefix: "exception", recordType: "exception", terms: ["high exception", "policy gap", "resolve", "owner", "root cause"] },
  { prefix: "renewal", recordType: "renewal_checkpoint", terms: ["notice deadline", "renewal checkpoint", "90 days", "reminder", "overdue"] },
  { prefix: "import", recordType: "import_job", terms: ["csv import", "import failed", "extraction queued", "row parse", "retry import"] },
  { prefix: "export", recordType: "export_job", terms: ["export queued", "csv export", "truncated export", "50k rows", "download"] },
  { prefix: "assurance", recordType: "finding", terms: ["control gap", "assurance finding", "scorecard", "review board", "health graph"] },
] as const;

export const V10_COMMAND_QUERY_SAMPLE_SET: readonly V10CommandQuerySample[] = Array.from(
  { length: 200 },
  (_, index) => {
    const category = COMMAND_QUERY_CATEGORIES[index % COMMAND_QUERY_CATEGORIES.length]!;
    const term = category.terms[Math.floor(index / COMMAND_QUERY_CATEGORIES.length) % category.terms.length]!;
    const hiddenCase = index % 25 === 24;
    const zeroCase = index % 40 === 39;
    return {
      id: `v10-command-query-${String(index + 1).padStart(3, "0")}`,
      query: `${term} ${index + 1}`,
      expectedRecordType: category.recordType,
      expectedBehavior: hiddenCase
        ? "hidden_record_non_leakage"
        : zeroCase
          ? "recovery_zero_result"
          : index % 3 === 0
            ? "alias_match"
            : "exact_or_prefix_match",
      proofArtifact: "src/app/api/command-palette/contracts/route.ts",
    };
  }
);

export const V10_AUDIT_VOCABULARY_TAXONOMY: readonly V10AuditVocabularyContract[] = [
  { action: "import_job.created", targetType: "import_job", outcomeRequired: true, diagnosticRequiredOnFailure: true, safeMetadataOnly: true },
  { action: "import_job.retry_created", targetType: "import_job", outcomeRequired: true, diagnosticRequiredOnFailure: true, safeMetadataOnly: true },
  { action: "work_item.bulk_completed", targetType: "work_item", outcomeRequired: true, diagnosticRequiredOnFailure: true, safeMetadataOnly: true },
  { action: "export_job.completed", targetType: "export_job", outcomeRequired: true, diagnosticRequiredOnFailure: true, safeMetadataOnly: true },
  { action: "report_run.created", targetType: "report_run", outcomeRequired: true, diagnosticRequiredOnFailure: true, safeMetadataOnly: true },
  { action: "report_run.completed", targetType: "report_run", outcomeRequired: true, diagnosticRequiredOnFailure: true, safeMetadataOnly: true },
  { action: "evidence_request.submitted", targetType: "evidence_request", outcomeRequired: true, diagnosticRequiredOnFailure: true, safeMetadataOnly: true },
  { action: "evidence_request.accepted", targetType: "evidence_request", outcomeRequired: true, diagnosticRequiredOnFailure: true, safeMetadataOnly: true },
  { action: "evidence_request.rejected", targetType: "evidence_request", outcomeRequired: true, diagnosticRequiredOnFailure: true, safeMetadataOnly: true },
  { action: "evidence_request.follow_up_scheduled", targetType: "evidence_request", outcomeRequired: true, diagnosticRequiredOnFailure: true, safeMetadataOnly: true },
  { action: "report_pack.created", targetType: "report_run", outcomeRequired: true, diagnosticRequiredOnFailure: true, safeMetadataOnly: true },
] as const;

export const V10_SOURCE_INVENTORY: readonly V10SourceInventoryEntry[] = [
  { category: "page", key: "dashboard", artifact: "src/app/(dashboard)/dashboard/page.tsx", owner: "product", runtimeStatus: "implemented", testStatus: "e2e" },
  { category: "page", key: "work", artifact: "src/app/(dashboard)/work/page.tsx", owner: "product", runtimeStatus: "implemented", testStatus: "e2e" },
  { category: "page", key: "contract_detail", artifact: "src/app/(dashboard)/contracts/[id]/page.tsx", owner: "product", runtimeStatus: "implemented", testStatus: "e2e" },
  { category: "page", key: "settings_health", artifact: "src/app/(dashboard)/settings/health/page.tsx", owner: "operations", runtimeStatus: "implemented", testStatus: "unit" },
  { category: "api_route", key: "command_palette_contracts", artifact: "src/app/api/command-palette/contracts/route.ts", owner: "product", runtimeStatus: "implemented", testStatus: "api" },
  { category: "api_route", key: "import_contracts", artifact: "src/app/api/import/contracts/route.ts", owner: "engineering", runtimeStatus: "implemented", testStatus: "api" },
  { category: "api_route", key: "export_contracts", artifact: "src/app/api/export/contracts/route.ts", owner: "engineering", runtimeStatus: "implemented", testStatus: "api" },
  { category: "api_route", key: "report_packs", artifact: "src/app/api/report-packs/route.ts", owner: "operations", runtimeStatus: "implemented", testStatus: "api" },
  { category: "cron", key: "evidence_followup", artifact: "src/app/api/cron/v4/evidence-followup/route.ts", owner: "operations", runtimeStatus: "implemented", testStatus: "api" },
  { category: "cron", key: "recompute_signals", artifact: "src/app/api/contracts/recompute-signals/route.ts", owner: "operations", runtimeStatus: "implemented", testStatus: "release_check" },
  { category: "server_action", key: "tasks", artifact: "src/actions/tasks.ts", owner: "engineering", runtimeStatus: "implemented", testStatus: "unit" },
  {
    category: "server_action",
    key: "v10_bulk_compatible_work",
    artifact: "src/actions/v10-bulk-compatible-work.ts",
    owner: "engineering",
    runtimeStatus: "implemented",
    testStatus: "unit",
  },
  { category: "server_action", key: "approvals", artifact: "src/actions/approvals.ts", owner: "product", runtimeStatus: "implemented", testStatus: "unit" },
  { category: "server_action", key: "exceptions", artifact: "src/actions/exceptions.ts", owner: "product", runtimeStatus: "implemented", testStatus: "unit" },
  { category: "database_table", key: "v10_runtime_contracts", artifact: "supabase/migrations/057_v10_runtime_contracts.sql", owner: "engineering", runtimeStatus: "implemented", testStatus: "unit" },
  { category: "database_table", key: "v10_runtime_coverage_ledger", artifact: "supabase/migrations/057_v10_runtime_contracts.sql", owner: "engineering", runtimeStatus: "implemented", testStatus: "unit" },
  { category: "read_model", key: "read_model_refresh", artifact: "src/lib/v10-read-model-refresh.ts", owner: "engineering", runtimeStatus: "implemented", testStatus: "unit" },
  { category: "telemetry_event", key: "product_v10_events", artifact: "src/lib/product-telemetry.ts", owner: "product", runtimeStatus: "implemented", testStatus: "unit" },
  { category: "audit_action", key: "v10_audit_vocabulary", artifact: "src/lib/v10-final-gap-audit.ts", owner: "security", runtimeStatus: "implemented", testStatus: "unit" },
  ...V10_CORE_REPORT_FAMILIES.map((family) => ({
    category: "report_family" as const,
    key: family,
    artifact: "src/lib/v10-read-model-refresh.ts",
    owner: "operations" as const,
    runtimeStatus: "implemented" as const,
    testStatus: "unit" as const,
  })),
  ...V10_JOB_CLASSES.map((jobClass) => ({
    category: "job_class" as const,
    key: jobClass,
    artifact: "src/lib/v10-job-visibility.ts",
    owner: "operations" as const,
    runtimeStatus: "implemented" as const,
    testStatus: "unit" as const,
  })),
  ...V10_NOTIFICATION_CLASSES.map((notificationClass) => ({
    category: "notification_class" as const,
    key: notificationClass,
    artifact: "src/lib/v10-read-model-refresh.ts",
    owner: "operations" as const,
    runtimeStatus: "implemented" as const,
    testStatus: "unit" as const,
  })),
  { category: "release_artifact", key: "release_evidence", artifact: "src/lib/v10-release-evidence.ts", owner: "release", runtimeStatus: "external_blocker", testStatus: "release_check" },
  { category: "component", key: "v10_recoverable_state", artifact: "src/components/ui/v10-recoverable-state.tsx", owner: "product", runtimeStatus: "implemented", testStatus: "ui" },
  { category: "api_contract", key: "route_api_catalog", artifact: "src/lib/v10-route-api-catalog.ts", owner: "engineering", runtimeStatus: "implemented", testStatus: "unit" },
  { category: "migration", key: "v10_runtime_migration", artifact: "supabase/migrations/057_v10_runtime_contracts.sql", owner: "engineering", runtimeStatus: "implemented", testStatus: "unit" },
  { category: "script", key: "v10_suite", artifact: "scripts/check-v10-suite.mjs", owner: "release", runtimeStatus: "implemented", testStatus: "release_check" },
  { category: "script", key: "v10_release_evidence", artifact: "scripts/check-v10-release-evidence.mjs", owner: "release", runtimeStatus: "implemented", testStatus: "release_check" },
  { category: "script", key: "v10_migration_smoke", artifact: "scripts/check-v10-migration-smoke.mjs", owner: "engineering", runtimeStatus: "implemented", testStatus: "release_check" },
  { category: "ci_workflow", key: "github_ci", artifact: ".github/workflows/ci.yml", owner: "release", runtimeStatus: "implemented", testStatus: "release_check" },
  { category: "semgrep_rule", key: "v10_surface_rules", artifact: "semgrep/oblixa-v10-surface.yml", owner: "security", runtimeStatus: "implemented", testStatus: "release_check" },
  { category: "fixture", key: "v10_core_smoke", artifact: "e2e/v10-core-smoke.spec.ts", owner: "release", runtimeStatus: "implemented", testStatus: "e2e" },
  { category: "external_evidence_gate", key: "non_autonomous_release_gates", artifact: "src/lib/v10-release-evidence.ts", owner: "release", runtimeStatus: "external_blocker", testStatus: "release_check" },
  { category: "runbook", key: "rebuild_read_models", artifact: "scripts/rebuild-v10-read-models.mjs", owner: "operations", runtimeStatus: "implemented", testStatus: "release_check" },
  { category: "environment_config", key: "vercel_crons", artifact: "vercel.json", owner: "operations", runtimeStatus: "implemented", testStatus: "release_check" },
  { category: "support_boundary", key: "settings_health_support_safe", artifact: "src/app/(dashboard)/settings/health/page.tsx", owner: "support", runtimeStatus: "implemented", testStatus: "unit" },
  { category: "verification_matrix", key: "final_gap_audit", artifact: "src/lib/v10-final-gap-audit.ts", owner: "release", runtimeStatus: "implemented", testStatus: "unit" },
] as const;

export const V10_REQUIRED_SOURCE_INVENTORY_CATEGORIES = [
  "page",
  "component",
  "api_route",
  "api_contract",
  "server_action",
  "cron",
  "database_table",
  "migration",
  "read_model",
  "telemetry_event",
  "audit_action",
  "report_family",
  "job_class",
  "notification_class",
  "release_artifact",
  "script",
  "ci_workflow",
  "semgrep_rule",
  "fixture",
  "external_evidence_gate",
  "runbook",
  "environment_config",
  "support_boundary",
  "verification_matrix",
] as const satisfies readonly V10SourceInventoryEntry["category"][];

export const V10_REQUIRED_FILE_OWNERSHIP_AREAS = [
  "spec",
  "database",
  "read_models",
  "mutations",
  "api",
  "server_actions",
  "dashboard_surfaces",
  "components",
  "telemetry",
  "audit",
  "testing",
  "fixtures",
  "ci_scripts",
  "security",
  "release",
  "operations",
  "environment",
  "integrations",
  "support",
  "compliance",
  "runbooks",
  "verification",
] as const satisfies readonly V10FileOwnershipArea[];

export const V10_REQUIRED_COMPATIBILITY_BOUNDARIES = [
  "public_url",
  "external_link",
  "artifact",
  "report_export_format",
  "audit_action",
  "telemetry_event",
  "migration_version",
  "stable_command",
  "persisted_data",
  "api_schema",
  "cache_policy",
  "provider_config",
  "entitlement_state",
  "support_diagnostic",
  "browser_support",
] as const satisfies readonly V10CompatibilityBoundary["boundary"][];

export const V10_REQUIRED_PROOF_DIMENSIONS = [
  "runtime_behavior",
  "functional_coverage",
  "data_contract",
  "api_contract",
  "authorization",
  "audit",
  "idempotency",
  "read_model_freshness",
  "telemetry",
  "privacy",
  "recoverable_ui",
  "accessibility",
  "performance",
  "fixture_or_e2e",
  "release_evidence",
  "operations",
  "environment_config",
  "integration_boundary",
  "data_lifecycle",
  "support_boundary",
  "compatibility",
  "post_ga_drift",
  "verification_matrix",
] as const satisfies readonly V10ProofDimension[];

export function getV10PlanTodoProof(planTodoId: string): V10PlanTodoProof | null {
  return PLAN_TODO_PROOF_ROWS.find((row) => row.planTodoId === planTodoId) ?? null;
}

export function validateV10FinalGapAudit(): string[] {
  const failures: string[] = [];
  const workTypes = new Set(V10_WORK_ITEM_TYPES);
  for (const type of workTypes) {
    if (!V10_WORK_SOURCE_ACTION_MATRIX.some((row) => row.workItemType === type)) {
      failures.push(`missing_work_source_action:${type}`);
    }
  }
  const jobClasses = new Set(V10_JOB_CLASSES);
  for (const jobClass of jobClasses) {
    if (!V10_JOB_CLASS_MATRIX.some((row) => row.jobClass === jobClass)) {
      failures.push(`missing_job_class:${jobClass}`);
    }
  }
  for (const row of V10_JOB_CLASS_MATRIX) {
    for (const status of [...row.retryableStatuses, ...row.terminalStatuses]) {
      if (!V10_JOB_STATUSES.includes(status)) failures.push(`invalid_job_status:${row.jobClass}:${status}`);
    }
  }
  if (V10_COMMAND_QUERY_SAMPLE_SET.length !== 200) failures.push("command_query_sample_size_mismatch");
  for (const notificationClass of V10_NOTIFICATION_CLASSES) {
    if (!notificationClass.includes("_") && notificationClass.length < 4) {
      failures.push(`notification_class_too_weak:${notificationClass}`);
    }
  }
  for (const audit of V10_AUDIT_VOCABULARY_TAXONOMY) {
    if (!audit.action.includes(".")) failures.push(`audit_action_not_namespaced:${audit.action}`);
    if (!audit.safeMetadataOnly) failures.push(`audit_metadata_not_safe:${audit.action}`);
  }
  return failures;
}

export function validateV10SourceInventory(inventory: readonly V10SourceInventoryEntry[] = V10_SOURCE_INVENTORY): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const entry of inventory) {
    const key = `${entry.category}:${entry.key}`;
    if (seen.has(key)) failures.push(`duplicate_inventory_key:${key}`);
    seen.add(key);
    if (!entry.artifact) failures.push(`${key}:artifact_required`);
    if (entry.runtimeStatus === "external_blocker" && entry.testStatus !== "release_check") {
      failures.push(`${key}:external_blocker_requires_release_check`);
    }
  }
  for (const category of V10_REQUIRED_SOURCE_INVENTORY_CATEGORIES) {
    if (!inventory.some((entry) => entry.category === category)) failures.push(`inventory_category_missing:${category}`);
  }
  return failures;
}

export function validateV10FinalGapRatchet(input: {
  inventory?: readonly V10SourceInventoryEntry[];
  sourceTexts?: readonly { artifact: string; text: string }[];
} = {}): string[] {
  const failures: string[] = [];
  const inventory = input.inventory ?? V10_SOURCE_INVENTORY;
  for (const entry of inventory) {
    const key = `${entry.category}:${entry.key}`;
    if (!entry.owner) failures.push(`${key}:runtime_owner_required`);
    if (!entry.artifact) failures.push(`${key}:artifact_required`);
    if (entry.runtimeStatus === "contract_only") failures.push(`${key}:runtime_implementation_required`);
    if (entry.runtimeStatus === "external_blocker" && entry.testStatus !== "release_check") {
      failures.push(`${key}:external_blocker_release_check_required`);
    }
  }
  for (const proof of PLAN_TODO_PROOF_ROWS) {
    if (proof.artifacts.length === 0) failures.push(`${proof.planTodoId}:proof_artifact_required`);
    if (proof.blocker && proof.proofKind !== "release_evidence" && proof.proofKind !== "non_autonomous_blocker" && proof.proofKind !== "environment_gated") {
      failures.push(`${proof.planTodoId}:blocker_kind_mismatch`);
    }
  }
  if (new Set(PLAN_TODO_PROOF_ROWS.map((proof) => proof.planTodoId)).size !== PLAN_TODO_PROOF_ROWS.length) {
    failures.push("plan_todo_proof_duplicate");
  }
  for (const planTodoId of V10_ATTACHED_PLAN_TODO_IDS) {
    if (!PLAN_TODO_PROOF_ROWS.some((proof) => proof.planTodoId === planTodoId)) {
      failures.push(`${planTodoId}:attached_plan_proof_required`);
    }
  }
  for (const source of input.sourceTexts ?? []) {
    if (/\b(TODO|FIXME|TBD|placeholder|stubbed|not implemented)\b/i.test(source.text)) {
      failures.push(`${source.artifact}:placeholder_text_blocked`);
    }
    if (/\b(skip|todo)\(/i.test(source.text)) failures.push(`${source.artifact}:skipped_test_blocked`);
  }
  return failures;
}

function classifyClaimVsProof(runtimeStatus: V10AcceptanceRuntimeStatus): V10ClaimVsProofRow["proofState"] {
  if (runtimeStatus === "runtime_verified" || runtimeStatus === "runtime_mapped") return "runtime_backed";
  if (runtimeStatus === "release_evidence_required") return "release_evidence_required";
  if (runtimeStatus === "non_autonomous_blocker") return "external_blocker";
  return "static_or_contract_only";
}

export function buildV10ClaimVsProofRows(): V10ClaimVsProofRow[] {
  return V10_ACCEPTANCE_MATRIX.map((row) => {
    const proof = getV10AcceptanceProof(row);
    const proofState = classifyClaimVsProof(proof.runtimeStatus);
    const failingGap =
      row.disposition === "shipped" && proofState !== "runtime_backed"
        ? `shipped_claim_not_runtime_backed:${row.id}`
        : proofState === "static_or_contract_only"
          ? `static_or_contract_only:${row.id}`
          : null;
    return {
      id: row.id,
      claim: row.disposition,
      runtimeStatus: proof.runtimeStatus,
      proofState,
      artifacts: row.artifacts,
      gates: row.gates,
      failingGap,
    };
  });
}

export function validateV10Phase0InventoryLock(input: {
  implementationMatrix?: readonly V10FrozenImplementationMatrixRow[];
  ownershipMap?: readonly V10FileOwnershipRow[];
  deprecationCandidates?: readonly V10DeprecationCandidate[];
  deprecationDecisions?: readonly V10DeprecationCleanupDecision[];
  compatibilityBoundaries?: readonly V10CompatibilityBoundary[];
  claimVsProofRows?: readonly V10ClaimVsProofRow[];
} = {}): string[] {
  const failures: string[] = [];
  const implementationMatrix = input.implementationMatrix ?? V10_FROZEN_IMPLEMENTATION_MATRIX;
  const ownershipMap = input.ownershipMap ?? V10_FILE_OWNERSHIP_MAP;
  const deprecationCandidates = input.deprecationCandidates ?? V10_DEPRECATION_CANDIDATES;
  const deprecationDecisions = input.deprecationDecisions ?? V10_DEPRECATION_CLEANUP_DECISIONS;
  const compatibilityBoundaries = input.compatibilityBoundaries ?? V10_COMPATIBILITY_BOUNDARIES;
  const claimVsProofRows = input.claimVsProofRows ?? buildV10ClaimVsProofRows();

  for (const todoId of V10_MASTER_PLAN_TODO_IDS) {
    if (!implementationMatrix.some((row) => row.todoId === todoId)) failures.push(`phase0_matrix_missing_todo:${todoId}`);
  }
  for (const row of implementationMatrix) {
    if (row.primaryArtifacts.length === 0) failures.push(`${row.todoId}:primary_artifacts_required`);
    if (row.requiredDimensions.length === 0) failures.push(`${row.todoId}:required_dimensions_required`);
    if (row.acceptanceIds.length === 0) failures.push(`${row.todoId}:acceptance_ids_required`);
    for (const acceptanceId of row.acceptanceIds) {
      if (!V10_ACCEPTANCE_MATRIX.some((acceptance) => acceptance.id === acceptanceId)) {
        failures.push(`${row.todoId}:unknown_acceptance_id:${acceptanceId}`);
      }
    }
  }
  for (const dimension of V10_REQUIRED_PROOF_DIMENSIONS) {
    if (!implementationMatrix.some((row) => row.requiredDimensions.includes(dimension))) {
      failures.push(`phase0_dimension_missing:${dimension}`);
    }
  }

  for (const area of V10_REQUIRED_FILE_OWNERSHIP_AREAS) {
    if (!ownershipMap.some((row) => row.area === area)) failures.push(`ownership_area_missing:${area}`);
  }
  for (const row of ownershipMap) {
    if (!row.pathPrefix) failures.push(`${row.area}:path_prefix_required`);
    if (row.requiredProof.length === 0) failures.push(`${row.area}:required_proof_required`);
  }

  for (const candidate of deprecationCandidates) {
    if (!V10_MASTER_PLAN_TODO_IDS.includes(candidate.removalGate)) {
      failures.push(`deprecation_unknown_removal_gate:${candidate.key}:${candidate.removalGate}`);
    }
    if (!candidate.replacement.trim()) failures.push(`deprecation_replacement_required:${candidate.key}`);
  }
  for (const category of ["duplicate_queue", "legacy_audit", "v9_label", "placeholder_gate", "descriptor_fixture", "duplicate_e2e", "metadata_only_claim"] as const) {
    if (!deprecationCandidates.some((candidate) => candidate.category === category)) {
      failures.push(`deprecation_category_missing:${category}`);
    }
  }
  failures.push(
    ...validateV10DeprecationCleanupDecisions({
      candidates: deprecationCandidates,
      decisions: deprecationDecisions,
      compatibilityBoundaries,
    })
  );

  for (const boundary of compatibilityBoundaries) {
    if (!boundary.owningArtifact) failures.push(`compatibility_boundary_owner_required:${boundary.key}`);
    if (boundary.compatibilityPolicy === "cleanup_after_backfill" && boundary.boundary !== "persisted_data") {
      failures.push(`compatibility_cleanup_only_for_persisted_data:${boundary.key}`);
    }
  }
  for (const boundary of V10_REQUIRED_COMPATIBILITY_BOUNDARIES) {
    if (!compatibilityBoundaries.some((row) => row.boundary === boundary)) {
      failures.push(`compatibility_boundary_missing:${boundary}`);
    }
  }

  for (const row of claimVsProofRows) {
    if (row.claim === "shipped" && row.proofState !== "runtime_backed") {
      failures.push(row.failingGap ?? `shipped_claim_not_runtime_backed:${row.id}`);
    }
    if (row.artifacts.length === 0) failures.push(`claim_artifacts_required:${row.id}`);
    if (row.gates.length === 0) failures.push(`claim_gates_required:${row.id}`);
  }

  for (const sourceObject of V10_SOURCE_OBJECT_INVENTORY) {
    if (sourceObject.tests.length === 0) failures.push(`source_object_tests_required:${sourceObject.sourceObjectType}`);
    if (sourceObject.organizationScope === "required" && sourceObject.autonomousStatus === "external_evidence") {
      failures.push(`source_object_runtime_scope_external_only:${sourceObject.sourceObjectType}`);
    }
  }

  for (const requirement of V10_IMPLEMENTATION_REQUIREMENTS) {
    if (requirement.artifacts.length === 0) failures.push(`implementation_requirement_artifacts_required:${requirement.id}`);
    if (!implementationMatrix.some((row) => row.acceptanceIds.some((acceptanceId) => requirement.id.includes(acceptanceId) || V10_ACCEPTANCE_MATRIX.some((acceptance) => acceptance.id === acceptanceId)))) {
      failures.push(`implementation_requirement_not_phase0_mapped:${requirement.id}`);
    }
  }

  return failures;
}

export function validateV10DeprecationCleanupDecisions(input: {
  candidates?: readonly V10DeprecationCandidate[];
  decisions?: readonly V10DeprecationCleanupDecision[];
  compatibilityBoundaries?: readonly V10CompatibilityBoundary[];
} = {}): string[] {
  const candidates = input.candidates ?? V10_DEPRECATION_CANDIDATES;
  const decisions = input.decisions ?? V10_DEPRECATION_CLEANUP_DECISIONS;
  const compatibilityBoundaries = input.compatibilityBoundaries ?? V10_COMPATIBILITY_BOUNDARIES;
  const failures: string[] = [];
  const boundaryKeys = new Set(compatibilityBoundaries.map((boundary) => boundary.key));
  const decisionByCandidate = new Map(decisions.map((decision) => [decision.candidateKey, decision]));

  for (const candidate of candidates) {
    const decision = decisionByCandidate.get(candidate.key);
    if (!decision) {
      failures.push(`deprecation_decision_missing:${candidate.key}`);
      continue;
    }
    if (!decision.supersededBy.includes(candidate.replacement)) failures.push(`${candidate.key}:supersession_mismatch`);
    if (!decision.runtimeReplacementProof) failures.push(`${candidate.key}:runtime_replacement_proof_required`);
    if (!decision.releaseEvidenceKey.startsWith("v10-release:deprecation:")) failures.push(`${candidate.key}:release_evidence_key_required`);
    if (!boundaryKeys.has(decision.compatibilityBoundaryKey)) failures.push(`${candidate.key}:compatibility_boundary_unknown`);
    if (!decision.testsPreserved) failures.push(`${candidate.key}:tests_preservation_required`);
    if (!decision.cleanupCommand.startsWith("npm run check:v10")) failures.push(`${candidate.key}:stable_cleanup_command_required`);
    if ((candidate.category === "placeholder_gate" || candidate.category === "descriptor_fixture") && decision.action === "preserve_boundary") {
      failures.push(`${candidate.key}:placeholder_or_descriptor_must_not_be_preserved`);
    }
    if (candidate.category === "legacy_audit" && decision.action === "retire") {
      failures.push(`${candidate.key}:legacy_audit_requires_quarantine_or_boundary_preservation`);
    }
  }

  for (const decision of decisions) {
    if (!candidates.some((candidate) => candidate.key === decision.candidateKey)) {
      failures.push(`deprecation_decision_unknown_candidate:${decision.candidateKey}`);
    }
  }
  if (new Set(decisions.map((decision) => decision.candidateKey)).size !== decisions.length) failures.push("deprecation_decision_duplicate");
  return failures;
}

function normalizeV10MatrixKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function buildV10NoExclusionsMatrixRow(input: {
  matrix: V10NoExclusionsMatrixKind;
  key: string;
  priority: V10NoExclusionsVerificationMatrixRow["priority"];
  owner: V10NoExclusionsVerificationMatrixRow["owner"];
  runtimeArtifact: string;
  dataArtifact?: string;
  uiArtifact?: string;
  mutationApiArtifact?: string;
  testArtifact: string;
  releaseEvidenceKey?: string;
  telemetryEvent?: `product.v10.${string}`;
  auditAction?: string;
  privacyClassification?: V10NoExclusionsVerificationMatrixRow["privacyClassification"];
  rollbackPlan?: string;
  status?: V10NoExclusionsVerificationMatrixRow["status"];
}): V10NoExclusionsVerificationMatrixRow {
  const normalizedKey = normalizeV10MatrixKey(input.key);
  return {
    matrix: input.matrix,
    key: input.key,
    priority: input.priority,
    owner: input.owner,
    runtimeArtifact: input.runtimeArtifact,
    dataArtifact: input.dataArtifact ?? "src/lib/v10-read-models.ts",
    uiArtifact: input.uiArtifact ?? "src/lib/v10-ui-state-contracts.ts",
    mutationApiArtifact: input.mutationApiArtifact ?? "src/lib/v10-route-api-catalog.ts",
    testArtifact: input.testArtifact,
    releaseEvidenceKey: input.releaseEvidenceKey ?? `v10-release:${input.matrix}:${normalizedKey}`,
    telemetryEvent: input.telemetryEvent ?? (`product.v10.${normalizedKey}_verified` as `product.v10.${string}`),
    auditAction: input.auditAction ?? `v10.${normalizedKey}_verified`,
    privacyClassification: input.privacyClassification ?? "diagnostic_safe",
    rollbackPlan: input.rollbackPlan ?? "Use Settings Health recovery, release blocker, or V10 rollback command before promotion.",
    status: input.status ?? "runtime_backed",
  };
}

export function buildV10NoExclusionsVerificationMatrix(
  input: {
    implementationMatrix?: readonly V10FrozenImplementationMatrixRow[];
    sourceInventory?: readonly V10SourceInventoryEntry[];
  } = {}
): V10NoExclusionsVerificationMatrixRow[] {
  const implementationMatrix = input.implementationMatrix ?? V10_FROZEN_IMPLEMENTATION_MATRIX;
  const sourceInventory = input.sourceInventory ?? V10_SOURCE_INVENTORY;
  const rows: V10NoExclusionsVerificationMatrixRow[] = [];

  rows.push(
    ...implementationMatrix.map((row) =>
      buildV10NoExclusionsMatrixRow({
        matrix: "requirement",
        key: row.todoId,
        priority: row.todoId.includes("phase-8") ? "P2" : row.todoId.includes("phase-10") || row.todoId.includes("phase-14") ? "release" : "P1",
        owner: getV10PlanTodoProof(row.todoId)?.owner ?? "engineering",
        runtimeArtifact: row.primaryArtifacts[0] ?? "src/lib/v10-final-gap-audit.ts",
        testArtifact: row.primaryArtifacts.find((artifact) => artifact.endsWith(".test.ts") || artifact.endsWith(".test.tsx")) ?? "src/lib/v10-final-gap-audit.v10.test.ts",
        releaseEvidenceKey: `v10-release:requirement:${row.todoId}`,
        status: row.blockerPolicy === "external_evidence_allowed" ? "release_evidence_required" : "runtime_backed",
      })
    )
  );

  rows.push(
    ...sourceInventory.map((entry) =>
      buildV10NoExclusionsMatrixRow({
        matrix: "file",
        key: `${entry.category}:${entry.key}`,
        priority: entry.category === "external_evidence_gate" || entry.category === "release_artifact" ? "release" : "P1",
        owner: entry.owner,
        runtimeArtifact: entry.artifact,
        testArtifact: entry.testStatus === "release_check" ? "src/lib/v10-release-evidence.v10.test.ts" : "src/lib/v10-final-gap-audit.v10.test.ts",
        releaseEvidenceKey: `v10-release:file:${entry.category}:${entry.key}`,
        status: entry.runtimeStatus === "external_blocker" ? "external_blocker" : "runtime_backed",
      })
    )
  );

  rows.push(
    ...V10_SOURCE_OBJECT_TYPES.map((sourceObject) =>
      buildV10NoExclusionsMatrixRow({
        matrix: "source_object",
        key: sourceObject,
        priority: "P1",
        owner: "product",
        runtimeArtifact: "src/lib/v10-source-object-inventory.ts",
        dataArtifact: "src/lib/v10-read-models.ts",
        testArtifact: "src/lib/v10-source-object-inventory.v10.test.ts",
        auditAction: `${sourceObject}.verified`,
        privacyClassification: "server_safe",
      })
    )
  );

  rows.push(
    ...V10_ROUTE_API_CATALOG.map((route) =>
      buildV10NoExclusionsMatrixRow({
        matrix: "route",
        key: `${route.methods.join("_")}:${route.path}`,
        priority: route.minimumMode === "core" ? "P1" : "P2",
        owner: "engineering",
        runtimeArtifact: route.path.startsWith("/api/")
          ? `src/app${route.path}/route.ts`.replace(/\[jobId\]/g, "[jobId]")
          : "src/lib/v10-route-api-catalog.ts",
        testArtifact: "src/lib/v10-route-api-catalog.v10.test.ts",
        mutationApiArtifact: "src/lib/v10-route-api-catalog.ts",
        releaseEvidenceKey: `v10-release:route:${normalizeV10MatrixKey(route.path)}`,
        auditAction: route.auditRequired ? `${route.featureFamily}.route_verified` : "v10.route_verified",
        privacyClassification: "client_safe",
      })
    )
  );

  rows.push(
    ...V10_REQUIRED_MUTATION_CONTRACTS.map((mutation) =>
      buildV10NoExclusionsMatrixRow({
        matrix: "mutation",
        key: mutation.key,
        priority: "P1",
        owner: "engineering",
        runtimeArtifact: mutation.runtimeArtifact,
        testArtifact: "src/lib/v10-server-contracts.v10.test.ts",
        mutationApiArtifact: "src/lib/v10-mutation-envelope.ts",
        auditAction: mutation.auditAction,
        privacyClassification: "audit_safe",
      })
    )
  );

  rows.push(
    ...V10_AUDIT_VOCABULARY_TAXONOMY.map((event) =>
      buildV10NoExclusionsMatrixRow({
        matrix: "telemetry_audit",
        key: event.action,
        priority: "P1",
        owner: "security",
        runtimeArtifact: "src/lib/v10-final-gap-audit.ts",
        testArtifact: "src/lib/v10-final-gap-audit.v10.test.ts",
        telemetryEvent: `product.v10.${normalizeV10MatrixKey(event.action)}_observed` as `product.v10.${string}`,
        auditAction: event.action,
        privacyClassification: "audit_safe",
      })
    )
  );

  rows.push(
    ...[
      "npm run check:v10-suite",
      "npm run check:v10-release-evidence",
      "npm run check:v10-migration-smoke",
      "npm run check:v10-privacy-scan",
      "npm run test:e2e:v10",
    ].map((command) =>
      buildV10NoExclusionsMatrixRow({
        matrix: "ci_release_gate",
        key: command,
        priority: "release",
        owner: "release",
        runtimeArtifact: "scripts/check-v10-suite.mjs",
        testArtifact: "src/lib/v10-release-evidence.v10.test.ts",
        releaseEvidenceKey: `v10-release:ci:${normalizeV10MatrixKey(command)}`,
        auditAction: "release.gate_verified",
        privacyClassification: "synthetic_only",
        status: command.includes("e2e") ? "release_evidence_required" : "runtime_backed",
      })
    )
  );

  return rows;
}

export function validateV10NoExclusionsVerificationMatrix(
  rows: readonly V10NoExclusionsVerificationMatrixRow[] = buildV10NoExclusionsVerificationMatrix()
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  const requiredMatrices: readonly V10NoExclusionsMatrixKind[] = [
    "requirement",
    "file",
    "source_object",
    "route",
    "mutation",
    "telemetry_audit",
    "ci_release_gate",
  ];
  for (const matrix of requiredMatrices) {
    if (!rows.some((row) => row.matrix === matrix)) failures.push(`verification_matrix_missing:${matrix}`);
  }
  for (const row of rows) {
    const key = `${row.matrix}:${row.key}`;
    if (seen.has(key)) failures.push(`verification_matrix_duplicate:${key}`);
    seen.add(key);
    if (!row.owner) failures.push(`${key}:owner_required`);
    if (!row.runtimeArtifact) failures.push(`${key}:runtime_artifact_required`);
    if (!row.dataArtifact) failures.push(`${key}:data_artifact_required`);
    if (!row.uiArtifact) failures.push(`${key}:ui_artifact_required`);
    if (!row.mutationApiArtifact) failures.push(`${key}:mutation_api_artifact_required`);
    if (!row.testArtifact) failures.push(`${key}:test_artifact_required`);
    if (!row.releaseEvidenceKey.startsWith("v10-release:")) failures.push(`${key}:release_evidence_required`);
    if (!row.telemetryEvent.startsWith("product.v10.")) failures.push(`${key}:telemetry_event_required`);
    if (!row.auditAction.includes(".")) failures.push(`${key}:audit_action_required`);
    if (!row.rollbackPlan.trim()) failures.push(`${key}:rollback_plan_required`);
    if (row.status !== "runtime_backed" && row.status !== "release_evidence_required" && row.status !== "external_blocker") {
      failures.push(`${key}:status_invalid`);
    }
    if (/raw|token|secret|customer payload|credential/i.test(row.rollbackPlan)) failures.push(`${key}:rollback_plan_not_support_safe`);
  }
  return failures;
}

