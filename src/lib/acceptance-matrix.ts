import { SPEC_ARTIFACT_V10 } from "./spec-artifact-ids";

export type V10AcceptanceDisposition =
  | "shipped"
  | "automated_gate"
  | "release_evidence"
  | "environment_gated"
  | "non_autonomous_blocker";

export type V10AcceptanceMatrixRow = {
  id: string;
  category:
    | "surface"
    | "data"
    | "api"
    | "security"
    | "release"
    | "operations"
    | "quality"
    | "measurement";
  disposition: V10AcceptanceDisposition;
  artifacts: readonly string[];
  gates: readonly string[];
  blockerType?: "external_dashboard" | "human_study" | "production_fixture" | "provider_configuration" | "release_owner_signoff";
};

export type V10AcceptancePriority = "P0" | "P1" | "P2" | "release_blocker";
export type V10AcceptanceReleaseStateImpact = "blocks_beta" | "blocks_ga" | "blocks_complete" | "holds_promotion";

export type V10AcceptanceRuntimeStatus =
  | "runtime_verified"
  | "runtime_mapped"
  | "typed_contract_only"
  | "release_evidence_required"
  | "non_autonomous_blocker";

export type V10AcceptanceProof = {
  id: string;
  specSections: readonly string[];
  docSpecSections: readonly string[];
  priority: V10AcceptancePriority;
  runtimeStatus: V10AcceptanceRuntimeStatus;
  implementationArtifacts: readonly string[];
  testGates: readonly string[];
  releaseEvidence: readonly string[];
  releaseEvidenceOwner: "engineering" | "product" | "operations" | "security" | "release" | "support";
  verificationCommands: readonly string[];
  objectiveMetricKey: string | null;
  releaseBlocking: boolean;
  blockerStatus: string;
  releaseStateImpact: V10AcceptanceReleaseStateImpact;
};

export type V10AcceptanceCoverageSummary = {
  total: number;
  runtimeBacked: readonly string[];
  staticContractOnly: readonly string[];
  automatedGated: readonly string[];
  releaseEvidenceGated: readonly string[];
  environmentGated: readonly string[];
  nonAutonomousBlocked: readonly string[];
  silentGaps: readonly string[];
};

export type V10AcceptanceGateClosureKind =
  | "runtime_proof"
  | "automated_gate"
  | "release_evidence"
  | "external_blocker";

export type V10AcceptanceGateClosureRow = {
  id: string;
  closureKind: V10AcceptanceGateClosureKind;
  runtimeStatus: V10AcceptanceRuntimeStatus;
  proofArtifacts: readonly string[];
  executableGates: readonly string[];
  releaseEvidence: readonly string[];
  blockerStatus: string;
  openGap: string | null;
};

export const V10_REQUIRED_ACCEPTANCE_IDS = [
  "fix-runtime-migration",
  "activation-intake",
  "home-daily-brief",
  "unified-work",
  "contract-record",
  "review-provenance-quality",
  "renewals-critical-dates",
  "evidence-obligations-collaboration",
  "approvals-decisions-exceptions",
  "complete-search-router",
  "reports-exports-reviews",
  "governance-health-reliability",
  "telemetry-objectives",
  "accessibility-performance-responsive",
  "p1-p2-continuity",
  "mutation-contracts",
  "security-privacy-data",
  "read-model-foundation",
  "route-api-contracts",
  "fixture-measurement-gates",
  "rollout-backfill-recovery",
  "surface-component-primitives",
  "negative-adversarial-coverage",
  "acceptance-matrix",
  "file-level-gap-closure",
  "ci-quality-ratchets",
  "fixture-runbooks-observability",
  "compatibility-regression-boundaries",
  "data-lineage-invariants",
  "release-handoff",
  "authorization-data-classification",
  "route-state-a11y-performance",
  "artifact-definition-of-done",
  "risk-register-review",
  "final-gap-audit-protocol",
  "non-autonomous-evidence-schema",
  "blocker-taxonomy",
  "implementation-slicing",
  "lifecycle-provider-boundaries",
  "operational-evidence-ownership",
  "concurrency-cache-time",
  "audit-vocabulary-taxonomy",
  "seed-backfill-tooling",
  "journey-contracts",
  "api-response-schemas",
  "threat-abuse-model",
  "release-signoff-governance",
  "database-constraint-index-budget",
  "component-copy-contracts",
  "browser-device-support",
  "adoption-operational-feedback",
  "environment-config-parity",
  "synthetic-fixture-safety",
  "deprecation-cleanup-policy",
  "support-docs-boundaries",
  "dependency-supply-chain",
  "state-machine-contracts",
  "contract-versioning-compatibility",
  "measurement-governance",
  "audit-telemetry-event-schemas",
  "support-admin-boundaries",
  "privacy-lifecycle-requests",
  "disaster-recovery-resilience",
  "tenant-isolation-proof",
  "progressive-rollout-canary",
  "data-quality-remediation-loop",
  "artifact-contracts",
  "intake-parser-validation",
  "api-pagination-filtering",
  "entitlement-billing-sync",
  "notification-consent-compliance",
  "report-export-redaction",
  "deterministic-ordering-contracts",
  "failure-injection-qa",
  "trace-release-evidence",
  "verification-gates",
] as const;

