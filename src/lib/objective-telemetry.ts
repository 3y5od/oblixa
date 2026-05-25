export type V10ObjectiveEvidenceSource =
  | "telemetry"
  | "audit_events"
  | "job_visibility"
  | "read_model"
  | "release_fixture"
  | "release_metric_run"
  | "slo_dashboard"
  | "manual_usability_run";

export type V10ObjectiveTelemetryContract = {
  objectiveKey: string;
  dashboardKey: string;
  evidenceSources: readonly V10ObjectiveEvidenceSource[];
  privacySafeFields: readonly string[];
};

export type V10SloDashboardEvidence = {
  dashboardKey: string;
  metricKey: (typeof V10_REQUIRED_PRODUCT_METRICS)[number];
  owner: "product" | "operations" | "engineering" | "support" | "release";
  releaseWindow: "pre_ga_release_candidate" | "post_ga_7_day" | "post_ga_30_day";
  freshnessMinutes: number;
  alertThresholds: readonly string[];
  diagnosticId: string;
  dashboardUrl: string | null;
};

export type V10ProductMetricDashboardMapRow = {
  metricKey: (typeof V10_REQUIRED_PRODUCT_METRICS)[number];
  objectiveKey: string;
  dashboardKey: string;
  evidenceSource: V10ObjectiveEvidenceSource;
};

export type V10PostGaDriftControl = {
  controlKey: string;
  metricKeys: readonly (typeof V10_REQUIRED_PRODUCT_METRICS)[number][];
  windows: readonly ("post_ga_7_day" | "post_ga_30_day")[];
  owner: "product" | "operations" | "engineering" | "support" | "release";
  alertReviewCadenceHours: number;
  releaseEvidenceKeys: readonly `v10-release:post-ga:${string}`[];
};

export type V10PromotedSloDashboardEvidence = V10SloDashboardEvidence & {
  dashboardUrl: string;
  capturedAt: string;
  evidenceOwner: string;
};

export const V10_REQUIRED_PRODUCT_METRICS = [
  "activation_completion_rate",
  "upload_to_first_approved_required_field_ms",
  "upload_to_first_generated_work_item_ms",
  "review_queue_clearance_rate",
  "work_item_completion_rate",
  "overdue_work_count",
  "renewal_deadline_misses",
  "evidence_request_completion_rate",
  "approval_sla_breach_rate",
  "exception_resolution_time_ms",
  "report_run_success_rate",
  "export_success_rate",
  "import_extraction_failure_rate",
  "command_palette_success_rate",
  "command_palette_zero_result_rate",
  "empty_state_cta_click_rate",
  "failed_job_retry_success_rate",
] as const;

const FORBIDDEN_TELEMETRY_FIELD_RE = /raw|text|email|token|secret|phone|address|name|url|file/i;

export const V10_OBJECTIVE_TELEMETRY_CONTRACTS: readonly V10ObjectiveTelemetryContract[] = [
  {
    objectiveKey: "activation_first_work_item",
    dashboardKey: "activation_first_work_item",
    evidenceSources: ["telemetry", "audit_events", "job_visibility", "read_model", "release_metric_run"],
    privacySafeFields: ["organization_id", "contract_id", "job_id", "duration_ms", "state"],
  },
  {
    objectiveKey: "daily_action_clearance",
    dashboardKey: "work_reachability",
    evidenceSources: ["read_model", "release_fixture", "release_metric_run"],
    privacySafeFields: ["work_item_id", "source_type", "due_state", "owner_state", "click_depth"],
  },
  {
    objectiveKey: "contract_record_trust",
    dashboardKey: "contract_record_trust",
    evidenceSources: ["read_model", "audit_events", "release_metric_run"],
    privacySafeFields: ["contract_id", "health_band", "next_action", "audit_event_id"],
  },
  {
    objectiveKey: "renewal_prevention",
    dashboardKey: "renewal_reminder_eligibility",
    evidenceSources: ["read_model", "job_visibility", "release_metric_run", "slo_dashboard"],
    privacySafeFields: ["contract_id", "posture", "horizon", "diagnostic_id"],
  },
  {
    objectiveKey: "evidence_accountability",
    dashboardKey: "evidence_followup_accountability",
    evidenceSources: ["read_model", "job_visibility", "audit_events", "release_metric_run"],
    privacySafeFields: ["evidence_request_id", "due_state", "notification_status", "diagnostic_id"],
  },
  {
    objectiveKey: "report_export_reliability",
    dashboardKey: "report_export_reliability",
    evidenceSources: ["job_visibility", "audit_events", "release_metric_run", "slo_dashboard"],
    privacySafeFields: ["report_run_id", "export_job_id", "row_count", "status", "diagnostic_id"],
  },
  {
    objectiveKey: "search_as_router",
    dashboardKey: "command_palette_router_success",
    evidenceSources: ["telemetry", "read_model", "release_metric_run"],
    privacySafeFields: ["query_class", "result_type", "result_count", "zero_result", "recovery_used"],
  },
  {
    objectiveKey: "empty_state_cta",
    dashboardKey: "empty_state_cta_click_rate",
    evidenceSources: ["telemetry", "release_metric_run"],
    privacySafeFields: ["checkpoint", "result_type", "completion", "exclusion_reason"],
  },
  {
    objectiveKey: "product_self_explanation",
    dashboardKey: "first_time_activation_no_docs",
    evidenceSources: ["manual_usability_run", "release_metric_run"],
    privacySafeFields: ["session_id", "checkpoint", "completed", "exclusion_reason"],
  },
] as const;

