import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  V10_ACCEPTANCE_GATES,
  V10_GA_SAMPLE_SIZES,
  V10_RELEASE_FIXTURE_MINIMUMS,
  V10_RELEASE_STATES,
} from "./v10-release-contract";
import {
  V10_OBJECTIVE_MEASUREMENT_RULES,
  V10_OBJECTIVE_METRIC_CAPTURE_PATHS,
  V10_OBJECTIVE_PROMOTION_EVIDENCE_CAPTURE,
  V10_RC_FIXTURE_CATEGORIES,
  V10_RC_FIXTURE_MANIFESTS,
  V10_RC_METRIC_CAPTURE_PLANS,
  V10_RC_SEEDED_JOURNEYS,
  V10_RC_TEARDOWN_GUARDS,
  V10_SYNTHETIC_METRIC_DESCRIPTORS,
  buildV10ObjectiveEvidenceExportRows,
  canPromoteV10ObjectiveMeasurement,
  getV10DeterministicFixtureSeed,
  getV10ObjectiveMeasurementPassRate,
  getV10ObjectiveMeasurementRule,
  getV10SloDashboardKeyForMetric,
  validateV10ObjectivePromotionEvidenceCapture,
  validateV10RcFixtureCategoryDescriptors,
  validateV10RcFixtureManifestSet,
  validateV10RcMetricCapturePlans,
  validateV10RcSeededJourneys,
  validateV10RcTeardownGuards,
  validateV10ObjectiveMeasurementRun,
  validateV10ObjectiveMetricCapturePaths,
  validateV10SyntheticMetricDescriptors,
} from "./v10-objective-measurements";

