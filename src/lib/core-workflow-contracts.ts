import type { V10RecoverableUiState } from "./ui-state-contracts";
import type { V10ReadModelRefreshScope } from "./read-model-refresh";
import { V10_REQUIRED_READ_MODEL_KEYS } from "./read-models";
import { V10_SOURCE_OBJECT_TYPES } from "./release-contract";

export type V10CoreWorkflowId =
  | "activation"
  | "home_daily_brief"
  | "unified_work"
  | "contract_record"
  | "field_review_data_quality"
  | "renewal_prevention";

export type V10CoreWorkflowContract = {
  id: V10CoreWorkflowId;
  priority: "P0";
  route: string;
  sourceTables: readonly string[];
  readModels: readonly string[];
  requiredActions: readonly string[];
  recoveryStates: readonly V10RecoverableUiState[];
  refreshScopes: readonly V10ReadModelRefreshScope[];
  telemetryEvents: readonly string[];
  objectiveSignal: string;
  autonomousProofs: readonly string[];
};

export type V10EndToEndDomainWorkflowId =
  | "activation"
  | "review"
  | "renewal"
  | "obligation"
  | "evidence"
  | "approval"
  | "exception"
  | "report"
  | "export"
  | "job"
  | "notification"
  | "settings"
  | "relationship"
  | "advanced"
  | "assurance"
  | "shipped_p2";

export type V10EndToEndDomainWorkflowContract = {
  id: V10EndToEndDomainWorkflowId;
  routeOrAction: string;
  sourceObjects: readonly string[];
  readModels: readonly string[];
  mutationOrActionNames: readonly string[];
  visibleStates: readonly string[];
  recoveryDestination: string;
  requiredProofs: readonly string[];
};

export type V10CoreSurfaceParitySurface = "home" | "work" | "contract_list" | "contract_detail" | "command_palette" | "nav";
export type V10CoreSurfaceParityMetric =
  | "due_today"
  | "overdue"
  | "blocked"
  | "high_risk"
  | "failed_jobs"
  | "missing_owner"
  | "hidden_filtered";

export type V10CoreSurfaceParitySnapshot = {
  surface: V10CoreSurfaceParitySurface;
  counts: Partial<Record<V10CoreSurfaceParityMetric, number>>;
  proofArtifact: string;
};

