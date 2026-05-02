export type V10RecoverableUiState =
  | "empty"
  | "loading"
  | "partial"
  | "failed"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "plan_gated"
  | "mode_gated"
  | "hidden_module"
  | "archived"
  | "deleted"
  | "stale"
  | "conflict"
  | "retryable"
  | "terminal_failure"
  | "dependency_blocked"
  | "external_link_expired"
  | "external_link_revoked"
  | "no_action_available";

export type V10UiStateContract = {
  state: V10RecoverableUiState;
  requiresReason: boolean;
  requiresNextActionOrExplanation: boolean;
  requiresAccessibleName: boolean;
};

export type V10RouteStateMatrixEntry = {
  route: string;
  requiredStates: readonly V10RecoverableUiState[];
  accessibilityAssertions: readonly string[];
  responsiveProfiles: readonly ("mobile" | "tablet" | "desktop")[];
  performanceBudgetKind: "dashboard" | "contract_list" | "command_palette" | "work_review_queue" | "report_export";
};

export type V10BrowserDeviceProfile = {
  profile: string;
  browser: "chromium" | "webkit" | "firefox";
  device: "desktop" | "tablet" | "mobile";
  locale: "en-US" | "en-GB";
  timezone: "UTC" | "America/New_York" | "Europe/London";
  inputMode: "keyboard" | "touch" | "screen_reader_keyboard";
  reducedMotion: boolean;
  largeResult: boolean;
  degradedNetwork: boolean;
};

export type V10VisualRegressionStateContract = {
  surface: string;
  states: readonly V10RecoverableUiState[];
  breakpoints: readonly ("mobile" | "tablet" | "desktop")[];
  reducedMotionCovered: boolean;
  highContrastCovered: boolean;
  proofArtifact: string;
};

export type V10InteractiveControlA11yAudit = {
  accessibleName?: string | null;
  keyboardReachable: boolean;
  touchTargetPx?: number | null;
  focusReturnTarget?: string | null;
  reducedMotionSafe: boolean;
  statusTextVisible: boolean;
  colorOnlyStatus: boolean;
};

export type V10UxStateMachineCoverageInput = {
  route: string;
  state: V10RecoverableUiState;
  availableActions: readonly string[];
  reason?: string | null;
  copy?: string | null;
  focusReturnTarget?: string | null;
  accessibleName?: string | null;
};

export type V10RecoverabilityFailureMode =
  | "retryable_job"
  | "terminal_job"
  | "stale_mutation_version"
  | "empty_state"
  | "hidden_feature"
  | "expired_external_link"
  | "revoked_external_link"
  | "async_report_threshold"
  | "unsafe_csv_value"
  | "provider_outage"
  | "read_model_refresh_failure"
  | "stale_release_evidence"
  | "canary_hold"
  | "rollback"
  | "no_action_terminal_state";

export type V10RecoverabilityFailureModeMatrixRow = {
  failureMode: V10RecoverabilityFailureMode;
  route: string;
  state: V10RecoverableUiState;
  userReason: string;
  diagnosticId: `v10_${string}`;
  nextActionLabel: string | null;
  noActionExplanation: string | null;
  auditAction: string;
  telemetryObjective: string;
};

export const V10_UI_STATE_CONTRACTS: readonly V10UiStateContract[] = [
  "empty",
  "loading",
  "partial",
  "failed",
  "unauthorized",
  "forbidden",
  "not_found",
  "plan_gated",
  "mode_gated",
  "hidden_module",
  "archived",
  "deleted",
  "stale",
  "conflict",
  "retryable",
  "terminal_failure",
  "dependency_blocked",
  "external_link_expired",
  "external_link_revoked",
  "no_action_available",
].map((state) => ({
  state: state as V10RecoverableUiState,
  requiresReason: state !== "loading",
  requiresNextActionOrExplanation: true,
  requiresAccessibleName: true,
}));