export const V10_SLO_DASHBOARD_EVIDENCE: readonly V10SloDashboardEvidence[] = [
  {
    dashboardKey: "activation_first_work_item",
    metricKey: "activation_completion_rate",
    owner: "product",
    releaseWindow: "pre_ga_release_candidate",
    freshnessMinutes: 60,
    alertThresholds: ["activation_completion_rate_below_90", "first_work_item_p95_above_budget"],
    diagnosticId: "v10_activation_slo_dashboard",
    dashboardUrl: null,
  },
  {
    dashboardKey: "work_reachability",
    metricKey: "work_item_completion_rate",
    owner: "operations",
    releaseWindow: "pre_ga_release_candidate",
    freshnessMinutes: 60,
    alertThresholds: ["work_queue_stale_minutes", "mutation_conflict_rate"],
    diagnosticId: "v10_work_reachability_slo_dashboard",
    dashboardUrl: null,
  },
  {
    dashboardKey: "report_export_reliability",
    metricKey: "export_success_rate",
    owner: "operations",
    releaseWindow: "pre_ga_release_candidate",
    freshnessMinutes: 30,
    alertThresholds: ["failed_export_rate", "artifact_expiry_backlog", "report_run_success_rate_below_95"],
    diagnosticId: "v10_report_export_slo_dashboard",
    dashboardUrl: null,
  },
  {
    dashboardKey: "command_palette_router_success",
    metricKey: "command_palette_success_rate",
    owner: "product",
    releaseWindow: "pre_ga_release_candidate",
    freshnessMinutes: 60,
    alertThresholds: ["search_error_rate", "zero_result_rate_above_budget"],
    diagnosticId: "v10_command_search_slo_dashboard",
    dashboardUrl: null,
  },
  {
    dashboardKey: "post_ga_operational_window",
    metricKey: "failed_job_retry_success_rate",
    owner: "support",
    releaseWindow: "post_ga_7_day",
    freshnessMinutes: 15,
    alertThresholds: ["failed_job_retry_success_rate_below_90", "support_escalation_rate"],
    diagnosticId: "v10_post_ga_slo_dashboard",
    dashboardUrl: null,
  },
  {
    dashboardKey: "post_ga_operational_window",
    metricKey: "failed_job_retry_success_rate",
    owner: "support",
    releaseWindow: "post_ga_30_day",
    freshnessMinutes: 60,
    alertThresholds: ["failed_job_retry_success_rate_below_95", "post_ga_drift_unreviewed_24h"],
    diagnosticId: "v10_post_ga_30_day_slo_dashboard",
    dashboardUrl: null,
  },
] as const;

