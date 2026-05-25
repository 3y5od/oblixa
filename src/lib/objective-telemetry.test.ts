import { describe, expect, it } from "vitest";
import {
  V10_OBJECTIVE_TELEMETRY_CONTRACTS,
  V10_POST_GA_DRIFT_CONTROLS,
  V10_PRODUCT_METRIC_DASHBOARD_MAP,
  V10_REQUIRED_PRODUCT_METRICS,
  V10_SLO_DASHBOARD_EVIDENCE,
  createV10ObjectiveTelemetryPayload,
  getV10ObjectiveTelemetryContract,
  validateV10ProductMetricDashboardMap,
  validateV10PostGaDriftControls,
  validateV10PromotedSloDashboardEvidence,
  validateV10SloDashboardEvidence,
  validateV10TelemetryFields,
  v10ObjectiveAllowsEvidenceSource,
} from "./objective-telemetry";
import { PRODUCT_TELEMETRY_ACTIONS } from "./product-telemetry";

describe("V10 objective telemetry contracts", () => {
  it("maps V10 objectives to dashboard keys and evidence sources", () => {
    expect(V10_OBJECTIVE_TELEMETRY_CONTRACTS.map((contract) => contract.objectiveKey)).toEqual(
      expect.arrayContaining([
        "activation_first_work_item",
        "daily_action_clearance",
        "renewal_prevention",
        "evidence_accountability",
        "search_as_router",
        "empty_state_cta",
      ])
    );
    expect(getV10ObjectiveTelemetryContract("activation_first_work_item")?.dashboardKey).toBe("activation_first_work_item");
  });

  it("keeps evidence sources explicit and privacy-safe", () => {
    expect(v10ObjectiveAllowsEvidenceSource("renewal_prevention", "slo_dashboard")).toBe(true);
    expect(v10ObjectiveAllowsEvidenceSource("search_as_router", "manual_usability_run")).toBe(false);
    expect(v10ObjectiveAllowsEvidenceSource("unknown_objective", "telemetry")).toBe(false);
    expect(new Set(V10_OBJECTIVE_TELEMETRY_CONTRACTS.map((contract) => contract.objectiveKey)).size).toBe(
      V10_OBJECTIVE_TELEMETRY_CONTRACTS.length
    );
    expect(new Set(V10_OBJECTIVE_TELEMETRY_CONTRACTS.map((contract) => contract.dashboardKey)).size).toBe(
      V10_OBJECTIVE_TELEMETRY_CONTRACTS.length
    );
    for (const contract of V10_OBJECTIVE_TELEMETRY_CONTRACTS) {
      expect(contract.privacySafeFields.length).toBeGreaterThan(0);
      expect(validateV10TelemetryFields(contract.privacySafeFields)).toEqual([]);
    }
  });

  it("tracks every required V10 product metric key", () => {
    expect(V10_REQUIRED_PRODUCT_METRICS).toEqual(
      expect.arrayContaining([
        "activation_completion_rate",
        "review_queue_clearance_rate",
        "work_item_completion_rate",
        "report_run_success_rate",
        "export_success_rate",
        "failed_job_retry_success_rate",
      ])
    );
    expect(validateV10TelemetryFields(["duration_ms", "raw_contract_text", "responder_email"])).toEqual([
      "raw_contract_text",
      "responder_email",
    ]);
  });

  it("maps every required product metric to an objective dashboard and allowed evidence source", () => {
    expect(validateV10ProductMetricDashboardMap()).toEqual([]);
    expect(V10_PRODUCT_METRIC_DASHBOARD_MAP.map((row) => row.metricKey)).toEqual(V10_REQUIRED_PRODUCT_METRICS);
    expect(V10_PRODUCT_METRIC_DASHBOARD_MAP.find((row) => row.metricKey === "failed_job_retry_success_rate")).toMatchObject({
      objectiveKey: "report_export_reliability",
      dashboardKey: "post_ga_operational_window",
      evidenceSource: "slo_dashboard",
    });
    expect(
      validateV10ProductMetricDashboardMap([
        {
          metricKey: "activation_completion_rate",
          objectiveKey: "unknown",
          dashboardKey: "",
          evidenceSource: "manual_usability_run",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "activation_completion_rate:objective_unknown",
        "activation_completion_rate:dashboard_key_required",
        "activation_completion_rate:evidence_source_not_allowed",
        "metric_dashboard_missing:upload_to_first_approved_required_field_ms",
      ])
    );
  });


  it("keeps V10 product telemetry event names explicit and unique", () => {
    const v10Actions = PRODUCT_TELEMETRY_ACTIONS.filter((action) => action.startsWith("product.v10."));

    expect(v10Actions).toEqual([
      "product.v10.activation_completed",
      "product.v10.first_work_item_generated",
      "product.v10.work_item_completed",
      "product.v10.renewal_posture_computed",
      "product.v10.evidence_follow_up_scheduled",
      "product.v10.evidence_request_created",
      "product.v10.evidence_submitted",
      "product.v10.report_run_completed",
      "product.v10.export_job_completed",
      "product.v10.command_palette_opened",
      "product.v10.command_palette_recovered",
      "product.v10.command_palette_result_selected",
      "product.v10.command_palette_zero_result",
      "product.v10.empty_state_cta_clicked",
      "product.v10.failed_job_retry_succeeded",
      "product.v10.release_check_recorded",
      "product.v10.review_queue_cleared",
      "product.v10.evidence_review_decision_recorded",
      "product.v10.approval_decision_recorded",
      "product.v10.approval_sla_breached",
      "product.v10.exception_resolution_recorded",
      "product.v10.renewal_checkpoint_completed",
      "product.v10.renewal_checkpoint_reopened",
      "product.v10.renewal_decision_packet_generated",
      "product.v10.import_extraction_failure_rate_sampled",
      "product.v10.contract_record_opened",
      "product.v10.contract_record_trust_viewed",
      "product.v10.field_review_completed",
      "product.v10.review_save_next_used",
    ]);
    expect(new Set(v10Actions).size).toBe(v10Actions.length);
    for (const action of v10Actions) {
      expect(action).toMatch(/^product\.v10\.[a-z0-9_]+$/);
    }
  });

  it("builds objective telemetry payloads from allowlisted safe fields only", () => {
    expect(
      createV10ObjectiveTelemetryPayload("activation_first_work_item", {
        organization_id: "org_1",
        duration_ms: 1200,
        raw_contract_text: "secret",
      })
    ).toEqual({
      payload: { organization_id: "org_1", duration_ms: 1200 },
      droppedFields: ["raw_contract_text"],
    });
    expect(
      createV10ObjectiveTelemetryPayload("unknown_objective", {
        duration_ms: 1200,
        diagnostic_id: "diag_1",
      })
    ).toEqual({
      payload: {},
      droppedFields: ["duration_ms", "diagnostic_id"],
    });
  });

  it("codifies SLO dashboard evidence and alert diagnostics without fabricating URLs", () => {
    expect(validateV10SloDashboardEvidence()).toEqual([]);
    expect(V10_SLO_DASHBOARD_EVIDENCE.map((row) => row.dashboardKey)).toEqual(
      expect.arrayContaining([
        "activation_first_work_item",
        "work_reachability",
        "report_export_reliability",
        "command_palette_router_success",
        "post_ga_operational_window",
      ])
    );
    expect(V10_SLO_DASHBOARD_EVIDENCE.find((row) => row.dashboardKey === "report_export_reliability")).toMatchObject({
      metricKey: "export_success_rate",
      owner: "operations",
      alertThresholds: expect.arrayContaining(["failed_export_rate", "artifact_expiry_backlog"]),
      diagnosticId: "v10_report_export_slo_dashboard",
      dashboardUrl: null,
    });
    expect(V10_SLO_DASHBOARD_EVIDENCE).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dashboardKey: "post_ga_operational_window",
          releaseWindow: "post_ga_7_day",
        }),
        expect.objectContaining({
          dashboardKey: "post_ga_operational_window",
          releaseWindow: "post_ga_30_day",
          diagnosticId: "v10_post_ga_30_day_slo_dashboard",
        }),
      ])
    );
    expect(
      validateV10SloDashboardEvidence([
        {
          dashboardKey: "unknown",
          metricKey: "activation_completion_rate",
          owner: "release",
          releaseWindow: "pre_ga_release_candidate",
          freshnessMinutes: 0,
          alertThresholds: [],
          diagnosticId: "diag",
          dashboardUrl: "http://example.test?token=secret",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "unknown:dashboard_contract_missing",
        "unknown:freshness_required",
        "unknown:alert_threshold_required",
        "unknown:diagnostic_id_required",
        "unknown:dashboard_url_must_be_https_without_secrets",
        "slo_dashboard_missing:activation_first_work_item",
      ])
    );
  });

  it("requires post-GA drift controls for both 7-day and 30-day windows", () => {
    expect(validateV10PostGaDriftControls()).toEqual([]);
    expect(V10_POST_GA_DRIFT_CONTROLS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlKey: "post_ga_operational_reliability",
          windows: ["post_ga_7_day", "post_ga_30_day"],
          releaseEvidenceKeys: expect.arrayContaining([
            "v10-release:post-ga:operational-reliability-7-day",
            "v10-release:post-ga:operational-reliability-30-day",
          ]),
        }),
      ])
    );
    expect(
      validateV10PostGaDriftControls([
        {
          controlKey: "broken",
          metricKeys: ["activation_completion_rate"],
          windows: ["post_ga_7_day"],
          owner: "release",
          alertReviewCadenceHours: 0,
          releaseEvidenceKeys: ["v10-release:objective-metric:activation" as never],
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "broken:post_ga_30_day_required",
        "broken:alert_review_cadence_invalid",
        "broken:post_ga_release_evidence_key_required",
        "post_ga_window_missing:post_ga_30_day",
      ])
    );
  });

  it("requires promotion-grade SLO dashboard evidence to be HTTPS, fresh, and owned", () => {
    expect(
      validateV10PromotedSloDashboardEvidence(
        [
          {
            dashboardKey: "report_export_reliability",
            metricKey: "export_success_rate",
            owner: "operations",
            releaseWindow: "pre_ga_release_candidate",
            freshnessMinutes: 30,
            alertThresholds: ["failed_export_rate"],
            diagnosticId: "v10_report_export_slo_dashboard",
            dashboardUrl: "https://dashboards.example.test/v10/report-export",
            capturedAt: "2026-04-26T21:00:00Z",
            evidenceOwner: "operations",
          },
        ],
        new Date("2026-04-26T21:10:00Z")
      )
    ).toEqual(
      expect.arrayContaining([
        "slo_dashboard_missing:activation_first_work_item",
        "slo_dashboard_missing:work_reachability",
        "slo_dashboard_missing:command_palette_router_success",
      ])
    );
    expect(
      validateV10PromotedSloDashboardEvidence(
        [
          {
            dashboardKey: "report_export_reliability",
            metricKey: "export_success_rate",
            owner: "operations",
            releaseWindow: "pre_ga_release_candidate",
            freshnessMinutes: 30,
            alertThresholds: ["failed_export_rate"],
            diagnosticId: "v10_report_export_slo_dashboard",
            dashboardUrl: "http://dashboards.example.test?token=secret",
            capturedAt: "2026-04-26T20:00:00Z",
            evidenceOwner: "",
          },
        ],
        new Date("2026-04-26T21:00:00Z")
      )
    ).toEqual(
      expect.arrayContaining([
        "report_export_reliability:dashboard_url_must_be_https_without_secrets",
        "report_export_reliability:promoted_dashboard_url_invalid",
        "report_export_reliability:promoted_owner_required",
        "report_export_reliability:dashboard_evidence_stale",
      ])
    );
  });
});
