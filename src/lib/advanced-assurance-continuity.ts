import type {
  V10NotificationClass,
  V10MutationOutcome,
  V10Plan,
  V10Role,
  V10SourceObjectType,
  V10VisibilityState,
  V10WorkspaceMode,
} from "./release-contract";
import {
  V10_NOTIFICATION_CLASSES,
  getV10WorkspaceModeRank,
} from "./release-contract";
import { evaluateV10Eligibility, getV10EligibleFallbackDestination } from "./governance";

export type V10ContinuityPriority = "P1" | "P2";
export type V10P2AutomationState =
  | "queued"
  | "running"
  | "approval_required"
  | "approved"
  | "rejected"
  | "succeeded"
  | "failed_retryable"
  | "failed_terminal"
  | "canceled"
  | "reverted"
  | "not_reversible"
  | "paused_by_kill_switch";

export type V10LinkedRecordContract = {
  recordType: V10SourceObjectType;
  priority: V10ContinuityPriority;
  featureFamily: string;
  workspaceModeMinimum: V10WorkspaceMode;
  requiredFields: readonly string[];
  linkage: readonly ("work_items" | "command_search_index" | "notification_deliveries" | "audit_events")[];
};

export type V10LinkedRecordContinuityEvidence = {
  record_type: V10SourceObjectType;
  workspace_mode_minimum: V10WorkspaceMode;
  visible: boolean;
  visibility_state: V10VisibilityState;
  outcome: V10MutationOutcome;
  fallback_destination: string;
  required_linkage: readonly V10LinkedRecordContract["linkage"][number][];
  present_linkage: readonly V10LinkedRecordContract["linkage"][number][];
  missing_linkage: readonly V10LinkedRecordContract["linkage"][number][];
};

export type V10LinkedRecordProjection = {
  record_type: V10SourceObjectType;
  workspace_mode: V10WorkspaceMode;
  workspace_mode_minimum: V10WorkspaceMode;
  visibility_state: V10VisibilityState;
  include_in_work: boolean;
  include_in_command_search: boolean;
  include_in_audit: boolean;
  include_in_notifications: boolean;
};

export type V10AdvancedAssuranceLifecycleLink = {
  recordType: V10SourceObjectType;
  sourceContractIds: readonly string[];
  presentLinkage: readonly V10LinkedRecordContract["linkage"][number][];
  lifecycleState?: string | null;
  auditEventIds?: readonly string[];
};

export type V10CoreContinuityIsolationSummary = {
  coreHiddenRecordTypes: readonly V10SourceObjectType[];
  advancedVisibleRecordTypes: readonly V10SourceObjectType[];
  assuranceVisibleRecordTypes: readonly V10SourceObjectType[];
  coreLeakCount: number;
  missingEligibleLinkageCount: number;
};

export type V10AdvancedAssuranceContinuitySignal = {
  recordType: V10SourceObjectType;
  workspaceModeMinimum: V10WorkspaceMode;
  auditAction: string;
  telemetryEvent: `product.v10.${string}`;
  notificationClass: V10NotificationClass | null;
};

export type V10AdvancedAssuranceNotificationBehavior =
  | "deliver"
  | "suppress_not_applicable"
  | "suppress_hidden_by_mode"
  | "suppress_hidden_by_module";

export type V10AdvancedAssuranceNotificationPolicy = {
  recordType: V10SourceObjectType;
  workspaceMode: V10WorkspaceMode;
  behavior: V10AdvancedAssuranceNotificationBehavior;
  notificationClass: V10NotificationClass | null;
  suppressionReason: string | null;
  workDestination: string;
  commandSearchDestination: string;
  auditAction: string;
  supportSafeCopy: string;
};

export type V10P2StretchBehaviorKey =
  | "predictive_scoring"
  | "custom_work_item_types"
  | "relationship_timeline_depth"
  | "additional_automation_playbooks"
  | "additional_report_families";

export type V10P2StretchBehaviorContract = {
  key: V10P2StretchBehaviorKey;
  minimumMode: V10WorkspaceMode;
  minimumPlan: V10Plan;
  controls: readonly (
    | "authorization"
    | "audit"
    | "telemetry"
    | "privacy"
    | "fixture"
    | "recoverability"
    | "explainability"
    | "rollback"
  )[];
  runtimeArtifacts: readonly string[];
};

