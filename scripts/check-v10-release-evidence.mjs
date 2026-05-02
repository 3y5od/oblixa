#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REQUIRED_V10_INDEXES } from "./lib/v10-required-indexes.mjs";

const root = process.cwd();
const V10_OBJECTIVE_METRICS = [
  "activation",
  "command_palette_search",
  "report_reliability",
  "export_reliability",
  "renewal_reminders",
  "evidence_follow_up",
  "work_reachability",
  "contract_record_trust",
  "recoverability",
  "usability_participants",
  "scripted_first_time_activation_sessions",
];
const V10_OBJECTIVE_SAMPLE_SIZES = {
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
};

function readOption(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? "";
}

const metricCapture = readOption("--metric");
const postGaWindow = readOption("--post-ga");
if (postGaWindow != null) {
  const allowedWindows = new Set(["7d", "30d"]);
  if (!allowedWindows.has(postGaWindow)) {
    console.error(`Unknown V10 post-GA evidence window: ${postGaWindow}`);
    process.exit(1);
  }
  const captureDocumented = process.env.V10_POST_GA_EVIDENCE_CAPTURE_OK === "1";
  if (captureDocumented) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "post_ga_capture_path_documented",
          window: postGaWindow,
          status: "operator_attested",
          generatedDataOnly: false,
          syntheticDataUsedForPromotion: false,
          persistenceMode: "runtime_evidence_required",
          requiredEvidence: [
            "SLO dashboard URL captured from production telemetry",
            "Metric window export persisted to v10_release_evidence_records",
            "External blocker review completed for provider and support incidents",
          ],
          operatorNote:
            "Set V10_POST_GA_EVIDENCE_CAPTURE_OK=1 only after persisting dashboard URLs and evidence rows per docs/v10-ops-runbook.md.",
        },
        null,
        2
      )
    );
    process.exit(0);
  }
  console.log(
    JSON.stringify(
      {
        ok: false,
        mode: "post_ga_runtime_dashboard_required",
        window: postGaWindow,
        status: "release_check_required",
        generatedDataOnly: false,
        syntheticDataUsedForPromotion: false,
        requiredEvidence: [
          "SLO dashboard URL captured from production telemetry",
          "Metric window export persisted to v10_release_evidence_records",
          "External blocker review completed for provider and support incidents",
        ],
        persistenceMode: "runtime_evidence_required",
      },
      null,
      2
    )
  );
  process.exit(1);
}

const externalBlockersOption = readOption("--external-blockers");
if (externalBlockersOption != null) {
  const blockers = externalBlockersOption
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => entry !== "none");
  console.log(
    JSON.stringify(
      {
        ok: blockers.length === 0,
        mode: "external_blocker_review",
        blockers,
        status: blockers.length === 0 ? "clear" : "blocked",
        generatedDataOnly: false,
        syntheticDataUsedForPromotion: false,
        persistenceMode: "release_evidence_records_required",
        requiredFollowUp: blockers.map((blocker) => ({
          blocker,
          evidenceKey: `v10-release:external-blocker:${blocker}`,
          action: "persist_owner_resolution_before_promotion",
        })),
      },
      null,
      2
    )
  );
  process.exit(blockers.length === 0 ? 0 : 1);
}

