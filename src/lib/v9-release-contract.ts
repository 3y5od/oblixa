export const V9_ACTIVATION_PATH = [
  "importing or uploading the first contract",
  "reviewing key extracted fields",
  "returning to a useful dashboard",
] as const;

export const V9_NOTIFICATION_CLASSES = [
  "due work",
  "overdue work",
  "pending approvals",
  "renewal horizon",
  "evidence request",
  "exception assignment",
  "review backlog",
] as const;

export const V9_RELIABILITY_STATES = [
  "extraction in progress",
  "extraction failed",
  "import in progress",
  "import failed or partial",
  "reminder active",
  "reminder inactive due to missing approved dates",
  "report generation in progress",
  "report generation failed",
] as const;

export const V9_VISIBLE_PRODUCT_OUTCOMES = [
  "understandable",
  "faster",
  "clearer about ownership",
  "calmer during background work",
  "more consistent",
  "easier to verify",
] as const;

export const V9_OPTIMIZATION_DIMENSIONS = [
  "workflow refinement",
  "navigation and search clarity",
  "better empty, loading, and error states",
  "tighter default filtering and ordering",
  "visible reliability signals",
  "nonblocking telemetry and measurement",
  "regression coverage for shipped Core behavior",
] as const;

export const V9_IMPLEMENTATION_PREFERENCES = [
  "refinement over addition",
  "visible Core improvements over hidden capability growth",
  "shared primitives over one-off surface logic",
  "measurable behavior over aspirational copy",
  "regression anchors over manual-only assertions",
] as const;

export const V9_APPLIES_TO = [
  "onboarding first-value flow",
  "dashboard actionability",
  "contract list filtering",
  "contract list ordering",
  "contract detail clarity",
  "review queue throughput",
  "work queue direct actions",
  "renewal quick actions",
  "exception resolution",
  "evidence submission",
  "evidence rejection flow",
  "search and command palette behavior",
  "import and extraction visibility",
  "reports and exports",
  "loading and mutation feedback",
  "major visible failure states",
  "performance telemetry",
  "auditability for visible changes",
] as const;

export const V9_DOES_NOT_REQUIRE = [
  "new product domains",
  "new top-level navigation areas",
  "new pricing structure",
  "broader public feature exposure",
  "new hidden platform families",
  "replacement of the existing architecture",
] as const;

export const V9_REGRESSION_GATES = [
  "workspace-mode containment",
  "route and action authorization behavior",
  "hidden-feature suppression",
  "notification eligibility controls",
] as const;

export const V9_AUDITABLE_RECORD_CLASSES = [
  "onboarding calibration application",
  "workspace mode changes",
  "visibility-affecting settings changes",
  "owner changes",
  "evidence state changes",
  "reminder enablement changes",
] as const;

export const V9_IMPROVEMENT_AREAS = [
  "onboarding first-value path",
  "dashboard actionability",
  "contract list filtering and ordering",
  "contract detail clarity and actions",
  "review queue throughput path",
  "work queue direct actions",
  "renewal quick actions",
  "exception resolution",
  "evidence submission and rejection flow",
  "search and command palette clarity",
  "import and extraction trust",
  "notification eligibility controls",
  "reports and exports",
  "empty states",
  "loading states",
  "recoverable error states",
  "performance telemetry",
  "auditability",
  "regression bridge coverage",
] as const;

export const V9_NON_GOALS = [
  "new Advanced families",
  "new Assurance families",
  "new top-level navigation areas",
  "broader automation exposure",
  "public paid-tier behavior",
  "architectural replacement",
  "documentation deliverables as part of this release specification",
] as const;

export const V9_SUPERSESSION_RECORDS = [
  {
    artifact: "docs/v9.md",
    supersededBy: "docs/v10.md",
    status: "superseded_bridge_preserved",
    reason: "V10 is the active release contract; V9 remains as a compatibility bridge for regression gates.",
    testsPreserved: true,
    releaseEvidenceKey: "v10_deprecation_policy",
  },
  {
    artifact: "logs 1.zip",
    supersededBy: "v10_release_evidence_records",
    status: "obsolete_binary_artifact_removed",
    reason: "Release evidence must be structured, scoped, and privacy-safe rather than retained as opaque local logs.",
    testsPreserved: true,
    releaseEvidenceKey: "v10_artifact_retention_policy",
  },
  {
    artifact: "logs 2.zip",
    supersededBy: "v10_release_evidence_records",
    status: "obsolete_binary_artifact_removed",
    reason: "Release evidence must be structured, scoped, and privacy-safe rather than retained as opaque local logs.",
    testsPreserved: true,
    releaseEvidenceKey: "v10_artifact_retention_policy",
  },
] as const;
