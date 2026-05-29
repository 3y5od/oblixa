#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  REQUIRED_FLAKE_CLASSES,
  buildPlaywrightFlakeClassificationReport,
} from "./classify-playwright-flakes.mjs";
import { analyzeE2eQuarantine } from "./check-e2e-quarantine.mjs";
import { SKIP_DETECTORS, buildTestSkipGovernanceReport } from "./report-test-skip-governance.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-test-reliability-governance.json";
const ARTIFACT_REL = "artifacts/operational-test-reliability-governance.json";
const WRITE = process.argv.includes("--write");

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

function walk(root, rel, predicate, out = []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const childRel = path.join(rel, entry.name).replace(/\\/gu, "/");
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    if (entry.isDirectory()) walk(root, childRel, predicate, out);
    else if (entry.isFile() && predicate(childRel)) out.push(childRel);
  }
  return out;
}

function sourceTestFiles(root) {
  const e2e = walk(root, "e2e", (rel) => /\.(?:ts|tsx)$/u.test(rel));
  const src = walk(root, "src", (rel) => /\.(?:test|spec)\.(?:ts|tsx)$/u.test(rel));
  return [...e2e, ...src].sort((a, b) => a.localeCompare(b));
}

function lineForIndex(raw, index) {
  return raw.slice(0, index).split("\n").length;
}

function checkConfigAndWiring(root, config, issues) {
  const scripts = packageScripts(root);
  const ci = read(root, ".github/workflows/ci.yml");
  const sourceFiles = config.sourceFiles ?? [];
  const requiredValidationCommands = config.requiredValidationCommands ?? [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-test-reliability-governance") {
    issues.push(issue("operational_test_reliability_invalid_config_metadata"));
  }
  if (config.generatedArtifact !== ARTIFACT_REL) {
    issues.push(issue("operational_test_reliability_unexpected_generated_artifact", { generatedArtifact: config.generatedArtifact ?? null }));
  }
  for (const rel of sourceFiles) {
    if (!fs.existsSync(path.join(root, rel))) issues.push(issue("operational_test_reliability_source_file_missing", { path: rel }));
  }
  for (const command of requiredValidationCommands) {
    if (!scripts[command]) issues.push(issue("operational_test_reliability_missing_package_script", { command }));
  }
  if (!ci.includes("npm run check:operational-test-reliability-governance")) {
    issues.push(issue("operational_test_reliability_missing_ci_command", { command: "npm run check:operational-test-reliability-governance" }));
  }

  return {
    sourceFileCount: sourceFiles.length,
    requiredValidationCommandCount: requiredValidationCommands.length,
  };
}

export function analyzeFlakeClassification(root, config, issues = []) {
  const flakeConfig = config.flakeClassification ?? {};
  const report = buildPlaywrightFlakeClassificationReport({
    root,
    owner: flakeConfig.owner,
    nextValidationCommand: flakeConfig.nextValidationCommand,
    reportPaths: flakeConfig.reportPaths ?? [],
  });
  const requiredClasses = flakeConfig.requiredClasses ?? REQUIRED_FLAKE_CLASSES;
  const coverageByClass = new Map((report.classCoverage ?? []).map((row) => [row.class, row]));
  for (const className of requiredClasses) {
    const row = coverageByClass.get(className);
    if (!row) {
      issues.push(issue("operational_test_reliability_flake_class_missing", { class: className }));
    } else if (!row.owner || !row.nextValidationCommand || row.detectorCount < 1) {
      issues.push(issue("operational_test_reliability_flake_class_metadata_missing", { class: className }));
    }
  }
  if (report.unclassifiedCount > 0) {
    issues.push(issue("operational_test_reliability_unclassified_flake_failures", { count: report.unclassifiedCount }));
  }
  return {
    ok: report.ok,
    mode: report.mode,
    requiredClassCount: requiredClasses.length,
    parsedReportCount: report.parsedReports.length,
    classifiedFailureCount: report.classifiedFailureCount,
    unclassifiedCount: report.unclassifiedCount,
    classCounts: report.classCounts,
    classCoverage: report.classCoverage,
  };
}