const runtimePlanFixture = readOption("--runtime-plan");
if (runtimePlanFixture != null) {
  const fixtureVersion = runtimePlanFixture || "v10-rc-runtime";
  const metricOption = readOption("--metric") ?? "all";
  const metrics = metricOption === "all" ? V10_OBJECTIVE_METRICS : V10_OBJECTIVE_METRICS.includes(metricOption) ? [metricOption] : null;
  if (!metrics) {
    console.error(`Unknown V10 objective metric for runtime plan: ${metricOption}`);
    process.exit(1);
  }
  const denominatorLocks = Object.fromEntries(
    V10_OBJECTIVE_METRICS.map((metric) => [metric, `${fixtureVersion}:${metric}:${V10_OBJECTIVE_SAMPLE_SIZES[metric]}`])
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "runtime_release_evidence_plan",
        fixtureVersion,
        seedRecord: {
          fixtureVersion,
          seedStatus: "planned",
          generatedDataOnly: true,
          descriptorFixtureReplaced: true,
          privacyScanStatus: "pending",
          teardownStatus: "pending",
        },
        denominatorLocks,
        metricCaptureCommands: metrics.map(
          (metric) => `npm run check:v10-release-evidence -- --metric ${metric} --lock ${denominatorLocks[metric]}`
        ),
        persistenceTables: [
          "v10_fixture_manifests",
          "v10_denominator_locks",
          "v10_metric_runs",
          "v10_release_evidence_records",
          "v10_promotion_decisions",
          "v10_verification_command_results",
          "v10_external_blocker_records",
          "v10_fixture_teardown_records",
        ],
        privacyScanCommand: "npm run check:v10-privacy-scan",
        teardownCommand: `npm run check:v10-suite -- --cleanup-fixture ${metricOption}`,
        syntheticDataUsedForPromotion: false,
        promotedEvidenceProtected: true,
        persistenceMode: "granular_runtime_tables_required",
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (metricCapture != null) {
  const metricCaptureMetrics =
    metricCapture === "all" ? V10_OBJECTIVE_METRICS : V10_OBJECTIVE_METRICS.includes(metricCapture) ? [metricCapture] : null;
  if (!metricCaptureMetrics) {
    console.error(`Unknown V10 objective metric: ${metricCapture}`);
    process.exit(1);
  }
  const denominatorLock = readOption("--lock");
  const metricRows = metricCaptureMetrics.map((metric) => {
    const fixedSampleSize = V10_OBJECTIVE_SAMPLE_SIZES[metric];
    const expectedLock = `v10-rc:${metric}:${fixedSampleSize}`;
    return {
      metric,
      fixedSampleSize,
      expectedLock,
      denominatorLockId: metricCapture === "all" && denominatorLock === "all" ? expectedLock : denominatorLock,
    };
  });
  for (const row of metricRows) {
    if (row.denominatorLockId !== row.expectedLock) {
      console.error(
        `V10 metric capture lock mismatch for ${row.metric}: expected ${row.expectedLock}, received ${row.denominatorLockId ?? "missing"}`
      );
      process.exit(1);
    }
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        metric: metricCapture,
        metrics: metricCaptureMetrics,
        releaseState: metricCaptureMetrics.includes("usability_participants") ? "GA" : "beta",
        denominatorLocks: Object.fromEntries(metricRows.map((row) => [row.metric, row.denominatorLockId])),
        sampleSizes: Object.fromEntries(metricRows.map((row) => [row.metric, row.fixedSampleSize])),
        status: "release_check_required",
        releaseEvidenceRows: metricRows.map((row) => ({
          evidenceKey: `v10-release:objective-metric:${row.metric}`,
          metricKey: row.metric,
          denominatorLockId: row.denominatorLockId,
          fixedSampleSize: row.fixedSampleSize,
          status: "release_check_required",
          promotionRule: "must_be_captured_in_release_candidate_workspace_before_promotion",
        })),
        generatedDataOnly: false,
        syntheticDataUsedForPromotion: false,
        runtimeCaptureRequired: true,
        persistenceMode: "release_evidence_command_backed",
        promotionBlockedUntil: "release_candidate_environment_capture",
        privacyScanCommand: `npm run check:v10-privacy-scan -- --privacy-scan ${metricCapture}`,
      },
      null,
      2
    )
  );
  process.exit(0);
}

const privacyScanMetric = readOption("--privacy-scan");
if (privacyScanMetric != null) {
  const privacyScanMetrics =
    privacyScanMetric === "all" ? V10_OBJECTIVE_METRICS : V10_OBJECTIVE_METRICS.includes(privacyScanMetric) ? [privacyScanMetric] : null;
  if (!privacyScanMetrics) {
    console.error(`Unknown V10 objective metric for privacy scan: ${privacyScanMetric}`);
    process.exit(1);
  }
  const scannedFiles = [
    "src/lib/v10-objective-measurements.ts",
    "src/lib/v10-objective-telemetry.ts",
    "src/lib/v10-release-evidence.ts",
    "src/lib/v10-readiness-scorecard.ts",
    "src/lib/v10-read-model-refresh.ts",
    "src/lib/product-telemetry.ts",
    "src/actions/product-telemetry.ts",
  ];
  const forbidden = [/customer[_ -]?email/i, /raw[_ -]?contract[_ -]?text/i, /responder[_ -]?email/i];
  const findings = [];
  const isAllowedRedactionStateLine = (line) =>
    /_state\b/.test(line) && /("provided"|"redacted"|"not_provided")/.test(line);
  const isAllowedPrivacyFixtureLine = (line) => line.includes("privacy_redaction_cases");
  const isAllowedPrivacyGuardrailLine = (line) =>
    line.includes("V10_TELEMETRY_FORBIDDEN_DETAIL_KEY_RE") ||
    line.includes("FORBIDDEN_AUDIT_METADATA_KEY_RE") ||
    (/raw_contract_text/.test(line) && /signed_url/.test(line) && /file_url/.test(line));
  for (const metric of privacyScanMetrics) {
    for (const relative of scannedFiles) {
      const content = readFileSync(join(root, relative), "utf8");
      const lines = content.split(/\r?\n/);
      for (const [index, line] of lines.entries()) {
        for (const pattern of forbidden) {
          if (
            pattern.test(line) &&
            !isAllowedPrivacyFixtureLine(line) &&
            !isAllowedRedactionStateLine(line) &&
            !isAllowedPrivacyGuardrailLine(line)
          ) {
            findings.push(`${metric}:${relative}:${index + 1}:${pattern.source}`);
          }
        }
      }
    }
  }
  if (findings.length > 0) {
    console.error(`V10 privacy scan failed for ${privacyScanMetric}: ${findings.join(", ")}`);
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        metrics: privacyScanMetrics,
        scan: "v10_synthetic_fixture_privacy",
        generatedDataOnly: true,
        scannedFiles,
      },
      null,
      2
    )
  );
  process.exit(0);
}