export const V10_ADVANCED_LINKED_RECORDS: readonly V10LinkedRecordContract[] = [
  {
    recordType: "account",
    priority: "P1",
    featureFamily: "relationship_workspaces",
    workspaceModeMinimum: "advanced",
    requiredFields: [
      "account_key",
      "active_contract_count",
      "owner_user_id",
      "health_signal_json",
      "generated_work_item_ids",
      "command_search_record_id",
      "audit_event_ids",
    ],
    linkage: ["work_items", "command_search_index", "audit_events"],
  },
  {
    recordType: "counterparty",
    priority: "P1",
    featureFamily: "relationship_workspaces",
    workspaceModeMinimum: "advanced",
    requiredFields: [
      "counterparty_key",
      "active_contract_count",
      "owner_user_id",
      "health_signal_json",
      "generated_work_item_ids",
      "command_search_record_id",
      "audit_event_ids",
    ],
    linkage: ["work_items", "command_search_index", "audit_events"],
  },
  {
    recordType: "decision",
    priority: "P1",
    featureFamily: "decisions",
    workspaceModeMinimum: "advanced",
    requiredFields: [
      "record_type",
      "record_id",
      "status",
      "owner_user_id",
      "source_contract_ids",
      "generated_work_item_ids",
      "command_search_record_id",
      "audit_event_ids",
    ],
    linkage: ["work_items", "command_search_index", "notification_deliveries", "audit_events"],
  },
  {
    recordType: "campaign",
    priority: "P1",
    featureFamily: "campaigns",
    workspaceModeMinimum: "advanced",
    requiredFields: [
      "impacted_contracts",
      "generated_tasks",
      "progress",
      "rollback_state",
      "outcome",
    ],
    linkage: ["work_items", "command_search_index", "notification_deliveries", "audit_events"],
  },
  {
    recordType: "simulation",
    priority: "P1",
    featureFamily: "simulations",
    workspaceModeMinimum: "advanced",
    requiredFields: [
      "input_set",
      "assumptions",
      "output_summary",
      "promotion_path",
      "command_search_record_id",
      "audit_event_ids",
    ],
    linkage: ["work_items", "command_search_index", "audit_events"],
  },
  {
    recordType: "relationship",
    priority: "P1",
    featureFamily: "relationship_workspaces",
    workspaceModeMinimum: "advanced",
    requiredFields: [
      "active_contract_count",
      "next_renewal_or_notice_deadline",
      "overdue_work_count",
      "open_exception_count",
      "outstanding_evidence_count",
      "pending_approval_count",
      "data_quality_gap_count",
      "relationship_owner_state",
    ],
    linkage: ["work_items", "command_search_index", "audit_events"],
  },
] as const;

