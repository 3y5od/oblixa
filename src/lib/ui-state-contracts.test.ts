import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  V10_ACCESSIBILITY_CONTRACTS,
  V10_BACKGROUND_REFRESH_PRESERVATION,
  V10_BROWSER_DEVICE_PROFILES,
  V10_PERFORMANCE_BUDGETS,
  V10_RECOVERABILITY_FAILURE_MODE_MATRIX,
  V10_RESPONSIVE_CONTRACTS,
  V10_ROUTE_STATE_MATRIX,
  V10_UI_STATE_CONTRACTS,
  V10_VISUAL_REGRESSION_STATE_CONTRACTS,
  validateV10BrowserDeviceProfiles,
  validateV10InteractiveControlA11y,
  validateV10RecoverabilityFailureModeMatrix,
  validateV10RoutePerformanceBudget,
  validateV10RouteStateMatrix,
  validateV10UiStateContract,
  validateV10UxStateMachineCoverage,
  validateV10VisualRegressionStateContracts,
} from "./ui-state-contracts";

describe("V10 UI state, accessibility, and performance contracts", () => {
  it("requires reasons and next actions for recoverable states", () => {
    expect(V10_UI_STATE_CONTRACTS).toHaveLength(20);
    expect(new Set(V10_UI_STATE_CONTRACTS.map((contract) => contract.state)).size).toBe(V10_UI_STATE_CONTRACTS.length);
    expect(validateV10UiStateContract({ state: "failed", accessibleName: "Failed job" })).toEqual([
      "reason_required",
      "next_action_or_explanation_required",
    ]);
    expect(
      validateV10UiStateContract({
        state: "plan_gated",
        reason: "Advanced reports require an Advanced plan.",
        nextActionLabel: "Open billing",
        accessibleName: "Plan required",
      })
    ).toEqual([]);
    expect(
      validateV10UiStateContract({
        state: "loading",
        noActionExplanation: "Loading current V10 state.",
        accessibleName: "Loading",
      })
    ).toEqual([]);
    expect(
      validateV10UiStateContract({
        state: "no_action_available",
        reason: "The current role cannot change this item.",
        noActionExplanation: "Request access from an admin.",
        accessibleName: "No action available",
      })
    ).toEqual([]);
    expect(
      validateV10UiStateContract({
        state: "stale",
        reason: "The read model is older than the source write.",
        nextActionLabel: "Refresh",
        accessibleName: "Stale work state",
      })
    ).toEqual([]);
    expect(
      validateV10UiStateContract({
        state: "external_link_revoked",
        reason: "This evidence link was revoked.",
        noActionExplanation: "Ask the requester for a new link.",
        accessibleName: "Evidence link revoked",
      })
    ).toEqual([]);
    for (const contract of V10_UI_STATE_CONTRACTS) {
      expect(
        validateV10UiStateContract({
          state: contract.state,
          reason: contract.requiresReason ? `Recoverable ${contract.state} state.` : null,
          noActionExplanation: "The current V10 state is visible and recoverable.",
          accessibleName: `${contract.state} state`,
        }),
        contract.state
      ).toEqual([]);
    }
  });

  it("keeps accessibility contracts explicit", () => {
    expect(V10_ACCESSIBILITY_CONTRACTS).toContain("focus_returns_after_modals_drawers_mobile_nav_and_command_palette");
    expect(V10_ACCESSIBILITY_CONTRACTS).toContain(
      "keyboard_completion_for_upload_import_review_work_evidence_approvals_exceptions_command_palette_settings"
    );
    expect(V10_ACCESSIBILITY_CONTRACTS).toContain("color_is_not_the_only_status_signal");
    expect(V10_RESPONSIVE_CONTRACTS).toContain("primary_actions_remain_reachable_without_hover");
    expect(V10_BACKGROUND_REFRESH_PRESERVATION).toEqual(
      expect.arrayContaining(["in_progress_form_input", "selected_rows", "keyboard_focus"])
    );
  });

  it("anchors runtime accessibility hooks for reduced motion, loading announcements, error regions, and focus return", () => {
    const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const loading = readFileSync(join(process.cwd(), "src/components/ui/segment-loading.tsx"), "utf8");
    const recoverableState = readFileSync(join(process.cwd(), "src/components/ui/recoverable-state.tsx"), "utf8");
    const commandPalette = readFileSync(join(process.cwd(), "src/components/layout/command-palette.tsx"), "utf8");
    const sidebar = readFileSync(join(process.cwd(), "src/components/layout/sidebar.tsx"), "utf8");

    expect(globalsCss).toContain("prefers-reduced-motion");
    expect(globalsCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ui-skeleton[\s\S]*animation:\s*none/);
    expect(loading).toContain('role="status"');
    expect(loading).toContain('aria-live="polite"');
    expect(loading).toContain('aria-busy="true"');
    expect(recoverableState).toContain('role={isUrgentState ? "alert" : "status"}');
    expect(recoverableState).toContain('aria-live={isUrgentState ? "assertive" : "polite"}');
    expect(commandPalette).toContain("openButtonRef.current?.focus()");
    expect(commandPalette).toContain('aria-label="Command palette"');
    expect(sidebar).toContain("mobileOpenButtonRef.current?.focus()");
    expect(sidebar).toContain('aria-label="Navigation drawer"');
  });

  it("keeps visual regression coverage tied to recoverable states, breakpoints, and contrast modes", () => {
    expect(validateV10VisualRegressionStateContracts()).toEqual([]);
    expect(V10_VISUAL_REGRESSION_STATE_CONTRACTS.map((contract) => contract.surface)).toEqual(
      expect.arrayContaining(["dashboard", "work", "contracts", "contract_record", "command_palette", "report_export", "settings_product", "settings_health"])
    );
    expect(
      validateV10VisualRegressionStateContracts([
        {
          surface: "dashboard",
          states: ["failed"],
          breakpoints: ["desktop"],
          reducedMotionCovered: false,
          highContrastCovered: false,
          proofArtifact: "",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "dashboard:breakpoint_missing:mobile",
        "dashboard:breakpoint_missing:tablet",
        "dashboard:reduced_motion_visual_missing",
        "dashboard:high_contrast_visual_missing",
        "dashboard:visual_proof_artifact_required",
        "visual_surface_missing:work",
      ])
    );
  });

  it("validates interactive control accessibility, focus, touch, and reduced-motion contracts", () => {
    expect(
      validateV10InteractiveControlA11y({
        accessibleName: "Retry failed import",
        keyboardReachable: true,
        touchTargetPx: 44,
        focusReturnTarget: "failed-import-row",
        reducedMotionSafe: true,
        statusTextVisible: true,
        colorOnlyStatus: false,
      })
    ).toEqual([]);
    expect(
      validateV10InteractiveControlA11y({
        accessibleName: "",
        keyboardReachable: false,
        touchTargetPx: 32,
        focusReturnTarget: "",
        reducedMotionSafe: false,
        statusTextVisible: false,
        colorOnlyStatus: true,
      })
    ).toEqual([
      "accessible_name_required",
      "keyboard_reachable_required",
      "touch_target_min_44px_required",
      "focus_return_target_required",
      "reduced_motion_safe_required",
      "status_text_required",
      "status_must_not_be_color_only",
    ]);
  });

  it("covers primary routes with recoverable, accessible, responsive state matrices", () => {
    expect(validateV10RouteStateMatrix()).toEqual([]);
    expect(V10_ROUTE_STATE_MATRIX.map((entry) => entry.route)).toEqual(
      expect.arrayContaining([
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
        "/contracts/bulk",
        "/contracts/reports",
        "/reports",
        "/settings/health",
        "command_palette",
      ])
    );
    expect(V10_ROUTE_STATE_MATRIX.find((entry) => entry.route === "/work")?.requiredStates).toEqual(
      expect.arrayContaining(["empty", "partial", "stale", "conflict", "retryable", "no_action_available"])
    );
    expect(V10_ROUTE_STATE_MATRIX.find((entry) => entry.route === "/contracts")?.requiredStates).toEqual(
      expect.arrayContaining(["empty", "partial", "failed", "retryable"])
    );
    expect(V10_ROUTE_STATE_MATRIX.find((entry) => entry.route === "/contracts/bulk")?.accessibilityAssertions).toEqual(
      expect.arrayContaining(["upload_controls_named", "import_history_keyboard_reachable", "failed_state_announced"])
    );
    expect(V10_ROUTE_STATE_MATRIX.find((entry) => entry.route === "/contracts")?.accessibilityAssertions).toContain(
      "failed_state_announced"
    );
    expect(new Set(V10_ROUTE_STATE_MATRIX.flatMap((entry) => entry.requiredStates)).size).toBe(V10_UI_STATE_CONTRACTS.length);
    expect(
      validateV10RouteStateMatrix([
        {
          route: "/broken",
          requiredStates: [],
          accessibilityAssertions: ["color_only"],
          responsiveProfiles: ["desktop"],
          performanceBudgetKind: "dashboard",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "/broken:recoverable_state_required",
        "/broken:accessibility_assertion_missing",
        "/broken:responsive_profile_missing",
        "route_matrix_missing:/dashboard",
        "recoverable_state_uncovered:empty",
      ])
    );
  });

  it("validates UX state-machine render coverage, actions, focus return, and customer-safe copy", () => {
    expect(
      validateV10UxStateMachineCoverage({
        route: "/reports",
        state: "plan_gated",
        availableActions: ["Open billing"],
        reason: "Reports require a Core plan.",
        copy: "Upgrade or ask an admin to enable reports.",
        focusReturnTarget: "reports-primary-action",
        accessibleName: "Reports plan required",
      })
    ).toEqual([]);
    expect(
      validateV10UxStateMachineCoverage({
        route: "/reports",
        state: "deleted",
        availableActions: ["Restore"],
        reason: "",
        copy: "Show raw contract token.",
        accessibleName: "",
      })
    ).toEqual(
      expect.arrayContaining([
        "reason_required",
        "accessible_name_required",
        "route_state_not_declared",
        "focus_return_target_required",
        "customer_safe_copy_violation",
      ])
    );
  });

  it("maps every required failure mode to recoverable UI, diagnostics, audit, and telemetry", () => {
    expect(validateV10RecoverabilityFailureModeMatrix()).toEqual([]);
    expect(V10_RECOVERABILITY_FAILURE_MODE_MATRIX.map((row) => row.failureMode)).toEqual([
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
    ]);
    expect(V10_RECOVERABILITY_FAILURE_MODE_MATRIX.find((row) => row.failureMode === "stale_release_evidence")).toMatchObject({
      route: "/settings/health#v10-runtime",
      state: "stale",
    });
    expect(V10_RECOVERABILITY_FAILURE_MODE_MATRIX.find((row) => row.failureMode === "retryable_job")).toMatchObject({
      state: "retryable",
      nextActionLabel: "Retry failed job",
      diagnosticId: "v10_retryable_job_recovery",
      auditAction: "job.retry_requested",
    });
    expect(V10_RECOVERABILITY_FAILURE_MODE_MATRIX.find((row) => row.failureMode === "no_action_terminal_state")).toMatchObject({
      state: "no_action_available",
      noActionExplanation: "The state is visible for audit and support review only.",
    });
    expect(
      validateV10RecoverabilityFailureModeMatrix([
        {
          failureMode: "retryable_job",
          route: "",
          state: "retryable",
          userReason: "",
          diagnosticId: "diag",
          nextActionLabel: null,
          noActionExplanation: null,
          auditAction: "retry",
          telemetryObjective: "",
        },
      ] as never)
    ).toEqual(
      expect.arrayContaining([
        "retryable_job:route_required",
        "retryable_job:reason_required",
        "retryable_job:next_action_or_explanation_required",
        "retryable_job:diagnostic_id_required",
        "retryable_job:audit_action_required",
        "retryable_job:telemetry_objective_required",
        "failure_mode_missing:terminal_job",
      ])
    );
  });

  it("keeps numeric performance budgets codified", () => {
    expect(V10_PERFORMANCE_BUDGETS.core_dashboard_p75_ms).toBe(800);
    expect(V10_PERFORMANCE_BUDGETS.command_palette_remote_search_p95_ms).toBe(700);
    expect(V10_PERFORMANCE_BUDGETS.report_export_async_json_bytes_threshold).toBe(2 * 1024 * 1024);
    expect(V10_PERFORMANCE_BUDGETS.contract_list_pagination_threshold_rows).toBe(50);
    expect(V10_PERFORMANCE_BUDGETS.command_palette_debounce_min_ms).toBe(150);
    expect(V10_PERFORMANCE_BUDGETS.command_palette_debounce_max_ms).toBe(250);
    expect(validateV10RoutePerformanceBudget({ routeKind: "command_palette", p95Ms: 800, debounceMs: 100 })).toEqual([
      "command_palette_budget_exceeded",
    ]);
    expect(validateV10RoutePerformanceBudget({ routeKind: "report_export", rowCount: 51 })).toEqual([
      "async_handoff_required",
    ]);
    expect(validateV10RoutePerformanceBudget({ routeKind: "report_export", estimatedExecutionMs: 5001 })).toEqual([
      "async_handoff_required",
    ]);
    expect(validateV10RoutePerformanceBudget({ routeKind: "dashboard", p95Ms: 1501 })).toEqual([
      "dashboard_p95_budget_exceeded",
    ]);
    expect(validateV10RoutePerformanceBudget({ routeKind: "work_review_queue", p95Ms: 2001 })).toEqual([
      "work_review_queue_p95_budget_exceeded",
    ]);
    expect(validateV10RoutePerformanceBudget({ routeKind: "contract_list", rowCount: 51 })).toEqual([
      "pagination_required",
    ]);
  });

  it("covers browser, device, locale, timezone, reduced-motion, large-result, and degraded-network profiles", () => {
    expect(validateV10BrowserDeviceProfiles()).toEqual([]);
    expect(V10_BROWSER_DEVICE_PROFILES.map((profile) => profile.browser)).toEqual(
      expect.arrayContaining(["chromium", "webkit", "firefox"])
    );
    expect(V10_BROWSER_DEVICE_PROFILES.map((profile) => profile.device)).toEqual(
      expect.arrayContaining(["desktop", "tablet", "mobile"])
    );
    expect(V10_BROWSER_DEVICE_PROFILES.some((profile) => profile.inputMode === "screen_reader_keyboard")).toBe(true);
    expect(V10_BROWSER_DEVICE_PROFILES.some((profile) => profile.reducedMotion)).toBe(true);
    expect(V10_BROWSER_DEVICE_PROFILES.some((profile) => profile.degradedNetwork)).toBe(true);
    expect(validateV10BrowserDeviceProfiles([])).toEqual(
      expect.arrayContaining(["browser_missing:chromium", "device_missing:mobile", "keyboard_profile_missing"])
    );
  });
});