export const V10_POST_GA_DRIFT_CONTROLS: readonly V10PostGaDriftControl[] = [
  {
    controlKey: "post_ga_operational_reliability",
    metricKeys: ["failed_job_retry_success_rate", "report_run_success_rate", "export_success_rate"],
    windows: ["post_ga_7_day", "post_ga_30_day"],
    owner: "operations",
    alertReviewCadenceHours: 24,
    releaseEvidenceKeys: [
      "v10-release:post-ga:operational-reliability-7-day",
      "v10-release:post-ga:operational-reliability-30-day",
    ],
  },
  {
    controlKey: "post_ga_product_adoption",
    metricKeys: ["activation_completion_rate", "work_item_completion_rate", "empty_state_cta_click_rate"],
    windows: ["post_ga_7_day", "post_ga_30_day"],
    owner: "product",
    alertReviewCadenceHours: 24,
    releaseEvidenceKeys: [
      "v10-release:post-ga:product-adoption-7-day",
      "v10-release:post-ga:product-adoption-30-day",
    ],
  },
  {
    controlKey: "post_ga_privacy_telemetry",
    metricKeys: ["command_palette_zero_result_rate", "evidence_request_completion_rate"],
    windows: ["post_ga_7_day", "post_ga_30_day"],
    owner: "support",
    alertReviewCadenceHours: 12,
    releaseEvidenceKeys: [
      "v10-release:post-ga:privacy-telemetry-7-day",
      "v10-release:post-ga:privacy-telemetry-30-day",
    ],
  },
] as const;

export const V10_PRODUCT_METRIC_DASHBOARD_MAP: readonly V10ProductMetricDashboardMapRow[] = [
  ["activation_completion_rate", "activation_first_work_item", "activation_first_work_item", "release_metric_run"],
  ["upload_to_first_approved_required_field_ms", "activation_first_work_item", "activation_first_work_item", "telemetry"],
  ["upload_to_first_generated_work_item_ms", "activation_first_work_item", "activation_first_work_item", "telemetry"],
  ["review_queue_clearance_rate", "daily_action_clearance", "work_reachability", "read_model"],
  ["work_item_completion_rate", "daily_action_clearance", "work_reachability", "read_model"],
  ["overdue_work_count", "daily_action_clearance", "work_reachability", "read_model"],
  ["renewal_deadline_misses", "renewal_prevention", "renewal_reminder_eligibility", "slo_dashboard"],
  ["evidence_request_completion_rate", "evidence_accountability", "evidence_followup_accountability", "read_model"],
  ["approval_sla_breach_rate", "daily_action_clearance", "work_reachability", "read_model"],
  ["exception_resolution_time_ms", "daily_action_clearance", "work_reachability", "read_model"],
  ["report_run_success_rate", "report_export_reliability", "report_export_reliability", "slo_dashboard"],
  ["export_success_rate", "report_export_reliability", "report_export_reliability", "slo_dashboard"],
  ["import_extraction_failure_rate", "activation_first_work_item", "activation_first_work_item", "job_visibility"],
  ["command_palette_success_rate", "search_as_router", "command_palette_router_success", "telemetry"],
  ["command_palette_zero_result_rate", "search_as_router", "command_palette_router_success", "telemetry"],
  ["empty_state_cta_click_rate", "empty_state_cta", "empty_state_cta_click_rate", "telemetry"],
  ["failed_job_retry_success_rate", "report_export_reliability", "post_ga_operational_window", "slo_dashboard"],
].map(([metricKey, objectiveKey, dashboardKey, evidenceSource]) => ({
  metricKey: metricKey as (typeof V10_REQUIRED_PRODUCT_METRICS)[number],
  objectiveKey,
  dashboardKey,
  evidenceSource: evidenceSource as V10ObjectiveEvidenceSource,
}));

export function getV10ObjectiveTelemetryContract(objectiveKey: string): V10ObjectiveTelemetryContract | null {
  return V10_OBJECTIVE_TELEMETRY_CONTRACTS.find((contract) => contract.objectiveKey === objectiveKey) ?? null;
}

export function v10ObjectiveAllowsEvidenceSource(objectiveKey: string, source: V10ObjectiveEvidenceSource): boolean {
  return getV10ObjectiveTelemetryContract(objectiveKey)?.evidenceSources.includes(source) ?? false;
}

export function validateV10TelemetryFields(fields: readonly string[]): string[] {
  return fields.filter((field) => FORBIDDEN_TELEMETRY_FIELD_RE.test(field));
}