export const V10_ASSURANCE_LINKED_RECORDS: readonly V10LinkedRecordContract[] = [
  {
    recordType: "finding",
    priority: "P1",
    featureFamily: "findings",
    workspaceModeMinimum: "assurance",
    requiredFields: [
      "source_contract_ids",
      "linked_exception_ids",
      "linked_evidence_request_ids",
      "linked_control_ids",
      "generated_work_item_ids",
      "audit_event_ids",
    ],
    linkage: ["work_items", "command_search_index", "notification_deliveries", "audit_events"],
  },
  {
    recordType: "control",
    priority: "P1",
    featureFamily: "control_policies",
    workspaceModeMinimum: "assurance",
    requiredFields: [
      "policy_status",
      "generated_evidence_requirement_ids",
      "generated_review_work_item_ids",
      "audit_event_ids",
    ],
    linkage: ["work_items", "command_search_index", "notification_deliveries", "audit_events"],
  },
  {
    recordType: "scorecard",
    priority: "P1",
    featureFamily: "scorecards",
    workspaceModeMinimum: "assurance",
    requiredFields: [
      "underlying_contract_ids",
      "underlying_finding_ids",
      "underlying_control_ids",
      "generated_work_item_ids",
      "audit_event_ids",
    ],
    linkage: ["work_items", "command_search_index", "audit_events"],
  },
  {
    recordType: "playbook",
    priority: "P1",
    featureFamily: "playbooks",
    workspaceModeMinimum: "assurance",
    requiredFields: [
      "approval_gate_state",
      "execution_state",
      "generated_work_item_ids",
      "revert_action",
      "audit_event_ids",
    ],
    linkage: ["work_items", "command_search_index", "notification_deliveries", "audit_events"],
  },
  {
    recordType: "review_board",
    priority: "P1",
    featureFamily: "review_boards",
    workspaceModeMinimum: "assurance",
    requiredFields: [
      "pending_decision_ids",
      "resulting_work_item_ids",
      "source_contract_ids",
      "audit_event_ids",
    ],
    linkage: ["work_items", "command_search_index", "audit_events"],
  },
  {
    recordType: "health_graph",
    priority: "P1",
    featureFamily: "health_graph",
    workspaceModeMinimum: "assurance",
    requiredFields: [
      "underlying_contract_ids",
      "underlying_finding_ids",
      "underlying_control_ids",
      "underlying_work_item_ids",
      "audit_event_ids",
    ],
    linkage: ["work_items", "command_search_index", "audit_events"],
  },
  {
    recordType: "automation_run",
    priority: "P2",
    featureFamily: "playbooks",
    workspaceModeMinimum: "assurance",
    requiredFields: [
      "approval_state",
      "execution_state",
      "result_state",
      "revert_action",
      "not_reversible_warning",
      "audit_event_ids",
    ],
    linkage: ["work_items", "command_search_index", "notification_deliveries", "audit_events"],
  },
] as const;

export const V10_ADVANCED_ASSURANCE_LINKED_RECORDS = [
  ...V10_ADVANCED_LINKED_RECORDS,
  ...V10_ASSURANCE_LINKED_RECORDS,
] as const;

function getV10AdvancedAssuranceNotificationClass(record: V10LinkedRecordContract): V10NotificationClass | null {
  if (!record.linkage.includes("notification_deliveries")) return null;
  if (record.recordType === "automation_run" || record.recordType === "playbook") return "automation_approval_required";
  if (record.recordType === "decision" || record.recordType === "review_board") return "pending_approval";
  if (record.recordType === "control") return "evidence_request";
  if (record.recordType === "campaign") return "due_work";
  return "review_backlog";
}

export const V10_ADVANCED_ASSURANCE_CONTINUITY_SIGNALS: readonly V10AdvancedAssuranceContinuitySignal[] =
  V10_ADVANCED_ASSURANCE_LINKED_RECORDS.map((record) => ({
    recordType: record.recordType,
    workspaceModeMinimum: record.workspaceModeMinimum,
    auditAction: `${record.recordType}.linked`,
    telemetryEvent: `product.v10.${record.recordType}_continuity_visible`,
    notificationClass: getV10AdvancedAssuranceNotificationClass(record),
  }));

export function validateV10AdvancedAssuranceContinuitySignals(
  signals: readonly V10AdvancedAssuranceContinuitySignal[] = V10_ADVANCED_ASSURANCE_CONTINUITY_SIGNALS
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  const contractsByType = new Map(V10_ADVANCED_ASSURANCE_LINKED_RECORDS.map((record) => [record.recordType, record]));
  for (const signal of signals) {
    if (seen.has(signal.recordType)) failures.push(`duplicate_signal:${signal.recordType}`);
    seen.add(signal.recordType);
    const contract = contractsByType.get(signal.recordType);
    if (!contract) {
      failures.push(`unknown_signal_record:${signal.recordType}`);
      continue;
    }
    if (signal.workspaceModeMinimum !== contract.workspaceModeMinimum) {
      failures.push(`${signal.recordType}:signal_mode_mismatch`);
    }
    if (!signal.auditAction.includes(".")) failures.push(`${signal.recordType}:audit_action_required`);
    if (!signal.telemetryEvent.startsWith("product.v10.")) failures.push(`${signal.recordType}:telemetry_event_required`);
    if (contract.linkage.includes("notification_deliveries") && !signal.notificationClass) {
      failures.push(`${signal.recordType}:notification_class_required`);
    }
    if (signal.notificationClass && !(V10_NOTIFICATION_CLASSES as readonly string[]).includes(signal.notificationClass)) {
      failures.push(`${signal.recordType}:notification_class_unknown`);
    }
  }
  for (const contract of V10_ADVANCED_ASSURANCE_LINKED_RECORDS) {
    if (!seen.has(contract.recordType)) failures.push(`missing_signal:${contract.recordType}`);
  }
  return failures;
}