export const V10_RECOVERABILITY_FAILURE_MODE_MATRIX: readonly V10RecoverabilityFailureModeMatrixRow[] = [
  {
    failureMode: "retryable_job",
    route: "/work?lens=failed_jobs",
    state: "retryable",
    userReason: "A job failed in a retryable state and can be safely run again.",
    diagnosticId: "v10_retryable_job_recovery",
    nextActionLabel: "Retry failed job",
    noActionExplanation: null,
    auditAction: "job.retry_requested",
    telemetryObjective: "report_export_reliability",
  },
  {
    failureMode: "terminal_job",
    route: "/settings/health#v10-runtime",
    state: "terminal_failure",
    userReason: "The job reached a terminal failure and needs support review before another attempt.",
    diagnosticId: "v10_terminal_job_support_review",
    nextActionLabel: "Open diagnostics",
    noActionExplanation: null,
    auditAction: "job.terminal_failure_viewed",
    telemetryObjective: "failed_job_retry_success_rate",
  },
  {
    failureMode: "stale_mutation_version",
    route: "/work",
    state: "conflict",
    userReason: "The record changed before this action could be applied.",
    diagnosticId: "v10_stale_mutation_version",
    nextActionLabel: "Refresh and retry",
    noActionExplanation: null,
    auditAction: "mutation.stale_version",
    telemetryObjective: "daily_action_clearance",
  },
  {
    failureMode: "empty_state",
    route: "/dashboard",
    state: "empty",
    userReason: "No source objects match this view yet.",
    diagnosticId: "v10_empty_state_recovery",
    nextActionLabel: "Create or import contracts",
    noActionExplanation: null,
    auditAction: "empty_state.viewed",
    telemetryObjective: "empty_state_cta",
  },
  {
    failureMode: "hidden_feature",
    route: "/settings/product",
    state: "hidden_module",
    userReason: "This destination is hidden by workspace configuration.",
    diagnosticId: "v10_hidden_feature_recovery",
    nextActionLabel: "Review product settings",
    noActionExplanation: null,
    auditAction: "workspace.hidden_module_filtered",
    telemetryObjective: "search_as_router",
  },
  {
    failureMode: "expired_external_link",
    route: "/evidence/submit",
    state: "external_link_expired",
    userReason: "This evidence link expired and no longer accepts submissions.",
    diagnosticId: "v10_external_link_expired",
    nextActionLabel: null,
    noActionExplanation: "Ask the requester for a new evidence link.",
    auditAction: "external_link.expired",
    telemetryObjective: "evidence_accountability",
  },
  {
    failureMode: "revoked_external_link",
    route: "/evidence/submit",
    state: "external_link_revoked",
    userReason: "This evidence link was revoked by the workspace.",
    diagnosticId: "v10_external_link_revoked",
    nextActionLabel: null,
    noActionExplanation: "Ask the requester for a replacement link.",
    auditAction: "external_link.revoked",
    telemetryObjective: "evidence_accountability",
  },
  {
    failureMode: "async_report_threshold",
    route: "/reports",
    state: "partial",
    userReason: "This report is large enough to continue asynchronously.",
    diagnosticId: "v10_async_report_threshold",
    nextActionLabel: "Open report jobs",
    noActionExplanation: null,
    auditAction: "report.async_handoff",
    telemetryObjective: "report_export_reliability",
  },
  {
    failureMode: "unsafe_csv_value",
    route: "/reports",
    state: "failed",
    userReason: "An export value looked unsafe for CSV output and was neutralized or blocked.",
    diagnosticId: "v10_unsafe_csv_value",
    nextActionLabel: "Review export diagnostics",
    noActionExplanation: null,
    auditAction: "export.csv_value_blocked",
    telemetryObjective: "report_export_reliability",
  },
  {
    failureMode: "provider_outage",
    route: "/settings/health#providers",
    state: "dependency_blocked",
    userReason: "A provider dependency is unavailable, so this action is paused.",
    diagnosticId: "v10_provider_outage",
    nextActionLabel: "Open provider health",
    noActionExplanation: null,
    auditAction: "provider.outage_detected",
    telemetryObjective: "failed_job_retry_success_rate",
  },
  {
    failureMode: "read_model_refresh_failure",
    route: "/settings/health#v10-runtime",
    state: "failed",
    userReason: "A read-model refresh failed and current data may be partial.",
    diagnosticId: "v10_read_model_refresh_failure",
    nextActionLabel: "Repair read models",
    noActionExplanation: null,
    auditAction: "read_model.refresh_failed",
    telemetryObjective: "daily_action_clearance",
  },
  {
    failureMode: "stale_release_evidence",
    route: "/settings/health#v10-runtime",
    state: "stale",
    userReason: "Release evidence is stale and must be recaptured before promotion.",
    diagnosticId: "v10_stale_release_evidence",
    nextActionLabel: "Run release evidence check",
    noActionExplanation: null,
    auditAction: "release_evidence.stale",
    telemetryObjective: "objective_measurement",
  },
  {
    failureMode: "canary_hold",
    route: "/settings/health#canary",
    state: "dependency_blocked",
    userReason: "The rollout is held by canary thresholds.",
    diagnosticId: "v10_canary_hold",
    nextActionLabel: "Review canary decision",
    noActionExplanation: null,
    auditAction: "rollout.canary_hold",
    telemetryObjective: "failed_job_retry_success_rate",
  },
  {
    failureMode: "rollback",
    route: "/settings/health#rollback",
    state: "partial",
    userReason: "Rollback is in progress and some V10 surfaces may be temporarily partial.",
    diagnosticId: "v10_rollback_recovery",
    nextActionLabel: "Open rollback runbook",
    noActionExplanation: null,
    auditAction: "release.rollback_started",
    telemetryObjective: "failed_job_retry_success_rate",
  },
  {
    failureMode: "no_action_terminal_state",
    route: "/work",
    state: "no_action_available",
    userReason: "This item has no safe user action in its current terminal state.",
    diagnosticId: "v10_no_action_terminal_state",
    nextActionLabel: null,
    noActionExplanation: "The state is visible for audit and support review only.",
    auditAction: "work.no_action_available",
    telemetryObjective: "daily_action_clearance",
  },
] as const;