const requiredFiles = [
  "src/lib/v10-release-contract.ts",
  "src/lib/v10-release-evidence.ts",
  "src/lib/v10-traceability-ledger.ts",
  "src/lib/v10-operational-contracts.ts",
  "src/lib/v10-domain-depth-contracts.ts",
  "src/lib/v10-status-action-vocabulary.ts",
  "src/lib/v10-readiness-scorecard.ts",
  "src/lib/v10-hardening-contracts.ts",
  "src/lib/v10-route-api-catalog.ts",
  "src/lib/v10-autonomous-coverage.ts",
  "src/lib/v10-objective-telemetry.ts",
  "src/lib/v10-final-gap-audit.ts",
  "src/lib/v10-no-exclusions-matrix.ts",
  "src/lib/v10-zero-exclusion-report.ts",
  "src/lib/v10-source-object-inventory.ts",
  "src/lib/v10-core-workflow-contracts.ts",
  "src/lib/product-telemetry.ts",
  "src/lib/v10-server-contracts.ts",
  "src/lib/v10-implementation-checklist.ts",
  "scripts/check-v10-inventory-lock.mjs",
  "scripts/check-v10-migration-smoke.mjs",
  "scripts/rebuild-v10-read-models.mjs",
  "docs/v10.md",
  "docs/v10-ops-runbook.md",
  "supabase/migrations/057_v10_runtime_contracts.sql",
  "e2e/v10-core-smoke.spec.ts",
  "semgrep/oblixa-v10-surface.yml",
];

const failures = [];

function collectTextFiles(dir, out) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git" || entry.name === "coverage") continue;
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTextFiles(absolute, out);
      continue;
    }
    if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) out.push(absolute);
  }
}

for (const relative of requiredFiles) {
  const absolute = join(root, relative);
  if (!existsSync(absolute)) failures.push(`missing:${relative}`);
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!packageJson.scripts?.["check:v10-suite"]?.includes("scripts/check-v10-suite.mjs")) {
  failures.push("missing:check:v10-suite");
}
if (!packageJson.scripts?.["check:v10-inventory-lock"]?.includes("scripts/check-v10-inventory-lock.mjs")) {
  failures.push("missing:check:v10-inventory-lock");
}
if (!packageJson.scripts?.["check:v10-zero-exclusion-report"]?.includes("src/lib/v10-zero-exclusion-report.v10.test.ts")) {
  failures.push("missing:check:v10-zero-exclusion-report");
}
if (!packageJson.scripts?.["check:v10-privacy-scan"]?.includes("--privacy-scan all")) {
  failures.push("missing:check:v10-privacy-scan-all");
}
if (!packageJson.scripts?.["check:v10-migration-smoke"]?.includes("scripts/check-v10-migration-smoke.mjs")) {
  failures.push("missing:check:v10-migration-smoke");
}
if (!packageJson.scripts?.["rebuild:v10-read-models"]?.includes("scripts/rebuild-v10-read-models.mjs")) {
  failures.push("missing:rebuild:v10-read-models");
}
if (!packageJson.scripts?.["test:e2e:v10"]?.includes("@v10")) {
  failures.push("missing:test:e2e:v10");
}
if (!packageJson.scripts?.["test:e2e:smoke"]?.includes("e2e/v10-core-smoke.spec.ts")) {
  failures.push("missing:test:e2e:smoke-v10-core");
}

const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
for (const token of [
  "semgrep/oblixa-v10-surface.yml",
  "npm run check:v10-inventory-lock",
  "npm run check:v10-suite",
  "npm run check:v10-complete-closure",
  "npm run check:v10-zero-exclusion-report",
  "npm run check:v10-release-evidence",
  "npm run check:v10-privacy-scan",
  "npm run test:e2e:v10",
]) {
  if (!ci.includes(token)) failures.push(`missing-ci-v10-token:${token}`);
}

const v10Semgrep = readFileSync(join(root, "semgrep/oblixa-v10-surface.yml"), "utf8");
if (v10Semgrep.includes("severity: WARNING")) failures.push("v10-semgrep-warning-severity");
if ((v10Semgrep.match(/severity: ERROR/g) ?? []).length < 2) failures.push("v10-semgrep-error-severity-missing");

const ledger = readFileSync(join(root, "src/lib/v10-traceability-ledger.ts"), "utf8");
for (const id of ["mutation-rollout", "traceability-ledger", "vocabulary-copy-catalog", "error-budget-audit-immutability", "component-contracts"]) {
  if (!ledger.includes(`"${id}"`)) failures.push(`missing-ledger-id:${id}`);
}