export function buildV10AdvancedAssuranceNotificationPolicy(input: {
  recordType: V10SourceObjectType;
  workspaceMode: V10WorkspaceMode;
  moduleHidden?: boolean;
}): V10AdvancedAssuranceNotificationPolicy {
  const contract = getV10AdvancedAssuranceLinkedRecordContract(input.recordType);
  const projection = buildV10LinkedRecordProjection({
    recordType: input.recordType,
    workspaceMode: input.workspaceMode,
    moduleHidden: input.moduleHidden,
  });
  const signal = V10_ADVANCED_ASSURANCE_CONTINUITY_SIGNALS.find((row) => row.recordType === input.recordType);
  const auditAction = signal?.auditAction ?? `${input.recordType}.hidden`;
  const workDestination = projection.include_in_work ? `/work?type=${input.recordType}` : "/settings/product";
  const commandSearchDestination = projection.include_in_command_search ? `cmdk:${input.recordType}` : "/settings/product";
  if (projection.visibility_state === "hidden_by_mode") {
    return {
      recordType: input.recordType,
      workspaceMode: input.workspaceMode,
      behavior: "suppress_hidden_by_mode",
      notificationClass: null,
      suppressionReason: `requires_${contract?.workspaceModeMinimum ?? "assurance"}_mode`,
      workDestination,
      commandSearchDestination,
      auditAction,
      supportSafeCopy: "This continuity record is hidden until the workspace mode includes it.",
    };
  }
  if (projection.visibility_state === "hidden_by_module") {
    return {
      recordType: input.recordType,
      workspaceMode: input.workspaceMode,
      behavior: "suppress_hidden_by_module",
      notificationClass: null,
      suppressionReason: "module_hidden_by_workspace_configuration",
      workDestination,
      commandSearchDestination,
      auditAction,
      supportSafeCopy: "This continuity record is hidden by workspace configuration.",
    };
  }
  if (projection.include_in_notifications && signal?.notificationClass) {
    return {
      recordType: input.recordType,
      workspaceMode: input.workspaceMode,
      behavior: "deliver",
      notificationClass: signal.notificationClass,
      suppressionReason: null,
      workDestination,
      commandSearchDestination,
      auditAction,
      supportSafeCopy: "This continuity record can deliver its V10 notification class.",
    };
  }
  return {
    recordType: input.recordType,
    workspaceMode: input.workspaceMode,
    behavior: "suppress_not_applicable",
    notificationClass: null,
    suppressionReason: "continuity_visible_without_notification_requirement",
    workDestination,
    commandSearchDestination,
    auditAction,
    supportSafeCopy: "This continuity record is visible in Work, search, and audit without sending a notification.",
  };
}

export function buildV10AdvancedAssuranceNotificationPolicies(input: {
  workspaceMode: V10WorkspaceMode;
  moduleHiddenRecordTypes?: readonly V10SourceObjectType[];
}): V10AdvancedAssuranceNotificationPolicy[] {
  const hidden = new Set(input.moduleHiddenRecordTypes ?? []);
  return V10_ADVANCED_ASSURANCE_LINKED_RECORDS.map((record) =>
    buildV10AdvancedAssuranceNotificationPolicy({
      recordType: record.recordType,
      workspaceMode: input.workspaceMode,
      moduleHidden: hidden.has(record.recordType),
    })
  );
}