export function createV10ObjectiveTelemetryPayload(
  objectiveKey: string,
  fields: Record<string, string | number | boolean | null>
): {
  payload: Record<string, string | number | boolean | null>;
  droppedFields: string[];
} {
  const contract = getV10ObjectiveTelemetryContract(objectiveKey);
  if (!contract) return { payload: {}, droppedFields: Object.keys(fields) };
  const allowed = new Set(contract.privacySafeFields);
  const payload: Record<string, string | number | boolean | null> = {};
  const droppedFields: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!allowed.has(key) || validateV10TelemetryFields([key]).length > 0) {
      droppedFields.push(key);
    } else {
      payload[key] = value;
    }
  }
  return { payload, droppedFields };
}

export function validateV10SloDashboardEvidence(
  rows: readonly V10SloDashboardEvidence[] = V10_SLO_DASHBOARD_EVIDENCE
): string[] {
  const failures: string[] = [];
  const dashboardKeys = new Set(V10_OBJECTIVE_TELEMETRY_CONTRACTS.map((contract) => contract.dashboardKey));
  const metricKeys = new Set(V10_REQUIRED_PRODUCT_METRICS);
  for (const row of rows) {
    if (!dashboardKeys.has(row.dashboardKey) && row.dashboardKey !== "post_ga_operational_window") {
      failures.push(`${row.dashboardKey}:dashboard_contract_missing`);
    }
    if (!metricKeys.has(row.metricKey)) failures.push(`${row.dashboardKey}:metric_unknown`);
    if (row.freshnessMinutes <= 0) failures.push(`${row.dashboardKey}:freshness_required`);
    if (row.alertThresholds.length === 0) failures.push(`${row.dashboardKey}:alert_threshold_required`);
    if (!row.diagnosticId.startsWith("v10_")) failures.push(`${row.dashboardKey}:diagnostic_id_required`);
    if (row.dashboardUrl && (!row.dashboardUrl.startsWith("https://") || /token=|secret|signed/i.test(row.dashboardUrl))) {
      failures.push(`${row.dashboardKey}:dashboard_url_must_be_https_without_secrets`);
    }
  }
  for (const required of ["activation_first_work_item", "work_reachability", "report_export_reliability", "command_palette_router_success"]) {
    if (!rows.some((row) => row.dashboardKey === required)) failures.push(`slo_dashboard_missing:${required}`);
  }
  return failures;
}

export function validateV10ProductMetricDashboardMap(
  rows: readonly V10ProductMetricDashboardMapRow[] = V10_PRODUCT_METRIC_DASHBOARD_MAP
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  const objectiveKeys = new Set(V10_OBJECTIVE_TELEMETRY_CONTRACTS.map((contract) => contract.objectiveKey));
  for (const row of rows) {
    if (seen.has(row.metricKey)) failures.push(`duplicate_metric_dashboard:${row.metricKey}`);
    seen.add(row.metricKey);
    if (!objectiveKeys.has(row.objectiveKey)) failures.push(`${row.metricKey}:objective_unknown`);
    if (!row.dashboardKey.trim()) failures.push(`${row.metricKey}:dashboard_key_required`);
    if (!v10ObjectiveAllowsEvidenceSource(row.objectiveKey, row.evidenceSource)) {
      failures.push(`${row.metricKey}:evidence_source_not_allowed`);
    }
  }
  for (const metric of V10_REQUIRED_PRODUCT_METRICS) {
    if (!seen.has(metric)) failures.push(`metric_dashboard_missing:${metric}`);
  }
  return failures;
}