export const V10_ACCEPTANCE_MATRIX: readonly V10AcceptanceMatrixRow[] = [
  {
    id: "fix-runtime-migration",
    category: "data",
    disposition: "automated_gate",
    artifacts: ["supabase/migrations/057_v10_runtime_contracts.sql", "src/lib/read-models.ts", "src/lib/release-contract.ts"],
    gates: ["npm run check:migrations", "src/lib/data-contracts.test.ts"],
  },
  {
    id: "activation-intake",
    category: "surface",
    disposition: "shipped",
    artifacts: ["src/lib/activation-state.ts", "src/app/api/import/contracts/route.ts", "src/app/(dashboard)/dashboard/page.tsx"],
    gates: ["src/lib/semantics.test.ts", "src/app/api/import/contracts/route.test.ts"],
  },
  {
    id: "home-daily-brief",
    category: "surface",
    disposition: "shipped",
    artifacts: ["src/app/(dashboard)/dashboard/page.tsx", "src/lib/ui-state-contracts.ts"],
    gates: ["src/lib/ui-state-contracts.test.ts", "npm run test:e2e:current-product"],
  },
  {
    id: "unified-work",
    category: "surface",
    disposition: "shipped",
    artifacts: ["src/app/(dashboard)/work/page.tsx", "src/lib/work-semantics.ts", "src/lib/work-hub-lens.ts"],
    gates: ["src/lib/semantics.test.ts", "npm run test:e2e:current-product"],
  },
  {
    id: "contract-record",
    category: "surface",
    disposition: "shipped",
    artifacts: ["src/app/(dashboard)/contracts/[id]/page.tsx", "src/lib/contract-health.ts", "src/lib/field-provenance.ts"],
    gates: ["src/lib/semantics.test.ts", "npm run test:e2e:current-product"],
  },
  {
    id: "review-provenance-quality",
    category: "data",
    disposition: "shipped",
    artifacts: ["src/lib/field-provenance.ts", "src/actions/policy-operations.ts"],
    gates: ["src/lib/semantics.test.ts"],
  },
  {
    id: "renewals-critical-dates",
    category: "data",
    disposition: "shipped",
    artifacts: ["src/lib/renewal-posture.ts", "src/actions/renewal-playbook.ts"],
    gates: ["src/lib/semantics.test.ts"],
  },
  {
    id: "evidence-obligations-collaboration",
    category: "operations",
    disposition: "shipped",
    artifacts: ["src/lib/evidence-collaboration.ts", "src/app/api/cron/v4/evidence-followup/route.ts"],
    gates: ["src/lib/semantics.test.ts", "src/app/api/cron/v4/evidence-followup/route.test.ts"],
  },
  {
    id: "approvals-decisions-exceptions",
    category: "api",
    disposition: "shipped",
    artifacts: ["src/lib/approval-exception.ts", "src/actions/approvals.ts", "src/actions/exceptions.ts"],
    gates: ["src/lib/semantics.test.ts"],
  },
  {
    id: "complete-search-router",
    category: "surface",
    disposition: "shipped",
    artifacts: ["src/app/api/command-palette/contracts/route.ts", "src/components/layout/command-palette.tsx"],
    gates: ["src/components/layout/command-palette.ui.test.tsx", "npm run test:e2e:current-product"],
  },
  {
    id: "reports-exports-reviews",
    category: "api",
    disposition: "shipped",
    artifacts: ["src/lib/report-export.ts", "src/lib/read-model-refresh.ts", "src/app/api/export/contracts/route.ts", "src/app/api/reports/send-summaries/route.ts"],
    gates: ["src/lib/semantics.test.ts", "src/lib/read-model-refresh.test.ts"],
  },
  {
    id: "governance-health-reliability",
    category: "operations",
    disposition: "shipped",
    artifacts: ["src/lib/governance.ts", "src/app/(dashboard)/settings/health/page.tsx", "src/actions/product-surface-settings.ts"],
    gates: ["src/lib/semantics.test.ts", "src/lib/route-api-catalog.test.ts", "src/actions/product-surface-settings.test.ts"],
  },
  {
    id: "telemetry-objectives",
    category: "measurement",
    disposition: "automated_gate",
    artifacts: ["src/lib/objective-telemetry.ts", "src/lib/product-telemetry.ts", "src/lib/readiness-scorecard.ts"],
    gates: ["src/lib/objective-telemetry.test.ts", "src/lib/product-telemetry-current.test.ts", "npm run check:release-evidence"],
  },
  {
    id: "accessibility-performance-responsive",
    category: "surface",
    disposition: "automated_gate",
    artifacts: ["src/lib/ui-state-contracts.ts", "e2e/current-product-core-smoke.spec.ts"],
    gates: ["src/lib/ui-state-contracts.test.ts", "npm run test:e2e:current-product"],
  },
  {
    id: "p1-p2-continuity",
    category: "operations",
    disposition: "automated_gate",
    artifacts: ["src/lib/advanced-assurance-continuity.ts", "src/lib/domain-depth-contracts.ts"],
    gates: ["src/lib/continuity.test.ts", "src/lib/domain-depth-contracts.test.ts"],
  },
  {
    id: "mutation-contracts",
    category: "api",
    disposition: "shipped",
    artifacts: ["src/lib/mutation-envelope.ts", "src/actions/tasks.ts", "src/actions/approvals.ts", "src/actions/exceptions.ts"],
    gates: ["src/lib/semantics.test.ts"],
  },
  {
    id: "security-privacy-data",
    category: "security",
    disposition: "automated_gate",
    artifacts: ["src/lib/hardening-contracts.ts", "src/lib/governance.ts", "supabase/migrations/057_v10_runtime_contracts.sql"],
    gates: ["src/lib/hardening-contracts.test.ts", "src/lib/data-contracts.test.ts"],
  },
  {
    id: "read-model-foundation",
    category: "data",
    disposition: "automated_gate",
    artifacts: ["src/lib/read-models.ts", "src/lib/read-model-refresh.ts"],
    gates: ["src/lib/data-contracts.test.ts", "src/lib/read-model-refresh.test.ts"],
  },
  {
    id: "route-api-contracts",
    category: "api",
    disposition: "automated_gate",
    artifacts: ["src/lib/route-api-catalog.ts", "src/lib/server-contracts.ts"],
    gates: ["src/lib/route-api-catalog.test.ts", "src/lib/server-contracts.test.ts"],
  },
  {
    id: "fixture-measurement-gates",
    category: "measurement",
    disposition: "automated_gate",
    artifacts: ["src/lib/release-evidence.ts", "src/lib/readiness-scorecard.ts"],
    gates: ["npm run check:release-evidence"],
    blockerType: "production_fixture",
  },
  {
    id: "rollout-backfill-recovery",
    category: "operations",
    disposition: "automated_gate",
    artifacts: ["src/lib/mutation-rollout.ts", "src/lib/read-model-refresh.ts"],
    gates: ["src/lib/mutation-rollout.test.ts", "src/lib/read-model-refresh.test.ts"],
  },
  {
    id: "surface-component-primitives",
    category: "surface",
    disposition: "shipped",
    artifacts: ["src/lib/ui-state-contracts.ts", "src/components/layout/command-palette.tsx"],
    gates: ["src/lib/ui-state-contracts.test.ts", "src/components/layout/command-palette.ui.test.tsx"],
  },
  {
    id: "negative-adversarial-coverage",
    category: "quality",
    disposition: "automated_gate",
    artifacts: ["src/lib/hardening-contracts.ts", "src/lib/mutation-envelope.ts"],
    gates: ["src/lib/hardening-contracts.test.ts", "src/lib/semantics.test.ts"],
  },
  {
    id: "acceptance-matrix",
    category: "release",
    disposition: "automated_gate",
    artifacts: ["src/lib/acceptance-matrix.ts"],
    gates: ["src/lib/acceptance-matrix.test.ts"],
  },
  {
    id: "file-level-gap-closure",
    category: "quality",
    disposition: "automated_gate",
    artifacts: ["src/lib/spec-trace-map.ts", "src/lib/implementation-checklist.ts"],
    gates: ["npm run check:release-suite-current"],
  },
  {
    id: "ci-quality-ratchets",
    category: "quality",
    disposition: "automated_gate",
    artifacts: ["scripts/check-release-suite-current.mjs", "scripts/check-release-evidence.mjs", "package.json"],
    gates: ["npm run check:release-suite-current", "npm run check:release-evidence"],
  },
  {
    id: "fixture-runbooks-observability",
    category: "operations",
    disposition: "automated_gate",
    artifacts: ["src/lib/release-evidence.ts", "src/lib/objective-telemetry.ts"],
    gates: ["npm run check:release-evidence"],
    blockerType: "external_dashboard",
  },
  {
    id: "compatibility-regression-boundaries",
    category: "quality",
    disposition: "automated_gate",
    artifacts: ["src/lib/compatibility-release-contract.ts", "src/lib/release-contract.ts"],
    gates: ["src/lib/compatibility-*.test.ts", "src/lib/release-contract.test.ts"],
  },
  {
    id: "implementation-slicing",
    category: "quality",
    disposition: "automated_gate",
    artifacts: ["src/lib/acceptance-matrix.ts", "scripts/check-release-suite-current.mjs"],
    gates: ["src/lib/acceptance-matrix.test.ts", "npm run check:release-suite-current"],
  },
  {
    id: "data-lineage-invariants",
    category: "data",
    disposition: "automated_gate",
    artifacts: ["src/lib/read-models.ts", "src/lib/read-model-refresh.ts"],
    gates: ["src/lib/data-contracts.test.ts", "src/lib/read-model-refresh.test.ts"],
  },
  {
    id: "release-handoff",
    category: "release",
    disposition: "automated_gate",
    artifacts: [SPEC_ARTIFACT_V10, "src/lib/release-evidence.ts"],
    gates: ["npm run check:release-evidence"],
  },
  {
    id: "authorization-data-classification",
    category: "security",
    disposition: "automated_gate",
    artifacts: ["src/lib/governance.ts", "src/lib/hardening-contracts.ts"],
    gates: ["src/lib/semantics.test.ts", "src/lib/hardening-contracts.test.ts"],
  },
  {
    id: "route-state-a11y-performance",
    category: "surface",
    disposition: "automated_gate",
    artifacts: ["src/lib/ui-state-contracts.ts", "e2e/current-product-core-smoke.spec.ts"],
    gates: ["src/lib/ui-state-contracts.test.ts", "npm run test:e2e:current-product"],
  },
  {
    id: "artifact-definition-of-done",
    category: "release",
    disposition: "automated_gate",
    artifacts: ["src/lib/implementation-checklist.ts", "src/lib/release-contract.ts"],
    gates: ["src/lib/implementation-checklist.test.ts", "src/lib/release-contract.test.ts"],
  },
  {
    id: "risk-register-review",
    category: "release",
    disposition: "automated_gate",
    artifacts: ["src/lib/release-evidence.ts", "src/lib/hardening-contracts.ts"],
    gates: ["npm run check:release-evidence"],
  },
  {
    id: "final-gap-audit-protocol",
    category: "quality",
    disposition: "automated_gate",
    artifacts: ["src/lib/spec-trace-map.ts", "src/lib/acceptance-matrix.ts"],
    gates: ["src/lib/data-contracts.test.ts", "src/lib/acceptance-matrix.test.ts"],
  },
  {
    id: "non-autonomous-evidence-schema",
    category: "measurement",
    disposition: "automated_gate",
    artifacts: ["src/lib/release-evidence.ts", "src/lib/readiness-scorecard.ts"],
    gates: ["npm run check:release-evidence"],
    blockerType: "human_study",
  },
  {
    id: "blocker-taxonomy",
    category: "release",
    disposition: "automated_gate",
    artifacts: ["src/lib/release-evidence.ts", "src/lib/acceptance-matrix.ts"],
    gates: ["src/lib/acceptance-matrix.test.ts"],
  },
  {
    id: "lifecycle-provider-boundaries",
    category: "operations",
    disposition: "automated_gate",
    artifacts: ["src/lib/hardening-contracts.ts", "src/lib/governance.ts", "src/lib/release-evidence.ts"],
    gates: ["src/lib/hardening-contracts.test.ts", "src/lib/release-evidence.test.ts"],
    blockerType: "provider_configuration",
  },
  {
    id: "operational-evidence-ownership",
    category: "operations",
    disposition: "automated_gate",
    artifacts: ["src/lib/release-evidence.ts", "src/lib/objective-telemetry.ts"],
    gates: ["npm run check:release-evidence"],
    blockerType: "release_owner_signoff",
  },
  {
    id: "concurrency-cache-time",
    category: "api",
    disposition: "automated_gate",
    artifacts: ["src/lib/mutation-envelope.ts", "src/lib/server-contracts.ts", "src/lib/route-api-catalog.ts"],
    gates: ["src/lib/semantics.test.ts", "src/lib/route-api-catalog.test.ts"],
  },
  {
    id: "audit-vocabulary-taxonomy",
    category: "api",
    disposition: "automated_gate",
    artifacts: ["src/lib/status-action-vocabulary.ts", "src/lib/release-contract.ts"],
    gates: ["src/lib/status-action-vocabulary.test.ts"],
  },
  {
    id: "seed-backfill-tooling",
    category: "operations",
    disposition: "automated_gate",
    artifacts: ["src/lib/read-model-refresh.ts", "src/lib/release-evidence.ts"],
    gates: ["src/lib/read-model-refresh.test.ts", "npm run check:release-evidence"],
  },
  {
    id: "journey-contracts",
    category: "surface",
    disposition: "automated_gate",
    artifacts: ["e2e/current-product-core-smoke.spec.ts", "src/lib/autonomous-coverage.ts"],
    gates: ["npm run test:e2e:current-product", "src/lib/autonomous-coverage.test.ts"],
  },
  {
    id: "api-response-schemas",
    category: "api",
    disposition: "automated_gate",
    artifacts: ["src/lib/mutation-envelope.ts", "src/lib/route-api-catalog.ts"],
    gates: ["src/lib/semantics.test.ts", "src/lib/route-api-catalog.test.ts"],
  },
  {
    id: "threat-abuse-model",
    category: "security",
    disposition: "automated_gate",
    artifacts: ["src/lib/hardening-contracts.ts", "src/lib/evidence-collaboration.ts"],
    gates: ["src/lib/hardening-contracts.test.ts", "src/lib/semantics.test.ts"],
  },
  {
    id: "release-signoff-governance",
    category: "release",
    disposition: "automated_gate",
    artifacts: ["src/lib/release-evidence.ts", "src/lib/readiness-scorecard.ts"],
    gates: ["npm run check:release-evidence"],
    blockerType: "release_owner_signoff",
  },
  {
    id: "database-constraint-index-budget",
    category: "data",
    disposition: "automated_gate",
    artifacts: ["supabase/migrations/057_v10_runtime_contracts.sql", "src/lib/release-contract.ts"],
    gates: ["npm run check:migrations", "src/lib/data-contracts.test.ts"],
  },
  {
    id: "component-copy-contracts",
    category: "surface",
    disposition: "automated_gate",
    artifacts: ["src/lib/hardening-contracts.ts", "src/lib/ui-state-contracts.ts"],
    gates: ["src/lib/hardening-contracts.test.ts", "src/lib/ui-state-contracts.test.ts"],
  },
  {
    id: "browser-device-support",
    category: "surface",
    disposition: "automated_gate",
    artifacts: ["e2e/current-product-core-smoke.spec.ts", "src/lib/ui-state-contracts.ts"],
    gates: ["npm run test:e2e:current-product"],
  },
  {
    id: "adoption-operational-feedback",
    category: "measurement",
    disposition: "automated_gate",
    artifacts: ["src/lib/objective-telemetry.ts", "src/lib/release-evidence.ts"],
    gates: ["npm run check:release-evidence"],
    blockerType: "external_dashboard",
  },
  {
    id: "environment-config-parity",
    category: "operations",
    disposition: "automated_gate",
    artifacts: ["src/lib/server-contracts.ts", "scripts/check-release-evidence.mjs"],
    gates: ["npm run check:release-evidence"],
  },
  {
    id: "synthetic-fixture-safety",
    category: "security",
    disposition: "automated_gate",
    artifacts: ["src/lib/hardening-contracts.ts", "src/lib/objective-telemetry.ts"],
    gates: ["src/lib/hardening-contracts.test.ts", "src/lib/objective-telemetry.test.ts"],
  },
  {
    id: "deprecation-cleanup-policy",
    category: "release",
    disposition: "automated_gate",
    artifacts: [SPEC_ARTIFACT_V10, "src/lib/compatibility-release-contract.ts"],
    gates: ["src/lib/compatibility-*.test.ts", "npm run check:release-suite-current"],
  },
  {
    id: "support-docs-boundaries",
    category: "operations",
    disposition: "automated_gate",
    artifacts: [SPEC_ARTIFACT_V10, "src/lib/hardening-contracts.ts"],
    gates: ["src/lib/hardening-contracts.test.ts"],
  },
  {
    id: "dependency-supply-chain",
    category: "quality",
    disposition: "automated_gate",
    artifacts: ["package.json", "scripts/check-release-suite-current.mjs"],
    gates: ["npm run lint", "npm run typecheck", "npm run check:release-suite-current"],
  },
  {
    id: "state-machine-contracts",
    category: "data",
    disposition: "automated_gate",
    artifacts: ["src/lib/status-action-vocabulary.ts", "src/lib/mutation-envelope.ts"],
    gates: ["src/lib/status-action-vocabulary.test.ts", "src/lib/semantics.test.ts"],
  },
  {
    id: "contract-versioning-compatibility",
    category: "api",
    disposition: "automated_gate",
    artifacts: ["src/lib/release-contract.ts", "src/lib/mutation-envelope.ts"],
    gates: ["src/lib/release-contract.test.ts", "src/lib/semantics.test.ts"],
  },
  {
    id: "measurement-governance",
    category: "measurement",
    disposition: "automated_gate",
    artifacts: ["src/lib/objective-telemetry.ts", "src/lib/readiness-scorecard.ts"],
    gates: ["src/lib/objective-telemetry.test.ts", "npm run check:release-evidence"],
    blockerType: "external_dashboard",
  },
  {
    id: "audit-telemetry-event-schemas",
    category: "api",
    disposition: "automated_gate",
    artifacts: ["src/lib/objective-telemetry.ts", "src/lib/release-contract.ts"],
    gates: ["src/lib/objective-telemetry.test.ts", "src/lib/release-contract.test.ts"],
  },
  {
    id: "support-admin-boundaries",
    category: "security",
    disposition: "automated_gate",
    artifacts: ["src/lib/governance.ts", "src/lib/hardening-contracts.ts"],
    gates: ["src/lib/semantics.test.ts"],
  },
  {
    id: "privacy-lifecycle-requests",
    category: "security",
    disposition: "automated_gate",
    artifacts: ["src/lib/hardening-contracts.ts", "src/lib/governance.ts"],
    gates: ["src/lib/hardening-contracts.test.ts"],
  },
  {
    id: "disaster-recovery-resilience",
    category: "operations",
    disposition: "automated_gate",
    artifacts: ["src/lib/read-model-refresh.ts", "src/lib/release-evidence.ts"],
    gates: ["src/lib/read-model-refresh.test.ts", "npm run check:release-evidence"],
  },
  {
    id: "tenant-isolation-proof",
    category: "security",
    disposition: "automated_gate",
    artifacts: ["supabase/migrations/057_v10_runtime_contracts.sql", "src/lib/governance.ts"],
    gates: ["npm run check:migrations", "src/lib/data-contracts.test.ts"],
  },
  {
    id: "progressive-rollout-canary",
    category: "operations",
    disposition: "automated_gate",
    artifacts: ["src/lib/mutation-rollout.ts", "src/lib/release-evidence.ts"],
    gates: ["src/lib/mutation-rollout.test.ts"],
  },
  {
    id: "data-quality-remediation-loop",
    category: "data",
    disposition: "automated_gate",
    artifacts: ["src/lib/field-provenance.ts", "src/lib/work-semantics.ts"],
    gates: ["src/lib/semantics.test.ts"],
  },
  {
    id: "artifact-contracts",
    category: "release",
    disposition: "automated_gate",
    artifacts: ["src/lib/release-evidence.ts", "src/lib/report-export.ts"],
    gates: ["src/lib/release-evidence.test.ts", "src/lib/semantics.test.ts"],
  },
  {
    id: "intake-parser-validation",
    category: "api",
    disposition: "automated_gate",
    artifacts: ["src/lib/activation-state.ts", "src/app/api/import/contracts/route.ts"],
    gates: ["src/lib/semantics.test.ts", "src/app/api/import/contracts/route.test.ts"],
  },
  {
    id: "api-pagination-filtering",
    category: "api",
    disposition: "automated_gate",
    artifacts: ["src/lib/route-api-catalog.ts", "src/lib/ui-state-contracts.ts"],
    gates: ["src/lib/route-api-catalog.test.ts", "src/lib/ui-state-contracts.test.ts"],
  },
  {
    id: "entitlement-billing-sync",
    category: "operations",
    disposition: "automated_gate",
    artifacts: ["src/lib/governance.ts", "src/lib/route-api-catalog.ts"],
    gates: ["src/lib/semantics.test.ts", "src/lib/route-api-catalog.test.ts"],
  },
  {
    id: "notification-consent-compliance",
    category: "operations",
    disposition: "automated_gate",
    artifacts: ["src/lib/evidence-collaboration.ts", "src/lib/hardening-contracts.ts"],
    gates: ["src/lib/semantics.test.ts", "src/lib/hardening-contracts.test.ts"],
  },
  {
    id: "report-export-redaction",
    category: "security",
    disposition: "automated_gate",
    artifacts: ["src/lib/report-export.ts", "src/lib/objective-telemetry.ts"],
    gates: ["src/lib/semantics.test.ts", "src/lib/objective-telemetry.test.ts"],
  },
  {
    id: "deterministic-ordering-contracts",
    category: "quality",
    disposition: "automated_gate",
    artifacts: [
      "src/lib/work-semantics.ts",
      "src/app/(dashboard)/work/page.tsx",
      "src/app/api/command-palette/contracts/route.ts",
    ],
    gates: ["src/lib/semantics.test.ts", "src/components/layout/command-palette.ui.test.tsx"],
  },
  {
    id: "failure-injection-qa",
    category: "quality",
    disposition: "automated_gate",
    artifacts: ["src/lib/hardening-contracts.ts", "src/lib/release-evidence.ts", "e2e/current-product-core-smoke.spec.ts"],
    gates: ["src/lib/hardening-contracts.test.ts", "npm run check:release-evidence", "npm run test:e2e:current-product"],
  },
  {
    id: "trace-release-evidence",
    category: "release",
    disposition: "automated_gate",
    artifacts: ["src/lib/spec-trace-map.ts", "src/lib/implementation-checklist.ts", "src/lib/release-evidence.ts"],
    gates: ["npm run check:release-suite-current", "npm run check:release-evidence"],
  },
  {
    id: "verification-gates",
    category: "quality",
    disposition: "automated_gate",
    artifacts: ["scripts/check-release-suite-current.mjs", "scripts/check-release-evidence.mjs", "package.json"],
    gates: ["npm run check:release-suite-current", "npm run typecheck", "npm run lint", "npm run check:migrations", "npm run test:e2e:current-product"],
  },
] as const;