export const V10_CORE_WORKFLOW_CONTRACTS: readonly V10CoreWorkflowContract[] = [
  {
    id: "activation",
    priority: "P0",
    route: "/dashboard",
    sourceTables: ["contracts", "contract_import_jobs", "extracted_fields"],
    readModels: ["activation_state", "work_items", "field_provenance_records", "command_search_index"],
    requiredActions: ["open_first_work_item", "complete_activation", "retry_failed_job"],
    recoveryStates: ["empty", "partial", "failed"],
    refreshScopes: ["full", "repair"],
    telemetryEvents: ["product.v10.activation_completed", "product.v10.first_work_item_generated"],
    objectiveSignal: "activation_first_work_item",
    autonomousProofs: [
      "src/lib/activation-state.ts",
      "src/lib/read-model-refresh.test.ts",
      "src/app/(dashboard)/dashboard/page.tsx",
    ],
  },
  {
    id: "home_daily_brief",
    priority: "P0",
    route: "/dashboard",
    sourceTables: ["v10_work_items", "v10_contract_health_snapshots", "v10_renewal_posture_snapshots"],
    readModels: ["work_items", "contract_health_snapshots", "renewal_posture_snapshots", "job_run_visibility"],
    requiredActions: ["open_source_object", "assign_owner", "retry_failed_job"],
    recoveryStates: ["empty", "partial", "failed", "no_action_available"],
    refreshScopes: ["full", "incremental", "repair"],
    telemetryEvents: ["product.v10.empty_state_cta_clicked", "product.v10.failed_job_retry_succeeded"],
    objectiveSignal: "daily_action_clearance",
    autonomousProofs: [
      "src/app/(dashboard)/dashboard/page.tsx",
      "src/components/ui/recoverable-state.tsx",
      "src/lib/ui-state-contracts.ts",
    ],
  },
  {
    id: "unified_work",
    priority: "P0",
    route: "/work",
    sourceTables: ["v10_work_items"],
    readModels: ["work_items", "command_search_index", "job_run_visibility"],
    requiredActions: ["mark_done", "approve_approval", "resolve_exception", "accept_evidence", "retry_failed_job"],
    recoveryStates: ["empty", "partial", "failed", "no_action_available"],
    refreshScopes: ["full", "incremental", "repair"],
    telemetryEvents: ["product.v10.work_item_completed"],
    objectiveSignal: "daily_action_clearance",
    autonomousProofs: ["src/app/(dashboard)/work/page.tsx", "src/lib/work-semantics.ts"],
  },
  {
    id: "contract_record",
    priority: "P0",
    route: "/contracts/[id]",
    sourceTables: ["contracts", "v10_contract_health_snapshots", "v10_contract_activity_events"],
    readModels: ["contract_health_snapshots", "contract_activity_events", "field_provenance_records", "renewal_posture_snapshots"],
    requiredActions: ["open_source_object", "assign_owner", "review_field", "complete_renewal_checkpoint"],
    recoveryStates: ["partial", "failed", "archived", "deleted"],
    refreshScopes: ["full", "incremental", "repair"],
    telemetryEvents: ["product.v10.contract_record_opened"],
    objectiveSignal: "contract_record_trust",
    autonomousProofs: ["src/app/(dashboard)/contracts/[id]/page.tsx", "src/lib/contract-health.ts"],
  },
  {
    id: "field_review_data_quality",
    priority: "P0",
    route: "/contracts/[id]",
    sourceTables: ["extracted_fields", "contract_tasks"],
    readModels: ["field_provenance_records", "work_items", "contract_health_snapshots"],
    requiredActions: ["approve_high_confidence", "request_clarification", "supply_missing_value", "save_and_next"],
    recoveryStates: ["empty", "partial", "failed"],
    refreshScopes: ["full", "incremental", "repair"],
    telemetryEvents: ["product.v10.field_review_completed"],
    objectiveSignal: "activation_first_work_item",
    autonomousProofs: ["src/lib/field-provenance.ts", "src/actions/policy-operations.ts"],
  },
  {
    id: "renewal_prevention",
    priority: "P0",
    route: "/contracts/[id]",
    sourceTables: ["contract_renewal_checkpoints", "v10_renewal_posture_snapshots"],
    readModels: ["renewal_posture_snapshots", "renewal_checkpoint_records", "work_items", "notification_deliveries"],
    requiredActions: ["complete_renewal_checkpoint", "generate_decision_packet", "schedule_reminder"],
    recoveryStates: ["empty", "partial", "failed", "no_action_available"],
    refreshScopes: ["full", "incremental", "repair"],
    telemetryEvents: ["product.v10.renewal_posture_computed", "product.v10.renewal_decision_packet_generated"],
    objectiveSignal: "renewal_prevention",
    autonomousProofs: ["src/lib/renewal-posture.ts", "src/app/api/renewals/[id]/[action]/route.ts"],
  },
] as const;