describe("V10 objective and release evidence contracts", () => {
  it("locks GA metric denominators to the specification", () => {
    expect(V10_GA_SAMPLE_SIZES).toEqual({
      activation: 100,
      command_palette_search: 200,
      report_reliability: 100,
      export_reliability: 100,
      renewal_reminders: 100,
      evidence_follow_up: 100,
      work_reachability: 200,
      contract_record_trust: 50,
      recoverability: 50,
      usability_participants: 20,
      scripted_first_time_activation_sessions: 100,
    });
  });

  it("keeps the release-candidate fixture minimums machine readable", () => {
    expect(V10_RELEASE_FIXTURE_MINIMUMS.core_workspaces).toBe(5);
    expect(V10_RELEASE_FIXTURE_MINIMUMS.advanced_workspaces).toBe(3);
    expect(V10_RELEASE_FIXTURE_MINIMUMS.assurance_workspaces).toBe(3);
    expect(V10_RELEASE_FIXTURE_MINIMUMS.export_jobs).toBe(10);
  });

  it("separates beta, GA, and complete release evidence", () => {
    expect(V10_RELEASE_STATES[0]).toMatchObject({ state: "beta", requiredPriorities: ["P0"] });
    expect(V10_RELEASE_STATES[1].requiredPriorities).toContain("P1");
    expect(V10_RELEASE_STATES[2].requiredPriorities).toContain("included P2");
  });

  it("keeps every acceptance gate represented", () => {
    expect(V10_ACCEPTANCE_GATES).toEqual([
      "activation",
      "work",
      "contract_record",
      "review_data_quality",
      "renewal",
      "evidence",
      "approval_exception",
      "search",
      "reporting",
      "workspace_governance",
      "reliability",
      "security_privacy",
      "accessibility",
      "performance",
      "data_contract",
      "objective_measurement",
    ]);
  });

  it("defines numerator, denominator, exclusion, freeze, rerun, stale, and promotion rules for every metric", () => {
    expect(V10_OBJECTIVE_MEASUREMENT_RULES.map((rule) => rule.metricKey)).toEqual(Object.keys(V10_GA_SAMPLE_SIZES));
    for (const rule of V10_OBJECTIVE_MEASUREMENT_RULES) {
      expect(rule.numerator.length).toBeGreaterThan(10);
      expect(rule.denominator.length).toBeGreaterThan(10);
      expect(rule.fixedSampleSize).toBe(V10_GA_SAMPLE_SIZES[rule.metricKey]);
      expect(rule.sampleFreezeRequired).toBe(true);
      expect(rule.allowedExclusions.length).toBeGreaterThan(0);
    }
    expect(getV10ObjectiveMeasurementRule("usability_participants")).toMatchObject({
      rerunRule: "new_window_required",
      fixedSampleSize: 20,
      promotionThreshold: 0.9,
    });
  });

  it("validates objective measurement runs before promotion", () => {
    const passing = {
      metricKey: "activation" as const,
      numeratorCount: 95,
      denominatorCount: V10_GA_SAMPLE_SIZES.activation,
      excludedCount: 0,
      exclusionReasons: [],
      denominatorLockId: "fixtures-v10:activation:100",
      capturedAt: "2026-04-25T00:00:00Z",
    };
    expect(validateV10ObjectiveMeasurementRun(passing, new Date("2026-04-26T00:00:00Z"))).toEqual([]);
    expect(getV10ObjectiveMeasurementPassRate(passing)).toBe(0.95);
    expect(canPromoteV10ObjectiveMeasurement(passing, new Date("2026-04-26T00:00:00Z"))).toBe(true);
    expect(
      validateV10ObjectiveMeasurementRun(
        {
          ...passing,
          denominatorCount: 99,
          denominatorLockId: "",
          exclusionReasons: ["unsupported_reason"],
          capturedAt: "2026-01-01T00:00:00Z",
          rerunOfLockId: "different-lock",
        },
        new Date("2026-04-26T00:00:00Z")
      )
    ).toEqual(
      expect.arrayContaining([
        "denominator_not_fixed_sample_size",
        "denominator_lock_missing",
        "exclusion_not_allowed:unsupported_reason",
        "rerun_denominator_changed",
        "measurement_evidence_stale",
      ])
    );
    expect(
      validateV10ObjectiveMeasurementRun(
        {
          ...passing,
          numeratorCount: 0,
          excludedCount: 1,
          exclusionReasons: [],
        },
        new Date("2026-04-26T00:00:00Z")
      )
    ).toContain("exclusion_reason_missing");
    expect(
      getV10ObjectiveMeasurementPassRate({
        ...passing,
        numeratorCount: 0,
        excludedCount: V10_GA_SAMPLE_SIZES.activation,
        exclusionReasons: ["provider_outage_with_retryable_diagnostics"],
      })
    ).toBe(0);
    expect(canPromoteV10ObjectiveMeasurement({ ...passing, numeratorCount: 89 }, new Date("2026-04-26T00:00:00Z"))).toBe(false);
    expect(getV10DeterministicFixtureSeed("activation")).toBe("v10:activation:100:pre_ga_release_candidate:0");
    expect(buildV10ObjectiveEvidenceExportRows([passing], new Date("2026-04-26T00:00:00Z"))).toEqual([
      {
        metric_key: "activation",
        denominator_lock_id: "fixtures-v10:activation:100",
        fixed_sample_size: 100,
        numerator_count: 95,
        denominator_count: 100,
        excluded_count: 0,
        pass_rate: 0.95,
        can_promote: true,
        exclusion_reasons: [],
        captured_at: "2026-04-25T00:00:00Z",
        evidence_command: "npm run check:v10-release-evidence -- --metric activation --lock fixtures-v10:activation:100",
        deterministic_seed: "v10:activation:100:pre_ga_release_candidate:0",
      },
    ]);
  });

  it("builds reproducible RC fixture manifests for every launch metric", () => {
    expect(validateV10RcFixtureManifestSet()).toEqual([]);
    expect(V10_RC_FIXTURE_MANIFESTS).toHaveLength(Object.keys(V10_GA_SAMPLE_SIZES).length);
    expect(V10_RC_FIXTURE_MANIFESTS.map((manifest) => manifest.metricKey)).toEqual(Object.keys(V10_GA_SAMPLE_SIZES));
    expect(V10_RC_FIXTURE_MANIFESTS.find((manifest) => manifest.metricKey === "activation")).toMatchObject({
      fixtureId: "v10-rc-activation",
      denominatorLockId: "v10-rc:activation:100",
      sampleSize: V10_GA_SAMPLE_SIZES.activation,
      generatedDataOnly: true,
    });
    expect(
      validateV10RcFixtureManifestSet([
        {
          fixtureId: "bad",
          metricKey: "activation",
          denominatorLockId: "wrong",
          sampleSize: 1,
          rebuildCommand: "node fixture.js",
          cleanupCommand: "",
          privacyScanCommand: "node scan.js",
          checksum: "missing",
          generatedDataOnly: false,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "activation:sample_size_mismatch",
        "activation:denominator_lock_mismatch",
        "activation:rebuild_command_missing",
        "activation:cleanup_command_missing",
        "activation:privacy_scan_missing",
        "activation:checksum_missing",
        "activation:generated_data_only_required",
        "fixture_manifest_missing:command_palette_search",
      ])
    );
  });

  it("defines autonomous fixture categories without production or private data", () => {
    expect(validateV10RcFixtureCategoryDescriptors()).toEqual([]);
    expect(V10_RC_FIXTURE_CATEGORIES.map((category) => category.category)).toEqual(
      expect.arrayContaining([
        "empty_core_workspace",
        "large_core_workspace",
        "advanced_decisions_campaigns_relationships",
        "assurance_findings_controls_automation",
        "privacy_redaction_cases",
        "adversarial_route_cases",
      ])
    );
    expect(V10_RC_FIXTURE_CATEGORIES.every((category) => category.generatedDataOnly && category.privacyScanRequired)).toBe(true);
    expect(
      validateV10RcFixtureCategoryDescriptors([
        {
          category: "empty_core_workspace",
          sourceShape: "",
          minimumRecords: 0,
          generatedDataOnly: false,
          privacyScanRequired: false,
          resetBehavior: "truncate_fixture_scope",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "empty_core_workspace:source_shape_missing",
        "empty_core_workspace:minimum_records_required",
        "empty_core_workspace:generated_data_only_required",
        "empty_core_workspace:privacy_scan_required",
        "fixture_category_missing:large_core_workspace",
      ])
    );
  });

  it("maps each objective metric to fixture descriptors and locked exclusion accounting", () => {
    expect(validateV10SyntheticMetricDescriptors()).toEqual([]);
    expect(V10_SYNTHETIC_METRIC_DESCRIPTORS).toHaveLength(Object.keys(V10_GA_SAMPLE_SIZES).length);
    expect(V10_SYNTHETIC_METRIC_DESCRIPTORS.find((descriptor) => descriptor.metricKey === "usability_participants")).toMatchObject({
      localEvidenceState: "human_study_required",
      sampleLockPolicy: "fixed_denominator",
    });
    expect(V10_SYNTHETIC_METRIC_DESCRIPTORS.find((descriptor) => descriptor.metricKey === "command_palette_search")?.fixtureCategories).toEqual(
      expect.arrayContaining(["advanced_decisions_campaigns_relationships", "assurance_findings_controls_automation", "privacy_redaction_cases"])
    );
    expect(V10_SYNTHETIC_METRIC_DESCRIPTORS.find((descriptor) => descriptor.metricKey === "evidence_follow_up")).toMatchObject({
      localEvidenceState: "integration_test_backed",
      fixtureCategories: expect.arrayContaining(["evidence_lifecycle_states", "degraded_core_workspace"]),
    });
    expect(V10_SYNTHETIC_METRIC_DESCRIPTORS.every((descriptor) => descriptor.localEvidenceState !== "synthetic_descriptor_only")).toBe(
      true
    );
    for (const proofPath of [
      "src/app/api/evidence/requests/route.test.ts",
      "src/app/api/evidence/[id]/[action]/route.test.ts",
      "src/app/api/cron/v4/evidence-followup/route.test.ts",
    ]) {
      expect(existsSync(join(process.cwd(), proofPath)), proofPath).toBe(true);
    }
    expect(
      validateV10SyntheticMetricDescriptors([
        {
          metricKey: "activation",
          fixedSampleSize: 1,
          fixtureCategories: ["not_a_category" as never],
          launchWindow: "post_ga_30_day",
          sampleLockPolicy: "fixed_denominator",
          exclusionAccounting: [],
          localEvidenceState: "synthetic_descriptor_only",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "activation:fixed_sample_size_mismatch",
        "activation:launch_window_mismatch",
        "activation:denominator_lock_accounting_required",
        "activation:unknown_fixture_category:not_a_category",
        "activation:synthetic_descriptor_not_promotable",
        "synthetic_metric_descriptor_missing:command_palette_search",
      ])
    );
  });

  it("defines seeded RC journeys with denominator locks, metric capture, and protected teardown", () => {
    expect(validateV10RcSeededJourneys()).toEqual([]);
    expect(V10_RC_SEEDED_JOURNEYS.map((journey) => journey.acceptanceGate)).toEqual(
      expect.arrayContaining(["activation", "work", "contract_record", "renewal", "search"])
    );
    expect(V10_RC_SEEDED_JOURNEYS.find((journey) => journey.journeyKey === "first_activation_to_work_item")).toMatchObject({
      fixtureCategories: expect.arrayContaining(["empty_core_workspace", "missing_fields"]),
      metricKeys: expect.arrayContaining(["activation", "scripted_first_time_activation_sessions"]),
      requiredArtifacts: expect.arrayContaining(["denominator_lock", "metric_run", "teardown_report"]),
    });

    expect(validateV10RcMetricCapturePlans()).toEqual([]);
    expect(V10_RC_METRIC_CAPTURE_PLANS).toHaveLength(Object.keys(V10_GA_SAMPLE_SIZES).length);
    expect(V10_RC_METRIC_CAPTURE_PLANS.find((plan) => plan.metricKey === "activation")).toMatchObject({
      denominatorLockId: "v10-rc:activation:100",
      promotedEvidenceProtected: true,
    });

    expect(validateV10RcTeardownGuards()).toEqual([]);
    expect(V10_RC_TEARDOWN_GUARDS.every((guard) => guard.protectsPromotedEvidence && guard.preservesDenominatorLocks)).toBe(true);
  });

  it("links objective captures to denominator locks, SLO dashboards, and promotion evidence", () => {
    expect(validateV10ObjectivePromotionEvidenceCapture()).toEqual([]);
    expect(V10_OBJECTIVE_PROMOTION_EVIDENCE_CAPTURE).toHaveLength(Object.keys(V10_GA_SAMPLE_SIZES).length);
    expect(getV10SloDashboardKeyForMetric("command_palette_search")).toBe("command_palette_router_success");
    expect(V10_OBJECTIVE_PROMOTION_EVIDENCE_CAPTURE.find((row) => row.metricKey === "activation")).toMatchObject({
      fixtureManifestId: "v10-rc-activation",
      denominatorLockId: "v10-rc:activation:100",
      fixedSampleSize: V10_GA_SAMPLE_SIZES.activation,
      sloDashboardKey: "activation_first_work_item",
      releaseEvidenceKey: "v10-release:objective:activation",
    });
    expect(
      validateV10ObjectivePromotionEvidenceCapture([
        {
          metricKey: "activation",
          fixtureManifestId: "wrong",
          denominatorLockId: "wrong",
          fixedSampleSize: 1,
          allowedExclusionCount: 0,
          captureCommand: "node capture.js",
          sloDashboardKey: "unknown",
          releaseEvidenceKey: "objective:activation",
          promotionRule: "manual",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "activation:fixed_sample_size_mismatch",
        "activation:denominator_lock_mismatch",
        "activation:fixture_manifest_mismatch",
        "activation:exclusion_policy_mismatch",
        "activation:capture_command_incomplete",
        "activation:slo_dashboard_missing",
        "activation:release_evidence_key_required",
        "activation:promotion_rule_mismatch",
        "promotion_capture_missing:command_palette_search",
      ])
    );
  });

  it("maps every objective to a runtime capture path and persisted measurement record", () => {
    expect(validateV10ObjectiveMetricCapturePaths()).toEqual([]);
    expect(V10_OBJECTIVE_METRIC_CAPTURE_PATHS).toHaveLength(Object.keys(V10_GA_SAMPLE_SIZES).length);
    expect(V10_OBJECTIVE_METRIC_CAPTURE_PATHS.find((path) => path.metricKey === "activation")).toMatchObject({
      captureSource: "activation_runtime",
      sampleSplit: expect.arrayContaining(["50_upload_activations", "50_import_activations"]),
      persistedMeasurementRecord: "v10-release:objective-metric:activation",
    });
    expect(V10_OBJECTIVE_METRIC_CAPTURE_PATHS.find((path) => path.metricKey === "export_reliability")?.sampleSplit).toEqual(
      expect.arrayContaining(["20_truncated_exports", "20_large_exports"])
    );
    expect(
      validateV10ObjectiveMetricCapturePaths([
        {
          metricKey: "activation",
          captureSource: "activation_runtime",
          denominatorLockId: "wrong",
          fixedSampleSize: 1,
          sampleSplit: [],
          persistedMeasurementRecord: "bad" as never,
          releaseEvidenceCommand: "npm run check:v10-release-evidence",
          requiredRuntimeArtifacts: [],
          exclusionPolicy: "fixed_denominator_with_allowed_exclusions",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "activation:denominator_lock_mismatch",
        "activation:fixed_sample_size_mismatch",
        "activation:sample_split_required",
        "activation:persisted_measurement_record_required",
        "activation:release_evidence_command_required",
        "activation:runtime_artifacts_required",
        "metric_capture_path_missing:command_palette_search",
      ])
    );
  });

  it("rejects unsafe RC journey, capture, and teardown descriptors", () => {
    expect(
      validateV10RcSeededJourneys([
        {
          journeyKey: "bad",
          acceptanceGate: "activation",
          fixtureCategories: ["not_a_fixture" as never],
          metricKeys: [],
          requiredArtifacts: ["audit_event"],
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "bad:unknown_fixture_category:not_a_fixture",
        "bad:metric_required",
        "bad:artifact_required:denominator_lock",
        "bad:artifact_required:metric_run",
        "bad:artifact_required:teardown_report",
        "seeded_journey_gate_missing:work",
      ])
    );
    expect(
      validateV10RcMetricCapturePlans([
        {
          metricKey: "activation",
          denominatorLockId: "wrong",
          fixtureVersion: "wrong",
          captureCommand: "node capture.js",
          teardownCommand: "node teardown.js",
          promotedEvidenceProtected: false,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "activation:capture_lock_mismatch",
        "activation:fixture_version_mismatch",
        "activation:capture_command_incomplete",
        "activation:teardown_command_missing",
        "activation:promoted_evidence_protection_required",
        "metric_capture_plan_missing:command_palette_search",
      ])
    );
    expect(
      validateV10RcTeardownGuards([
        {
          guardKey: "unsafe",
          protectsPromotedEvidence: false,
          preservesDenominatorLocks: false,
          deletesFixtureRowsOnly: false,
          auditAction: "unsafe",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "unsafe:promoted_evidence_protection_required",
        "unsafe:denominator_lock_preservation_required",
        "unsafe:fixture_scope_only_required",
        "unsafe:audit_action_required",
        "teardown_guard_missing:preserve_promoted_release_evidence",
      ])
    );
  });
});