export function getV10AcceptanceMatrixRow(id: string): V10AcceptanceMatrixRow | null {
  return V10_ACCEPTANCE_MATRIX.find((row) => row.id === id) ?? null;
}

function getV10AcceptanceSpecSections(category: V10AcceptanceMatrixRow["category"]): readonly string[] {
  const byCategory: Record<V10AcceptanceMatrixRow["category"], readonly string[]> = {
    surface: ["End-To-End Journey Contracts", "User-Facing Primitives"],
    data: ["Data Lineage And Invariants", "Read-Model Reconciliation Checks"],
    api: ["Source-To-Proof Requirements", "API Response Schemas"],
    security: ["Authorization Matrix", "Tenant Isolation Proof Matrix", "Data Classification Matrix"],
    release: ["Artifact Definition Of Done", "Release Handoff"],
    operations: ["Rollout, Backfill, And Recovery Runbooks", "Seed, Backfill, And Operator Tooling"],
    quality: ["Implementation Slicing Rules", "Final QA Batch"],
    measurement: ["Feasibility Classification", "Measurement Governance"],
  };
  return byCategory[category];
}

function getV10AcceptanceDocSections(category: V10AcceptanceMatrixRow["category"]): readonly string[] {
  const byCategory: Record<V10AcceptanceMatrixRow["category"], readonly string[]> = {
    surface: ["4.1", "4.2", "4.3", "4.4", "4.9", "4.16", "6.13", "6.14"],
    data: ["5.1", "5.2", "5.3", "6.15"],
    api: ["5.4", "5.5", "5.6", "5.7", "6.8", "6.9", "6.11"],
    security: ["3.4", "3.5", "6.10", "6.12"],
    release: ["1", "3.1.1", "6", "8"],
    operations: ["4.13", "4.14", "6.11"],
    quality: ["6.13", "6.14", "6.15"],
    measurement: ["2", "2.1", "2.2", "4.15", "6.16"],
  };
  return byCategory[category];
}

