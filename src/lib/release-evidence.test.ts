import { describe, expect, it } from "vitest";
import {
  applyV10ReleaseGovernanceDecisionToEvidenceGates,
  buildV10NonAutonomousGatePersistenceRows,
  buildV10RuntimeReleaseEvidencePlan,
  buildV10ReleaseCandidateFixturePlan,
  buildV10ReleaseEvidencePersistenceRows,
  buildV10MetricRunsFromObjectiveMeasurements,
  createV10ReleaseCandidateEvidenceBundle,
  evaluateV10ReleasePromotionReadiness,
  evaluateV10ReleasePromotionReadinessFromRows,
  getV10MetricPassRate,
  isV10NonAutonomousGateResolvedForPromotion,
  persistV10ReleaseEvidenceRows,
  promoteV10NonAutonomousEvidenceGate,
  validateV10ExternalEvidenceRecord,
  validateV10FixtureManifest,
  validateV10MetricRun,
  validateV10NonAutonomousEvidenceGateSet,
  validateV10NonAutonomousEvidenceGate,
  validateV10OperatorRunbookContracts,
  validateV10ReleaseCandidateFixturePlan,
  validateV10RuntimeReleaseEvidencePlan,
  validateV10ReleaseGovernanceDecision,
  validateV10ReleaseEvidenceBundle,
  validateV10ReleaseEvidencePersistenceRows,
  validateV10ReleaseEvidencePersistenceTables,
  validateV10VerificationCommandSet,
  validateV10VerificationCommandResult,
  V10_FINAL_VERIFICATION_COMMANDS,
  V10_GA_METRIC_EVIDENCE_REQUIREMENTS,
  V10_RELEASE_EVIDENCE_PERSISTENCE_TABLES,
  V10_NON_AUTONOMOUS_EVIDENCE_GATES,
  V10_OPERATOR_RUNBOOK_CONTRACTS,
  V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS,
  validateV10ReleaseCandidateEvidenceRequirements,
  validateV10ReleasePromotionDecisionRecord,
} from "./release-evidence";
import {
  V10_GA_SAMPLE_SIZES,
  V10_RELEASE_FIXTURE_MINIMUMS,
  V10_SPEC_VERSION,
} from "./release-contract";

