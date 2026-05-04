import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  V10_ACCEPTANCE_GATES,
  V10_CORE_REPORT_FAMILIES,
  V10_GA_SAMPLE_SIZES,
  V10_JOB_CLASSES,
  V10_NAVIGATION_FAMILIES,
  V10_NOTIFICATION_CLASSES,
  V10_RELEASE_FIXTURE_MINIMUMS,
  V10_SOURCE_OBJECT_TYPES,
} from "./v10-release-contract";
import { PRODUCT_TELEMETRY_ACTIONS } from "./product-telemetry";
import { V10_NON_AUTONOMOUS_EVIDENCE_GATES } from "./v10-release-evidence";
import { V10_IMPLEMENTATION_REQUIREMENTS } from "./v10-implementation-checklist";
import { V10_AUTONOMOUS_COVERAGE_CONTRACTS } from "./v10-autonomous-coverage";
import { V10_REQUIRED_MUTATION_CONTRACTS } from "./v10-mutation-envelope";
import { V10_REQUIRED_READ_MODEL_KEYS } from "./v10-read-models";
import { V10_ROUTE_API_CATALOG } from "./v10-route-api-catalog";
import { V10_SPEC_TRACE } from "./v10-spec-trace-map";
import { V10_UI_STATE_CONTRACTS } from "./v10-ui-state-contracts";
import {
  V10_AUDIT_VOCABULARY_TAXONOMY,
  V10_COMPATIBILITY_BOUNDARIES,
  V10_SOURCE_INVENTORY,
} from "./v10-final-gap-audit";
import { V10_OPS_RELEASE_READINESS_CONTRACTS, V10_PROVIDER_BOUNDARIES } from "./v10-operational-contracts";
import {
  buildV10NoExclusionsMatrix,
  validateV10NoExclusionsMatrix,
  type V10NoExclusionsMatrixRow,
} from "./v10-no-exclusions-matrix";

const PATH_LIKE_PREFIXES = [
  ".github/",
  "artifacts/generated/security/",
  "e2e/",
  "package.json",
  "scripts/",
  "semgrep/",
  "src/",
  "supabase/",
] as const;

function pathLike(artifact: string): boolean {
  return PATH_LIKE_PREFIXES.some((prefix) => artifact.startsWith(prefix));
}