export function validateV10AdvancedAssuranceNotificationPolicies(
  policies: readonly V10AdvancedAssuranceNotificationPolicy[]
): string[] {
  const failures: string[] = [];
  const seen = new Set<V10SourceObjectType>();
  for (const policy of policies) {
    if (seen.has(policy.recordType)) failures.push(`duplicate_notification_policy:${policy.recordType}`);
    seen.add(policy.recordType);
    if (!getV10AdvancedAssuranceLinkedRecordContract(policy.recordType)) failures.push(`${policy.recordType}:contract_required`);
    if (policy.behavior === "deliver" && !policy.notificationClass) failures.push(`${policy.recordType}:notification_class_required`);
    if (policy.behavior !== "deliver" && !policy.suppressionReason?.trim()) {
      failures.push(`${policy.recordType}:suppression_reason_required`);
    }
    if (!policy.workDestination.trim()) failures.push(`${policy.recordType}:work_destination_required`);
    if (!policy.commandSearchDestination.trim()) failures.push(`${policy.recordType}:command_search_destination_required`);
    if (!policy.auditAction.includes(".")) failures.push(`${policy.recordType}:audit_action_required`);
    if (!policy.supportSafeCopy || /raw|token|secret|customer payload/i.test(policy.supportSafeCopy)) {
      failures.push(`${policy.recordType}:support_safe_copy_required`);
    }
  }
  for (const record of V10_ADVANCED_ASSURANCE_LINKED_RECORDS) {
    if (!seen.has(record.recordType)) failures.push(`notification_policy_missing:${record.recordType}`);
  }
  return failures;
}

export const V10_P2_STRETCH_BEHAVIOR_CONTRACTS: readonly V10P2StretchBehaviorContract[] = [
  {
    key: "predictive_scoring",
    minimumMode: "assurance",
    minimumPlan: "assurance",
    controls: ["authorization", "audit", "telemetry", "privacy", "fixture", "recoverability", "explainability", "rollback"],
    runtimeArtifacts: ["src/lib/objective-measurements.ts", "src/lib/hardening-contracts.ts"],
  },
  {
    key: "custom_work_item_types",
    minimumMode: "advanced",
    minimumPlan: "advanced",
    controls: ["authorization", "audit", "telemetry", "privacy", "fixture", "recoverability", "rollback"],
    runtimeArtifacts: ["src/lib/work-semantics.ts", "src/lib/read-model-refresh.ts"],
  },
  {
    key: "relationship_timeline_depth",
    minimumMode: "advanced",
    minimumPlan: "advanced",
    controls: ["authorization", "audit", "telemetry", "privacy", "fixture", "recoverability"],
    runtimeArtifacts: ["src/lib/domain-depth-contracts.ts", "src/lib/read-model-refresh.ts"],
  },
  {
    key: "additional_automation_playbooks",
    minimumMode: "assurance",
    minimumPlan: "assurance",
    controls: ["authorization", "audit", "telemetry", "privacy", "fixture", "recoverability", "rollback"],
    runtimeArtifacts: ["src/lib/mutation-rollout.ts", "src/lib/hardening-contracts.ts"],
  },
  {
    key: "additional_report_families",
    minimumMode: "advanced",
    minimumPlan: "advanced",
    controls: ["authorization", "audit", "telemetry", "privacy", "fixture", "recoverability"],
    runtimeArtifacts: ["src/lib/report-export.ts", "src/lib/release-evidence.ts"],
  },
] as const;

export function validateV10P2StretchBehaviorContracts(
  contracts: readonly V10P2StretchBehaviorContract[] = V10_P2_STRETCH_BEHAVIOR_CONTRACTS
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const contract of contracts) {
    if (seen.has(contract.key)) failures.push(`duplicate_p2_stretch:${contract.key}`);
    seen.add(contract.key);
    if (contract.minimumMode === "core") failures.push(`${contract.key}:p2_requires_advanced_or_assurance_mode`);
    if (contract.minimumPlan === "trial" || contract.minimumPlan === "core") failures.push(`${contract.key}:p2_requires_paid_advanced_plan`);
    for (const requiredControl of ["authorization", "audit", "telemetry", "privacy", "fixture", "recoverability"] as const) {
      if (!contract.controls.includes(requiredControl)) failures.push(`${contract.key}:control_required:${requiredControl}`);
    }
    if (contract.key === "predictive_scoring" && !contract.controls.includes("explainability")) {
      failures.push("predictive_scoring:explainability_required");
    }
    if ((contract.key === "custom_work_item_types" || contract.key === "additional_automation_playbooks") && !contract.controls.includes("rollback")) {
      failures.push(`${contract.key}:rollback_required`);
    }
    if (contract.runtimeArtifacts.length === 0) failures.push(`${contract.key}:runtime_artifact_required`);
  }
  for (const key of [
    "predictive_scoring",
    "custom_work_item_types",
    "relationship_timeline_depth",
    "additional_automation_playbooks",
    "additional_report_families",
  ] as const) {
    if (!seen.has(key)) failures.push(`missing_p2_stretch:${key}`);
  }
  return failures;
}