export const V10_END_TO_END_DOMAIN_WORKFLOW_CONTRACTS: readonly V10EndToEndDomainWorkflowContract[] = [
  {
    id: "activation",
    routeOrAction: "/dashboard",
    sourceObjects: ["contract", "import_job", "field"],
    readModels: ["activation_state", "work_items", "field_provenance_records"],
    mutationOrActionNames: ["create_contract_import", "retry_failed_job"],
    visibleStates: ["empty", "partial", "failed", "success"],
    recoveryDestination: "/work",
    requiredProofs: ["src/lib/activation-state.ts", "src/app/(dashboard)/dashboard/page.tsx"],
  },
  {
    id: "review",
    routeOrAction: "src/actions/policy-operations.ts",
    sourceObjects: ["field", "contract", "work_item"],
    readModels: ["field_provenance_records", "work_items", "contract_health_snapshots"],
    mutationOrActionNames: ["edit_and_approve_field", "approve_high_confidence", "request_clarification"],
    visibleStates: ["partial", "failed", "stale_version", "success"],
    recoveryDestination: "/contracts/[id]",
    requiredProofs: ["src/lib/field-provenance.ts", "src/actions/policy-operations.ts"],
  },
  {
    id: "renewal",
    routeOrAction: "/api/renewals/[id]/[action]",
    sourceObjects: ["renewal_checkpoint", "notification_delivery", "contract"],
    readModels: ["renewal_posture_snapshots", "renewal_checkpoint_records", "work_items"],
    mutationOrActionNames: ["change_renewal_posture", "generate_renewal_decision_packet", "record_renewal_recommendation"],
    visibleStates: ["empty", "partial", "failed", "success"],
    recoveryDestination: "/contracts/[id]",
    requiredProofs: ["src/lib/renewal-posture.ts", "src/app/api/renewals/[id]/[action]/route.ts"],
  },
  {
    id: "obligation",
    routeOrAction: "src/actions/obligations.ts",
    sourceObjects: ["obligation", "work_item", "contract"],
    readModels: ["obligation_records", "work_items", "contract_health_snapshots"],
    mutationOrActionNames: ["mark_done", "assign_work_item_owner"],
    visibleStates: ["empty", "partial", "failed", "success"],
    recoveryDestination: "/work?type=obligation",
    requiredProofs: ["src/actions/obligations.ts", "src/lib/read-model-refresh.ts"],
  },
  {
    id: "evidence",
    routeOrAction: "/api/evidence/[id]/[action]",
    sourceObjects: ["evidence_request", "external_evidence_submission", "work_item"],
    readModels: ["evidence_request_statuses", "external_evidence_submissions", "work_items"],
    mutationOrActionNames: ["create_evidence_request", "accept_evidence", "reject_evidence", "submit_external_evidence"],
    visibleStates: ["empty", "partial", "failed", "external_link_expired", "external_link_revoked", "success"],
    recoveryDestination: "/work?type=evidence",
    requiredProofs: ["src/lib/evidence-collaboration.ts", "src/app/api/evidence/[id]/[action]/route.ts"],
  },
  {
    id: "approval",
    routeOrAction: "/api/approvals/[id]/[action]",
    sourceObjects: ["approval", "work_item", "audit_event"],
    readModels: ["approval_records", "work_items", "command_search_index"],
    mutationOrActionNames: ["approve_approval_request", "reject_approval_request", "delegate_approval_request"],
    visibleStates: ["empty", "partial", "failed", "success"],
    recoveryDestination: "/work?type=approval",
    requiredProofs: ["src/lib/approval-exception.ts", "src/app/api/approvals/[id]/[action]/route.ts"],
  },
  {
    id: "exception",
    routeOrAction: "/api/exceptions/[id]/[action]",
    sourceObjects: ["exception", "work_item", "audit_event"],
    readModels: ["exception_records", "work_items", "command_search_index"],
    mutationOrActionNames: ["assign_exception_owner", "resolve_exception", "reopen_exception"],
    visibleStates: ["empty", "partial", "failed", "success"],
    recoveryDestination: "/work?type=exception",
    requiredProofs: ["src/lib/approval-exception.ts", "src/app/api/exceptions/[id]/[action]/route.ts"],
  },
  {
    id: "report",
    routeOrAction: "/api/report-packs",
    sourceObjects: ["report_run", "runtime_artifact", "audit_event"],
    readModels: ["report_run_visibility", "job_run_visibility", "command_search_index"],
    mutationOrActionNames: ["create_report_run", "cancel_job", "retry_failed_job"],
    visibleStates: ["queued", "running", "partial", "failed_retryable", "failed_terminal", "success"],
    recoveryDestination: "/settings/health#v10-jobs",
    requiredProofs: ["src/lib/report-export.ts", "src/app/api/report-packs/route.ts"],
  },
  {
    id: "export",
    routeOrAction: "/api/export/contracts",
    sourceObjects: ["export_job", "runtime_artifact", "audit_event"],
    readModels: ["job_run_visibility", "report_run_visibility", "command_search_index"],
    mutationOrActionNames: ["create_export_job", "cancel_job", "retry_failed_job"],
    visibleStates: ["queued", "running", "partial", "failed_retryable", "failed_terminal", "success"],
    recoveryDestination: "/settings/health#v10-jobs",
    requiredProofs: ["src/lib/report-export.ts", "src/app/api/export/contracts/route.ts"],
  },
  {
    id: "job",
    routeOrAction: "/settings/health",
    sourceObjects: ["import_job", "export_job", "report_run", "runtime_artifact"],
    readModels: ["job_run_visibility", "work_items", "command_search_index"],
    mutationOrActionNames: ["retry_failed_job", "cancel_job"],
    visibleStates: ["queued", "running", "partial", "failed_retryable", "failed_terminal", "canceled", "success"],
    recoveryDestination: "/settings/health#v10-jobs",
    requiredProofs: ["src/lib/job-visibility.ts", "src/app/(dashboard)/settings/health/page.tsx"],
  },
  {
    id: "notification",
    routeOrAction: "src/actions/product-surface-settings.ts",
    sourceObjects: ["notification_delivery", "setting", "work_item"],
    readModels: ["notification_deliveries", "work_items", "activation_state"],
    mutationOrActionNames: ["update_notification_preferences", "schedule_reminder"],
    visibleStates: ["empty", "partial", "failed", "success"],
    recoveryDestination: "/settings/product",
    requiredProofs: ["src/actions/product-surface-settings.ts", "src/lib/read-model-refresh.ts"],
  },
  {
    id: "settings",
    routeOrAction: "src/actions/product-surface-settings.ts",
    sourceObjects: ["setting", "account", "audit_event"],
    readModels: ["activation_state", "job_run_visibility", "command_search_index"],
    mutationOrActionNames: ["update_workspace_mode", "update_module_visibility", "update_plan_mode"],
    visibleStates: ["empty", "partial", "failed", "hidden_module", "success"],
    recoveryDestination: "/settings/product",
    requiredProofs: ["src/lib/governance.ts", "src/actions/product-surface-settings.ts"],
  },
  {
    id: "relationship",
    routeOrAction: "/counterparties/[key]",
    sourceObjects: ["account", "counterparty", "relationship", "contract"],
    readModels: ["advanced_assurance_linked_records", "contract_health_snapshots", "command_search_index"],
    mutationOrActionNames: ["assign_work_item_owner", "update_module_visibility"],
    visibleStates: ["empty", "partial", "failed", "success"],
    recoveryDestination: "/work?lens=relationships",
    requiredProofs: ["src/components/relationship/relationship-workspace-actions.tsx", "src/app/(dashboard)/counterparties/[key]/page.tsx"],
  },
  {
    id: "advanced",
    routeOrAction: "/decisions",
    sourceObjects: ["decision", "simulation", "program", "playbook", "automation_run"],
    readModels: ["advanced_assurance_linked_records", "work_items", "command_search_index"],
    mutationOrActionNames: ["approve_approval_request", "reject_approval_request", "retry_failed_job"],
    visibleStates: ["empty", "partial", "failed", "hidden_module", "success"],
    recoveryDestination: "/decisions",
    requiredProofs: ["src/lib/advanced-assurance-continuity.ts", "src/app/(dashboard)/decisions/page.tsx"],
  },
  {
    id: "assurance",
    routeOrAction: "/assurance",
    sourceObjects: ["finding", "control", "campaign", "scorecard", "review_board", "health_graph"],
    readModels: ["advanced_assurance_linked_records", "work_items", "command_search_index"],
    mutationOrActionNames: ["approve_approval_request", "resolve_exception", "retry_failed_job"],
    visibleStates: ["empty", "partial", "failed", "hidden_module", "success"],
    recoveryDestination: "/assurance",
    requiredProofs: ["src/lib/advanced-assurance-continuity.ts", "src/app/(dashboard)/assurance/page.tsx"],
  },
  {
    id: "shipped_p2",
    routeOrAction: "/work",
    sourceObjects: ["automation_run", "decision", "finding", "control", "runtime_artifact"],
    readModels: ["advanced_assurance_linked_records", "work_items", "job_run_visibility"],
    mutationOrActionNames: ["approve_approval_request", "reject_approval_request", "retry_failed_job"],
    visibleStates: ["empty", "partial", "failed_retryable", "failed_terminal", "hidden_module", "success"],
    recoveryDestination: "/work?type=automation_approval",
    requiredProofs: ["src/lib/domain-depth-contracts.ts", "src/lib/read-model-refresh.ts"],
  },
] as const;