export const V10_ACCESSIBILITY_CONTRACTS = [
  "actionable_controls_have_accessible_names",
  "keyboard_completion_for_upload_review_work_evidence_approvals_search_settings",
  "focus_returns_after_modals_drawers_mobile_nav_and_command_palette",
  "loading_states_do_not_trap_focus",
  "errors_are_announced_or_screen_reader_reachable",
  "reduced_motion_is_respected",
  "color_is_not_the_only_status_signal",
] as const;

export const V10_RESPONSIVE_CONTRACTS = [
  "home_work_contracts_review_detail_evidence_renewals_reports_settings_usable_at_mobile_width",
  "operational_tables_provide_cards_or_horizontal_scroll_with_visible_labels",
  "mobile_navigation_preserves_focus_and_body_scroll_state",
  "primary_actions_remain_reachable_without_hover",
] as const;

export const V10_BACKGROUND_REFRESH_PRESERVATION = [
  "in_progress_form_input",
  "selected_rows",
  "active_filters",
  "open_disclosure_state",
  "keyboard_focus",
] as const;

export const V10_VISUAL_REGRESSION_STATE_CONTRACTS: readonly V10VisualRegressionStateContract[] = [
  {
    surface: "dashboard",
    states: ["empty", "partial", "failed", "dependency_blocked"],
    breakpoints: ["mobile", "tablet", "desktop"],
    reducedMotionCovered: true,
    highContrastCovered: true,
    proofArtifact: "e2e/v10-core-smoke.spec.ts",
  },
  {
    surface: "work",
    states: ["empty", "stale", "retryable", "no_action_available"],
    breakpoints: ["mobile", "tablet", "desktop"],
    reducedMotionCovered: true,
    highContrastCovered: true,
    proofArtifact: "src/app/(dashboard)/work/page.tsx",
  },
  {
    surface: "contracts",
    states: ["empty", "loading", "partial", "failed", "retryable"],
    breakpoints: ["mobile", "tablet", "desktop"],
    reducedMotionCovered: true,
    highContrastCovered: true,
    proofArtifact: "src/components/contracts/contract-table.ui.test.tsx",
  },
  {
    surface: "contract_record",
    states: ["partial", "failed", "not_found", "archived", "deleted", "stale"],
    breakpoints: ["mobile", "tablet", "desktop"],
    reducedMotionCovered: true,
    highContrastCovered: true,
    proofArtifact: "src/app/(dashboard)/contracts/[id]/page.tsx",
  },
  {
    surface: "command_palette",
    states: ["empty", "failed", "hidden_module", "stale"],
    breakpoints: ["mobile", "tablet", "desktop"],
    reducedMotionCovered: true,
    highContrastCovered: true,
    proofArtifact: "src/components/layout/command-palette.ui.test.tsx",
  },
  {
    surface: "report_export",
    states: ["loading", "partial", "failed", "terminal_failure", "external_link_expired"],
    breakpoints: ["mobile", "tablet", "desktop"],
    reducedMotionCovered: true,
    highContrastCovered: true,
    proofArtifact: "src/lib/v10-report-export.v10.test.ts",
  },
  {
    surface: "settings_product",
    states: ["forbidden", "hidden_module", "mode_gated", "plan_gated", "stale"],
    breakpoints: ["mobile", "tablet", "desktop"],
    reducedMotionCovered: true,
    highContrastCovered: true,
    proofArtifact: "src/actions/product-surface-settings.test.ts",
  },
  {
    surface: "settings_health",
    states: ["empty", "partial", "failed", "dependency_blocked", "terminal_failure", "stale"],
    breakpoints: ["mobile", "tablet", "desktop"],
    reducedMotionCovered: true,
    highContrastCovered: true,
    proofArtifact: "src/app/(dashboard)/settings/health/page.tsx",
  },
] as const;

