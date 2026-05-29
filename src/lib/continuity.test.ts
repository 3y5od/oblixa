import { describe, expect, it } from "vitest";
import {
  V10_ADVANCED_ASSURANCE_LINKED_RECORDS,
  V10_ADVANCED_ASSURANCE_CONTINUITY_SIGNALS,
  V10_ADVANCED_LINKED_RECORDS,
  V10_ASSURANCE_LINKED_RECORDS,
  V10_P2_STRETCH_BEHAVIOR_CONTRACTS,
  buildV10AdvancedAssuranceNotificationPolicies,
  buildV10AdvancedAssuranceNotificationPolicy,
  buildV10LinkedRecordContinuityEvidence,
  buildV10LinkedRecordProjection,
  getV10P2AutomationApprovalContract,
  summarizeV10CoreContinuityIsolation,
  validateV10AdvancedAssuranceLifecycleLink,
  validateV10AdvancedAssuranceContinuitySignals,
  validateV10AdvancedAssuranceNotificationPolicies,
  validateV10CoreContinuityIsolation,
  validateV10P2StretchBehaviorContracts,
  validateV10P2AutomationRunState,
  v10LinkedRecordIsVisibleInMode,
  v10LinkedRecordRequiresContainment,
} from "./advanced-assurance-continuity";