export function validateV10PostGaDriftControls(
  rows: readonly V10PostGaDriftControl[] = V10_POST_GA_DRIFT_CONTROLS
): string[] {
  const failures: string[] = [];
  const metricKeys = new Set(V10_REQUIRED_PRODUCT_METRICS);
  const windows = new Set<V10PostGaDriftControl["windows"][number]>();
  const seenControls = new Set<string>();
  for (const row of rows) {
    if (!row.controlKey.trim()) failures.push("post_ga_control_key_required");
    if (seenControls.has(row.controlKey)) failures.push(`duplicate_post_ga_control:${row.controlKey}`);
    seenControls.add(row.controlKey);
    if (row.metricKeys.length === 0) failures.push(`${row.controlKey}:metric_required`);
    for (const metric of row.metricKeys) {
      if (!metricKeys.has(metric)) failures.push(`${row.controlKey}:metric_unknown:${metric}`);
    }
    for (const window of row.windows) windows.add(window);
    if (!row.windows.includes("post_ga_7_day")) failures.push(`${row.controlKey}:post_ga_7_day_required`);
    if (!row.windows.includes("post_ga_30_day")) failures.push(`${row.controlKey}:post_ga_30_day_required`);
    if (row.alertReviewCadenceHours <= 0 || row.alertReviewCadenceHours > 168) {
      failures.push(`${row.controlKey}:alert_review_cadence_invalid`);
    }
    if (row.releaseEvidenceKeys.length < row.windows.length) failures.push(`${row.controlKey}:release_evidence_per_window_required`);
    for (const key of row.releaseEvidenceKeys) {
      if (!key.startsWith("v10-release:post-ga:")) failures.push(`${row.controlKey}:post_ga_release_evidence_key_required`);
    }
  }
  for (const window of ["post_ga_7_day", "post_ga_30_day"] as const) {
    if (!windows.has(window)) failures.push(`post_ga_window_missing:${window}`);
  }
  return failures;
}

export function validateV10PromotedSloDashboardEvidence(
  rows: readonly V10PromotedSloDashboardEvidence[],
  now = new Date()
): string[] {
  const failures = validateV10SloDashboardEvidence(rows);
  for (const row of rows) {
    if (!row.dashboardUrl.startsWith("https://") || /token=|secret|signed/i.test(row.dashboardUrl)) {
      failures.push(`${row.dashboardKey}:promoted_dashboard_url_invalid`);
    }
    if (!row.evidenceOwner.trim()) failures.push(`${row.dashboardKey}:promoted_owner_required`);
    const capturedAt = new Date(row.capturedAt);
    if (Number.isNaN(capturedAt.getTime())) {
      failures.push(`${row.dashboardKey}:captured_at_required`);
      continue;
    }
    const ageMinutes = (now.getTime() - capturedAt.getTime()) / 60_000;
    if (ageMinutes > row.freshnessMinutes) failures.push(`${row.dashboardKey}:dashboard_evidence_stale`);
  }
  return failures;
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { createV10ObjectiveTelemetryPayload as createObjectiveTelemetryPayload };
export { getV10ObjectiveTelemetryContract as getObjectiveTelemetryContract };
export { V10_OBJECTIVE_TELEMETRY_CONTRACTS as OBJECTIVE_TELEMETRY_CONTRACTS };
export { V10_POST_GA_DRIFT_CONTROLS as POST_GA_DRIFT_CONTROLS };
export { V10_PRODUCT_METRIC_DASHBOARD_MAP as PRODUCT_METRIC_DASHBOARD_MAP };
export { V10_REQUIRED_PRODUCT_METRICS as REQUIRED_PRODUCT_METRICS };
export { V10_SLO_DASHBOARD_EVIDENCE as SLO_DASHBOARD_EVIDENCE };
export { v10ObjectiveAllowsEvidenceSource as objectiveAllowsEvidenceSource };
export { validateV10PostGaDriftControls as validatePostGaDriftControls };
export { validateV10ProductMetricDashboardMap as validateProductMetricDashboardMap };
export { validateV10PromotedSloDashboardEvidence as validatePromotedSloDashboardEvidence };
export { validateV10SloDashboardEvidence as validateSloDashboardEvidence };
export { validateV10TelemetryFields as validateTelemetryFields };
export type { V10ObjectiveEvidenceSource as ObjectiveEvidenceSource };
export type { V10ObjectiveTelemetryContract as ObjectiveTelemetryContract };
export type { V10PostGaDriftControl as PostGaDriftControl };
export type { V10ProductMetricDashboardMapRow as ProductMetricDashboardMapRow };
export type { V10PromotedSloDashboardEvidence as PromotedSloDashboardEvidence };
export type { V10SloDashboardEvidence as SloDashboardEvidence };
// End version-name compatibility aliases.