function getV10AcceptancePriority(row: V10AcceptanceMatrixRow): V10AcceptancePriority {
  if (row.disposition === "environment_gated" || row.disposition === "non_autonomous_blocker") return "release_blocker";
  if (row.category === "surface" || row.category === "api" || row.category === "security" || row.category === "data") return "P0";
  if (row.category === "operations" || row.category === "measurement") return "P1";
  return "P2";
}

export function classifyV10AcceptanceRuntimeStatus(row: V10AcceptanceMatrixRow): V10AcceptanceRuntimeStatus {
  if (row.disposition === "non_autonomous_blocker") return "non_autonomous_blocker";
  if (row.disposition === "environment_gated" || row.disposition === "release_evidence") {
    return "release_evidence_required";
  }
  const staticOnlyArtifactPatterns = [
    /^docs\//,
    /(?:v10-)?acceptance-matrix/,
    /(?:v10-)?autonomous-coverage/,
    /(?:v10-)?final-gap-audit/,
    /(?:v10-)?implementation-checklist/,
    /(?:v10-)?release-contract/,
    /(?:v10-)?spec-trace-map/,
    /(?:v10-)?traceability-ledger/,
  ];
  const hasOnlyStaticArtifacts = row.artifacts.length > 0 && row.artifacts.every((artifact) =>
    staticOnlyArtifactPatterns.some((pattern) => pattern.test(artifact))
  );
  const hasRuntimeArtifact = row.artifacts.some(
    (artifact) =>
      artifact.includes("/app/") ||
      artifact.includes("/actions/") ||
      artifact.includes("/components/") ||
      artifact.includes("read-model-refresh") ||
      artifact.includes("mutation-envelope") ||
      artifact.includes("server-contracts") ||
      artifact.includes("product-telemetry") ||
      artifact.includes("supabase/migrations/")
  );
  if (hasOnlyStaticArtifacts) return "typed_contract_only";
  if (row.disposition === "automated_gate") return hasRuntimeArtifact ? "runtime_verified" : "runtime_mapped";
  return hasRuntimeArtifact ? "runtime_verified" : "runtime_mapped";
}