const surfacePipeline = readFileSync(join(root, "scripts/pipelines/pipeline-surface-suite.mjs"), "utf8");
if (!surfacePipeline.includes('"check:v10-suite"')) failures.push("missing-surface-pipeline:v10-suite");
const v10SuiteScript = readFileSync(join(root, "scripts/check-v10-suite.mjs"), "utf8");
if (v10SuiteScript.includes('persistenceMode: "descriptor_only"') || v10SuiteScript.includes("persistentRowsWritten: 0")) {
  failures.push("descriptor-only-rc-fixture-command");
}
if (!v10SuiteScript.includes("releaseEvidenceRows") || !v10SuiteScript.includes("persistentRowsRequired")) {
  failures.push("missing-rc-fixture-persistence-rows");
}
if (!v10SuiteScript.includes("generatedDataOnly: true") || !v10SuiteScript.includes("fixtureSafetyPolicy")) {
  failures.push("missing-rc-fixture-generated-data-safety");
}
const releaseEvidenceScript = readFileSync(join(root, "scripts/check-v10-release-evidence.mjs"), "utf8");
if (!releaseEvidenceScript.includes('metricCapture === "all"') || !releaseEvidenceScript.includes('denominatorLock === "all"')) {
  failures.push("missing-all-objective-metric-capture");
}
for (const token of ["--post-ga", "--external-blockers", "runtimeCaptureRequired", "syntheticDataUsedForPromotion"]) {
  if (!releaseEvidenceScript.includes(token)) failures.push(`missing-release-evidence-runtime-token:${token}`);
}
const migrationSmokeScript = readFileSync(join(root, "scripts/check-v10-migration-smoke.mjs"), "utf8");
for (const token of [
  "V10_MIGRATION_SMOKE_DATABASE_URL",
  "V10_MIGRATION_SMOKE_ALLOW_MUTATING_DATABASE",
  "--set",
  "ON_ERROR_STOP=1",
  "--single-transaction",
  "release_check_required",
]) {
  if (!migrationSmokeScript.includes(token)) failures.push(`missing-v10-migration-smoke-token:${token}`);
}

const mutationEnvelope = readFileSync(join(root, "src/lib/v10-mutation-envelope.ts"), "utf8");
for (const token of [
  '["assign_work_item_owner", "work_item", "work_item", true, true, true, "src/actions/tasks.ts"]',
  '["bulk_assign_compatible_work_items", "work_item", "work_item", true, true, true, "src/actions/tasks.ts", "v10_bulk_mutation_envelope"]',
]) {
  if (!mutationEnvelope.includes(token)) failures.push(`missing-v10-work-mutation-contract:${token}`);
}
const taskActions = readFileSync(join(root, "src/actions/tasks.ts"), "utf8");
for (const token of [
  "assignWorkItemOwner",
  "bulkAssignCompatibleContractTasks",
  "completeWorkItem",
  "executeV10IdempotentMutation",
  'mutationName: "assign_work_item_owner"',
  'mutationName: "bulk_assign_compatible_work_items"',
  'mutationName: "complete_work_item"',
  'action: "work_item.owner_changed"',
  'action: "work_item.bulk_owner_changed"',
  'action: "work_item.completed"',
]) {
  if (!taskActions.includes(token)) failures.push(`missing-v10-work-mutation-runtime:${token}`);
}

const evidence = readFileSync(join(root, "src/lib/v10-release-evidence.ts"), "utf8");
for (const symbol of [
  "V10ExternalEvidenceRecord",
  "V10_GA_METRIC_EVIDENCE_REQUIREMENTS",
  "release_check_required",
  "validateV10ReleaseEvidenceBundle",
  "createV10ReleaseCandidateEvidenceBundle",
  "V10VerificationCommandResult",
  "validateV10VerificationCommandResult",
  "V10_FINAL_VERIFICATION_COMMANDS",
  "validateV10VerificationCommandSet",
  "V10_NON_AUTONOMOUS_EVIDENCE_GATES",
  "validateV10NonAutonomousEvidenceGateSet",
  "validateV10ReleaseEvidencePersistenceRows",
  "V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS",
  "validateV10ReleaseCandidateEvidenceRequirements",
  "V10ReleasePromotionDecisionRecord",
  "validateV10ReleasePromotionDecisionRecord",
]) {
  if (!evidence.includes(symbol)) failures.push(`missing-release-evidence-symbol:${symbol}`);
}

const readModels = readFileSync(join(root, "src/lib/v10-read-models.ts"), "utf8");
for (const symbol of ["V10AuditEventReadModel", "V10NotificationDeliveryReadModel", "V10ReportRunVisibilityReadModel"]) {
  if (!readModels.includes(symbol)) failures.push(`missing-read-model-symbol:${symbol}`);
}