export function analyzeQuarantineGovernance(root, config, issues = []) {
  const quarantineConfig = config.quarantine ?? {};
  const report = analyzeE2eQuarantine(root, { manifestRel: quarantineConfig.manifest, strict: true });
  const configuredRequired = quarantineConfig.requiredFields ?? [];
  for (const field of configuredRequired) {
    if (!report.requiredFields.includes(field)) {
      issues.push(issue("operational_test_reliability_quarantine_required_field_not_enforced", { field }));
    }
  }
  if (report.issueCount > 0) {
    issues.push(issue("operational_test_reliability_quarantine_manifest_failed", { issueCount: report.issueCount }));
  }
  return report;
}

export function analyzeSkipGovernance(root, config, issues = []) {
  const skipConfig = config.skipGovernance ?? {};
  const report = buildTestSkipGovernanceReport(root, { targets: skipConfig.scanTargets, strict: true });
  const requiredDetectors = skipConfig.requiredDetectors ?? [];
  for (const detector of requiredDetectors) {
    if (!SKIP_DETECTORS.includes(detector) || !report.detectors.includes(detector)) {
      issues.push(issue("operational_test_reliability_skip_detector_missing", { detector }));
    }
  }
  if (report.problemCount > 0) {
    issues.push(issue("operational_test_reliability_skip_metadata_failed", { problemCount: report.problemCount }));
  }

  const baselineRel = skipConfig.baseline;
  const baseline = baselineRel ? readJson(root, baselineRel, null) : null;
  const maxDelta = Number(skipConfig.maxDelta ?? 0);
  const delta = baseline ? report.skipCount - Number(baseline.skipCount ?? 0) : report.skipCount;
  if (!baseline) {
    issues.push(issue("operational_test_reliability_skip_baseline_missing", { baseline: baselineRel ?? null }));
  } else if (delta > maxDelta) {
    issues.push(issue("operational_test_reliability_skip_count_regression", { skipCount: report.skipCount, baseline: baseline.skipCount, delta, maxDelta }));
  }

  return {
    skipCount: report.skipCount,
    problemCount: report.problemCount,
    baseline: baselineRel ?? null,
    baselineSkipCount: baseline?.skipCount ?? null,
    delta,
    maxDelta,
    detectorCount: report.detectors.length,
    byKind: report.byKind,
    byClassification: report.byClassification,
  };
}