export function getV10AcceptanceProof(row: V10AcceptanceMatrixRow): V10AcceptanceProof {
  const releaseEvidenceOwner = getV10AcceptanceReleaseEvidenceOwner(row);
  return {
    id: row.id,
    specSections: getV10AcceptanceSpecSections(row.category),
    docSpecSections: getV10AcceptanceDocSections(row.category),
    priority: getV10AcceptancePriority(row),
    runtimeStatus: classifyV10AcceptanceRuntimeStatus(row),
    implementationArtifacts: row.artifacts,
    testGates: row.gates,
    releaseEvidence: [
      row.disposition,
      ...row.gates.filter((gate) => gate.includes("release-evidence")),
      ...row.artifacts.filter(
        (artifact) =>
          artifact.includes("release-evidence") || artifact.startsWith("spec:") || artifact.startsWith("ops:")
      ),
    ],
    releaseEvidenceOwner,
    verificationCommands: getV10AcceptanceVerificationCommands(row),
    objectiveMetricKey: getV10AcceptanceObjectiveMetricKey(row),
    releaseBlocking: row.disposition === "environment_gated" || row.disposition === "non_autonomous_blocker" || row.disposition === "release_evidence",
    blockerStatus: row.blockerType ? `blocked:${row.blockerType}` : "none",
    releaseStateImpact: getV10AcceptanceReleaseStateImpact(row),
  };
}