export function v10LinkedRecordIsVisibleInMode(
  record: V10LinkedRecordContract,
  workspaceMode: V10WorkspaceMode
): boolean {
  return getV10WorkspaceModeRank(workspaceMode) >= getV10WorkspaceModeRank(record.workspaceModeMinimum);
}

export function v10LinkedRecordRequiresContainment(
  record: V10LinkedRecordContract,
  workspaceMode: V10WorkspaceMode
): boolean {
  return !v10LinkedRecordIsVisibleInMode(record, workspaceMode);
}

export function getV10P2AutomationApprovalContract(): V10LinkedRecordContract {
  return V10_ASSURANCE_LINKED_RECORDS.find((record) => record.recordType === "automation_run")!;
}

export function getV10AdvancedAssuranceLinkedRecordContract(recordType: V10SourceObjectType): V10LinkedRecordContract | null {
  return V10_ADVANCED_ASSURANCE_LINKED_RECORDS.find((record) => record.recordType === recordType) ?? null;
}

export function buildV10LinkedRecordContinuityEvidence(input: {
  recordType: V10SourceObjectType;
  workspaceMode: V10WorkspaceMode;
  role: V10Role;
  plan: V10Plan;
  moduleHidden?: boolean;
  sameOrganization?: boolean;
  presentLinkage?: readonly V10LinkedRecordContract["linkage"][number][];
}): V10LinkedRecordContinuityEvidence {
  const contract = getV10AdvancedAssuranceLinkedRecordContract(input.recordType);
  if (!contract) {
    return {
      record_type: input.recordType,
      workspace_mode_minimum: "assurance",
      visible: false,
      visibility_state: "hidden_by_module",
      outcome: "hidden_module",
      fallback_destination: "/settings/product",
      required_linkage: [],
      present_linkage: input.presentLinkage ?? [],
      missing_linkage: [],
    };
  }
  const requiredPlan: V10Plan = contract.workspaceModeMinimum === "assurance" ? "assurance" : "advanced";
  const eligibility = evaluateV10Eligibility({
    workspaceMode: input.workspaceMode,
    requiredMode: contract.workspaceModeMinimum,
    role: input.role,
    requiredRole: "viewer",
    plan: input.plan,
    requiredPlan,
    moduleHidden: input.moduleHidden,
    sameOrganization: input.sameOrganization,
  });
  const present = input.presentLinkage ?? [];
  const missing = contract.linkage.filter((linkage) => !present.includes(linkage));
  return {
    record_type: contract.recordType,
    workspace_mode_minimum: contract.workspaceModeMinimum,
    visible: eligibility.allowed,
    visibility_state: eligibility.visibilityState,
    outcome: eligibility.outcome,
    fallback_destination: getV10EligibleFallbackDestination(eligibility),
    required_linkage: contract.linkage,
    present_linkage: present,
    missing_linkage: missing,
  };
}

export function buildV10LinkedRecordProjection(input: {
  recordType: V10SourceObjectType;
  workspaceMode: V10WorkspaceMode;
  role?: V10Role;
  plan?: V10Plan;
  sameOrganization?: boolean;
  moduleHidden?: boolean;
}): V10LinkedRecordProjection {
  const contract = getV10AdvancedAssuranceLinkedRecordContract(input.recordType);
  const workspaceModeMinimum = contract?.workspaceModeMinimum ?? "assurance";
  const requiredPlan: V10Plan = workspaceModeMinimum === "assurance" ? "assurance" : "advanced";
  const eligibility = contract
    ? evaluateV10Eligibility({
        workspaceMode: input.workspaceMode,
        requiredMode: workspaceModeMinimum,
        role: input.role ?? "viewer",
        requiredRole: "viewer",
        plan: input.plan ?? "enterprise",
        requiredPlan,
        sameOrganization: input.sameOrganization,
        moduleHidden: input.moduleHidden,
      })
    : null;
  const visible = Boolean(eligibility?.allowed);
  const visibilityState: V10VisibilityState = eligibility?.visibilityState ?? "hidden_by_module";
  const linkage = new Set(contract?.linkage ?? []);
  return {
    record_type: input.recordType,
    workspace_mode: input.workspaceMode,
    workspace_mode_minimum: workspaceModeMinimum,
    visibility_state: visibilityState,
    include_in_work: visible && linkage.has("work_items"),
    include_in_command_search: visible && linkage.has("command_search_index"),
    include_in_audit: visible && linkage.has("audit_events"),
    include_in_notifications: visible && linkage.has("notification_deliveries"),
  };
}