export function getV10CoreWorkflowContract(id: V10CoreWorkflowId): V10CoreWorkflowContract | null {
  return V10_CORE_WORKFLOW_CONTRACTS.find((contract) => contract.id === id) ?? null;
}

export function validateV10CoreWorkflowContracts(
  contracts: readonly V10CoreWorkflowContract[] = V10_CORE_WORKFLOW_CONTRACTS
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const contract of contracts) {
    if (seen.has(contract.id)) failures.push(`duplicate_workflow:${contract.id}`);
    seen.add(contract.id);
    if (contract.priority !== "P0") failures.push(`${contract.id}:priority_not_p0`);
    if (!contract.route) failures.push(`${contract.id}:route_required`);
    if (contract.sourceTables.length === 0) failures.push(`${contract.id}:source_table_required`);
    if (contract.readModels.length === 0) failures.push(`${contract.id}:read_model_required`);
    if (contract.requiredActions.length === 0) failures.push(`${contract.id}:action_required`);
    if (!contract.recoveryStates.includes("partial") && !contract.recoveryStates.includes("failed")) {
      failures.push(`${contract.id}:recoverability_required`);
    }
    if (!contract.refreshScopes.includes("repair")) failures.push(`${contract.id}:repair_scope_required`);
    if (contract.telemetryEvents.length === 0) failures.push(`${contract.id}:telemetry_required`);
    if (!contract.objectiveSignal) failures.push(`${contract.id}:objective_signal_required`);
    if (contract.autonomousProofs.length === 0) failures.push(`${contract.id}:proof_required`);
  }
  for (const id of [
    "activation",
    "home_daily_brief",
    "unified_work",
    "contract_record",
    "field_review_data_quality",
    "renewal_prevention",
  ] as const) {
    if (!seen.has(id)) failures.push(`missing_workflow:${id}`);
  }
  return failures;
}