export function getV10AcceptanceReleaseStateImpact(row: V10AcceptanceMatrixRow): V10AcceptanceReleaseStateImpact {
  if (row.disposition === "environment_gated" || row.disposition === "non_autonomous_blocker" || row.disposition === "release_evidence") {
    return "holds_promotion";
  }
  const priority = getV10AcceptancePriority(row);
  if (priority === "P0") return "blocks_beta";
  if (priority === "P1") return "blocks_ga";
  return "blocks_complete";
}

export function getV10AcceptanceReleaseEvidenceOwner(
  row: V10AcceptanceMatrixRow
): V10AcceptanceProof["releaseEvidenceOwner"] {
  if (row.category === "security") return "security";
  if (row.category === "operations") return "operations";
  if (row.category === "measurement" || row.category === "release") return "release";
  if (row.category === "surface" || row.category === "quality") return "product";
  return "engineering";
}

export function getV10AcceptanceVerificationCommands(row: V10AcceptanceMatrixRow): readonly string[] {
  const commands = row.gates.filter((gate) => gate.startsWith("npm run "));
  return commands.length > 0 ? commands : ["npm run check:release-suite-current"];
}

export function getV10AcceptanceObjectiveMetricKey(row: V10AcceptanceMatrixRow): string | null {
  if (row.id.includes("activation")) return "activation_first_work_item";
  if (row.id.includes("renewal")) return "renewal_reminders";
  if (row.id.includes("evidence")) return "evidence_follow_up";
  if (row.id.includes("report") || row.id.includes("export")) return "report_export_reliability";
  if (row.id.includes("telemetry") || row.category === "measurement") return "objective_measurement";
  return null;
}

