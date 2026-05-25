import { describe, expect, it } from "vitest";
import {
  V10_RUNTIME_COVERAGE_LEDGER,
  V10_QUERYABLE_COVERAGE_LEDGER,
  V10_TRACEABILITY_LEDGER,
  buildV10QueryableCoverageLedger,
  buildV10DocRuntimeProofRows,
  getV10RuntimeCoverageLedgerRow,
  getV10TraceabilityLedgerRow,
  summarizeV10TraceabilityByStatus,
  validateV10DocRuntimeProofRows,
  validateV10RuntimeCoverageLedger,
  validateV10TraceabilityClosure,
} from "./traceability-ledger";

describe("V10 traceability ledger", () => {
  it("classifies V10 plan items by priority, artifact, proof, and evidence", () => {
    expect(V10_TRACEABILITY_LEDGER.length).toBeGreaterThan(70);
    for (const row of V10_TRACEABILITY_LEDGER) {
      expect(row.id).toBeTruthy();
      expect(row.priority).toMatch(/^P[0-2]$/);
      expect(row.automatedProof).toBeTruthy();
      expect(row.releaseEvidence).toBeTruthy();
    }
    expect(new Set(V10_TRACEABILITY_LEDGER.map((row) => row.automatedProof)).size).toBeGreaterThan(3);
  });

  it("keeps ledger ids unique and queryable", () => {
    const ids = V10_TRACEABILITY_LEDGER.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getV10TraceabilityLedgerRow("mutation-rollout")).toMatchObject({
      priority: "P0",
      status: "implemented",
    });
    expect(getV10TraceabilityLedgerRow("component-contracts")).toMatchObject({
      priority: "P0",
      status: "implemented",
    });
    expect(getV10TraceabilityLedgerRow("release-fixtures")).toMatchObject({
      status: "requires_release_candidate",
    });
  });

  it("summarizes implementation status for readiness review", () => {
    const expected = V10_TRACEABILITY_LEDGER.reduce(
      (summary, row) => {
        summary[row.status] += 1;
        return summary;
      },
      {
        implemented: 0,
        codified: 0,
        externally_verified: 0,
        requires_release_candidate: 0,
      }
    );
    expect(summarizeV10TraceabilityByStatus()).toEqual(expected);
    expect(expected.implemented).toBeGreaterThan(0);
    expect(expected.codified).toBeGreaterThan(0);
  });

  it("counts every declared implementation status for release fixtures", () => {
    expect(
      summarizeV10TraceabilityByStatus([
        {
          id: "implemented_fixture",
          priority: "P0",
          artifact: "test",
          status: "implemented",
          automatedProof: "npm run check:release-suite-current",
          releaseEvidence: "local proof",
        },
        {
          id: "codified_fixture",
          priority: "P1",
          artifact: "catalog",
          status: "codified",
          automatedProof: "npm run check:release-suite-current",
          releaseEvidence: "catalog proof",
        },
        {
          id: "external_fixture",
          priority: "P1",
          artifact: "release_evidence",
          status: "externally_verified",
          automatedProof: "npm run check:release-suite-current",
          releaseEvidence: "dashboard proof",
        },
        {
          id: "rc_fixture",
          priority: "P2",
          artifact: "release_evidence",
          status: "requires_release_candidate",
          automatedProof: "npm run check:release-suite-current",
          releaseEvidence: "release candidate fixture",
        },
      ])
    ).toEqual({
      implemented: 1,
      codified: 1,
      externally_verified: 1,
      requires_release_candidate: 1,
    });
  });

  it("publishes a queryable runtime coverage ledger with ownership, authz, evidence, and rollback", () => {
    expect(validateV10RuntimeCoverageLedger()).toEqual([]);
    expect(V10_RUNTIME_COVERAGE_LEDGER).toHaveLength(V10_TRACEABILITY_LEDGER.length);
    expect(getV10RuntimeCoverageLedgerRow("route-api-map")).toMatchObject({
      coverageKind: "route",
      priority: "P0",
      runtimeStatus: "runtime_backed",
      authorizationRule: "organization_membership_and_feature_eligibility",
    });
    expect(getV10RuntimeCoverageLedgerRow("stakeholder-readiness")).toMatchObject({
      priority: "release_blocker",
      runtimeStatus: "external_blocker",
      owner: "release",
    });
    expect(V10_RUNTIME_COVERAGE_LEDGER.map((row) => row.coverageKind)).toEqual(
      expect.arrayContaining(["route", "mutation", "read_model", "audit_action", "fixture", "non_autonomous_blocker"])
    );
  });

  it("closes spec sections, gates, priorities, routes, mutations, models, telemetry, audits, fixtures, and reports", () => {
    expect(validateV10TraceabilityClosure()).toEqual([]);
    expect(V10_QUERYABLE_COVERAGE_LEDGER.length).toBe(buildV10QueryableCoverageLedger().length);
    expect(V10_QUERYABLE_COVERAGE_LEDGER.map((row) => row.coverageKind)).toEqual(
      expect.arrayContaining([
        "spec_section",
        "acceptance_gate",
        "route",
        "mutation",
        "read_model",
        "telemetry_event",
        "audit_action",
        "fixture",
        "report_family",
      ])
    );
    expect(V10_QUERYABLE_COVERAGE_LEDGER).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ coverageKind: "spec_section", coverageKey: "4.15" }),
        expect.objectContaining({ coverageKind: "route", coverageKey: "/api/command-palette/contracts:GET" }),
        expect.objectContaining({ coverageKind: "mutation", coverageKey: "accept_evidence" }),
        expect.objectContaining({ coverageKind: "read_model", coverageKey: "command_search_index" }),
        expect.objectContaining({ coverageKind: "telemetry_event", coverageKey: "product.v10.release_check_recorded" }),
        expect.objectContaining({ coverageKind: "audit_action", coverageKey: "evidence_request.accepted" }),
        expect.objectContaining({ coverageKind: "report_family", coverageKey: "workspace_health_report" }),
      ])
    );
    expect(validateV10TraceabilityClosure([V10_QUERYABLE_COVERAGE_LEDGER[0]!])).toEqual(
      expect.arrayContaining([
        "missing_coverage_kind:acceptance_gate",
        "missing_coverage_kind:route",
        "missing_coverage_kind:mutation",
        "missing_coverage_kind:read_model",
        "missing_coverage_kind:telemetry_event",
        "missing_coverage_kind:audit_action",
        "missing_coverage_kind:fixture",
        "missing_coverage_kind:report_family",
      ])
    );
  });

  it("publishes doc-to-runtime proof rows joined to acceptance, CI, tests, and release evidence", () => {
    const proofRows = buildV10DocRuntimeProofRows();

    expect(validateV10DocRuntimeProofRows(proofRows)).toEqual([]);
    expect(proofRows.map((row) => row.queryKey)).toContain("spec_section:4.15");
    expect(proofRows.find((row) => row.specSection === "4.15")).toMatchObject({
      codeArtifacts: expect.arrayContaining(["src/lib/product-telemetry.ts", "src/lib/release-contract.ts"]),
      testArtifacts: expect.arrayContaining(["src/lib/objective-telemetry.test.ts"]),
      acceptanceIds: expect.arrayContaining(["telemetry-objectives"]),
      ciChecks: expect.arrayContaining(["npm run check:release-suite-current"]),
      releaseEvidence: expect.arrayContaining(["automated_gate"]),
    });
    expect(
      validateV10DocRuntimeProofRows([
        {
          specSection: "missing",
          queryKey: "spec_section:missing",
          codeArtifacts: [],
          testArtifacts: [],
          acceptanceIds: [],
          ciChecks: [],
          releaseEvidence: [],
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "missing:queryable_ledger_missing",
        "missing:code_artifact_required",
        "missing:test_artifact_required",
        "missing:acceptance_id_required",
        "missing:ci_check_required",
        "missing:release_evidence_required",
      ])
    );
  });
});