export function summarizeV10CoreContinuityIsolation(
  records: readonly V10LinkedRecordContract[] = V10_ADVANCED_ASSURANCE_LINKED_RECORDS
): V10CoreContinuityIsolationSummary {
  const coreProjections = records.map((record) =>
    buildV10LinkedRecordProjection({ recordType: record.recordType, workspaceMode: "core" })
  );
  const advancedProjections = records.map((record) =>
    buildV10LinkedRecordProjection({ recordType: record.recordType, workspaceMode: "advanced" })
  );
  const assuranceProjections = records.map((record) =>
    buildV10LinkedRecordProjection({ recordType: record.recordType, workspaceMode: "assurance" })
  );
  const eligibleProjections = [...advancedProjections, ...assuranceProjections].filter(
    (projection) => projection.visibility_state === "visible"
  );
  return {
    coreHiddenRecordTypes: coreProjections
      .filter((projection) => projection.visibility_state !== "visible")
      .map((projection) => projection.record_type),
    advancedVisibleRecordTypes: advancedProjections
      .filter((projection) => projection.visibility_state === "visible")
      .map((projection) => projection.record_type),
    assuranceVisibleRecordTypes: assuranceProjections
      .filter((projection) => projection.visibility_state === "visible")
      .map((projection) => projection.record_type),
    coreLeakCount: coreProjections.filter(
      (projection) =>
        projection.visibility_state === "visible" ||
        projection.include_in_work ||
        projection.include_in_command_search ||
        projection.include_in_notifications
    ).length,
    missingEligibleLinkageCount: eligibleProjections.filter(
      (projection) => !projection.include_in_command_search || !projection.include_in_audit
    ).length,
  };
}

export function validateV10CoreContinuityIsolation(
  records: readonly V10LinkedRecordContract[] = V10_ADVANCED_ASSURANCE_LINKED_RECORDS
): string[] {
  const failures: string[] = [];
  const summary = summarizeV10CoreContinuityIsolation(records);
  if (summary.coreLeakCount > 0) failures.push("core_visibility_leak");
  if (summary.coreHiddenRecordTypes.length !== records.length) failures.push("core_hidden_record_count_mismatch");
  if (!summary.advancedVisibleRecordTypes.includes("account")) failures.push("advanced_account_continuity_missing");
  if (!summary.advancedVisibleRecordTypes.includes("relationship")) failures.push("advanced_relationship_continuity_missing");
  if (!summary.assuranceVisibleRecordTypes.includes("finding")) failures.push("assurance_finding_continuity_missing");
  if (!summary.assuranceVisibleRecordTypes.includes("automation_run")) failures.push("p2_automation_continuity_missing");
  if (summary.missingEligibleLinkageCount > 0) failures.push("eligible_linkage_missing");
  return failures;
}

export function validateV10P2AutomationRunState(input: {
  state: V10P2AutomationState;
  approvalId?: string | null;
  revertAction?: string | null;
  notReversibleWarning?: string | null;
  auditEventIds?: readonly string[];
  killSwitchActive?: boolean;
}): string[] {
  const failures: string[] = [];
  if (["approval_required", "approved", "rejected", "running", "succeeded"].includes(input.state) && !input.approvalId) {
    failures.push("approval_id_required");
  }
  if (["succeeded", "failed_retryable", "failed_terminal", "canceled", "reverted"].includes(input.state)) {
    if ((input.auditEventIds?.length ?? 0) === 0) failures.push("audit_event_required");
  }
  if (input.state === "succeeded" && !input.revertAction) failures.push("revert_action_required");
  if (input.state === "not_reversible" && !input.notReversibleWarning) {
    failures.push("not_reversible_warning_required");
  }
  if (input.state === "paused_by_kill_switch" && !input.killSwitchActive) {
    failures.push("kill_switch_state_required");
  }
  return failures;
}