export function validateV10EndToEndDomainWorkflowContracts(
  contracts: readonly V10EndToEndDomainWorkflowContract[] = V10_END_TO_END_DOMAIN_WORKFLOW_CONTRACTS
): string[] {
  const failures: string[] = [];
  const requiredIds: readonly V10EndToEndDomainWorkflowId[] = [
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
  ];
  for (const id of requiredIds) {
    if (!contracts.some((contract) => contract.id === id)) failures.push(`domain_workflow_missing:${id}`);
  }
  for (const contract of contracts) {
    if (!contract.routeOrAction) failures.push(`${contract.id}:route_or_action_required`);
    if (contract.sourceObjects.length === 0) failures.push(`${contract.id}:source_object_required`);
    for (const sourceObject of contract.sourceObjects) {
      if (!V10_SOURCE_OBJECT_TYPES.includes(sourceObject as (typeof V10_SOURCE_OBJECT_TYPES)[number])) {
        failures.push(`${contract.id}:unknown_source_object:${sourceObject}`);
      }
    }
    if (contract.readModels.length === 0) failures.push(`${contract.id}:read_model_required`);
    for (const readModel of contract.readModels) {
      if (!V10_REQUIRED_READ_MODEL_KEYS.includes(readModel as (typeof V10_REQUIRED_READ_MODEL_KEYS)[number])) {
        failures.push(`${contract.id}:unknown_read_model:${readModel}`);
      }
    }
    if (contract.mutationOrActionNames.length === 0) failures.push(`${contract.id}:mutation_or_action_required`);
    if (!contract.visibleStates.some((state) => /partial|failed|expired|revoked|stale/i.test(state))) {
      failures.push(`${contract.id}:recoverable_failure_state_required`);
    }
    if (!contract.visibleStates.includes("success")) failures.push(`${contract.id}:success_state_required`);
    if (!contract.recoveryDestination.startsWith("/")) failures.push(`${contract.id}:recovery_destination_required`);
    if (contract.requiredProofs.length === 0) failures.push(`${contract.id}:proof_required`);
    if ((contract.id === "report" || contract.id === "export" || contract.id === "job") && !contract.visibleStates.includes("failed_retryable")) {
      failures.push(`${contract.id}:retryable_job_state_required`);
    }
  }
  if (new Set(contracts.map((contract) => contract.id)).size !== contracts.length) failures.push("domain_workflow_duplicate");
  return failures;
}