export const V10_ROUTE_STATE_MATRIX: readonly V10RouteStateMatrixEntry[] = [
  {
    route: "/dashboard",
    requiredStates: ["empty", "partial", "failed", "unauthorized", "forbidden"],
    accessibilityAssertions: ["landmark_heading", "keyboard_reachable_primary_action", "status_text_not_color_only"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "dashboard",
  },
  {
    route: "/work",
    requiredStates: ["empty", "partial", "failed", "stale", "conflict", "retryable", "no_action_available"],
    accessibilityAssertions: ["lens_tabs_keyboard_reachable", "bulk_actions_named", "status_regions_announced"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "work_review_queue",
  },
  {
    route: "/contracts",
    requiredStates: ["empty", "loading", "partial", "failed", "retryable"],
    accessibilityAssertions: ["filters_named", "pagination_keyboard_reachable", "large_result_count_visible", "failed_state_announced"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "contract_list",
  },
  {
    route: "/contracts/[id]",
    requiredStates: ["partial", "failed", "not_found", "archived", "deleted", "stale"],
    accessibilityAssertions: ["first_fold_heading", "source_links_named", "audit_region_reachable"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "dashboard",
  },
  {
    route: "/contracts/tasks",
    requiredStates: ["empty", "partial", "failed", "retryable", "no_action_available"],
    accessibilityAssertions: ["task_rows_keyboard_reachable", "status_regions_announced", "bulk_actions_named"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "work_review_queue",
  },
  {
    route: "/contracts/obligations",
    requiredStates: ["empty", "partial", "failed", "retryable", "stale"],
    accessibilityAssertions: ["obligation_actions_named", "status_regions_announced", "keyboard_reachable_primary_action"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "work_review_queue",
  },
  {
    route: "/contracts/review",
    requiredStates: ["empty", "partial", "failed", "stale", "conflict"],
    accessibilityAssertions: ["review_actions_named", "field_status_announced", "keyboard_reachable_primary_action"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "work_review_queue",
  },
  {
    route: "/contracts/renewals",
    requiredStates: ["empty", "partial", "failed", "stale", "no_action_available"],
    accessibilityAssertions: ["renewal_rows_keyboard_reachable", "status_regions_announced", "timeline_heading_named"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "dashboard",
  },
  {
    route: "/contracts/approvals",
    requiredStates: ["empty", "partial", "failed", "retryable", "forbidden"],
    accessibilityAssertions: ["approval_actions_named", "status_regions_announced", "keyboard_reachable_primary_action"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "work_review_queue",
  },
  {
    route: "/contracts/exceptions",
    requiredStates: ["empty", "partial", "failed", "retryable", "hidden_module"],
    accessibilityAssertions: ["exception_actions_named", "status_regions_announced", "keyboard_reachable_primary_action"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "work_review_queue",
  },
  {
    route: "/contracts/evidence-studio",
    requiredStates: ["empty", "partial", "failed", "external_link_expired", "external_link_revoked"],
    accessibilityAssertions: ["evidence_actions_named", "status_regions_announced", "keyboard_reachable_primary_action"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "dashboard",
  },
  {
    route: "/contracts/reports",
    requiredStates: ["empty", "partial", "failed", "retryable", "terminal_failure"],
    accessibilityAssertions: ["report_actions_named", "retry_states_announced", "artifact_expiry_visible"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "report_export",
  },
  {
    route: "/reports",
    requiredStates: ["empty", "failed", "retryable", "terminal_failure", "plan_gated", "mode_gated", "no_action_available"],
    accessibilityAssertions: ["report_actions_named", "retry_states_announced", "artifact_expiry_visible"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "report_export",
  },
  {
    route: "/settings/health",
    requiredStates: ["empty", "partial", "failed", "hidden_module", "dependency_blocked"],
    accessibilityAssertions: ["diagnostics_safe_copy", "recovery_links_named", "status_regions_announced"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "dashboard",
  },
  {
    route: "/settings/product",
    requiredStates: ["forbidden", "hidden_module", "mode_gated", "plan_gated", "stale"],
    accessibilityAssertions: ["settings_controls_named", "status_regions_announced", "keyboard_reachable_primary_action"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "dashboard",
  },
  {
    route: "command_palette",
    requiredStates: ["empty", "partial", "failed", "external_link_expired", "external_link_revoked"],
    accessibilityAssertions: ["dialog_named", "focus_returns_to_trigger", "zero_result_recovery_action"],
    responsiveProfiles: ["mobile", "tablet", "desktop"],
    performanceBudgetKind: "command_palette",
  },
] as const;

export const V10_PERFORMANCE_BUDGETS = {
  core_dashboard_p75_ms: 800,
  core_dashboard_p95_ms: 1500,
  contract_list_p75_ms: 900,
  contract_list_p95_ms: 1800,
  command_palette_first_open_p75_ms: 500,
  command_palette_remote_search_p95_ms: 700,
  work_review_queue_p75_ms: 1000,
  work_review_queue_p95_ms: 2000,
  report_export_async_row_threshold: 50,
  report_export_async_json_bytes_threshold: 2 * 1024 * 1024,
  report_export_async_execution_ms_threshold: 5000,
  contract_list_pagination_threshold_rows: 50,
  visible_row_virtualization_threshold_rows: 100,
  command_palette_debounce_min_ms: 150,
  command_palette_debounce_max_ms: 250,
} as const;

export const V10_BROWSER_DEVICE_PROFILES: readonly V10BrowserDeviceProfile[] = [
  { profile: "chromium_desktop_keyboard_utc", browser: "chromium", device: "desktop", locale: "en-US", timezone: "UTC", inputMode: "keyboard", reducedMotion: false, largeResult: true, degradedNetwork: false },
  { profile: "webkit_mobile_touch_reduced_motion", browser: "webkit", device: "mobile", locale: "en-US", timezone: "America/New_York", inputMode: "touch", reducedMotion: true, largeResult: false, degradedNetwork: true },
  { profile: "firefox_desktop_screen_reader_london", browser: "firefox", device: "desktop", locale: "en-GB", timezone: "Europe/London", inputMode: "screen_reader_keyboard", reducedMotion: true, largeResult: false, degradedNetwork: false },
  { profile: "chromium_tablet_large_result_degraded", browser: "chromium", device: "tablet", locale: "en-US", timezone: "America/New_York", inputMode: "touch", reducedMotion: false, largeResult: true, degradedNetwork: true },
] as const;

export function validateV10UiStateContract(input: {
  state: V10RecoverableUiState;
  reason?: string | null;
  nextActionLabel?: string | null;
  noActionExplanation?: string | null;
  accessibleName?: string | null;
}): string[] {
  const contract = V10_UI_STATE_CONTRACTS.find((row) => row.state === input.state);
  if (!contract) return ["unknown_state"];
  const failures: string[] = [];
  if (contract.requiresReason && !input.reason?.trim()) failures.push("reason_required");
  if (contract.requiresNextActionOrExplanation && !input.nextActionLabel?.trim() && !input.noActionExplanation?.trim()) {
    failures.push("next_action_or_explanation_required");
  }
  if (contract.requiresAccessibleName && !input.accessibleName?.trim()) failures.push("accessible_name_required");
  return failures;
}

export function validateV10RoutePerformanceBudget(input: {
  routeKind: "dashboard" | "contract_list" | "command_palette" | "work_review_queue" | "report_export";
  p95Ms?: number | null;
  rowCount?: number | null;
  jsonBytes?: number | null;
  estimatedExecutionMs?: number | null;
  debounceMs?: number | null;
}): string[] {
  const failures: string[] = [];
  if (input.routeKind === "dashboard" && (input.p95Ms ?? 0) > V10_PERFORMANCE_BUDGETS.core_dashboard_p95_ms) {
    failures.push("dashboard_p95_budget_exceeded");
  }
  if (input.routeKind === "contract_list" && (input.rowCount ?? 0) > V10_PERFORMANCE_BUDGETS.contract_list_pagination_threshold_rows) {
    failures.push("pagination_required");
  }
  if (
    input.routeKind === "command_palette" &&
    ((input.p95Ms ?? 0) > V10_PERFORMANCE_BUDGETS.command_palette_remote_search_p95_ms ||
      (input.debounceMs ?? V10_PERFORMANCE_BUDGETS.command_palette_debounce_min_ms) <
        V10_PERFORMANCE_BUDGETS.command_palette_debounce_min_ms ||
      (input.debounceMs ?? V10_PERFORMANCE_BUDGETS.command_palette_debounce_max_ms) >
        V10_PERFORMANCE_BUDGETS.command_palette_debounce_max_ms)
  ) {
    failures.push("command_palette_budget_exceeded");
  }
  if (input.routeKind === "work_review_queue" && (input.p95Ms ?? 0) > V10_PERFORMANCE_BUDGETS.work_review_queue_p95_ms) {
    failures.push("work_review_queue_p95_budget_exceeded");
  }
  if (
    input.routeKind === "report_export" &&
    ((input.rowCount ?? 0) > V10_PERFORMANCE_BUDGETS.report_export_async_row_threshold ||
      (input.jsonBytes ?? 0) > V10_PERFORMANCE_BUDGETS.report_export_async_json_bytes_threshold ||
      (input.estimatedExecutionMs ?? 0) > V10_PERFORMANCE_BUDGETS.report_export_async_execution_ms_threshold)
  ) {
    failures.push("async_handoff_required");
  }
  return failures;
}

export function validateV10RouteStateMatrix(
  matrix: readonly V10RouteStateMatrixEntry[] = V10_ROUTE_STATE_MATRIX
): string[] {
  const failures: string[] = [];
  for (const entry of matrix) {
    if (!entry.route) failures.push("route_required");
    if (entry.requiredStates.length === 0) failures.push(`${entry.route}:recoverable_state_required`);
    if (!entry.requiredStates.every((state) => V10_UI_STATE_CONTRACTS.some((contract) => contract.state === state))) {
      failures.push(`${entry.route}:unknown_recoverable_state`);
    }
    if (!entry.accessibilityAssertions.some((assertion) => /keyboard|focus|heading|named|announced|dialog/.test(assertion))) {
      failures.push(`${entry.route}:accessibility_assertion_missing`);
    }
    if (!["mobile", "tablet", "desktop"].every((profile) => entry.responsiveProfiles.includes(profile as never))) {
      failures.push(`${entry.route}:responsive_profile_missing`);
    }
  }
  for (const route of [
    "/dashboard",
    "/work",
    "/contracts",
    "/contracts/[id]",
    "/contracts/tasks",
    "/contracts/obligations",
    "/contracts/review",
    "/contracts/renewals",
    "/contracts/approvals",
    "/contracts/exceptions",
    "/contracts/evidence-studio",
    "/contracts/reports",
    "/reports",
    "/settings/health",
    "/settings/product",
    "command_palette",
  ]) {
    if (!matrix.some((entry) => entry.route === route)) failures.push(`route_matrix_missing:${route}`);
  }
  const coveredStates = new Set(matrix.flatMap((entry) => entry.requiredStates));
  for (const state of V10_UI_STATE_CONTRACTS.map((contract) => contract.state)) {
    if (!coveredStates.has(state)) failures.push(`recoverable_state_uncovered:${state}`);
  }
  return failures;
}

export function validateV10VisualRegressionStateContracts(
  contracts: readonly V10VisualRegressionStateContract[] = V10_VISUAL_REGRESSION_STATE_CONTRACTS
): string[] {
  const failures: string[] = [];
  for (const contract of contracts) {
    if (!contract.surface.trim()) failures.push("visual_surface_required");
    if (contract.states.length === 0) failures.push(`${contract.surface}:visual_state_required`);
    for (const state of contract.states) {
      if (!V10_UI_STATE_CONTRACTS.some((uiState) => uiState.state === state)) failures.push(`${contract.surface}:unknown_visual_state:${state}`);
    }
    for (const breakpoint of ["mobile", "tablet", "desktop"] as const) {
      if (!contract.breakpoints.includes(breakpoint)) failures.push(`${contract.surface}:breakpoint_missing:${breakpoint}`);
    }
    if (!contract.reducedMotionCovered) failures.push(`${contract.surface}:reduced_motion_visual_missing`);
    if (!contract.highContrastCovered) failures.push(`${contract.surface}:high_contrast_visual_missing`);
    if (!contract.proofArtifact.trim()) failures.push(`${contract.surface}:visual_proof_artifact_required`);
  }
  for (const required of ["dashboard", "work", "contracts", "contract_record", "command_palette", "report_export", "settings_product", "settings_health"]) {
    if (!contracts.some((contract) => contract.surface === required)) failures.push(`visual_surface_missing:${required}`);
  }
  return failures;
}

export function validateV10RecoverabilityFailureModeMatrix(
  matrix: readonly V10RecoverabilityFailureModeMatrixRow[] = V10_RECOVERABILITY_FAILURE_MODE_MATRIX
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  const requiredModes: readonly V10RecoverabilityFailureMode[] = [
    "retryable_job",
    "terminal_job",
    "stale_mutation_version",
    "empty_state",
    "hidden_feature",
    "expired_external_link",
    "revoked_external_link",
    "async_report_threshold",
    "unsafe_csv_value",
    "provider_outage",
    "read_model_refresh_failure",
    "stale_release_evidence",
    "canary_hold",
    "rollback",
    "no_action_terminal_state",
  ];
  for (const row of matrix) {
    if (seen.has(row.failureMode)) failures.push(`duplicate_failure_mode:${row.failureMode}`);
    seen.add(row.failureMode);
    if (!row.route.trim()) failures.push(`${row.failureMode}:route_required`);
    if (row.route.startsWith("/settings/health#")) {
      const anchor = row.route.split("#")[1] ?? "";
      const renderedHealthAnchors = new Set([
        "read-models",
        "jobs",
        "coverage-ledger",
        "runtime-artifacts",
        "exports",
        "v10-runtime",
        "v10-idempotency",
        "providers",
        "canary",
        "support",
        "rollback",
      ]);
      if (!renderedHealthAnchors.has(anchor)) failures.push(`${row.failureMode}:settings_health_anchor_missing:${anchor}`);
    }
    if (!V10_UI_STATE_CONTRACTS.some((contract) => contract.state === row.state)) failures.push(`${row.failureMode}:state_unknown`);
    failures.push(
      ...validateV10UiStateContract({
        state: row.state,
        reason: row.userReason,
        nextActionLabel: row.nextActionLabel,
        noActionExplanation: row.noActionExplanation,
        accessibleName: `${row.failureMode} recoverability state`,
      }).map((failure) => `${row.failureMode}:${failure}`)
    );
    if (!row.diagnosticId.startsWith("v10_")) failures.push(`${row.failureMode}:diagnostic_id_required`);
    if (!row.auditAction.includes(".")) failures.push(`${row.failureMode}:audit_action_required`);
    if (!row.telemetryObjective.trim()) failures.push(`${row.failureMode}:telemetry_objective_required`);
  }
  for (const mode of requiredModes) {
    if (!seen.has(mode)) failures.push(`failure_mode_missing:${mode}`);
  }
  return failures;
}

export function validateV10BrowserDeviceProfiles(
  profiles: readonly V10BrowserDeviceProfile[] = V10_BROWSER_DEVICE_PROFILES
): string[] {
  const failures: string[] = [];
  for (const browser of ["chromium", "webkit", "firefox"] as const) {
    if (!profiles.some((profile) => profile.browser === browser)) failures.push(`browser_missing:${browser}`);
  }
  for (const device of ["desktop", "tablet", "mobile"] as const) {
    if (!profiles.some((profile) => profile.device === device)) failures.push(`device_missing:${device}`);
  }
  if (!profiles.some((profile) => profile.inputMode === "keyboard")) failures.push("keyboard_profile_missing");
  if (!profiles.some((profile) => profile.inputMode === "screen_reader_keyboard")) failures.push("screen_reader_keyboard_profile_missing");
  if (!profiles.some((profile) => profile.reducedMotion)) failures.push("reduced_motion_profile_missing");
  if (!profiles.some((profile) => profile.largeResult)) failures.push("large_result_profile_missing");
  if (!profiles.some((profile) => profile.degradedNetwork)) failures.push("degraded_network_profile_missing");
  if (!profiles.some((profile) => profile.timezone !== "UTC")) failures.push("non_utc_timezone_profile_missing");
  if (new Set(profiles.map((profile) => profile.profile)).size !== profiles.length) failures.push("duplicate_profile");
  return failures;
}

export function validateV10InteractiveControlA11y(input: V10InteractiveControlA11yAudit): string[] {
  const failures: string[] = [];
  if (!input.accessibleName?.trim()) failures.push("accessible_name_required");
  if (!input.keyboardReachable) failures.push("keyboard_reachable_required");
  if ((input.touchTargetPx ?? 44) < 44) failures.push("touch_target_min_44px_required");
  if (!input.focusReturnTarget?.trim()) failures.push("focus_return_target_required");
  if (!input.reducedMotionSafe) failures.push("reduced_motion_safe_required");
  if (!input.statusTextVisible) failures.push("status_text_required");
  if (input.colorOnlyStatus) failures.push("status_must_not_be_color_only");
  return failures;
}

export function validateV10UxStateMachineCoverage(input: V10UxStateMachineCoverageInput): string[] {
  const failures = validateV10UiStateContract({
    state: input.state,
    reason: input.reason,
    nextActionLabel: input.availableActions[0],
    noActionExplanation: input.availableActions.length === 0 ? input.copy : null,
    accessibleName: input.accessibleName,
  });
  const routeEntry = V10_ROUTE_STATE_MATRIX.find((entry) => entry.route === input.route);
  if (!routeEntry) failures.push("route_matrix_entry_required");
  if (routeEntry && !routeEntry.requiredStates.includes(input.state)) failures.push("route_state_not_declared");
  if (input.availableActions.length > 0 && !input.focusReturnTarget?.trim()) failures.push("focus_return_target_required");
  if (!input.copy?.trim()) failures.push("customer_safe_copy_required");
  if (input.copy && /token|secret|raw contract|customer payload/i.test(input.copy)) failures.push("customer_safe_copy_violation");
  return failures;
}