export function validateV10AdvancedAssuranceLifecycleLink(input: V10AdvancedAssuranceLifecycleLink & {
  workspaceMode: V10WorkspaceMode;
}): string[] {
  const failures: string[] = [];
  const contract = getV10AdvancedAssuranceLinkedRecordContract(input.recordType);
  if (!contract) return ["linked_record_contract_required"];
  if (!v10LinkedRecordIsVisibleInMode(contract, input.workspaceMode)) failures.push("workspace_mode_containment_required");
  if (input.sourceContractIds.length === 0) failures.push("source_contract_required");
  for (const linkage of contract.linkage) {
    if (!input.presentLinkage.includes(linkage)) failures.push(`missing_linkage:${linkage}`);
  }
  if (!input.lifecycleState?.trim()) failures.push("lifecycle_state_required");
  if ((input.auditEventIds?.length ?? 0) === 0) failures.push("audit_event_required");
  return failures;
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { buildV10AdvancedAssuranceNotificationPolicies as buildAdvancedAssuranceNotificationPolicies };
export { buildV10AdvancedAssuranceNotificationPolicy as buildAdvancedAssuranceNotificationPolicy };
export { buildV10LinkedRecordContinuityEvidence as buildLinkedRecordContinuityEvidence };
export { buildV10LinkedRecordProjection as buildLinkedRecordProjection };
export { getV10AdvancedAssuranceLinkedRecordContract as getAdvancedAssuranceLinkedRecordContract };
export { getV10P2AutomationApprovalContract as getP2AutomationApprovalContract };
export { summarizeV10CoreContinuityIsolation as summarizeCoreContinuityIsolation };
export { V10_ADVANCED_ASSURANCE_CONTINUITY_SIGNALS as ADVANCED_ASSURANCE_CONTINUITY_SIGNALS };
export { V10_ADVANCED_ASSURANCE_LINKED_RECORDS as ADVANCED_ASSURANCE_LINKED_RECORDS };
export { V10_ADVANCED_LINKED_RECORDS as ADVANCED_LINKED_RECORDS };
export { V10_ASSURANCE_LINKED_RECORDS as ASSURANCE_LINKED_RECORDS };
export { V10_P2_STRETCH_BEHAVIOR_CONTRACTS as P2_STRETCH_BEHAVIOR_CONTRACTS };
export { v10LinkedRecordIsVisibleInMode as linkedRecordIsVisibleInMode };
export { v10LinkedRecordRequiresContainment as linkedRecordRequiresContainment };
export { validateV10AdvancedAssuranceContinuitySignals as validateAdvancedAssuranceContinuitySignals };
export { validateV10AdvancedAssuranceLifecycleLink as validateAdvancedAssuranceLifecycleLink };
export { validateV10AdvancedAssuranceNotificationPolicies as validateAdvancedAssuranceNotificationPolicies };
export { validateV10CoreContinuityIsolation as validateCoreContinuityIsolation };
export { validateV10P2AutomationRunState as validateP2AutomationRunState };
export { validateV10P2StretchBehaviorContracts as validateP2StretchBehaviorContracts };
export type { V10AdvancedAssuranceContinuitySignal as AdvancedAssuranceContinuitySignal };
export type { V10AdvancedAssuranceLifecycleLink as AdvancedAssuranceLifecycleLink };
export type { V10AdvancedAssuranceNotificationBehavior as AdvancedAssuranceNotificationBehavior };
export type { V10AdvancedAssuranceNotificationPolicy as AdvancedAssuranceNotificationPolicy };
export type { V10ContinuityPriority as ContinuityPriority };
export type { V10CoreContinuityIsolationSummary as CoreContinuityIsolationSummary };
export type { V10LinkedRecordContinuityEvidence as LinkedRecordContinuityEvidence };
export type { V10LinkedRecordContract as LinkedRecordContract };
export type { V10LinkedRecordProjection as LinkedRecordProjection };
export type { V10P2AutomationState as P2AutomationState };
export type { V10P2StretchBehaviorContract as P2StretchBehaviorContract };
export type { V10P2StretchBehaviorKey as P2StretchBehaviorKey };
// End version-name compatibility aliases.