describe("V10 no-exclusions matrix", () => {
  it("generates complete runtime proof rows for every V10 coverage family", () => {
    const matrix = buildV10NoExclusionsMatrix();

    expect(validateV10NoExclusionsMatrix(matrix)).toEqual([]);
    expect(matrix.length).toBe(
      V10_IMPLEMENTATION_REQUIREMENTS.length +
        V10_AUTONOMOUS_COVERAGE_CONTRACTS.length +
        V10_SOURCE_OBJECT_TYPES.length +
        V10_NAVIGATION_FAMILIES.length +
        V10_REQUIRED_MUTATION_CONTRACTS.length +
        V10_ROUTE_API_CATALOG.length +
        V10_REQUIRED_READ_MODEL_KEYS.length +
        V10_JOB_CLASSES.length +
        V10_NOTIFICATION_CLASSES.length +
        V10_CORE_REPORT_FAMILIES.length +
        V10_UI_STATE_CONTRACTS.length +
        V10_ACCEPTANCE_GATES.length +
        V10_COMPATIBILITY_BOUNDARIES.length +
        Object.keys(V10_GA_SAMPLE_SIZES).length +
        Object.keys(V10_RELEASE_FIXTURE_MINIMUMS).length +
        V10_NON_AUTONOMOUS_EVIDENCE_GATES.length +
        V10_PROVIDER_BOUNDARIES.length +
        V10_OPS_RELEASE_READINESS_CONTRACTS.length +
        Object.keys(V10_SPEC_TRACE).length +
        V10_SOURCE_INVENTORY.length +
        PRODUCT_TELEMETRY_ACTIONS.filter((action) => action.startsWith("product.v10.")).length +
        V10_AUDIT_VOCABULARY_TAXONOMY.length +
        10
    );
    expect(matrix.some((row) => row.coverageKind === "ci_release_gate" && row.coverageKey === "ci_release_gate:npm run check:v10-complete-closure")).toBe(true);
    expect(matrix.some((row) => row.coverageKind === "ci_release_gate" && row.coverageKey === "ci_release_gate:npm run check:v10-zero-exclusion-report")).toBe(true);
    expect(new Set(matrix.map((row) => row.coverageKey)).size).toBe(matrix.length);
  });

  it("keeps artifacts, tests, and release evidence attached to every row", () => {
    for (const row of buildV10NoExclusionsMatrix()) {
      expect(row.sourceArtifacts.length, row.coverageKey).toBeGreaterThan(0);
      expect(row.testArtifacts.length, row.coverageKey).toBeGreaterThan(0);
      expect(row.releaseEvidenceKey, row.coverageKey).toMatch(/^v10-release:/);
      expect(row.dimensions, row.coverageKey).toContain("test");
      expect(row.dimensions, row.coverageKey).toContain("release_evidence");

      for (const artifact of [...row.sourceArtifacts, ...row.testArtifacts].filter(pathLike)) {
        expect(existsSync(join(process.cwd(), artifact)), `${row.coverageKey}:${artifact}`).toBe(true);
      }
    }
  });

  it("makes mutable, searchable, and actionable source objects explicit", () => {
    const matrix = buildV10NoExclusionsMatrix();

    expect(matrix.find((row) => row.coverageKey === "source_object:contract")).toMatchObject({
      priority: "P0",
      status: "runtime_backed",
      dimensions: expect.arrayContaining(["database_or_source", "read_model", "work_visibility", "command_search", "audit", "telemetry"]),
    });
    expect(matrix.find((row) => row.coverageKey === "mutation:create_contract_import")).toMatchObject({
      status: "runtime_backed",
      dimensions: expect.arrayContaining(["route_or_action", "authorization", "idempotency", "audit"]),
    });
    expect(matrix.find((row) => row.coverageKey === "job_class:billing_sync")).toMatchObject({
      status: "release_evidence_required",
      residualRisk: expect.stringContaining("Billing sync"),
    });
    expect(matrix.find((row) => row.coverageKey === "navigation:advanced")).toMatchObject({
      priority: "P1",
      status: "runtime_backed",
    });
    expect(matrix.find((row) => row.coverageKey === "objective_metric:activation")).toMatchObject({
      priority: "release_blocker",
      status: "release_evidence_required",
      dimensions: expect.arrayContaining(["telemetry", "fixture", "release_evidence"]),
    });
    expect(matrix.find((row) => row.coverageKey === "fixture:contracts")).toMatchObject({
      status: "release_evidence_required",
      dimensions: expect.arrayContaining(["database_or_source", "fixture", "operations"]),
    });
    expect(matrix.find((row) => row.coverageKey === "external_evidence_gate:provider_configuration_readiness")).toMatchObject({
      status: "non_autonomous_blocker",
      owner: "operations",
    });
    expect(matrix.find((row) => row.coverageKey === "provider_boundary:supabase")).toMatchObject({
      priority: "release_blocker",
      status: "release_evidence_required",
      dimensions: expect.arrayContaining(["provider_boundary", "environment", "authorization"]),
    });
    expect(matrix.find((row) => row.coverageKey === "ops_release_readiness:read_model_refresh")).toMatchObject({
      priority: "release_blocker",
      status: "release_evidence_required",
      dimensions: expect.arrayContaining(["operations", "support", "provider_boundary"]),
    });
    expect(matrix.find((row) => row.coverageKey === "spec_section:4.2")).toMatchObject({
      coverageKind: "spec_section",
      sourceArtifacts: expect.arrayContaining(["spec:v10", "src/app/(dashboard)/work/page.tsx"]),
    });
    expect(matrix.find((row) => row.coverageKey === "inventory_file:api_route:command_palette_contracts")).toMatchObject({
      coverageKind: "inventory_file",
      status: "runtime_backed",
    });
    expect(matrix.find((row) => row.coverageKey === "route:/api/command-palette/contracts:GET")).toMatchObject({
      coverageKind: "route",
      sourceArtifacts: expect.arrayContaining([
        "src/lib/v10-route-api-catalog.ts",
        "src/app/api/command-palette/contracts/route.ts",
      ]),
      testArtifacts: expect.arrayContaining(["src/app/api/command-palette/contracts/route.v10.test.ts"]),
    });
    expect(matrix.find((row) => row.coverageKey === "route:/work:GET")).toMatchObject({
      coverageKind: "route",
      sourceArtifacts: expect.arrayContaining(["src/app/(dashboard)/work/page.tsx"]),
      testArtifacts: expect.arrayContaining(["e2e/v10-core-smoke.spec.ts"]),
    });
    expect(matrix.find((row) => row.coverageKey === "telemetry_event:product.v10.activation_completed")).toMatchObject({
      coverageKind: "telemetry_event",
      dimensions: expect.arrayContaining(["telemetry", "test", "release_evidence"]),
    });
    expect(matrix.find((row) => row.coverageKey === "audit_action:report_run.created")).toMatchObject({
      coverageKind: "audit_action",
      dimensions: expect.arrayContaining(["audit", "privacy"]),
    });
    expect(matrix.find((row) => row.coverageKey === "ci_release_gate:npm run check:v10-suite")).toMatchObject({
      coverageKind: "ci_release_gate",
      owner: "release",
    });
    expect(matrix.find((row) => row.coverageKey === "implementation_requirement:approval-gated-automation")).toMatchObject({
      coverageKind: "implementation_requirement",
      priority: "P2",
      status: "runtime_backed",
      dimensions: expect.arrayContaining(["database_or_source", "read_model", "test", "release_evidence"]),
    });
    expect(matrix.find((row) => row.coverageKey === "implementation_requirement:external-launch-evidence-placeholders")).toMatchObject({
      coverageKind: "implementation_requirement",
      priority: "release_blocker",
      status: "non_autonomous_blocker",
      residualRisk: expect.stringContaining("Non-autonomous launch evidence"),
    });
    expect(matrix.find((row) => row.coverageKey === "autonomous_coverage_contract:exhaustive-artifact-sweep")).toMatchObject({
      coverageKind: "autonomous_coverage_contract",
      dimensions: expect.arrayContaining(["test", "release_evidence"]),
    });
  });

  it("keeps every acceptance gate backed by at least one scoped acceptance row", () => {
    const matrix = buildV10NoExclusionsMatrix();

    for (const gate of V10_ACCEPTANCE_GATES) {
      const row = matrix.find((entry) => entry.coverageKey === `acceptance_gate:${gate}`);
      expect(row, gate).toBeTruthy();
      if (gate !== "objective_measurement") {
        expect(row?.residualRisk, gate).toBeNull();
      }
    }
  });

  it("blocks silent omissions and incomplete proof rows", () => {
    const incomplete: V10NoExclusionsMatrixRow[] = [
      {
        coverageKey: "source_object:contract",
        coverageKind: "source_object",
        priority: "P0",
        status: "runtime_backed",
        owner: "engineering",
        dimensions: [],
        sourceArtifacts: [],
        testArtifacts: [],
        releaseEvidenceKey: "source_object:contract",
        residualRisk: null,
      },
    ];

    expect(validateV10NoExclusionsMatrix(incomplete)).toEqual(
      expect.arrayContaining([
        "source_object:contract:dimension_required",
        "source_object:contract:source_artifact_required",
        "source_object:contract:test_artifact_required",
        "source_object:contract:release_evidence_key_required",
        "missing_source_object:work_item",
        "missing_read_model:activation_state",
        "missing_job_class:contract_import",
        "missing_notification_class:due_work",
        "missing_report_family:contract_portfolio_summary",
        "missing_acceptance_gate:activation",
        "missing_navigation_family:Home",
        "missing_mutation:create_contract_import",
        "missing_recoverable_state:empty",
        "missing_compatibility_boundary:external_evidence_links",
        "missing_objective_metric:activation",
        "missing_fixture:core_workspaces",
        "missing_external_evidence_gate:human_usability_sessions",
        "missing_provider_boundary:supabase",
        "missing_ops_release_readiness:read_model_refresh",
        "missing_spec_section:1",
        "missing_inventory_file:page:dashboard",
        "missing_telemetry_event:product.v10.activation_completed",
        "missing_audit_action:import_job.created",
        "missing_ci_release_gate:npm run check:v10-suite",
        "missing_ci_release_gate:npm run check:v10-inventory-lock",
        "missing_implementation_requirement:activation-state-runtime",
        "missing_autonomous_coverage_contract:migration-rls-runtime",
      ])
    );
  });
});
