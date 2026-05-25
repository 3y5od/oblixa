import { describe, expect, it } from "vitest";
import {
  V10_COMPONENT_CONTRACTS,
  V10_CONCURRENCY_CONTRACTS,
  V10_DATA_INTEGRITY,
  V10_DOMAIN_DEPTH_CONTRACTS,
  V10_DOMAIN_WORKFLOW_SOURCE_LINKS,
  V10_JOURNEY_COVERAGE,
  V10_PLAN_LIMIT_CONTRACTS,
  V10_RELEASE_OPERATIONS,
  V10_ROUTE_STATE_MATRIX,
  V10_RUNTIME_OWNERSHIP,
  V10_THREAT_MODEL_CONTRACTS,
  validateV10DomainWorkflowSourceLinks,
  v10DepthContractHasRequirement,
} from "./domain-depth-contracts";

describe("V10 domain-depth contracts", () => {
  it("covers end-to-end journeys and browser harness targets", () => {
    expect(V10_JOURNEY_COVERAGE.map((contract) => contract.key)).toEqual(
      expect.arrayContaining(["first_activation", "daily_work", "renewal_prevention", "evidence_collection", "reporting_governance"])
    );
    expect(v10DepthContractHasRequirement("first_activation", "self_explanation")).toBe(true);
    expect(v10DepthContractHasRequirement("reporting_governance", "settings_visibility")).toBe(true);
  });

  it("covers runtime ownership, freshness, integrity, and reconciliation", () => {
    expect(V10_RUNTIME_OWNERSHIP.length).toBeGreaterThan(0);
    expect(V10_DATA_INTEGRITY.length).toBeGreaterThan(0);
    expect(v10DepthContractHasRequirement("read_models", "freshness_slo")).toBe(true);
    expect(v10DepthContractHasRequirement("count_reconciliation", "home_work_reports_match")).toBe(true);
  });

  it("covers concurrency, quotas, threat models, and route-state policy", () => {
    expect(V10_CONCURRENCY_CONTRACTS.length).toBeGreaterThan(0);
    expect(V10_PLAN_LIMIT_CONTRACTS.length).toBeGreaterThan(0);
    expect(V10_THREAT_MODEL_CONTRACTS.length).toBeGreaterThan(0);
    expect(V10_ROUTE_STATE_MATRIX.length).toBeGreaterThan(0);
    expect(v10DepthContractHasRequirement("mutations", "idempotency_key")).toBe(true);
    expect(v10DepthContractHasRequirement("exports_reports", "csv_injection")).toBe(true);
    expect(v10DepthContractHasRequirement("http_policy", "cache_control_private")).toBe(true);
  });

  it("covers release operations and reusable component contracts", () => {
    expect(V10_RELEASE_OPERATIONS.map((contract) => contract.owner)).toEqual(
      expect.arrayContaining(["release", "operations", "support"])
    );
    expect(V10_COMPONENT_CONTRACTS.map((contract) => contract.key)).toEqual(
      expect.arrayContaining(["badges", "cards_tables", "dialogs_drawers_forms", "diagnostics_permission_hints"])
    );
    expect(V10_DOMAIN_DEPTH_CONTRACTS.length).toBeGreaterThan(25);
  });

  it("links every domain workflow source object to Work, search, reporting, notification, and audit", () => {
    expect(validateV10DomainWorkflowSourceLinks()).toEqual([]);
    expect(V10_DOMAIN_WORKFLOW_SOURCE_LINKS.map((row) => row.workflow)).toEqual([
      "activation",
      "review",
      "task",
      "renewal",
      "evidence",
      "obligation",
      "approval",
      "exception",
      "report",
      "export",
      "job",
      "notification",
      "decision",
      "relationship",
      "advanced",
      "assurance",
      "shipped_p2",
    ]);
    expect(V10_DOMAIN_WORKFLOW_SOURCE_LINKS.find((row) => row.workflow === "evidence")).toMatchObject({
      sourceObjectType: "evidence_request",
      readModel: "evidence_request_statuses",
      workItemType: "evidence_request",
      auditAction: "evidence_request.accepted",
      notificationClass: "evidence_request",
    });
    expect(V10_DOMAIN_WORKFLOW_SOURCE_LINKS.find((row) => row.workflow === "report")).toMatchObject({
      sourceObjectType: "report_run",
      readModel: "report_run_visibility",
      workItemType: "report_failure",
      notificationClass: "failed_report",
    });
    expect(V10_DOMAIN_WORKFLOW_SOURCE_LINKS.find((row) => row.workflow === "relationship")).toMatchObject({
      sourceObjectType: "relationship",
      readModel: "advanced_assurance_linked_records",
      workItemType: "relationship_review",
    });
    expect(V10_DOMAIN_WORKFLOW_SOURCE_LINKS.find((row) => row.workflow === "advanced")).toMatchObject({
      sourceObjectType: "decision",
      workItemType: "automation_approval",
      notificationClass: "automation_approval_required",
    });
    expect(V10_DOMAIN_WORKFLOW_SOURCE_LINKS.find((row) => row.workflow === "assurance")).toMatchObject({
      sourceObjectType: "finding",
      reportExportInclusion: "required",
    });
    expect(V10_DOMAIN_WORKFLOW_SOURCE_LINKS.find((row) => row.workflow === "shipped_p2")).toMatchObject({
      sourceObjectType: "automation_run",
      auditAction: "automation.run_approved",
    });
    expect(
      validateV10DomainWorkflowSourceLinks([
        {
          workflow: "evidence",
          sourceObjectType: "",
          sourceTable: "",
          readModel: "",
          workItemType: "",
          primaryAction: "",
          auditAction: "invalid",
          commandSearchRequired: false,
          reportExportInclusion: "required",
          notificationClass: null,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "domain_source_link_missing:renewal",
        "evidence:source_object_required",
        "evidence:audit_action_required",
        "evidence:command_search_required",
        "evidence:notification_class_required",
      ])
    );
  });

  it("keeps every domain-depth row well-formed with non-duplicated requirements", () => {
    const owners = new Set(V10_DOMAIN_DEPTH_CONTRACTS.map((contract) => contract.owner));
    expect(owners).toEqual(new Set(["engineering", "product", "release", "operations", "security", "support"]));
    for (const contract of V10_DOMAIN_DEPTH_CONTRACTS) {
      expect(contract.key).toMatch(/^[a-z0-9_]+$/);
      expect(contract.requirements.length, contract.key).toBeGreaterThanOrEqual(3);
      expect(new Set(contract.requirements).size, contract.key).toBe(contract.requirements.length);
      for (const requirement of contract.requirements) {
        expect(requirement).toMatch(/^[a-z0-9_]+$/);
      }
    }
  });
});
