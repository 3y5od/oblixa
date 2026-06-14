#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { analyzeEnvContractHygiene } from "./check-env-contract-hygiene.mjs";
import { analyzeProviderIntegrationFixtures } from "./check-provider-integration-fixtures.mjs";
import { analyzeReleaseSecurityRequiredEnv } from "./check-release-security-required-env.mjs";
import { analyzeSupabaseSeedSafety } from "./check-supabase-seed-safety.mjs";
import { analyzeTestFixtureSecrets } from "./check-test-fixture-secrets.mjs";
import { buildOperationalTestReliabilityGovernanceReport } from "./check-operational-test-reliability-governance.mjs";
import {
  LIVE_SECRET_RE,
  REQUIRED_ENV_CLASS_IDS,
  REQUIRED_ENV_DIMENSIONS,
  REQUIRED_FIXTURE_CONTROLS,
  REQUIRED_PREVIEW_CONTROLS,
  classifyEnvironmentKey,
  classifyEnvironmentValue,
  issueCodes,
  parseEnvFile,
  scanSeedFileSource,
  syntheticEnv,
} from "./lib/operational-environment-isolation-requirements.mjs";

export { classifyEnvironmentKey, classifyEnvironmentValue };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const CONFIG_REL = "config/operational-environment-isolation.json";
const ARTIFACT_REL = "artifacts/operational-environment-isolation.json";

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel, fallback = null) {
  const text = read(root, rel);
  return text ? JSON.parse(text) : fallback;
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function packageScripts(root) {
  return readJson(root, "package.json", { scripts: {} })?.scripts ?? {};
}

function analyzeConfigAndWiring(root, config, issues) {
  const scripts = packageScripts(root);
  const ci = read(root, ".github/workflows/ci.yml");

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-environment-isolation") {
    issues.push(issue("operational_environment_invalid_config_metadata"));
  }
  if (config.generatedArtifact !== ARTIFACT_REL) {
    issues.push(issue("operational_environment_unexpected_generated_artifact", { generatedArtifact: config.generatedArtifact ?? null }));
  }
  for (const rel of config.sourceFiles ?? []) {
    if (!fs.existsSync(path.join(root, rel))) issues.push(issue("operational_environment_source_file_missing", { path: rel }));
  }
  for (const command of config.requiredValidationCommands ?? []) {
    if (!scripts[command]) issues.push(issue("operational_environment_missing_package_script", { command }));
  }
  if (!ci.includes("npm run check:operational-environment-isolation")) {
    issues.push(issue("operational_environment_missing_ci_command", { command: "npm run check:operational-environment-isolation" }));
  }

  return {
    sourceFileCount: config.sourceFiles?.length ?? 0,
    requiredValidationCommandCount: config.requiredValidationCommands?.length ?? 0,
  };
}

function analyzeEnvironmentClasses(config, issues) {
  const configuredRequiredIds = config.requiredEnvironmentClassIds ?? [];
  const configuredRequiredDimensions = config.requiredEnvironmentDimensions ?? [];
  for (const id of REQUIRED_ENV_CLASS_IDS) {
    if (!configuredRequiredIds.includes(id)) issues.push(issue("operational_environment_required_class_not_configured", { id }));
  }
  for (const dimension of REQUIRED_ENV_DIMENSIONS) {
    if (!configuredRequiredDimensions.includes(dimension)) {
      issues.push(issue("operational_environment_required_dimension_not_configured", { dimension }));
    }
  }

  const classRows = [];
  const seen = new Set();
  for (const row of config.environmentClasses ?? []) {
    if (!row.id) issues.push(issue("operational_environment_class_missing_id"));
    if (seen.has(row.id)) issues.push(issue("operational_environment_duplicate_class", { id: row.id }));
    seen.add(row.id);
    for (const dimension of REQUIRED_ENV_DIMENSIONS) {
      const value = row[dimension];
      const present = Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim().length > 0;
      if (!present) issues.push(issue("operational_environment_class_missing_dimension", { id: row.id ?? "(missing)", dimension }));
    }
    classRows.push({
      id: row.id,
      urlSignalCount: row.urlSignals?.length ?? 0,
      keySignalCount: row.requiredKeySignals?.length ?? 0,
      callbackOriginPolicy: row.callbackOriginPolicy ?? null,
      cookiePolicy: row.cookiePolicy ?? null,
      storageBucketPolicy: row.storageBucketPolicy ?? null,
      providerModePolicy: row.providerModePolicy ?? null,
      productionJobPolicy: row.productionJobPolicy ?? null,
    });
  }
  for (const id of REQUIRED_ENV_CLASS_IDS) {
    if (!seen.has(id)) issues.push(issue("operational_environment_class_missing", { id }));
  }

  return {
    classCount: classRows.length,
    requiredClassCount: REQUIRED_ENV_CLASS_IDS.length,
    requiredDimensionCount: REQUIRED_ENV_DIMENSIONS.length,
    rows: classRows.sort((a, b) => String(a.id).localeCompare(String(b.id))),
  };
}