describe("V10 P1/P2 Advanced and Assurance continuity", () => {
  it("links Advanced records through V10 operational contracts", () => {
    expect(V10_ADVANCED_LINKED_RECORDS.map((record) => record.recordType)).toEqual([
      "account",
      "counterparty",
      "decision",
      "campaign",
      "simulation",
      "relationship",
    ]);
    for (const record of V10_ADVANCED_LINKED_RECORDS) {
      expect(record.priority).toBe("P1");
      expect(record.workspaceModeMinimum).toBe("advanced");
      expect(record.linkage).toContain("work_items");
      expect(record.linkage).toContain("command_search_index");
      expect(record.linkage).toContain("audit_events");
    }
  });

  it("links Assurance records without widening Core visibility", () => {
    expect(V10_ASSURANCE_LINKED_RECORDS.map((record) => record.recordType)).toEqual([
      "finding",
      "control",
      "scorecard",
      "playbook",
      "review_board",
      "health_graph",
      "automation_run",
    ]);
    for (const record of V10_ASSURANCE_LINKED_RECORDS) {
      expect(record.workspaceModeMinimum).toBe("assurance");
      expect(v10LinkedRecordRequiresContainment(record, "core")).toBe(true);
      expect(v10LinkedRecordRequiresContainment(record, "advanced")).toBe(true);
      expect(v10LinkedRecordIsVisibleInMode(record, "assurance")).toBe(true);
    }
  });

  it("keeps P2 automation approval-gated and auditable", () => {
    const automation = getV10P2AutomationApprovalContract();
    expect(automation.priority).toBe("P2");
    expect(V10_ADVANCED_ASSURANCE_LINKED_RECORDS.filter((record) => record.priority === "P2").map((record) => record.recordType)).toEqual([
      "automation_run",
    ]);
    expect(automation.requiredFields).toEqual(
      expect.arrayContaining(["approval_state", "revert_action", "not_reversible_warning", "audit_event_ids"])
    );
    expect(
      validateV10P2AutomationRunState({
        state: "succeeded",
        approvalId: "approval_1",
        revertAction: "revert_playbook_run",
        auditEventIds: ["audit_1"],
      })
    ).toEqual([]);
    expect(validateV10P2AutomationRunState({ state: "succeeded" })).toEqual(
      expect.arrayContaining(["approval_id_required", "audit_event_required", "revert_action_required"])
    );
    expect(validateV10P2AutomationRunState({ state: "paused_by_kill_switch" })).toEqual([
      "kill_switch_state_required",
    ]);
  });

  it("locks included P2 stretch behavior behind full V10 controls", () => {
    expect(validateV10P2StretchBehaviorContracts()).toEqual([]);
    expect(V10_P2_STRETCH_BEHAVIOR_CONTRACTS.map((contract) => contract.key)).toEqual([
      "predictive_scoring",
      "custom_work_item_types",
      "relationship_timeline_depth",
      "additional_automation_playbooks",
      "additional_report_families",
    ]);
    expect(V10_P2_STRETCH_BEHAVIOR_CONTRACTS.find((contract) => contract.key === "predictive_scoring")).toMatchObject({
      minimumMode: "assurance",
      minimumPlan: "assurance",
      controls: expect.arrayContaining(["privacy", "explainability", "rollback"]),
    });
    expect(V10_P2_STRETCH_BEHAVIOR_CONTRACTS.find((contract) => contract.key === "custom_work_item_types")).toMatchObject({
      controls: expect.arrayContaining(["authorization", "audit", "telemetry", "rollback"]),
    });
    expect(
      validateV10P2StretchBehaviorContracts([
        {
          key: "predictive_scoring",
          minimumMode: "core",
          minimumPlan: "core",
          controls: ["authorization"],
          runtimeArtifacts: [],
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "predictive_scoring:p2_requires_advanced_or_assurance_mode",
        "predictive_scoring:p2_requires_paid_advanced_plan",
        "predictive_scoring:control_required:audit",
        "predictive_scoring:explainability_required",
        "predictive_scoring:runtime_artifact_required",
        "missing_p2_stretch:custom_work_item_types",
      ])
    );
  });

  it("keeps the combined linkage catalog traceable", () => {
    expect(V10_ADVANCED_ASSURANCE_LINKED_RECORDS).toHaveLength(13);
    expect(V10_ADVANCED_ASSURANCE_LINKED_RECORDS.every((record) => record.featureFamily.length > 0)).toBe(true);
    const recordTypes = V10_ADVANCED_ASSURANCE_LINKED_RECORDS.map((record) => record.recordType);
    expect(new Set(recordTypes).size).toBe(recordTypes.length);
    for (const record of V10_ADVANCED_ASSURANCE_LINKED_RECORDS) {
      expect(v10LinkedRecordRequiresContainment(record, "core"), record.recordType).toBe(true);
      expect(record.requiredFields.length, record.recordType).toBeGreaterThan(0);
      expect(new Set(record.requiredFields).size, record.recordType).toBe(record.requiredFields.length);
      expect(record.linkage, record.recordType).toContain("audit_events");
    }
  });

  it("maps every Advanced and Assurance linked record to audit, telemetry, and notification signals", () => {
    expect(validateV10AdvancedAssuranceContinuitySignals()).toEqual([]);
    expect(V10_ADVANCED_ASSURANCE_CONTINUITY_SIGNALS).toHaveLength(V10_ADVANCED_ASSURANCE_LINKED_RECORDS.length);
    expect(V10_ADVANCED_ASSURANCE_CONTINUITY_SIGNALS.find((row) => row.recordType === "decision")).toMatchObject({
      auditAction: "decision.linked",
      telemetryEvent: "product.v10.decision_continuity_visible",
      notificationClass: "pending_approval",
    });
    expect(V10_ADVANCED_ASSURANCE_CONTINUITY_SIGNALS.find((row) => row.recordType === "account")).toMatchObject({
      workspaceModeMinimum: "advanced",
      notificationClass: null,
    });
    expect(
      validateV10AdvancedAssuranceContinuitySignals([
        {
          recordType: "decision",
          workspaceModeMinimum: "core",
          auditAction: "decision",
          telemetryEvent: "product.v10.decision_continuity_visible",
          notificationClass: "decision_continuity" as never,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "decision:signal_mode_mismatch",
        "decision:audit_action_required",
        "decision:notification_class_unknown",
        "missing_signal:account",
      ])
    );
  });

  it("makes notification delivery or suppression explicit for every Advanced and Assurance continuity row", () => {
    const corePolicies = buildV10AdvancedAssuranceNotificationPolicies({ workspaceMode: "core" });
    expect(validateV10AdvancedAssuranceNotificationPolicies(corePolicies)).toEqual([]);
    expect(corePolicies.every((policy) => policy.behavior === "suppress_hidden_by_mode")).toBe(true);

    const advancedPolicies = buildV10AdvancedAssuranceNotificationPolicies({ workspaceMode: "advanced" });
    expect(validateV10AdvancedAssuranceNotificationPolicies(advancedPolicies)).toEqual([]);
    expect(advancedPolicies.find((policy) => policy.recordType === "decision")).toMatchObject({
      behavior: "deliver",
      notificationClass: "pending_approval",
      workDestination: "/work?type=decision",
      commandSearchDestination: "cmdk:decision",
    });
    expect(advancedPolicies.find((policy) => policy.recordType === "account")).toMatchObject({
      behavior: "suppress_not_applicable",
      suppressionReason: "continuity_visible_without_notification_requirement",
    });
    expect(
      buildV10AdvancedAssuranceNotificationPolicy({
        recordType: "automation_run",
        workspaceMode: "assurance",
        moduleHidden: true,
      })
    ).toMatchObject({
      behavior: "suppress_hidden_by_module",
      suppressionReason: "module_hidden_by_workspace_configuration",
      workDestination: "/settings",
    });
    expect(
      validateV10AdvancedAssuranceNotificationPolicies([
        {
          recordType: "decision",
          workspaceMode: "advanced",
          behavior: "deliver",
          notificationClass: null,
          suppressionReason: null,
          workDestination: "",
          commandSearchDestination: "",
          auditAction: "decision",
          supportSafeCopy: "Expose raw token.",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "decision:notification_class_required",
        "decision:work_destination_required",
        "decision:command_search_destination_required",
        "decision:audit_action_required",
        "decision:support_safe_copy_required",
        "notification_policy_missing:account",
      ])
    );
  });

  it("builds mode, plan, module, and linkage evidence for Advanced and Assurance records", () => {
    expect(
      buildV10LinkedRecordContinuityEvidence({
        recordType: "account",
        workspaceMode: "advanced",
        role: "viewer",
        plan: "advanced",
        presentLinkage: ["work_items", "command_search_index", "audit_events"],
      })
    ).toMatchObject({
      visible: true,
      visibility_state: "visible",
      outcome: "success",
      missing_linkage: [],
    });
    expect(
      buildV10LinkedRecordContinuityEvidence({
        recordType: "decision",
        workspaceMode: "advanced",
        role: "viewer",
        plan: "advanced",
        presentLinkage: ["work_items", "command_search_index", "audit_events"],
      })
    ).toMatchObject({
      visible: true,
      visibility_state: "visible",
      outcome: "success",
      missing_linkage: ["notification_deliveries"],
    });
    expect(
      buildV10LinkedRecordContinuityEvidence({
        recordType: "finding",
        workspaceMode: "advanced",
        role: "viewer",
        plan: "advanced",
        presentLinkage: ["work_items"],
      })
    ).toMatchObject({
      visible: false,
      visibility_state: "hidden_by_mode",
      outcome: "mode_required",
      fallback_destination: "/settings",
    });
    expect(
      buildV10LinkedRecordContinuityEvidence({
        recordType: "automation_run",
        workspaceMode: "assurance",
        role: "viewer",
        plan: "assurance",
        moduleHidden: true,
        presentLinkage: ["work_items", "command_search_index", "notification_deliveries", "audit_events"],
      })
    ).toMatchObject({
      visible: false,
      visibility_state: "hidden_by_module",
      outcome: "hidden_module",
      missing_linkage: [],
    });
  });

  it("projects linked records into Work, search, audit, and notifications only when visible", () => {
    expect(buildV10LinkedRecordProjection({ recordType: "decision", workspaceMode: "core" })).toMatchObject({
      visibility_state: "hidden_by_mode",
      include_in_work: false,
      include_in_command_search: false,
      include_in_audit: false,
    });
    expect(buildV10LinkedRecordProjection({ recordType: "decision", workspaceMode: "advanced" })).toMatchObject({
      visibility_state: "visible",
      include_in_work: true,
      include_in_command_search: true,
      include_in_audit: true,
      include_in_notifications: true,
    });
    expect(buildV10LinkedRecordProjection({ recordType: "finding", workspaceMode: "advanced" })).toMatchObject({
      visibility_state: "hidden_by_mode",
      include_in_work: false,
    });
    expect(buildV10LinkedRecordProjection({ recordType: "decision", workspaceMode: "advanced", plan: "core" })).toMatchObject({
      visibility_state: "hidden_by_plan",
      include_in_work: false,
      include_in_command_search: false,
      include_in_audit: false,
    });
    expect(buildV10LinkedRecordProjection({ recordType: "decision", workspaceMode: "advanced", plan: "advanced" })).toMatchObject({
      visibility_state: "visible",
      include_in_work: true,
      include_in_command_search: true,
      include_in_audit: true,
    });
    expect(buildV10LinkedRecordProjection({ recordType: "automation_run", workspaceMode: "assurance", moduleHidden: true })).toMatchObject({
      visibility_state: "hidden_by_module",
      include_in_work: false,
      include_in_notifications: false,
    });
  });

  it("summarizes Core isolation so P1/P2 continuity stays additive", () => {
    expect(validateV10CoreContinuityIsolation()).toEqual([]);
    const summary = summarizeV10CoreContinuityIsolation();

    expect(summary.coreLeakCount).toBe(0);
    expect(summary.coreHiddenRecordTypes).toHaveLength(V10_ADVANCED_ASSURANCE_LINKED_RECORDS.length);
    expect(summary.advancedVisibleRecordTypes).toEqual(
      expect.arrayContaining(["account", "counterparty", "relationship", "decision"])
    );
    expect(summary.advancedVisibleRecordTypes).not.toContain("finding");
    expect(summary.assuranceVisibleRecordTypes).toEqual(
      expect.arrayContaining(["finding", "control", "scorecard", "automation_run"])
    );
    expect(summary.missingEligibleLinkageCount).toBe(0);
  });

  it("validates lifecycle linkage for account, counterparty, relationship, decision, control, and finding records", () => {
    for (const recordType of ["account", "counterparty", "relationship", "decision"] as const) {
      expect(
        validateV10AdvancedAssuranceLifecycleLink({
          recordType,
          workspaceMode: "advanced",
          sourceContractIds: ["contract_1"],
          presentLinkage: ["work_items", "command_search_index", "notification_deliveries", "audit_events"],
          lifecycleState: "active",
          auditEventIds: ["audit_1"],
        })
      ).toEqual([]);
    }
    for (const recordType of ["control", "finding"] as const) {
      expect(
        validateV10AdvancedAssuranceLifecycleLink({
          recordType,
          workspaceMode: "assurance",
          sourceContractIds: ["contract_1"],
          presentLinkage: ["work_items", "command_search_index", "notification_deliveries", "audit_events"],
          lifecycleState: "active",
          auditEventIds: ["audit_1"],
        })
      ).toEqual([]);
    }
    expect(
      validateV10AdvancedAssuranceLifecycleLink({
        recordType: "finding",
        workspaceMode: "core",
        sourceContractIds: [],
        presentLinkage: ["work_items"],
      })
    ).toEqual(
      expect.arrayContaining([
        "workspace_mode_containment_required",
        "source_contract_required",
        "missing_linkage:command_search_index",
        "missing_linkage:notification_deliveries",
        "missing_linkage:audit_events",
        "lifecycle_state_required",
        "audit_event_required",
      ])
    );
  });
});