export function validateV10CoreSurfaceParitySnapshots(
  snapshots: readonly V10CoreSurfaceParitySnapshot[],
  requiredMetrics: readonly V10CoreSurfaceParityMetric[] = ["due_today", "overdue", "blocked", "high_risk", "failed_jobs", "missing_owner", "hidden_filtered"]
): string[] {
  const failures: string[] = [];
  const requiredSurfaces: readonly V10CoreSurfaceParitySurface[] = [
    "home",
    "work",
    "contract_list",
    "contract_detail",
    "command_palette",
    "nav",
  ];
  for (const surface of requiredSurfaces) {
    if (!snapshots.some((snapshot) => snapshot.surface === surface)) failures.push(`surface_missing:${surface}`);
  }
  for (const snapshot of snapshots) {
    if (!snapshot.proofArtifact) failures.push(`${snapshot.surface}:proof_artifact_required`);
  }
  for (const metric of requiredMetrics) {
    const values = snapshots
      .filter((snapshot) => Object.prototype.hasOwnProperty.call(snapshot.counts, metric))
      .map((snapshot) => ({ surface: snapshot.surface, value: snapshot.counts[metric] }));
    if (values.length < requiredSurfaces.length) failures.push(`metric_missing:${metric}`);
    const unique = new Set(values.map((row) => row.value));
    if (unique.size > 1) failures.push(`metric_mismatch:${metric}:${values.map((row) => `${row.surface}=${row.value}`).join(",")}`);
  }
  return failures;
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { getV10CoreWorkflowContract as getCoreWorkflowContract };
export { V10_CORE_WORKFLOW_CONTRACTS as CORE_WORKFLOW_CONTRACTS };
export { V10_END_TO_END_DOMAIN_WORKFLOW_CONTRACTS as END_TO_END_DOMAIN_WORKFLOW_CONTRACTS };
export { validateV10CoreSurfaceParitySnapshots as validateCoreSurfaceParitySnapshots };
export { validateV10CoreWorkflowContracts as validateCoreWorkflowContracts };
export { validateV10EndToEndDomainWorkflowContracts as validateEndToEndDomainWorkflowContracts };
export type { V10CoreSurfaceParityMetric as CoreSurfaceParityMetric };
export type { V10CoreSurfaceParitySnapshot as CoreSurfaceParitySnapshot };
export type { V10CoreSurfaceParitySurface as CoreSurfaceParitySurface };
export type { V10CoreWorkflowContract as CoreWorkflowContract };
export type { V10CoreWorkflowId as CoreWorkflowId };
export type { V10EndToEndDomainWorkflowContract as EndToEndDomainWorkflowContract };
export type { V10EndToEndDomainWorkflowId as EndToEndDomainWorkflowId };
// End version-name compatibility aliases.