const autonomousCoverage = readFileSync(join(root, "src/lib/v10-autonomous-coverage.ts"), "utf8");
for (const symbol of [
  "V10_AUTONOMOUS_COVERAGE_CONTRACTS",
  "summarizeV10CoverageByStatus",
  "classifyV10CoveragePromotionState",
  "validateV10AutonomousCoveragePromotion",
  "release_check_required",
  "environment_gated",
  "blocked_with_reason",
]) {
  if (!autonomousCoverage.includes(symbol)) failures.push(`missing-autonomous-coverage-symbol:${symbol}`);
}

const finalGapAudit = readFileSync(join(root, "src/lib/v10-final-gap-audit.ts"), "utf8");
for (const symbol of [
  "V10_OBJECTIVE_METRIC_CAPTURE_PATHS",
  "validateV10ObjectiveMetricCapturePaths",
  "50_upload_activations",
  "20_truncated_exports",
]) {
  const objectiveMeasurements = readFileSync(join(root, "src/lib/v10-objective-measurements.ts"), "utf8");
  if (!objectiveMeasurements.includes(symbol)) failures.push(`missing-objective-measurement-symbol:${symbol}`);
}

for (const symbol of [
  "V10_WORK_SOURCE_ACTION_MATRIX",
  "V10_JOB_CLASS_MATRIX",
  "V10_COMMAND_QUERY_SAMPLE_SET",
  "V10_AUDIT_VOCABULARY_TAXONOMY",
  "V10_REQUIRED_SOURCE_INVENTORY_CATEGORIES",
  "V10_REQUIRED_FILE_OWNERSHIP_AREAS",
  "V10_REQUIRED_COMPATIBILITY_BOUNDARIES",
  "V10_REQUIRED_PROOF_DIMENSIONS",
  "validateV10FinalGapAudit",
  "validateV10Phase0InventoryLock",
]) {
  if (!finalGapAudit.includes(symbol)) failures.push(`missing-final-gap-audit-symbol:${symbol}`);
}
for (const category of [
  "page",
  "component",
  "api_route",
  "api_contract",
  "server_action",
  "cron",
  "database_table",
  "migration",
  "read_model",
  "telemetry_event",
  "audit_action",
  "report_family",
  "job_class",
  "notification_class",
  "release_artifact",
  "script",
  "ci_workflow",
  "semgrep_rule",
  "fixture",
  "external_evidence_gate",
  "runbook",
  "environment_config",
  "support_boundary",
  "verification_matrix",
]) {
  if (!finalGapAudit.includes(`"${category}"`)) failures.push(`no_unclassified_v10_artifact:missing-category:${category}`);
}
for (const phaseId of [
  "phase-0-inventory-lock",
  "phase-0-baseline",
  "phase-1-read-models",
  "phase-2-security",
  "phase-3-mutations",
  "phase-4-core-surfaces",
  "phase-5-domain-workflows",
  "phase-6-routing-reporting",
  "phase-7-ops-governance",
  "phase-8-p1-p2",
  "phase-9-ui-quality",
  "phase-10-release",
  "phase-11-post-ga-drift",
  "phase-12-api-env-integrations",
  "phase-13-data-lifecycle-compliance",
  "phase-14-verification-matrix",
]) {
  if (!finalGapAudit.includes(`"${phaseId}"`)) failures.push(`no_unclassified_v10_artifact:missing-phase:${phaseId}`);
}

const noExclusionsMatrix = readFileSync(join(root, "src/lib/v10-no-exclusions-matrix.ts"), "utf8");
for (const symbol of [
  "buildV10NoExclusionsMatrix",
  "validateV10NoExclusionsMatrix",
  "V10NoExclusionsMatrixRow",
  "compatibility_boundary",
  "objective_metric",
  "external_evidence_gate",
  "release_evidence_required",
]) {
  if (!noExclusionsMatrix.includes(symbol)) failures.push(`missing-no-exclusions-matrix-symbol:${symbol}`);
}

const advancedAssuranceContinuity = readFileSync(join(root, "src/lib/v10-advanced-assurance-continuity.ts"), "utf8");
for (const symbol of [
  "V10_ADVANCED_ASSURANCE_CONTINUITY_SIGNALS",
  "validateV10AdvancedAssuranceContinuitySignals",
  "V10_P2_STRETCH_BEHAVIOR_CONTRACTS",
  "validateV10P2StretchBehaviorContracts",
  "predictive_scoring",
  "custom_work_item_types",
]) {
  if (!advancedAssuranceContinuity.includes(symbol)) failures.push(`missing-advanced-assurance-continuity-symbol:${symbol}`);
}

const operationalContracts = readFileSync(join(root, "src/lib/v10-operational-contracts.ts"), "utf8");
for (const symbol of [
  "V10_SETTINGS_HEALTH_RECOVERY_ANCHORS",
  "V10_OPS_RELEASE_READINESS_CONTRACTS",
  "V10_OPERATOR_RUNBOOKS",
  "V10_OPERATIONAL_RUNBOOK_COVERAGE",
  "validateV10OperationalRunbookCoverage",
  "V10_QUALITY_MATRIX",
  "validateV10QualityMatrix",
  "V10_FINAL_CUTOVER_CHECKLIST",
  "validateV10FinalCutoverChecklist",
  "validateV10DisasterRecoveryDrill",
  "validateV10CanaryControlDecision",
  "rollback_repair",
]) {
  if (!operationalContracts.includes(symbol)) failures.push(`missing-operational-contract-symbol:${symbol}`);
}