export function validateV10AcceptanceMatrix(
  rows: readonly V10AcceptanceMatrixRow[] = V10_ACCEPTANCE_MATRIX,
  options?: { requireAllIds?: boolean }
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const proof = getV10AcceptanceProof(row);
    if (seen.has(row.id)) failures.push(`duplicate:${row.id}`);
    seen.add(row.id);
    if (row.artifacts.length === 0) failures.push(`missing_artifact:${row.id}`);
    if (row.gates.length === 0) failures.push(`missing_gate:${row.id}`);
    if (proof.specSections.length === 0) failures.push(`missing_spec_section:${row.id}`);
    if (proof.docSpecSections.length === 0) failures.push(`missing_doc_spec_section:${row.id}`);
    if (proof.releaseEvidence.length === 0) failures.push(`missing_evidence:${row.id}`);
    if (!proof.releaseEvidenceOwner) failures.push(`missing_release_owner:${row.id}`);
    if (proof.verificationCommands.length === 0) failures.push(`missing_verification_command:${row.id}`);
    if (!proof.priority) failures.push(`missing_priority:${row.id}`);
    if (!proof.releaseStateImpact) failures.push(`missing_release_state_impact:${row.id}`);
    if (row.disposition === "shipped" && proof.runtimeStatus === "typed_contract_only") {
      failures.push(`shipped_without_runtime:${row.id}`);
    }
    if ((proof.priority === "P0" || proof.priority === "P1") && proof.runtimeStatus === "typed_contract_only") {
      failures.push(`priority_runtime_unproven:${row.id}`);
    }
    if (
      row.disposition === "automated_gate" &&
      !row.gates.some((gate) => gate.endsWith(".test.ts") || gate.endsWith(".test.tsx") || gate.startsWith("npm run"))
    ) {
      failures.push(`automated_gate_without_executable_gate:${row.id}`);
    }
    if (
      (row.disposition === "environment_gated" || row.disposition === "non_autonomous_blocker") &&
      !row.gates.some((gate) => gate.includes("release-evidence") || gate.includes("e2e"))
    ) {
      failures.push(`release_evidence_without_gate:${row.id}`);
    }
    if ((row.disposition === "environment_gated" || row.disposition === "non_autonomous_blocker") && !row.blockerType) {
      failures.push(`missing_blocker_type:${row.id}`);
    }
  }
  if (options?.requireAllIds ?? rows === V10_ACCEPTANCE_MATRIX) {
    for (const id of V10_REQUIRED_ACCEPTANCE_IDS) {
      if (!seen.has(id)) failures.push(`missing_required_id:${id}`);
    }
  }
  return failures;
}

