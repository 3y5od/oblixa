import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  V10_SOURCE_OBJECT_TYPES,
  V10_WORK_ITEM_TYPES,
} from "./v10-release-contract";
import { V10_REQUIRED_READ_MODEL_KEYS } from "./v10-read-models";
import {
  V10_SOURCE_OBJECT_INVENTORY,
  buildV10SourceObjectCoverageMatrix,
  getV10SourceObjectInventoryRow,
  validateV10SourceObjectCoverageMatrix,
  validateV10SourceObjectInventory,
} from "./v10-source-object-inventory";

describe("V10 source object inventory", () => {
  it("maps every V10 source object type to runtime lineage and proof", () => {
    expect(validateV10SourceObjectInventory()).toEqual([]);
    expect(V10_SOURCE_OBJECT_INVENTORY.map((row) => row.sourceObjectType).sort()).toEqual(
      [...V10_SOURCE_OBJECT_TYPES].sort()
    );

    for (const row of V10_SOURCE_OBJECT_INVENTORY) {
      expect(row.sourceTable, row.sourceObjectType).toMatch(/^[a-z0-9_]+$/);
      expect(row.readModels.length, row.sourceObjectType).toBeGreaterThan(0);
      expect(row.readModels.every((model) => V10_REQUIRED_READ_MODEL_KEYS.includes(model as never)), row.sourceObjectType).toBe(true);
      expect(row.auditActions.every((action) => action.includes(".")), row.sourceObjectType).toBe(true);
      expect(row.telemetryObjectives.length, row.sourceObjectType).toBeGreaterThan(0);
      for (const testPath of row.tests) {
        expect(existsSync(join(process.cwd(), testPath)), `${row.sourceObjectType}:${testPath}`).toBe(true);
      }
    }
  });

  it("builds an explicit coverage matrix for read models, Work, search, audit, telemetry, and release evidence", () => {
    const matrix = buildV10SourceObjectCoverageMatrix();

    expect(validateV10SourceObjectCoverageMatrix(matrix)).toEqual([]);
    expect(matrix.map((row) => row.sourceObjectType).sort()).toEqual([...V10_SOURCE_OBJECT_TYPES].sort());
    expect(matrix.find((row) => row.sourceObjectType === "contract")).toMatchObject({
      primaryReadModel: "activation_state",
      ownershipCoverage: "owner_field",
      statusCoverage: "status_field",
      dueCoverage: "derived_due_state",
      visibilityCoverage: "visibility_field",
      generatesWork: true,
      workItemType: "unassigned_work",
      commandSearchCoverage: "required",
      auditCoverage: "runtime_audited",
      telemetryCoverage: "objective_mapped",
      reportExportInclusion: "required",
      retentionPolicy: "source_retained",
      releaseEvidenceKey: "source_object:contract",
    });
    expect(matrix.find((row) => row.sourceObjectType === "billing_sync")).toMatchObject({
      ownershipCoverage: "release_evidence",
      auditCoverage: "external_blocker",
      retentionPolicy: "release_evidence",
      releaseEvidenceKey: "source_object:billing_sync",
    });
    expect(
      matrix.every((row) => row.proofTests.every((testPath) => existsSync(join(process.cwd(), testPath))))
    ).toBe(true);
  });

  it("keeps work-generating source objects tied to canonical work item types", () => {
    for (const row of V10_SOURCE_OBJECT_INVENTORY.filter((entry) => entry.workItemType !== null)) {
      expect(V10_WORK_ITEM_TYPES, row.sourceObjectType).toContain(row.workItemType);
      expect(row.readModels, row.sourceObjectType).toContain("work_items");
      expect(row.statusField ?? row.dueField ?? row.ownerField, row.sourceObjectType).toBeTruthy();
    }
  });

  it("separates Core-required sources from Advanced and Assurance continuity sources", () => {
    expect(getV10SourceObjectInventoryRow("contract")).toMatchObject({
      minimumMode: "core",
      commandSearch: "required",
      reportExportInclusion: "required",
      autonomousStatus: "runtime_verified",
    });
    expect(getV10SourceObjectInventoryRow("finding")).toMatchObject({
      minimumMode: "assurance",
      commandSearch: "eligible_when_visible",
      reportExportInclusion: "eligible",
      autonomousStatus: "runtime_verified",
    });
    expect(getV10SourceObjectInventoryRow("account")).toMatchObject({
      autonomousStatus: "runtime_verified",
      tests: expect.arrayContaining(["src/lib/v10-read-model-refresh.v10.test.ts"]),
    });
    expect(getV10SourceObjectInventoryRow("playbook")).toMatchObject({
      sourceTable: "adaptive_playbook_runs",
      autonomousStatus: "runtime_verified",
    });
    expect(getV10SourceObjectInventoryRow("automation_run")).toMatchObject({
      minimumMode: "assurance",
      workItemType: "automation_approval",
      autonomousStatus: "runtime_verified",
    });
    const autonomousAdvancedRows = V10_SOURCE_OBJECT_INVENTORY.filter(
      (row) => row.minimumMode !== "core" && row.sourceObjectType !== "program"
    );
    expect(autonomousAdvancedRows.every((row) => row.autonomousStatus === "runtime_verified")).toBe(true);
  });

  it("includes plan-named operational sources that are not first-class contract records", () => {
    expect(
      [
        "external_evidence_submission",
        "file_upload",
        "audit_event",
        "program",
        "setting_destination",
        "billing_sync",
        "runtime_artifact",
      ].map((sourceObjectType) => getV10SourceObjectInventoryRow(sourceObjectType as never)?.sourceTable)
    ).toEqual([
      "evidence_submissions",
      "contract_files",
      "v10_audit_events",
      "portfolio_programs",
      "notification_destinations",
      "billing_sync_jobs",
      "v10_runtime_artifacts",
    ]);
    expect(getV10SourceObjectInventoryRow("external_evidence_submission")).toMatchObject({
      organizationScope: "external_token_scoped",
      retentionPolicy: "token_expiring",
      commandSearch: "not_applicable",
    });
    expect(getV10SourceObjectInventoryRow("runtime_artifact")).toMatchObject({
      retentionPolicy: "artifact_expiring",
      reportExportInclusion: "eligible",
    });
    expect(getV10SourceObjectInventoryRow("evidence_request")).toMatchObject({
      autonomousStatus: "runtime_verified",
      tests: expect.arrayContaining(["src/app/api/evidence/requests/route.test.ts"]),
    });
    expect(getV10SourceObjectInventoryRow("workspace_health_diagnostic")).toMatchObject({
      autonomousStatus: "runtime_verified",
      tests: expect.arrayContaining(["src/app/api/cron/v10/read-model-refresh/route.test.ts"]),
    });
  });

  it("rejects silent source object omissions", () => {
    expect(
      validateV10SourceObjectInventory([
        {
          sourceObjectType: "contract",
          sourceTable: "",
          organizationScope: "required",
          ownerField: null,
          statusField: null,
          dueField: null,
          visibilityField: null,
          featureFamily: "contracts",
          minimumMode: "core",
          workItemType: null,
          readModels: [],
          commandSearch: "required",
          auditActions: [],
          telemetryObjectives: [],
          reportExportInclusion: "required",
          retentionPolicy: "source_retained",
          autonomousStatus: "typed_contract",
          tests: [],
        },
        {
          sourceObjectType: "work_item",
          sourceTable: "contract_tasks",
          organizationScope: "required",
          ownerField: "assignee_id",
          statusField: "status",
          dueField: "due_date",
          visibilityField: null,
          featureFamily: "work",
          minimumMode: "core",
          workItemType: "contract_task",
          readModels: ["unknown_model"],
          commandSearch: "required",
          auditActions: ["work_item.completed"],
          telemetryObjectives: ["daily_action_clearance"],
          reportExportInclusion: "required",
          retentionPolicy: "source_retained",
          autonomousStatus: "typed_contract",
          tests: ["src/lib/v10-source-object-inventory.v10.test.ts"],
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "contract:source_table_required",
        "contract:org_source_required",
        "contract:read_model_required",
        "contract:command_search_index_required",
        "work_item:unknown_read_model:unknown_model",
        "work_item:command_search_index_required",
        "work_item:work_source_missing_work_items_model",
        "contract:audit_action_required",
        "contract:telemetry_objective_required",
        "contract:test_required",
        "missing_source_object:field",
      ])
    );
  });

  it("rejects silent coverage matrix omissions", () => {
    expect(
      validateV10SourceObjectCoverageMatrix([
        {
          sourceObjectType: "contract",
          sourceTable: "",
          primaryReadModel: "missing",
          ownershipCoverage: "",
          statusCoverage: "",
          dueCoverage: "",
          visibilityCoverage: "",
          generatesWork: true,
          workItemType: null,
          commandSearchCoverage: "required",
          auditCoverage: "runtime_audited",
          telemetryCoverage: "objective_mapped",
          reportExportInclusion: "required",
          retentionPolicy: "source_retained",
          releaseEvidenceKey: "contract",
          proofTests: [],
        } as never,
      ])
    ).toEqual(
      expect.arrayContaining([
        "contract:matrix_source_table_required",
        "contract:matrix_primary_read_model_required",
        "contract:matrix_ownership_required",
        "contract:matrix_status_required",
        "contract:matrix_due_required",
        "contract:matrix_visibility_required",
        "contract:matrix_work_item_type_required",
        "contract:matrix_release_evidence_key_required",
        "contract:matrix_proof_required",
        "missing_matrix_source_object:work_item",
      ])
    );
  });
});