describe("V10 release fixture and evidence schemas", () => {
  it("validates release-candidate fixture minimums", () => {
    expect(
      validateV10FixtureManifest({
        spec_version: V10_SPEC_VERSION,
        fixture_version: "fixtures-v10-001",
        generated_at: "2026-04-25T00:00:00Z",
        counts: V10_RELEASE_FIXTURE_MINIMUMS,
      })
    ).toEqual([]);
  });

  it("rejects incomplete fixture evidence", () => {
    expect(
      validateV10FixtureManifest({
        spec_version: V10_SPEC_VERSION,
        fixture_version: "",
        generated_at: "",
        counts: { ...V10_RELEASE_FIXTURE_MINIMUMS, contracts: 1 },
      })
    ).toEqual(expect.arrayContaining(["fixture_minimum_not_met:contracts", "fixture_version_missing", "generated_at_missing"]));
  });

  it("validates fixed denominators and promotable metric evidence", () => {
    expect(
      validateV10MetricRun({
        metric_key: "activation",
        release_state: "beta",
        denominator_lock_id: "lock-1",
        fixed_sample_size: V10_GA_SAMPLE_SIZES.activation,
        pass_count: 80,
        fail_count: 20,
        excluded_count: 0,
        exclusion_reasons: [],
        generated_at: "2026-04-25T00:00:00Z",
        status: "candidate",
      })
    ).toEqual([]);
  });

  it("rejects denominator drift and draft evidence", () => {
    expect(
      validateV10MetricRun({
        metric_key: "command_palette_search",
        release_state: "GA",
        denominator_lock_id: "",
        fixed_sample_size: 100,
        pass_count: 90,
        fail_count: 5,
        excluded_count: 0,
        exclusion_reasons: [],
        generated_at: "2026-04-25T00:00:00Z",
        status: "draft",
      })
    ).toEqual(expect.arrayContaining(["fixed_sample_size_mismatch", "denominator_lock_missing", "sample_accounting_mismatch", "evidence_not_promotable"]));
  });

  it("computes pass rate excluding allowed exclusions", () => {
    expect(
      getV10MetricPassRate({
        metric_key: "export_reliability",
        release_state: "GA",
        denominator_lock_id: "lock-2",
        fixed_sample_size: 100,
        pass_count: 95,
        fail_count: 0,
        excluded_count: 5,
        exclusion_reasons: ["provider_outage_with_retryable_diagnostics"],
        generated_at: "2026-04-25T00:00:00Z",
        status: "promoted",
      })
    ).toBe(1);
    expect(
      getV10MetricPassRate({
        metric_key: "export_reliability",
        release_state: "GA",
        denominator_lock_id: "lock-empty",
        fixed_sample_size: 100,
        pass_count: 0,
        fail_count: 0,
        excluded_count: 100,
        exclusion_reasons: ["release_check_required"],
        generated_at: "2026-04-25T00:00:00Z",
        status: "release_check_required",
      })
    ).toBe(0);
  });

  it("tracks external release evidence without pretending local tests prove it", () => {
    expect(
      validateV10ExternalEvidenceRecord({
        key: "post-ga-dashboard-activation",
        kind: "post_ga_dashboard",
        release_state: "GA",
        owner: "release",
        evidence_url: null,
        captured_at: null,
        expires_at: null,
        status: "draft",
        pending_reason: "Dashboard is created in the release-candidate environment.",
      })
    ).toEqual([]);
    expect(
      validateV10ExternalEvidenceRecord({
        key: "human-usability",
        kind: "human_usability_study",
        release_state: "GA",
        owner: "",
        evidence_url: null,
        captured_at: null,
        expires_at: null,
        status: "promoted",
        pending_reason: null,
      })
    ).toEqual(expect.arrayContaining(["external_owner_missing", "external_evidence_url_missing", "external_captured_at_missing"]));
    expect(
      validateV10ExternalEvidenceRecord(
        {
          key: "post-ga-dashboard-expired",
          kind: "post_ga_dashboard",
          release_state: "GA",
          owner: "release",
          evidence_url: "https://example.test/dashboard",
          captured_at: "2026-04-20T00:00:00Z",
          expires_at: "2026-04-24T00:00:00Z",
          status: "promoted",
          pending_reason: null,
        },
        new Date("2026-04-25T00:00:00Z")
      )
    ).toContain("external_evidence_expired");
  });

  it("requires every fixed metric run in a release evidence bundle", () => {
    const bundleFailures = validateV10ReleaseEvidenceBundle({
      fixture_manifest: {
        spec_version: V10_SPEC_VERSION,
        fixture_version: "fixtures-v10-001",
        generated_at: "2026-04-25T00:00:00Z",
        counts: V10_RELEASE_FIXTURE_MINIMUMS,
      },
      metric_runs: [
        {
          metric_key: "activation",
          release_state: "beta",
          denominator_lock_id: "lock-activation",
          fixed_sample_size: V10_GA_SAMPLE_SIZES.activation,
          pass_count: 80,
          fail_count: 20,
          excluded_count: 0,
          exclusion_reasons: [],
          generated_at: "2026-04-25T00:00:00Z",
          status: "candidate",
        },
      ],
      external_records: [],
    });
    expect(bundleFailures).toContain("metric_run_missing:command_palette_search");
  });

  it("locks release-candidate metric requirements without fabricating local pass results", () => {
    expect(V10_GA_METRIC_EVIDENCE_REQUIREMENTS).toHaveLength(Object.keys(V10_GA_SAMPLE_SIZES).length);
    for (const requirement of V10_GA_METRIC_EVIDENCE_REQUIREMENTS) {
      expect(requirement.fixed_sample_size).toBe(V10_GA_SAMPLE_SIZES[requirement.metric_key]);
      expect(["contract_only", "synthetic_descriptor", "integration_test", "browser_gated"]).toContain(requirement.autonomous_local_proof);
    }
    expect(V10_GA_METRIC_EVIDENCE_REQUIREMENTS.filter((requirement) => requirement.autonomous_local_proof === "integration_test").map((requirement) => requirement.metric_key)).toEqual(
      expect.arrayContaining(["report_reliability", "export_reliability", "renewal_reminders", "evidence_follow_up"])
    );
  });

  it("generates a release-candidate evidence bundle without fabricating metric evidence", () => {
    const bundle = createV10ReleaseCandidateEvidenceBundle({
      fixtureVersion: "rc-2026-04-25",
      generatedAt: "2026-04-25T00:00:00Z",
      releaseState: "complete",
    });

    expect(validateV10ReleaseEvidenceBundle(bundle)).toEqual(
      Object.keys(V10_GA_SAMPLE_SIZES).map((metricKey) => `${metricKey}:evidence_not_promotable`)
    );
    expect(bundle.metric_runs).toHaveLength(Object.keys(V10_GA_SAMPLE_SIZES).length);
    expect(bundle.metric_runs.find((run) => run.metric_key === "activation")).toMatchObject({
      pass_count: 0,
      excluded_count: V10_GA_SAMPLE_SIZES.activation,
      exclusion_reasons: ["release_check_required"],
      status: "release_check_required",
    });
    expect(bundle.external_records.every((record) => record.status === "release_check_required")).toBe(true);
    expect(bundle.external_records.map((record) => record.pending_reason)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("outside this repository"),
        expect.stringContaining("after GA launch"),
        expect.stringContaining("configuration evidence outside this repository"),
        expect.stringContaining("rolling 7-day and 30-day SLO windows"),
      ])
    );
    expect(bundle.external_records.map((record) => record.kind)).toEqual(
      expect.arrayContaining(["human_usability_study", "post_ga_dashboard", "provider_configuration", "operational_slo_window"])
    );
  });

  it("builds a typed RC fixture plan with denominator locks, capture commands, privacy scan, and persistence", () => {
    const plan = buildV10ReleaseCandidateFixturePlan({
      fixtureVersion: "rc-2026-04-25",
      generatedAt: "2026-04-25T00:00:00Z",
      metric: "activation",
    });

    expect(validateV10ReleaseCandidateFixturePlan(plan)).toEqual([]);
    expect(plan.fixture_manifest.counts).toEqual(V10_RELEASE_FIXTURE_MINIMUMS);
    expect(plan.denominator_locks.activation).toBe(`rc-2026-04-25:activation:${V10_GA_SAMPLE_SIZES.activation}`);
    expect(plan.metric_capture_commands).toEqual([
      `npm run check:release-evidence -- --metric activation --lock rc-2026-04-25:activation:${V10_GA_SAMPLE_SIZES.activation}`,
    ]);
    expect(plan.release_evidence_keys).toEqual(["v10-release:objective-metric:activation"]);
    expect(plan.cleanup_command).toBe("npm run check:release-suite-current -- --cleanup-fixture activation");
    expect(
      validateV10ReleaseCandidateFixturePlan({
        ...plan,
        denominator_locks: { ...plan.denominator_locks, activation: "drifted" },
        metric_capture_commands: ["npm run check:release-evidence"],
        release_evidence_keys: [],
        privacy_scan_command: "npm run lint",
        cleanup_command: "npm run check:release-suite-current",
        persistence_required: false,
      })
    ).toEqual(
      expect.arrayContaining([
        "denominator_lock_mismatch:activation",
        "metric_capture_command_invalid",
        "metric_capture_lock_required",
        "evidence_key_capture_count_mismatch",
        "privacy_scan_command_required",
        "cleanup_command_required",
        "persistence_required",
      ])
    );
  });

  it("builds runtime release evidence plan that replaces descriptor fixtures with generated data and protected teardown", () => {
    const plan = buildV10RuntimeReleaseEvidencePlan({
      organizationId: "org_1",
      fixtureVersion: "rc-2026-04-25",
      generatedAt: "2026-04-25T00:00:00Z",
      releaseState: "GA",
      metric: "all",
    });

    expect(validateV10RuntimeReleaseEvidencePlan(plan)).toEqual([]);
    expect(plan.seed_record).toMatchObject({
      organization_id: "org_1",
      generated_data_only: true,
      descriptor_fixture_replaced: true,
      privacy_scan_status: "pending",
      teardown_status: "pending",
    });
    expect(plan.denominator_lock_records).toHaveLength(Object.keys(V10_GA_SAMPLE_SIZES).length);
    expect(plan.metric_run_records.find((run) => run.metric_key === "activation")).toMatchObject({
      denominator_lock_id: `rc-2026-04-25:activation:${V10_GA_SAMPLE_SIZES.activation}`,
      status: "release_check_required",
    });
    expect(plan.privacy_scan_record).toMatchObject({
      scan_command: "npm run check:release-privacy-scan",
      finding_count: 0,
    });
    expect(plan.teardown_record).toMatchObject({
      teardown_key: "v10-release:fixture-teardown:rc-2026-04-25",
      status: "pending",
    });
    expect(plan.persistence_tables).toEqual(V10_RELEASE_EVIDENCE_PERSISTENCE_TABLES.map((table) => table.table));
    expect(plan.synthetic_data_used_for_promotion).toBe(false);
    expect(plan.promoted_evidence_protected).toBe(true);

    expect(
      validateV10RuntimeReleaseEvidencePlan({
        ...plan,
        generated_data_only: false,
        descriptor_fixture_replaced: false,
        promoted_evidence_protected: false,
        seed_record: {
          ...plan.seed_record,
          generated_data_only: false,
          descriptor_fixture_replaced: false,
          privacy_scan_status: "failed",
          teardown_status: "failed",
        },
        privacy_scan_record: {
          ...plan.privacy_scan_record,
          scan_command: "npm run lint",
          finding_count: 1,
        },
        teardown_record: {
          ...plan.teardown_record,
          teardown_key: "fixture-teardown",
          preserved_evidence_keys: [],
        },
        denominator_lock_records: plan.denominator_lock_records.map((record) =>
          record.metric_key === "activation" ? { ...record, denominator_lock_id: "drifted" } : record
        ),
        persistence_tables: ["v10_release_evidence_records"],
      })
    ).toEqual(
      expect.arrayContaining([
        "seed_record:generated_data_only_required",
        "seed_record:descriptor_fixture_replaced_required",
        "seed_record:privacy_scan_failed",
        "seed_record:teardown_failed",
        "generated_data_only_required",
        "descriptor_fixture_replaced_required",
        "promoted_evidence_protected_required",
        "privacy_scan_command_required",
        "privacy_scan_findings_must_be_zero",
        "teardown_key_required",
        "teardown_preserved_evidence_required",
        "denominator_lock_mismatch:activation",
        "persistence_table_missing:v10_fixture_manifests",
      ])
    );
  });

  it("keeps operator runbooks tied to fixture rebuilds, rollback, canary, and post-GA monitoring", () => {
    expect(validateV10OperatorRunbookContracts()).toEqual([]);
    expect(V10_OPERATOR_RUNBOOK_CONTRACTS.map((contract) => contract.key)).toEqual(
      expect.arrayContaining(["rc_fixture_rebuild", "read_model_repair", "provider_outage", "post_ga_slo"])
    );
    expect(V10_OPERATOR_RUNBOOK_CONTRACTS.find((contract) => contract.key === "post_ga_slo")).toMatchObject({
      commands: expect.arrayContaining(["npm run check:release-evidence -- --post-ga 7d"]),
      diagnostics: expect.arrayContaining(["v10_stale_release_evidence"]),
    });
    expect(
      validateV10OperatorRunbookContracts([
        {
          key: "rc_fixture_rebuild",
          owner: "",
          commands: [],
          diagnostics: [],
          rollbackStep: null,
          canaryGate: null,
          postGaMonitor: null,
          supportSafe: false,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "rc_fixture_rebuild:owner_required",
        "rc_fixture_rebuild:command_required",
        "rc_fixture_rebuild:diagnostic_required",
        "rc_fixture_rebuild:rollback_step_required",
        "rc_fixture_rebuild:canary_gate_required",
        "rc_fixture_rebuild:post_ga_monitor_required",
        "rc_fixture_rebuild:support_safe_required",
        "runbook_missing:read_model_repair",
      ])
    );
  });

  it("builds persistence rows and promotion readiness without masking blockers", () => {
    const bundle = createV10ReleaseCandidateEvidenceBundle({
      fixtureVersion: "rc-2026-04-25",
      generatedAt: "2026-04-25T00:00:00Z",
      releaseState: "GA",
    });
    const rows = buildV10ReleaseEvidencePersistenceRows({ organizationId: "org_1", bundle });

    expect(rows).toHaveLength(bundle.metric_runs.length + bundle.external_records.length);
    expect(rows.find((row) => row.evidence_key === "v10-release:objective-metric:activation")).toMatchObject({
      organization_id: "org_1",
      evidence_kind: "release_candidate_metric",
      status: "release_check_required",
      pending_reason: "Metric evidence requires release-check promotion.",
    });
    expect(rows.find((row) => row.evidence_key === "v10-release:objective-metric:activation")?.metadata).toMatchObject({
      metric_key: "activation",
      fixed_sample_size: V10_GA_SAMPLE_SIZES.activation,
      pass_rate: 0,
    });
    expect(validateV10ReleaseEvidencePersistenceRows(rows)).toEqual([]);

    const blocked = evaluateV10ReleasePromotionReadiness({
      releaseState: "GA",
      bundle,
      rollbackReady: false,
      now: new Date("2026-04-25T00:00:00Z"),
    });
    expect(blocked.can_promote).toBe(false);
    expect(blocked.unresolved_metric_keys).toEqual(Object.keys(V10_GA_SAMPLE_SIZES));
    const expectedGaRequirementBlockers = V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS.filter(
      (requirement) =>
        requirement.promotion_blocker &&
        requirement.evidence_kind !== "release_candidate_metric" &&
        requirement.release_state === "GA"
    ).map((requirement) => requirement.key);
    expect(blocked.unresolved_blocker_keys.sort()).toEqual(expect.arrayContaining([...expectedGaRequirementBlockers].sort()));
    expect(blocked.rollback_required).toBe(true);

    const promotedBundle = {
      ...bundle,
      metric_runs: bundle.metric_runs.map((run) => ({
        ...run,
        pass_count: run.fixed_sample_size,
        excluded_count: 0,
        status: "promoted" as const,
      })),
      external_records: [],
    };
    expect(
      evaluateV10ReleasePromotionReadiness({
        releaseState: "beta",
        bundle: promotedBundle,
        gates: [],
        rollbackReady: true,
      }).can_promote
    ).toBe(true);
  });

  it("declares first-class persistence tables for every release evidence artifact family", () => {
    expect(validateV10ReleaseEvidencePersistenceTables()).toEqual([]);
    expect(V10_RELEASE_EVIDENCE_PERSISTENCE_TABLES.map((row) => row.purpose)).toEqual([
      "generic_evidence",
      "fixture_manifest",
      "denominator_lock",
      "metric_run",
      "promotion_decision",
      "waiver",
      "verification_command",
      "external_blocker",
      "fixture_teardown",
    ]);
    for (const table of V10_RELEASE_EVIDENCE_PERSISTENCE_TABLES) {
      expect(table.table).toMatch(/^v10_/);
      expect(table.releaseBlocking).toBe(true);
      expect(table.requiredIndexes.length, table.table).toBeGreaterThan(0);
    }
    expect(
      validateV10ReleaseEvidencePersistenceTables([
        {
          table: "release_waivers",
          purpose: "waiver",
          releaseBlocking: false,
          requiredIndexes: [],
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "release_waivers:v10_table_required",
        "release_waivers:index_required",
        "release_waivers:release_blocking_required",
        "purpose_missing:generic_evidence",
      ])
    );
  });

  it("promotes non-autonomous blockers from external evidence records without waiving them", () => {
    const gate = V10_NON_AUTONOMOUS_EVIDENCE_GATES.find((row) => row.key === "provider_configuration_readiness")!;
    const promoted = promoteV10NonAutonomousEvidenceGate({
      gate,
      approver: "release-owner",
      now: new Date("2026-04-25T00:00:00Z"),
      record: {
        key: "provider_configuration_readiness",
        kind: "provider_configuration",
        release_state: "GA",
        owner: "operations",
        evidence_url: "https://example.test/evidence/provider-readiness",
        captured_at: "2026-04-25T00:00:00Z",
        expires_at: "2026-05-25T00:00:00Z",
        status: "promoted",
        pending_reason: null,
      },
    });

    expect(promoted.failures).toEqual([]);
    expect(promoted.gate).toMatchObject({
      key: "provider_configuration_readiness",
      validation_status: "promoted",
      blocker_reason: null,
      waiver_reason: null,
      approver: "release-owner",
    });
    expect(isV10NonAutonomousGateResolvedForPromotion(promoted.gate)).toBe(true);
    expect(
      promoteV10NonAutonomousEvidenceGate({
        gate,
        approver: "",
        record: {
          key: "wrong-kind",
          kind: "human_usability_study",
          release_state: "GA",
          owner: "product",
          evidence_url: null,
          captured_at: null,
          expires_at: null,
          status: "candidate",
          pending_reason: null,
        },
      }).failures
    ).toEqual(
      expect.arrayContaining([
        "external_record:external_evidence_url_missing",
        "external_record:external_captured_at_missing",
        "approver_required",
        "evidence_kind_mismatch",
        "external_record_not_promoted",
      ])
    );
  });

  it("converts objective measurement runs into persisted release evidence rows", async () => {
    const metricRuns = buildV10MetricRunsFromObjectiveMeasurements({
      releaseState: "GA",
      generatedAt: "2026-04-25T00:00:00Z",
      now: new Date("2026-04-26T00:00:00Z"),
      measurements: [
        {
          metricKey: "activation",
          numeratorCount: V10_GA_SAMPLE_SIZES.activation,
          denominatorCount: V10_GA_SAMPLE_SIZES.activation,
          excludedCount: 0,
          exclusionReasons: [],
          denominatorLockId: "lock:activation",
          capturedAt: "2026-04-25T00:00:00Z",
        },
      ],
    });

    expect(metricRuns.find((run) => run.metric_key === "activation")).toMatchObject({
      status: "promoted",
      denominator_lock_id: "lock:activation",
      pass_count: V10_GA_SAMPLE_SIZES.activation,
    });
    expect(metricRuns.find((run) => run.metric_key === "command_palette_search")).toMatchObject({
      status: "release_check_required",
      excluded_count: V10_GA_SAMPLE_SIZES.command_palette_search,
    });

    const rows = buildV10ReleaseEvidencePersistenceRows({
      organizationId: "org_1",
      bundle: {
        fixture_manifest: {
          spec_version: V10_SPEC_VERSION,
          fixture_version: "fixtures-v10-001",
          generated_at: "2026-04-25T00:00:00Z",
          counts: V10_RELEASE_FIXTURE_MINIMUMS,
        },
        metric_runs: metricRuns,
        external_records: [],
      },
    });
    const upserted: unknown[] = [];
    const result = await persistV10ReleaseEvidenceRows(
      {
        from(table: "v10_release_evidence_records") {
          expect(table).toBe("v10_release_evidence_records");
          return {
            async upsert(nextRows, options) {
              upserted.push(...nextRows);
              expect(options.onConflict).toBe("organization_id,evidence_key,release_state");
              return { error: null };
            },
          };
        },
      },
      rows
    );

    expect(result).toEqual({ ok: true, persisted_count: rows.length, failures: [] });
    expect(upserted).toHaveLength(rows.length);
    expect(rows.find((row) => row.evidence_key === "v10-release:objective-metric:activation")?.metadata).toMatchObject({
      pass_rate: 1,
    });
  });

  it("evaluates promotion readiness from persisted release evidence rows", () => {
    const candidateBundle = createV10ReleaseCandidateEvidenceBundle({
      fixtureVersion: "rc-2026-04-25",
      generatedAt: "2026-04-25T00:00:00Z",
      releaseState: "GA",
    });
    const promotedBundle = {
      ...candidateBundle,
      metric_runs: candidateBundle.metric_runs.map((run) => ({
        ...run,
        pass_count: run.fixed_sample_size,
        excluded_count: 0,
        status: "promoted" as const,
      })),
      external_records: candidateBundle.external_records.map((record) => ({
        ...record,
        evidence_url: `https://example.test/evidence/${record.key.replaceAll(":", "-")}`,
        captured_at: "2026-04-25T00:00:00Z",
        status: "promoted" as const,
        pending_reason: null,
      })),
    };
    const rows = buildV10ReleaseEvidencePersistenceRows({ organizationId: "org_1", bundle: promotedBundle });

    expect(
      evaluateV10ReleasePromotionReadinessFromRows({
        releaseState: "GA",
        rows,
        gates: [],
        rollbackReady: true,
      }).can_promote
    ).toBe(true);
    expect(
      evaluateV10ReleasePromotionReadinessFromRows({
        releaseState: "GA",
        rows: rows.filter((row) => row.evidence_key !== "v10-release:external-blocker:provider-configuration"),
        gates: [],
        rollbackReady: true,
      }).unresolved_blocker_keys
    ).toContain("provider_configuration_rc_review");
  });

  it("fails closed before persisting release evidence rows with private metadata or unsafe URLs", async () => {
    const unsafeRows = [
      {
        organization_id: "org_1",
        evidence_key: "metric:unsafe",
        evidence_kind: "release_candidate_metric" as const,
        release_state: "GA" as const,
        owner: "release",
        evidence_url: "http://example.test?token=secret",
        captured_at: "2026-04-25T00:00:00Z",
        expires_at: null,
        status: "candidate" as const,
        pending_reason: null,
        metadata: {
          raw_contract_text: "private",
          reviewer_email: "person@example.test",
          safe_count: 1,
        },
      },
    ];
    expect(validateV10ReleaseEvidencePersistenceRows(unsafeRows)).toEqual(
      expect.arrayContaining([
        "metric:unsafe:evidence_url_must_be_https_without_secrets",
        "metric:unsafe:metadata_key_not_privacy_safe:raw_contract_text",
        "metric:unsafe:metadata_key_not_privacy_safe:reviewer_email",
        "metric:unsafe:metadata_value_not_privacy_safe:reviewer_email",
      ])
    );
    let upsertCalled = false;
    const result = await persistV10ReleaseEvidenceRows(
      {
        from() {
          return {
            async upsert() {
              upsertCalled = true;
              return { error: null };
            },
          };
        },
      },
      unsafeRows
    );
    expect(result.ok).toBe(false);
    expect(upsertCalled).toBe(false);
  });

  it("requires final verification command capture or explicit blockers", () => {
    const capturedAt = "2026-04-25T00:00:00Z";
    const results = V10_FINAL_VERIFICATION_COMMANDS.map((command) => ({
      ...command,
      status: command.command === "npm run test:e2e:current-product" ? ("skipped" as const) : ("passed" as const),
      output_summary: command.command === "npm run test:e2e:current-product" ? null : `${command.command} passed.`,
      prerequisite: command.command === "npm run test:e2e:current-product" ? "Playwright credentials" : null,
      blocker_reason:
        command.command === "npm run test:e2e:current-product"
          ? "Credentials are unavailable in local automation."
          : null,
      evidence_key: `evidence:${command.command}`,
      captured_at: capturedAt,
    }));

    expect(validateV10VerificationCommandSet(results)).toEqual([]);
    expect(validateV10VerificationCommandSet(results.slice(1))).toContain(
      "verification_command_missing:npm run check:release-suite-current"
    );
  });

  it("fails closed for non-autonomous evidence gates without owner, blocker, mitigation, and approval", () => {
    expect(validateV10NonAutonomousEvidenceGateSet()).toEqual([]);
    expect(V10_NON_AUTONOMOUS_EVIDENCE_GATES.map((gate) => gate.kind)).toEqual(
      expect.arrayContaining([
        "human_usability_study",
        "provider_configuration",
        "canary_review",
        "release_owner_signoff",
        "support_readiness_review",
        "operational_slo_window",
      ])
    );
    expect(
      validateV10NonAutonomousEvidenceGate({
        key: "rc-usability",
        kind: "human_usability_study",
        release_state: "GA",
        owner: "product",
        evidence_needed: "Observed first-time activation sessions.",
        validation_status: "release_check_required",
        release_state_impact: "blocks_GA",
        captured_at: null,
        expires_at: null,
        blocker_reason: "Participant sessions have not run.",
        mitigation: "Keep GA blocked until evidence is attached.",
        approver: null,
        waiver_reason: null,
      })
    ).toEqual([]);
    expect(
      validateV10NonAutonomousEvidenceGate({
        key: "",
        kind: "post_ga_dashboard",
        release_state: "complete",
        owner: "",
        evidence_needed: "",
        validation_status: "promoted",
        release_state_impact: "blocks_complete",
        captured_at: null,
        expires_at: "2026-04-24T00:00:00Z",
        blocker_reason: null,
        mitigation: null,
        approver: null,
        waiver_reason: "ship anyway",
      })
    ).toEqual(
      expect.arrayContaining([
        "gate_key_missing",
        "gate_owner_missing",
        "evidence_needed_missing",
        "captured_at_missing",
        "approver_missing",
        "waiver_requires_approver",
      ])
    );
  });

  it("blocks release promotion when evidence is stale, blockers remain, or rollback is not ready", () => {
    expect(
      validateV10ReleaseGovernanceDecision({
        action: "promote",
        release_state: "GA",
        owner: "release",
        decided_at: "2026-04-25T00:00:00Z",
        evidence_keys: ["rc-metrics"],
        stale_evidence_keys: [],
        unresolved_blocker_keys: [],
        rollback_ready: true,
        waiver_reason: null,
      })
    ).toEqual([]);
    expect(
      validateV10ReleaseGovernanceDecision({
        action: "promote",
        release_state: "GA",
        owner: "release",
        decided_at: "2026-04-25T00:00:00Z",
        evidence_keys: ["rc-metrics"],
        stale_evidence_keys: ["slo-dashboard"],
        unresolved_blocker_keys: ["human-usability"],
        rollback_ready: false,
        waiver_reason: null,
      })
    ).toEqual([
      "promotion_blocked_by_unresolved_blockers",
      "promotion_blocked_by_stale_evidence",
      "promotion_requires_rollback_readiness",
    ]);
  });

  it("allows release-owner waiver decisions to document non-autonomous blocker risk", () => {
    const candidateBundle = createV10ReleaseCandidateEvidenceBundle({
      fixtureVersion: "rc-2026-04-25",
      generatedAt: "2026-04-25T00:00:00Z",
      releaseState: "GA",
    });
    const bundle = {
      ...candidateBundle,
      metric_runs: candidateBundle.metric_runs.map((run) => ({
        ...run,
        pass_count: run.fixed_sample_size,
        excluded_count: 0,
        status: "promoted" as const,
      })),
      external_records: candidateBundle.external_records.map((record) => ({
        ...record,
        evidence_url: `https://example.test/evidence/${record.key.replaceAll(":", "-")}`,
        captured_at: "2026-04-25T00:00:00Z",
        status: "promoted" as const,
        pending_reason: null,
      })),
    };
    const decision = {
      action: "waive" as const,
      release_state: "GA" as const,
      owner: "release-owner",
      decided_at: "2026-04-25T00:00:00Z",
      evidence_keys: ["rc-metrics"],
      stale_evidence_keys: [],
      unresolved_blocker_keys: ["human_usability_sessions", "provider_configuration_readiness"],
      rollback_ready: true,
      waiver_reason: "Accepted for private beta continuation with rollback owner assigned.",
    };

    const result = applyV10ReleaseGovernanceDecisionToEvidenceGates({
      decision,
      gates: V10_NON_AUTONOMOUS_EVIDENCE_GATES.filter((gate) =>
        ["human_usability_sessions", "provider_configuration_readiness"].includes(gate.key)
      ),
    });
    expect(result.failures).toEqual([]);
    expect(result.waived_gate_keys).toEqual(["human_usability_sessions", "provider_configuration_readiness"]);
    expect(result.gates.flatMap((gate) => validateV10NonAutonomousEvidenceGate(gate))).toEqual([]);
    expect(
      evaluateV10ReleasePromotionReadiness({
        releaseState: "GA",
        bundle,
        gates: result.gates,
        rollbackReady: true,
      }).can_promote
    ).toBe(true);

    const rows = buildV10NonAutonomousGatePersistenceRows({ organizationId: "org_1", gates: result.gates });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      evidence_key: "gate:human_usability_sessions",
      status: "candidate",
      pending_reason: expect.stringContaining("Waived by release-owner"),
      metadata: expect.objectContaining({
        waiver_state: "provided",
        approver_state: "provided",
      }),
    });
    expect(buildV10ReleaseEvidencePersistenceRows({ organizationId: "org_1", bundle, gates: result.gates })).toHaveLength(
      bundle.metric_runs.length + bundle.external_records.length + result.gates.length
    );
  });

  it("records command-level verification without hiding skipped or failed gates", () => {
    expect(
      validateV10VerificationCommandResult({
        command: "npm run check:release-suite-current",
        required_for: "focused_v10",
        status: "passed",
        output_summary: "21 files and 109 tests passed.",
        prerequisite: null,
        blocker_reason: null,
        evidence_key: "command_check_v10_suite_2026_04_25",
        captured_at: "2026-04-25T00:00:00Z",
      })
    ).toEqual([]);
    expect(
      validateV10VerificationCommandResult({
        command: "npm run test:e2e:current-product",
        required_for: "e2e",
        status: "skipped",
        output_summary: null,
        prerequisite: "E2E credentials",
        blocker_reason: "Dedicated V10 Playwright test is configured but skipped in local environment.",
        evidence_key: "command_test_e2e_v10_2026_04_25",
        captured_at: "2026-04-25T00:00:00Z",
      })
    ).toEqual([]);
    expect(
      validateV10VerificationCommandResult({
        command: "",
        required_for: "broad_verify",
        status: "failed",
        output_summary: null,
        prerequisite: null,
        blocker_reason: null,
        evidence_key: null,
        captured_at: null,
      })
    ).toEqual(
      expect.arrayContaining([
        "command_required",
        "captured_at_required",
        "failed_output_summary_required",
        "failed_blocker_reason_required",
        "failed_evidence_key_required",
      ])
    );
  });

  it("requires RC, external blocker, and post-GA evidence rows before promotion", () => {
    expect(validateV10ReleaseCandidateEvidenceRequirements()).toEqual([]);
    expect(V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS.map((requirement) => requirement.key)).toEqual(
      expect.arrayContaining([
        "activation_metric_rc_capture",
        "provider_configuration_rc_review",
        "support_readiness_review",
        "post_ga_7_day_dashboard",
        "post_ga_30_day_slo_window",
      ])
    );
    expect(V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS.filter((requirement) => requirement.denominator_lock_required).map((requirement) => requirement.evidence_kind)).toEqual(
      expect.arrayContaining(["release_candidate_metric"])
    );
    expect(
      validateV10ReleaseCandidateEvidenceRequirements([
        {
          key: "bad_post_ga",
          release_state: "GA",
          evidence_kind: "post_ga_dashboard",
          owner: "operations",
          required_runtime_source: "human_review",
          denominator_lock_required: false,
          post_ga_window: "7d",
          promotion_blocker: true,
          persistence_key: "bad" as never,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "bad_post_ga:persistence_key_required",
        "bad_post_ga:post_ga_window_requires_complete_state",
        "bad_post_ga:post_ga_dashboard_source_required",
        "rc_requirement_missing:activation_metric_rc_capture",
      ])
    );
  });

  it("records final promotion decisions with denominator locks, dashboard refs, and blockers", () => {
    expect(
      validateV10ReleasePromotionDecisionRecord({
        release_state: "complete",
        decision: "promoted",
        owner: "release-owner",
        decided_at: "2026-04-25T00:00:00Z",
        evidence_keys: ["v10-release:objective-metric:activation"],
        unresolved_blockers: [],
        denominator_locks: ["v10-rc:activation:100"],
        rollback_ready: true,
        post_ga_dashboard_refs: ["dashboard:7d", "dashboard:30d"],
      })
    ).toEqual([]);
    expect(
      validateV10ReleasePromotionDecisionRecord({
        release_state: "GA",
        decision: "promoted",
        owner: "",
        decided_at: null,
        evidence_keys: [],
        unresolved_blockers: ["provider_configuration_readiness"],
        denominator_locks: [],
        rollback_ready: false,
        post_ga_dashboard_refs: [],
      })
    ).toEqual(
      expect.arrayContaining([
        "promotion_owner_required",
        "promotion_decision_timestamp_required",
        "promotion_evidence_required",
        "promotion_blocked_by_unresolved_blockers",
        "promotion_requires_rollback_readiness",
        "promotion_denominator_locks_required",
      ])
    );
  });
});