export function summarizeV10AcceptanceCoverage(
  rows: readonly V10AcceptanceMatrixRow[] = V10_ACCEPTANCE_MATRIX
): V10AcceptanceCoverageSummary {
  const runtimeBacked: string[] = [];
  const staticContractOnly: string[] = [];
  const automatedGated: string[] = [];
  const releaseEvidenceGated: string[] = [];
  const environmentGated: string[] = [];
  const nonAutonomousBlocked: string[] = [];
  const silentGaps: string[] = [];
  for (const row of rows) {
    const proof = getV10AcceptanceProof(row);
    if (proof.runtimeStatus === "runtime_verified" || proof.runtimeStatus === "runtime_mapped") runtimeBacked.push(row.id);
    if (proof.runtimeStatus === "typed_contract_only") staticContractOnly.push(row.id);
    if (row.disposition === "automated_gate") automatedGated.push(row.id);
    if (row.disposition === "release_evidence") releaseEvidenceGated.push(row.id);
    if (row.disposition === "environment_gated") environmentGated.push(row.id);
    if (row.disposition === "non_autonomous_blocker") nonAutonomousBlocked.push(row.id);
    if (row.artifacts.length === 0 || row.gates.length === 0 || proof.releaseEvidence.length === 0) silentGaps.push(row.id);
  }
  return {
    total: rows.length,
    runtimeBacked,
    staticContractOnly,
    automatedGated,
    releaseEvidenceGated,
    environmentGated,
    nonAutonomousBlocked,
    silentGaps,
  };
}

function getV10AcceptanceGateClosureKind(row: V10AcceptanceMatrixRow): V10AcceptanceGateClosureKind {
  if (row.disposition === "non_autonomous_blocker" || classifyV10AcceptanceRuntimeStatus(row) === "non_autonomous_blocker") {
    return "external_blocker";
  }
  if (row.disposition === "environment_gated" || row.disposition === "release_evidence") return "release_evidence";
  if (row.disposition === "automated_gate") return "automated_gate";
  return "runtime_proof";
}

export function buildV10AcceptanceGateClosureLedger(
  rows: readonly V10AcceptanceMatrixRow[] = V10_ACCEPTANCE_MATRIX
): V10AcceptanceGateClosureRow[] {
  return rows.map((row) => {
    const proof = getV10AcceptanceProof(row);
    const executableGates = row.gates.filter((gate) => gate.startsWith("npm run ") || gate.endsWith(".test.ts") || gate.endsWith(".test.tsx") || gate.includes("*"));
    const closureKind = getV10AcceptanceGateClosureKind(row);
    const openGap =
      row.artifacts.length === 0
        ? "artifact_missing"
        : executableGates.length === 0
          ? "executable_gate_missing"
          : proof.releaseEvidence.length === 0
            ? "release_evidence_missing"
            : closureKind === "external_blocker" && proof.blockerStatus === "none"
              ? "blocker_status_missing"
              : null;
    return {
      id: row.id,
      closureKind,
      runtimeStatus: proof.runtimeStatus,
      proofArtifacts: row.artifacts,
      executableGates,
      releaseEvidence: proof.releaseEvidence,
      blockerStatus: proof.blockerStatus,
      openGap,
    };
  });
}

export function validateV10AcceptanceGateClosureLedger(
  rows: readonly V10AcceptanceGateClosureRow[] = buildV10AcceptanceGateClosureLedger()
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) failures.push(`closure_duplicate:${row.id}`);
    seen.add(row.id);
    if (row.openGap) failures.push(`${row.id}:${row.openGap}`);
    if (row.proofArtifacts.length === 0) failures.push(`${row.id}:proof_artifact_required`);
    if (row.executableGates.length === 0) failures.push(`${row.id}:executable_gate_required`);
    if (row.releaseEvidence.length === 0) failures.push(`${row.id}:release_evidence_required`);
    if (row.closureKind === "external_blocker" && !row.blockerStatus.startsWith("blocked:")) {
      failures.push(`${row.id}:external_blocker_status_required`);
    }
    if (row.closureKind === "runtime_proof" && row.runtimeStatus === "typed_contract_only") {
      failures.push(`${row.id}:runtime_proof_required`);
    }
  }
  for (const id of V10_REQUIRED_ACCEPTANCE_IDS) {
    if (!seen.has(id)) failures.push(`closure_missing:${id}`);
  }
  return failures;
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { buildV10AcceptanceGateClosureLedger as buildAcceptanceGateClosureLedger };
export { classifyV10AcceptanceRuntimeStatus as classifyAcceptanceRuntimeStatus };
export { getV10AcceptanceMatrixRow as getAcceptanceMatrixRow };
export { getV10AcceptanceObjectiveMetricKey as getAcceptanceObjectiveMetricKey };
export { getV10AcceptanceProof as getAcceptanceProof };
export { getV10AcceptanceReleaseEvidenceOwner as getAcceptanceReleaseEvidenceOwner };
export { getV10AcceptanceReleaseStateImpact as getAcceptanceReleaseStateImpact };
export { getV10AcceptanceVerificationCommands as getAcceptanceVerificationCommands };
export { summarizeV10AcceptanceCoverage as summarizeAcceptanceCoverage };
export { V10_ACCEPTANCE_MATRIX as ACCEPTANCE_MATRIX };
export { V10_REQUIRED_ACCEPTANCE_IDS as REQUIRED_ACCEPTANCE_IDS };
export { validateV10AcceptanceGateClosureLedger as validateAcceptanceGateClosureLedger };
export { validateV10AcceptanceMatrix as validateAcceptanceMatrix };
export type { V10AcceptanceCoverageSummary as AcceptanceCoverageSummary };
export type { V10AcceptanceDisposition as AcceptanceDisposition };
export type { V10AcceptanceGateClosureKind as AcceptanceGateClosureKind };
export type { V10AcceptanceGateClosureRow as AcceptanceGateClosureRow };
export type { V10AcceptanceMatrixRow as AcceptanceMatrixRow };
export type { V10AcceptancePriority as AcceptancePriority };
export type { V10AcceptanceProof as AcceptanceProof };
export type { V10AcceptanceReleaseStateImpact as AcceptanceReleaseStateImpact };
export type { V10AcceptanceRuntimeStatus as AcceptanceRuntimeStatus };
// End version-name compatibility aliases.