const settingsHealthPage = readFileSync(join(root, "src/app/(dashboard)/settings/health/page.tsx"), "utf8");
for (const anchor of ["v10-runtime", "mutations", "artifacts", "providers", "canary", "support", "rollback"]) {
  if (!settingsHealthPage.includes(`id={anchor}`) && !settingsHealthPage.includes(`id="${anchor}"`)) {
    failures.push(`missing-settings-health-anchor:${anchor}`);
  }
}

const sourceObjectInventory = readFileSync(join(root, "src/lib/v10-source-object-inventory.ts"), "utf8");
for (const symbol of [
  "V10_SOURCE_OBJECT_INVENTORY",
  "V10SourceObjectInventoryRow",
  "validateV10SourceObjectInventory",
  "getV10SourceObjectInventoryRow",
]) {
  if (!sourceObjectInventory.includes(symbol)) failures.push(`missing-source-object-inventory-symbol:${symbol}`);
}

const coreWorkflows = readFileSync(join(root, "src/lib/v10-core-workflow-contracts.ts"), "utf8");
for (const symbol of [
  "V10_CORE_WORKFLOW_CONTRACTS",
  "validateV10CoreWorkflowContracts",
  "activation",
  "home_daily_brief",
  "unified_work",
  "contract_record",
  "field_review_data_quality",
  "renewal_prevention",
]) {
  if (!coreWorkflows.includes(symbol)) failures.push(`missing-core-workflow-contract:${symbol}`);
}
for (const sourceObjectType of [
  "contract",
  "work_item",
  "field",
  "obligation",
  "approval",
  "exception",
  "evidence_request",
  "report_run",
  "export_job",
  "import_job",
  "extraction_job",
  "automation_run",
  "notification_delivery",
  "reminder",
  "renewal_checkpoint",
  "finding",
  "control",
  "campaign",
  "decision",
  "simulation",
  "scorecard",
  "playbook",
  "review_board",
  "health_graph",
  "account",
  "counterparty",
  "relationship",
  "saved_view",
  "setting",
  "workspace_health_diagnostic",
]) {
  if (!sourceObjectInventory.includes(`sourceObjectType: "${sourceObjectType}"`) && !sourceObjectInventory.includes(`["${sourceObjectType}"`)) {
    failures.push(`missing-source-object-inventory-row:${sourceObjectType}`);
  }
}

const productTelemetry = readFileSync(join(root, "src/lib/product-telemetry.ts"), "utf8");
const requiredV10ProductActions = [
  "product.v10.activation_completed",
  "product.v10.first_work_item_generated",
  "product.v10.work_item_completed",
  "product.v10.renewal_posture_computed",
  "product.v10.evidence_follow_up_scheduled",
  "product.v10.evidence_submitted",
  "product.v10.report_run_completed",
  "product.v10.export_job_completed",
  "product.v10.command_palette_recovered",
  "product.v10.command_palette_result_selected",
  "product.v10.command_palette_zero_result",
  "product.v10.empty_state_cta_clicked",
  "product.v10.failed_job_retry_succeeded",
  "product.v10.release_check_recorded",
];
for (const action of requiredV10ProductActions) {
  if (!productTelemetry.includes(`"${action}"`)) failures.push(`missing-product-telemetry-action:${action}`);
}
if (!productTelemetry.includes("V10_TELEMETRY_EVENT_EVIDENCE_EXCEPTIONS")) {
  failures.push("missing-product-telemetry-evidence-exceptions");
}
const telemetrySourceFiles = [];
for (const directory of ["src/actions", "src/app", "src/components", "src/lib", "scripts", "e2e"]) {
  collectTextFiles(join(root, directory), telemetrySourceFiles);
}
const telemetryCallsiteCorpus = telemetrySourceFiles
  .filter((absolute) => !absolute.endsWith("src/lib/product-telemetry.ts") && !absolute.endsWith(".test.ts") && !absolute.endsWith(".test.tsx"))
  .map((absolute) => readFileSync(absolute, "utf8"))
  .join("\n");
for (const action of requiredV10ProductActions) {
  const hasRuntimeCallsite = telemetryCallsiteCorpus.includes(`"${action}"`) || telemetryCallsiteCorpus.includes(`'${action}'`);
  const hasEvidenceException = productTelemetry.includes(`"${action}":`);
  if (!hasRuntimeCallsite && !hasEvidenceException) {
    failures.push(`missing-product-telemetry-callsite-or-exception:${action}`);
  }
}