function hardcodedEmails(root, files, allowedDomains) {
  const rows = [];
  const allowed = new Set(allowedDomains ?? []);
  const wildcardSuffixes = [...allowed].filter((entry) => entry.startsWith("*.")).map((entry) => entry.slice(2));
  const emailRe = /\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/giu;
  for (const rel of files) {
    const raw = read(root, rel);
    for (const match of raw.matchAll(emailRe)) {
      const domain = match[1].toLowerCase();
      const allowedDomain =
        allowed.has(domain) ||
        [...allowed].some((entry) => !entry.startsWith("*.") && domain.endsWith(`.${entry}`)) ||
        wildcardSuffixes.some((suffix) => domain === suffix || domain.endsWith(`.${suffix}`));
      if (!allowedDomain) {
        rows.push({ file: rel, line: lineForIndex(raw, match.index), domain, email: match[0] });
      }
    }
  }
  return rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function mutableStateWrites(root, files, allowedFiles) {
  const allowed = new Set(allowedFiles ?? []);
  const rows = [];
  const writeRe = /\b(?:writeFileSync|appendFileSync|rmSync|unlinkSync|storageState\s*\(\s*\{[^}]*path|mkdirSync)\b/gu;
  for (const rel of files.filter((file) => file.startsWith("e2e/"))) {
    if (allowed.has(rel)) continue;
    const raw = read(root, rel);
    for (const match of raw.matchAll(writeRe)) {
      rows.push({ file: rel, line: lineForIndex(raw, match.index), pattern: match[0] });
    }
  }
  return rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

export function analyzeTestDataIsolation(root, config, issues = []) {
  const isolationConfig = config.testDataIsolation ?? {};
  const scripts = packageScripts(root);
  const files = sourceTestFiles(root);
  const fixtureRows = (isolationConfig.requiredFixtures ?? []).map((rel) => ({ path: rel, present: fs.existsSync(path.join(root, rel)) }));
  for (const row of fixtureRows) {
    if (!row.present) issues.push(issue("operational_test_reliability_fixture_missing", { path: row.path }));
  }
  const commandRows = (isolationConfig.requiredCommands ?? []).map((command) => ({ command, present: Boolean(scripts[command]) }));
  for (const row of commandRows) {
    if (!row.present) issues.push(issue("operational_test_reliability_isolation_command_missing", { command: row.command }));
  }

  const playwrightConfig = read(root, "playwright.config.ts");
  const markerRows = (isolationConfig.requiredPlaywrightMarkers ?? []).map((marker) => ({ marker, present: playwrightConfig.includes(marker) }));
  for (const row of markerRows) {
    if (!row.present) issues.push(issue("operational_test_reliability_playwright_marker_missing", { marker: row.marker }));
  }

  const emailViolations = hardcodedEmails(root, files, isolationConfig.allowedTestEmailDomains ?? []);
  for (const row of emailViolations) {
    issues.push(issue("operational_test_reliability_unapproved_test_email_domain", row));
  }

  const mutableStateViolations = mutableStateWrites(root, files, isolationConfig.allowedMutableStateFiles ?? []);
  for (const row of mutableStateViolations) {
    issues.push(issue("operational_test_reliability_shared_mutable_state_unlocked", row));
  }

  return {
    scannedTestFileCount: files.length,
    requiredFixtureCount: fixtureRows.length,
    missingFixtureCount: fixtureRows.filter((row) => !row.present).length,
    requiredCommandCount: commandRows.length,
    missingCommandCount: commandRows.filter((row) => !row.present).length,
    requiredPlaywrightMarkerCount: markerRows.length,
    missingPlaywrightMarkerCount: markerRows.filter((row) => !row.present).length,
    hardcodedEmailViolationCount: emailViolations.length,
    mutableStateViolationCount: mutableStateViolations.length,
    fixtureRows,
    commandRows,
    markerRows,
    emailViolations,
    mutableStateViolations,
  };
}

function snapshotFiles(root, snapshotRoot) {
  if (!snapshotRoot) return [];
  return walk(root, snapshotRoot, (rel) => rel.endsWith(".png")).sort((a, b) => a.localeCompare(b));
}

export function analyzeVisualBaselineGovernance(root, config, issues = []) {
  const visualConfig = config.visualBaselineGovernance ?? {};
  const scripts = packageScripts(root);
  const routeMatrices = (visualConfig.routeMatrices ?? []).map((rel) => ({ path: rel, present: fs.existsSync(path.join(root, rel)) }));
  for (const row of routeMatrices) {
    if (!row.present) issues.push(issue("operational_test_reliability_visual_route_matrix_missing", { path: row.path }));
  }

  const helper = visualConfig.helper ?? "e2e/visual-helpers.ts";
  if (!fs.existsSync(path.join(root, helper))) {
    issues.push(issue("operational_test_reliability_visual_helper_missing", { path: helper }));
  }

  const suiteRows = [];
  for (const suite of visualConfig.suites ?? []) {
    const specText = read(root, suite.spec);
    const runCommand = scripts[suite.runCommand] ?? "";
    const updateCommand = scripts[suite.updateCommand] ?? "";
    const snapshots = snapshotFiles(root, suite.snapshotRoot);
    const badSnapshotNames = snapshots.filter(
      (rel) => !path.basename(rel).includes(suite.browser) || !path.basename(rel).includes(suite.osAssumption)
    );
    const requiredMetadata = ["owner", "runCommand", "updateCommand", "browser", "device", "osAssumption", "diffThreshold", "reviewEvidenceCommand"];
    for (const field of requiredMetadata) {
      if (!suite[field]) issues.push(issue("operational_test_reliability_visual_suite_metadata_missing", { spec: suite.spec, field }));
    }
    if (!fs.existsSync(path.join(root, suite.spec))) {
      issues.push(issue("operational_test_reliability_visual_spec_missing", { spec: suite.spec }));
    }
    if (suite.snapshotRoot && !fs.existsSync(path.join(root, suite.snapshotRoot))) {
      issues.push(issue("operational_test_reliability_visual_snapshot_root_missing", { spec: suite.spec, snapshotRoot: suite.snapshotRoot }));
    }
    if (!specText.includes("toHaveScreenshot")) {
      issues.push(issue("operational_test_reliability_visual_spec_without_snapshot_assertion", { spec: suite.spec }));
    }
    if (!specText.includes("visual-helpers") && !specText.includes("toHaveScreenshot")) {
      issues.push(issue("operational_test_reliability_visual_spec_without_helper", { spec: suite.spec }));
    }
    if (!scripts[suite.runCommand]) {
      issues.push(issue("operational_test_reliability_visual_run_command_missing", { spec: suite.spec, command: suite.runCommand }));
    }
    if (!scripts[suite.updateCommand]) {
      issues.push(issue("operational_test_reliability_visual_update_command_missing", { spec: suite.spec, command: suite.updateCommand }));
    }
    if (runCommand.includes("--update-snapshots")) {
      issues.push(issue("operational_test_reliability_visual_run_command_updates_snapshots", { spec: suite.spec, command: suite.runCommand }));
    }
    if (updateCommand && !updateCommand.includes("--update-snapshots")) {
      issues.push(issue("operational_test_reliability_visual_update_command_without_update_flag", { spec: suite.spec, command: suite.updateCommand }));
    }
    for (const rel of badSnapshotNames) {
      issues.push(issue("operational_test_reliability_visual_snapshot_metadata_missing", { spec: suite.spec, snapshot: rel, browser: suite.browser, osAssumption: suite.osAssumption }));
    }
    suiteRows.push({
      spec: suite.spec,
      snapshotRoot: suite.snapshotRoot,
      snapshotCount: snapshots.length,
      owner: suite.owner,
      runCommand: suite.runCommand,
      updateCommand: suite.updateCommand,
      browser: suite.browser,
      device: suite.device,
      osAssumption: suite.osAssumption,
      diffThreshold: suite.diffThreshold,
      reviewEvidenceCommand: suite.reviewEvidenceCommand,
      badSnapshotNameCount: badSnapshotNames.length,
    });
  }

  return {
    routeMatrixCount: routeMatrices.length,
    missingRouteMatrixCount: routeMatrices.filter((row) => !row.present).length,
    suiteCount: suiteRows.length,
    snapshotCount: suiteRows.reduce((count, row) => count + row.snapshotCount, 0),
    badSnapshotNameCount: suiteRows.reduce((count, row) => count + row.badSnapshotNameCount, 0),
    routeMatrices,
    suites: suiteRows.sort((a, b) => a.spec.localeCompare(b.spec)),
  };
}

export function buildOperationalTestReliabilityGovernanceReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL, {});
  const issues = [];

  const wiring = checkConfigAndWiring(root, config, issues);
  const flakeClassification = analyzeFlakeClassification(root, config, issues);
  const quarantineGovernance = analyzeQuarantineGovernance(root, config, issues);
  const skipGovernance = analyzeSkipGovernance(root, config, issues);
  const testDataIsolation = analyzeTestDataIsolation(root, config, issues);
  const visualBaselineGovernance = analyzeVisualBaselineGovernance(root, config, issues);

  return {
    schemaVersion: 1,
    source: "code-owned-operational-test-reliability-governance",
    generatedArtifact: ARTIFACT_REL,
    ok: issues.length === 0,
    summary: {
      classifiedFailureCount: flakeClassification.classifiedFailureCount,
      quarantinedCount: quarantineGovernance.quarantined,
      skipCount: skipGovernance.skipCount,
      skipProblemCount: skipGovernance.problemCount,
      testDataIsolationViolationCount:
        testDataIsolation.hardcodedEmailViolationCount + testDataIsolation.mutableStateViolationCount + testDataIsolation.missingFixtureCount,
      visualSnapshotCount: visualBaselineGovernance.snapshotCount,
      visualSuiteCount: visualBaselineGovernance.suiteCount,
    },
    requiredValidationCommands: config.requiredValidationCommands ?? [],
    wiring,
    flakeClassification,
    quarantineGovernance,
    skipGovernance,
    testDataIsolation,
    visualBaselineGovernance,
    manualBoundary: config.manualBoundary ?? null,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = buildOperationalTestReliabilityGovernanceReport();

  if (WRITE) {
    writeJson(ROOT, ARTIFACT_REL, report);
  } else {
    const existing = readJson(ROOT, ARTIFACT_REL, null);
    if (!existing) {
      report.issues.push(issue("operational_test_reliability_artifact_missing", { artifact: ARTIFACT_REL }));
      report.issueCount = report.issues.length;
      report.ok = false;
    } else if (stableStringify(existing) !== stableStringify(report)) {
      report.issues.push(
        issue("operational_test_reliability_artifact_drift", {
          artifact: ARTIFACT_REL,
          writeCommand: "npm run write:operational-test-reliability-governance",
        })
      );
      report.issueCount = report.issues.length;
      report.ok = false;
    }
  }

  console.log(stableStringify(report));
  if (!report.ok) process.exitCode = 1;
}
