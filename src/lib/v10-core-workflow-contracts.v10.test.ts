import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V10_REQUIRED_READ_MODEL_KEYS } from "./v10-read-models";
import {
  V10_CORE_WORKFLOW_CONTRACTS,
  V10_END_TO_END_DOMAIN_WORKFLOW_CONTRACTS,
  getV10CoreWorkflowContract,
  validateV10CoreSurfaceParitySnapshots,
  validateV10CoreWorkflowContracts,
  validateV10EndToEndDomainWorkflowContracts,
} from "./v10-core-workflow-contracts";

describe("V10 core workflow contracts", () => {
  it("covers every autonomous P0 core workflow with concrete runtime proof", () => {
    expect(validateV10CoreWorkflowContracts()).toEqual([]);
    expect(V10_CORE_WORKFLOW_CONTRACTS.map((contract) => contract.id)).toEqual([
      "activation",
      "home_daily_brief",
      "unified_work",
      "contract_record",
      "field_review_data_quality",
      "renewal_prevention",
    ]);

    for (const contract of V10_CORE_WORKFLOW_CONTRACTS) {
      expect(contract.priority, contract.id).toBe("P0");
      expect(contract.refreshScopes, contract.id).toContain("repair");
      expect(contract.recoveryStates, contract.id).toEqual(expect.arrayContaining(["partial", "failed"]));
      expect(contract.objectiveSignal, contract.id).toMatch(/^[a-z0-9_]+$/);
      for (const proof of contract.autonomousProofs) {
        expect(existsSync(join(process.cwd(), proof)), `${contract.id}:${proof}`).toBe(true);
      }
    }
  });

  it("keeps core workflows tied to canonical V10 read models", () => {
    const requiredReadModels = new Set(V10_REQUIRED_READ_MODEL_KEYS);
    for (const contract of V10_CORE_WORKFLOW_CONTRACTS) {
      for (const model of contract.readModels) {
        expect(requiredReadModels, `${contract.id}:${model}`).toContain(model);
      }
    }

    expect(getV10CoreWorkflowContract("activation")?.readModels).toEqual(
      expect.arrayContaining(["activation_state", "work_items", "field_provenance_records"])
    );
    expect(getV10CoreWorkflowContract("unified_work")?.requiredActions).toEqual(
      expect.arrayContaining(["mark_done", "approve_approval", "resolve_exception", "retry_failed_job"])
    );
    expect(getV10CoreWorkflowContract("renewal_prevention")?.readModels).toEqual(
      expect.arrayContaining(["renewal_posture_snapshots", "renewal_checkpoint_records", "notification_deliveries"])
    );
  });

  it("covers each end-to-end V10 domain workflow from activation through settings", () => {
    expect(validateV10EndToEndDomainWorkflowContracts()).toEqual([]);
    expect(V10_END_TO_END_DOMAIN_WORKFLOW_CONTRACTS.map((contract) => contract.id)).toEqual([
      "activation",
      "review",
      "renewal",
      "obligation",
      "evidence",
      "approval",
      "exception",
      "report",
      "export",
      "job",
      "notification",
      "settings",
      "relationship",
      "advanced",
      "assurance",
      "shipped_p2",
    ]);
    expect(V10_END_TO_END_DOMAIN_WORKFLOW_CONTRACTS.find((contract) => contract.id === "evidence")).toMatchObject({
      mutationOrActionNames: expect.arrayContaining(["create_evidence_request", "accept_evidence", "reject_evidence", "submit_external_evidence"]),
      readModels: expect.arrayContaining(["evidence_request_statuses", "external_evidence_submissions"]),
      visibleStates: expect.arrayContaining(["external_link_expired", "external_link_revoked", "success"]),
    });
    expect(V10_END_TO_END_DOMAIN_WORKFLOW_CONTRACTS.find((contract) => contract.id === "relationship")).toMatchObject({
      sourceObjects: expect.arrayContaining(["account", "counterparty", "relationship"]),
      readModels: expect.arrayContaining(["advanced_assurance_linked_records", "command_search_index"]),
    });
    expect(V10_END_TO_END_DOMAIN_WORKFLOW_CONTRACTS.find((contract) => contract.id === "advanced")).toMatchObject({
      sourceObjects: expect.arrayContaining(["decision", "simulation", "automation_run"]),
      visibleStates: expect.arrayContaining(["hidden_module", "success"]),
    });
    expect(V10_END_TO_END_DOMAIN_WORKFLOW_CONTRACTS.find((contract) => contract.id === "assurance")).toMatchObject({
      sourceObjects: expect.arrayContaining(["finding", "control", "campaign", "scorecard"]),
      visibleStates: expect.arrayContaining(["hidden_module", "success"]),
    });
    expect(V10_END_TO_END_DOMAIN_WORKFLOW_CONTRACTS.find((contract) => contract.id === "shipped_p2")).toMatchObject({
      sourceObjects: expect.arrayContaining(["automation_run", "runtime_artifact"]),
      visibleStates: expect.arrayContaining(["failed_retryable", "hidden_module", "success"]),
    });
    for (const contract of V10_END_TO_END_DOMAIN_WORKFLOW_CONTRACTS) {
      for (const proof of contract.requiredProofs) {
        expect(existsSync(join(process.cwd(), proof)), `${contract.id}:${proof}`).toBe(true);
      }
    }
    expect(
      validateV10EndToEndDomainWorkflowContracts([
        {
          id: "activation",
          routeOrAction: "",
          sourceObjects: [],
          readModels: [],
          mutationOrActionNames: [],
          visibleStates: ["empty"],
          recoveryDestination: "work",
          requiredProofs: [],
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "domain_workflow_missing:review",
        "activation:route_or_action_required",
        "activation:source_object_required",
        "activation:read_model_required",
        "activation:mutation_or_action_required",
        "activation:recoverable_failure_state_required",
        "activation:success_state_required",
        "activation:recovery_destination_required",
        "activation:proof_required",
      ])
    );
    expect(
      validateV10EndToEndDomainWorkflowContracts([
        {
          id: "activation",
          routeOrAction: "/dashboard",
          sourceObjects: ["contract", "legacy_source"],
          readModels: ["legacy_evidence_request_records"],
          mutationOrActionNames: ["create_contract_import"],
          visibleStates: ["failed", "success"],
          recoveryDestination: "/work",
          requiredProofs: ["src/lib/v10-activation-state.ts"],
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "activation:unknown_source_object:legacy_source",
        "activation:unknown_read_model:legacy_evidence_request_records",
      ])
    );
  });

  it("keeps the Work hub empty queue slices on V10 recoverable-state contracts", () => {
    const workPage = readFileSync(join(process.cwd(), "src/app/(dashboard)/work/page.tsx"), "utf8");

    expect(workPage).toContain("from(\"v10_work_items\")");
    expect(workPage).toContain("<V10RecoverableState");
    expect(workPage).not.toContain("@/components/ui/empty-state");
    for (const accessibleName of [
      "Empty task queue state",
      "Empty approval queue state",
      "Empty obligation queue state",
      "Empty exception queue state",
    ]) {
      expect(workPage).toContain(`accessibleName="${accessibleName}"`);
    }
  });

  it("ratchets core surface parity across Home, Work, contracts, command palette, and nav", () => {
    const counts = {
      due_today: 4,
      overdue: 2,
      blocked: 1,
      high_risk: 3,
      failed_jobs: 1,
      missing_owner: 2,
      hidden_filtered: 5,
    };
    expect(
      validateV10CoreSurfaceParitySnapshots([
        { surface: "home", counts, proofArtifact: "src/app/(dashboard)/dashboard/page.tsx" },
        { surface: "work", counts, proofArtifact: "src/app/(dashboard)/work/page.tsx" },
        { surface: "contract_list", counts, proofArtifact: "src/app/(dashboard)/contracts/page.tsx" },
        { surface: "contract_detail", counts, proofArtifact: "src/app/(dashboard)/contracts/[id]/page.tsx" },
        { surface: "command_palette", counts, proofArtifact: "src/app/api/command-palette/contracts/route.ts" },
        { surface: "nav", counts, proofArtifact: "src/components/layout/command-palette.tsx" },
      ])
    ).toEqual([]);
    expect(
      validateV10CoreSurfaceParitySnapshots([
        { surface: "home", counts, proofArtifact: "src/app/(dashboard)/dashboard/page.tsx" },
        { surface: "work", counts: { ...counts, blocked: 2 }, proofArtifact: "src/app/(dashboard)/work/page.tsx" },
      ])
    ).toEqual(expect.arrayContaining(["surface_missing:contract_list", "metric_mismatch:blocked:home=1,work=2"]));
  });

  it("rejects incomplete workflow proof rows", () => {
    expect(
      validateV10CoreWorkflowContracts([
        {
          id: "activation",
          priority: "P0",
          route: "",
          sourceTables: [],
          readModels: [],
          requiredActions: [],
          recoveryStates: ["empty"],
          refreshScopes: ["full"],
          telemetryEvents: [],
          objectiveSignal: "",
          autonomousProofs: [],
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "activation:route_required",
        "activation:source_table_required",
        "activation:read_model_required",
        "activation:action_required",
        "activation:recoverability_required",
        "activation:repair_scope_required",
        "activation:telemetry_required",
        "activation:objective_signal_required",
        "activation:proof_required",
        "missing_workflow:home_daily_brief",
      ])
    );
  });
});