const routeCatalog = readFileSync(join(root, "src/lib/v10-route-api-catalog.ts"), "utf8");
for (const routePath of [
  "/api/import/contracts/[jobId]",
  "/api/contracts/recompute-signals",
  "/contracts/evidence-studio",
  "/api/approvals/[id]/[action]",
  "/api/exceptions/[id]/[action]",
  "/api/renewals/[id]/[action]",
  "/api/evidence/requests",
  "/api/evidence/[id]/[action]",
  "/api/cron/v4/evidence-followup",
  "/api/cron/v10/idempotency-cleanup",
  "/api/cron/v10/read-model-refresh",
  "/api/cron/v10/runtime-artifact-cleanup",
  "/reports",
  "/api/export/contracts/[jobId]",
  "/api/reports/send-summaries",
]) {
  if (!routeCatalog.includes(`path: "${routePath}"`)) failures.push(`missing-route-catalog-path:${routePath}`);
}

const migration = readFileSync(join(root, "supabase/migrations/057_v10_runtime_contracts.sql"), "utf8");
const serverContracts = readFileSync(join(root, "src/lib/v10-server-contracts.ts"), "utf8");
const v10MigrationTables = [...migration.matchAll(/create table if not exists public\.(v10_[a-z0-9_]+) \(/g)]
  .map((match) => match[1])
  .sort();
const v10RlsTables = [...migration.matchAll(/alter table public\.(v10_[a-z0-9_]+) enable row level security/g)]
  .map((match) => match[1])
  .sort();
const v10SelectPolicyTables = [...migration.matchAll(/on public\.(v10_[a-z0-9_]+) for select/g)].map((match) => match[1]).sort();
const v10MemberReadableTables = v10MigrationTables.filter((table) => table !== "v10_mutation_idempotency");
if (!migration.includes("No direct member access V10 mutation idempotency")) {
  failures.push("missing-rls:v10-mutation-idempotency-deny");
}
if (!migration.includes("om.organization_id = v10_release_evidence_records.organization_id")) {
  failures.push("missing-rls:v10-release-evidence-org-scope");
}
if (v10RlsTables.join("|") !== v10MigrationTables.join("|")) {
  failures.push("missing-rls:v10-table-coverage");
}
if (v10SelectPolicyTables.join("|") !== v10MemberReadableTables.join("|")) {
  failures.push("missing-rls:v10-member-select-policy-coverage");
}
for (const indexName of REQUIRED_V10_INDEXES) {
  if (!new RegExp(`create (unique )?index if not exists ${indexName}\\b`, "i").test(migration)) {
    failures.push(`missing-index:${indexName}`);
  }
}
for (const token of ["refresh_scope", "repair_mode", "expected_source_tables", "stale_source_tables", "drift_state"]) {
  if (!migration.includes(token)) failures.push(`missing-refresh-diagnostic-column:${token}`);
}
for (const token of ["claim_v10_mutation_idempotency", "complete_v10_mutation_idempotency"]) {
  if (!migration.includes(token)) failures.push(`missing-idempotency-rpc:${token}`);
  if (!serverContracts.includes(token)) failures.push(`missing-idempotency-rpc-runtime:${token}`);
}

const commandSearchRoute = readFileSync(join(root, "src/app/api/command-palette/contracts/route.ts"), "utf8");
for (const token of ["modeAllows", "matchRank", "workspace_mode_minimum", "rank_terms_safe", "buildV10CommandSearchRecovery"]) {
  if (!commandSearchRoute.includes(token)) failures.push(`missing-command-search-token:${token}`);
}

const routeImplementationChecks = [
  {
    routePath: "/api/evidence/requests",
    file: "src/app/api/evidence/requests/route.ts",
    tokens: ["executeV10AuditedMutation", "create_evidence_request", "recordV10AuditEvent", "refreshV10ReadModelsForOrganization", "Cache-Control"],
  },
  {
    routePath: "/api/evidence/submit",
    file: "src/app/api/evidence/submit/route.ts",
    tokens: ["executeV10AuditedMutation", "recordV10AuditEvent", "product.v10.evidence_submitted", "Cache-Control"],
  },
  {
    routePath: "/api/evidence/[id]/[action]",
    file: "src/app/api/evidence/[id]/[action]/route.ts",
    tokens: ["executeV10IdempotentMutation", "getV10ExpectedVersionFromRequest", "recordV10AuditEvent", "Cache-Control"],
  },
  {
    routePath: "/api/approvals/[id]/[action]",
    file: "src/app/api/approvals/[id]/[action]/route.ts",
    tokens: ["executeV10IdempotentMutation", "getV10ExpectedVersionFromRequest", "recordV10AuditEvent", "refreshV10ReadModelsForOrganization", "Cache-Control"],
  },
  {
    routePath: "/api/exceptions/[id]/[action]",
    file: "src/app/api/exceptions/[id]/[action]/route.ts",
    tokens: ["executeV10IdempotentMutation", "getV10ExpectedVersionFromRequest", "recordV10AuditEvent", "refreshV10ReadModelsForOrganization", "Cache-Control"],
  },
  {
    routePath: "/api/renewals/[id]/[action]",
    file: "src/app/api/renewals/[id]/[action]/route.ts",
    tokens: ["executeV10IdempotentMutation", "getV10ExpectedVersionFromRequest", "recordV10AuditEvent", "refreshV10ReadModelsForOrganization", "Cache-Control"],
  },
  {
    routePath: "/api/report-packs",
    file: "src/app/api/report-packs/route.ts",
    tokens: ["executeV10AuditedMutation", "recordV10AuditEvent", "Cache-Control"],
  },
  {
    routePath: "/api/export/contracts",
    file: "src/app/api/export/contracts/route.ts",
    tokens: ["getV10IdempotencyKeyFromRequest", "recordV10AuditEvent", "Cache-Control"],
  },
  {
    routePath: "/api/cron/v10/idempotency-cleanup",
    file: "src/app/api/cron/v10/idempotency-cleanup/route.ts",
    tokens: ["ensureCronAuthorized", "cleanup_expired_v10_mutation_idempotency", "Cache-Control"],
  },
  {
    routePath: "/api/cron/v10/runtime-artifact-cleanup",
    file: "src/app/api/cron/v10/runtime-artifact-cleanup/route.ts",
    tokens: ["ensureCronAuthorized", "cleanup_expired_v10_runtime_artifacts", "cleanup_old_v10_read_model_refresh_jobs", "Cache-Control"],
  },
  {
    routePath: "/api/cron/v10/read-model-refresh",
    file: "src/app/api/cron/v10/read-model-refresh/route.ts",
    tokens: ["ensureCronAuthorized", "refreshV10ReadModelsForOrganization", "recordV10AuditEvent", "Cache-Control"],
  },
];
for (const check of routeImplementationChecks) {
  const source = readFileSync(join(root, check.file), "utf8");
  for (const token of check.tokens) {
    if (!source.includes(token)) failures.push(`missing-route-implementation-token:${check.routePath}:${token}`);
  }
}

const exportRouteSource = readFileSync(join(root, "src/app/api/export/contracts/route.ts"), "utf8");
if (!/export async function GET\(request: Request\) \{\s*return runExportContractsCsv\(request\);\s*\}/.test(exportRouteSource)) {
  failures.push("export-get-must-remain-read-only");
}
if (!exportRouteSource.includes("createExportJob: true")) {
  failures.push("export-post-must-create-v10-export-job");
}

for (const planTodoId of ["exhaustive-artifact-sweep", "non-autonomous-proof"]) {
  if (!autonomousCoverage.includes(`planTodoId: "${planTodoId}"`)) {
    failures.push(`missing-autonomous-coverage-plan-todo:${planTodoId}`);
  }
}

for (const planTodoId of [
  "domain-workflows",
  "security-privacy",
  "release-evidence-boundaries",
  "fixtures-backfill",
  "observability-ops",
  "rollout-rollback",
  "entitlements-integrations",
  "browser-performance",
]) {
  if (!autonomousCoverage.includes(`planTodoId: "${planTodoId}"`)) {
    failures.push(`missing-expanded-autonomous-coverage-plan-todo:${planTodoId}`);
  }
}

for (const evidenceGate of [
  "human_usability_sessions",
  "provider_configuration_readiness",
  "external_dashboard_and_canary",
  "release_owner_signoff",
  "support_readiness_review",
  "post_ga_observation_window",
]) {
  if (!evidence.includes(`key: "${evidenceGate}"`)) failures.push(`missing-non-autonomous-evidence-gate:${evidenceGate}`);
}

const docs = readFileSync(join(root, "docs/v10.md"), "utf8");
const traceMap = readFileSync(join(root, "src/lib/v10-spec-trace-map.ts"), "utf8");
const docSections = [...docs.matchAll(/^#{2,6}\s+(\d+(?:\.\d+)*)(?:\.\s+|\s+|$)/gm)]
  .map((match) => match[1])
  .filter(Boolean);
const traceSections = [...traceMap.matchAll(/"(\d+(?:\.\d+)*)"\s*:/g)]
  .map((match) => match[1])
  .filter(Boolean);
for (const section of docSections) {
  if (!traceMap.includes(`"${section}"`)) failures.push(`missing-spec-trace-section:${section}`);
}
for (const section of traceSections) {
  if (!docSections.includes(section)) failures.push(`stale-spec-trace-section:${section}`);
}

if (failures.length > 0) {
  console.error("V10 release evidence check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const noExclusionsMatrixCheck = spawnSync("npx", ["vitest", "run", "src/lib/v10-no-exclusions-matrix.v10.test.ts"], {
  stdio: "inherit",
  cwd: root,
  shell: false,
});
if ((noExclusionsMatrixCheck.status ?? 1) !== 0) process.exit(noExclusionsMatrixCheck.status ?? 1);

console.log("V10 release evidence check passed.");