function analyzeEnvFiles(root, config, issues) {
  const envFiles = [".env.example", ".env.local.example"];
  const rows = [];
  const byKey = new Map();
  for (const rel of envFiles) {
    const parsed = parseEnvFile(read(root, rel));
    for (const entry of parsed) {
      const keyClass = classifyEnvironmentKey(entry.key);
      const valueClass = classifyEnvironmentValue(entry.value);
      rows.push({
        file: rel,
        line: entry.line,
        key: entry.key,
        commented: entry.commented,
        valueClass,
        public: keyClass.public,
        sensitive: keyClass.sensitive,
        classHints: keyClass.classHints,
      });
      const aggregate = byKey.get(entry.key) ?? { key: entry.key, files: new Set(), classes: new Set(), sensitive: keyClass.sensitive, public: keyClass.public };
      aggregate.files.add(rel);
      if (valueClass !== "empty" && valueClass !== "unknown") aggregate.classes.add(valueClass);
      byKey.set(entry.key, aggregate);

      if (rel === ".env.local.example" && LIVE_SECRET_RE.test(entry.value)) {
        issues.push(issue("operational_environment_local_example_contains_live_secret", { file: rel, line: entry.line, key: entry.key }));
      }
      if (rel === ".env.local.example" && ["production", "preview", "staging"].includes(valueClass) && entry.key !== "NEXT_PUBLIC_APP_URL") {
        issues.push(issue("operational_environment_local_example_mixed_reference", { file: rel, line: entry.line, key: entry.key, valueClass }));
      }
      if (keyClass.public && keyClass.sensitive && !["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SENTRY_DSN"].includes(entry.key)) {
        issues.push(issue("operational_environment_public_key_looks_sensitive", { file: rel, line: entry.line, key: entry.key }));
      }
    }
  }

  const matrix = readJson(root, "config/e2e-env-matrix.json", { keys: [] });
  const matrixKeys = new Set(matrix.keys ?? []);
  for (const key of config.requiredE2eMatrixKeys ?? []) {
    if (!matrixKeys.has(key)) issues.push(issue("operational_environment_e2e_matrix_missing_key", { key }));
  }

  return {
    envFileCount: envFiles.length,
    envEntryCount: rows.length,
    uniqueEnvKeyCount: byKey.size,
    e2eMatrixKeyCount: matrixKeys.size,
    requiredE2eMatrixKeyCount: config.requiredE2eMatrixKeys?.length ?? 0,
    rows: rows.sort((a, b) => `${a.key}:${a.file}:${a.line}`.localeCompare(`${b.key}:${b.file}:${b.line}`)),
    keySummary: [...byKey.values()]
      .map((entry) => ({
        key: entry.key,
        files: [...entry.files].sort((a, b) => a.localeCompare(b)),
        valueClasses: [...entry.classes].sort((a, b) => a.localeCompare(b)),
        public: entry.public,
        sensitive: entry.sensitive,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  };
}

function analyzeSyntheticProviderIsolation(root, issues) {
  const previewSafe = analyzeReleaseSecurityRequiredEnv({
    root,
    env: syntheticEnv({
      OBLIXA_RELEASE_ENVIRONMENT: "preview",
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_APP_URL: "https://preview-branch.example.test",
      NEXT_PUBLIC_SUPABASE_URL: "https://preview.supabase.co",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_1234567890123456",
      STRIPE_SECRET_KEY: "sk_test_1234567890123456",
      STRIPE_EXPECTED_MODE: "test",
      STAGING_BASE_URL: "https://staging.example.test",
      UPSTASH_REDIS_REST_URL: "https://preview-upstash.example.test",
    }),
    strict: false,
  });
  if (!previewSafe.ok) {
    issues.push(issue("operational_environment_preview_safe_synthetic_failed", { issueCount: previewSafe.issueCount, issues: previewSafe.issues.slice(0, 10) }));
  }

  const previewLive = analyzeReleaseSecurityRequiredEnv({
    root,
    env: syntheticEnv({
      OBLIXA_RELEASE_ENVIRONMENT: "preview",
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_APP_URL: "https://preview-branch.example.test",
      NEXT_PUBLIC_SUPABASE_URL: "https://preview.supabase.co",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_1234567890123456",
      STRIPE_SECRET_KEY: "sk_live_1234567890123456",
      STRIPE_EXPECTED_MODE: "live",
    }),
    strict: false,
  });
  if (!issueCodes(previewLive).has("mixed_environment_credentials")) {
    issues.push(issue("operational_environment_preview_live_mode_not_rejected"));
  }

  const productionTest = analyzeReleaseSecurityRequiredEnv({
    root,
    env: syntheticEnv({
      OBLIXA_RELEASE_ENVIRONMENT: "production",
      VERCEL_ENV: "production",
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://oblixa.io",
      NEXT_PUBLIC_SUPABASE_URL: "https://prod.supabase.co",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_1234567890123456",
      STRIPE_SECRET_KEY: "sk_test_1234567890123456",
      STRIPE_EXPECTED_MODE: "test",
    }),
    strict: false,
  });
  if (!issueCodes(productionTest).has("mixed_environment_credentials")) {
    issues.push(issue("operational_environment_production_test_mode_not_rejected"));
  }

  return {
    previewSafe: { ok: previewSafe.ok, issueCount: previewSafe.issueCount },
    previewLiveRejected: issueCodes(previewLive).has("mixed_environment_credentials"),
    productionTestRejected: issueCodes(productionTest).has("mixed_environment_credentials"),
  };
}

function analyzeSeedSafety(root, config, issues) {
  const delegated = analyzeSupabaseSeedSafety(root);
  if (!delegated.ok) issues.push(issue("operational_environment_delegated_seed_safety_failed", { issueCount: delegated.issueCount }));
  const seedConfig = config.seedSafety ?? {};
  const seedRows = (seedConfig.seedFiles ?? []).map((rel) => {
    const scan = scanSeedFileSource(read(root, rel), rel, seedConfig);
    issues.push(...scan.issues);
    return scan.result;
  });
  return {
    delegated: { ok: delegated.ok, issueCount: delegated.issueCount, insertCount: delegated.insertCount },
    seedFileCount: seedRows.length,
    mutationCount: seedRows.reduce((count, row) => count + row.mutationCount, 0),
    uuidCount: seedRows.reduce((count, row) => count + row.uuidCount, 0),
    emailCount: seedRows.reduce((count, row) => count + row.emailCount, 0),
    rows: seedRows.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

function markerCoverage(root, sourceFile, markers, issues, issueCode, fields = {}) {
  const text = read(root, sourceFile);
  if (!text) {
    issues.push(issue(`${issueCode}_source_file_missing`, { ...fields, sourceFile }));
    return (markers ?? []).map((marker) => ({ marker, present: false }));
  }
  return (markers ?? []).map((marker) => {
    const present = text.includes(marker);
    if (!present) issues.push(issue(`${issueCode}_marker_missing`, { ...fields, sourceFile, marker }));
    return { marker, present };
  });
}

function analyzeFixtureLifecycle(root, config, issues) {
  const configuredIds = new Set((config.fixtureLifecycleControls ?? []).map((row) => row.id));
  for (const id of REQUIRED_FIXTURE_CONTROLS) {
    if (!configuredIds.has(id)) issues.push(issue("operational_environment_fixture_control_missing", { id }));
  }
  const rows = [];
  for (const control of config.fixtureLifecycleControls ?? []) {
    const coverage = markerCoverage(root, control.sourceFile, control.markers, issues, "operational_environment_fixture_control", { id: control.id });
    rows.push({
      id: control.id,
      sourceFile: control.sourceFile,
      markerCount: control.markers?.length ?? 0,
      presentMarkerCount: coverage.filter((row) => row.present).length,
      markerCoverage: coverage,
    });
  }
  return {
    controlCount: rows.length,
    requiredControlCount: REQUIRED_FIXTURE_CONTROLS.length,
    rows: rows.sort((a, b) => String(a.id).localeCompare(String(b.id))),
  };
}

function analyzePreviewProviderControls(root, config, issues) {
  const configuredIds = new Set((config.previewProviderControls ?? []).map((row) => row.id));
  for (const id of REQUIRED_PREVIEW_CONTROLS) {
    if (!configuredIds.has(id)) issues.push(issue("operational_environment_preview_control_missing", { id }));
  }
  const rows = [];
  for (const control of config.previewProviderControls ?? []) {
    const coverage = markerCoverage(root, control.sourceFile, control.markers, issues, "operational_environment_preview_control", { id: control.id, provider: control.provider });
    rows.push({
      id: control.id,
      provider: control.provider,
      sourceFile: control.sourceFile,
      markerCount: control.markers?.length ?? 0,
      presentMarkerCount: coverage.filter((row) => row.present).length,
      markerCoverage: coverage,
    });
  }
  return {
    controlCount: rows.length,
    requiredControlCount: REQUIRED_PREVIEW_CONTROLS.length,
    rows: rows.sort((a, b) => String(a.id).localeCompare(String(b.id))),
  };
}

function summarizeDelegated(report) {
  return {
    ok: Boolean(report.ok ?? report.issueCount === 0),
    issueCount: Number(report.issueCount ?? 0),
    checkId: report.checkId ?? report.source ?? "unknown",
  };
}

function analyzeDelegatedChecks(root, issues) {
  const reports = {
    envContractHygiene: summarizeDelegated(analyzeEnvContractHygiene(root)),
    testFixtureSecrets: summarizeDelegated(analyzeTestFixtureSecrets(root)),
    providerIntegrationFixtures: summarizeDelegated(analyzeProviderIntegrationFixtures(root)),
    operationalTestReliabilityGovernance: summarizeDelegated(buildOperationalTestReliabilityGovernanceReport(root)),
  };
  for (const [key, report] of Object.entries(reports)) {
    if (!report.ok) issues.push(issue("operational_environment_delegated_check_failed", { key, issueCount: report.issueCount }));
  }
  return reports;
}

export function buildOperationalEnvironmentIsolationReport(root = DEFAULT_ROOT, options = {}) {
  const checkDrift = Boolean(options.checkDrift);
  const issues = [];
  const config = readJson(root, CONFIG_REL, {});
  const wiring = analyzeConfigAndWiring(root, config, issues);
  const environmentClasses = analyzeEnvironmentClasses(config, issues);
  const envFileIsolation = analyzeEnvFiles(root, config, issues);
  const syntheticProviderIsolation = analyzeSyntheticProviderIsolation(root, issues);
  const seedSafety = analyzeSeedSafety(root, config, issues);
  const fixtureLifecycle = analyzeFixtureLifecycle(root, config, issues);
  const previewProviderControls = analyzePreviewProviderControls(root, config, issues);
  const delegatedChecks = analyzeDelegatedChecks(root, issues);

  const report = {
    schemaVersion: 1,
    source: "code-owned-operational-environment-isolation",
    generatedArtifact: ARTIFACT_REL,
    generatedFrom: CONFIG_REL,
    ok: false,
    summary: {
      environmentClassCount: environmentClasses.classCount,
      envKeyCount: envFileIsolation.uniqueEnvKeyCount,
      e2eMatrixKeyCount: envFileIsolation.e2eMatrixKeyCount,
      seedFileCount: seedSafety.seedFileCount,
      fixtureLifecycleControlCount: fixtureLifecycle.controlCount,
      previewProviderControlCount: previewProviderControls.controlCount,
    },
    wiring,
    environmentClasses,
    envFileIsolation,
    syntheticProviderIsolation,
    seedSafety,
    fixtureLifecycle,
    previewProviderControls,
    delegatedChecks,
    manualBoundary: config.manualBoundary ?? null,
    issueCount: 0,
    issues: [],
  };

  if (checkDrift) {
    const expected = stableStringify({ ...report, ok: issues.length === 0, issueCount: issues.length, issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) });
    const actual = read(root, ARTIFACT_REL);
    if (!actual) {
      issues.push(issue("operational_environment_artifact_missing", { artifact: ARTIFACT_REL, writeCommand: "npm run write:operational-environment-isolation" }));
    } else if (actual !== expected) {
      issues.push(issue("operational_environment_artifact_drift", { artifact: ARTIFACT_REL, writeCommand: "npm run write:operational-environment-isolation" }));
    }
  }

  report.ok = issues.length === 0;
  report.issueCount = issues.length;
  report.issues = issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return report;
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") {
      options.write = true;
    } else if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    }
  }
  return options;
}

export function runOperationalEnvironmentIsolation(options = parseArgs(process.argv.slice(2))) {
  const report = buildOperationalEnvironmentIsolationReport(options.root, { checkDrift: !options.write });
  if (options.write) writeJson(options.root, ARTIFACT_REL, report);
  console.log(stableStringify(report));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOperationalEnvironmentIsolation();
}
