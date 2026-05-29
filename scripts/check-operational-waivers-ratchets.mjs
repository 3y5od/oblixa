#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-waivers-ratchets.json";
const WAIVER_REGISTRY_REL = "config/qa-external-waiver-registry.json";
const OBJECTIVES_REL = "config/operational-hardening-objectives.json";
const MANUAL_BOUNDARIES_REL = "config/operational-manual-boundaries.json";
const ARTIFACT_REL = "artifacts/operational-waivers-ratchets.json";
const WRITE = process.argv.includes("--write");

const REQUIRED_DEBT_METRICS = [
  "optionalChecks",
  "stubWorkflows",
  "warnOnlyScripts",
  "skippedTests",
  "allowlistRows",
  "uncoveredRoutes",
  "waivedObjectives",
];

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function readJson(rel) {
  return JSON.parse(readText(rel));
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function dateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(time) ? null : time;
}

function todayUtcDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(startDate, endDate) {
  const start = dateOnly(startDate);
  const end = dateOnly(endDate);
  if (start === null || end === null) return null;
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

function packageScripts() {
  return readJson("package.json").scripts ?? {};
}

function runJsonScript(scriptName, args = []) {
  const raw = execFileSync("node", [path.join(ROOT, "scripts", scriptName), ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return JSON.parse(raw);
}

function collectWorkflowFiles() {
  const workflowDir = path.join(ROOT, ".github", "workflows");
  return fs
    .readdirSync(workflowDir)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort((a, b) => a.localeCompare(b));
}

function isStubWorkflow(name, contents) {
  return (
    /(?:stub|optional|dast|zap|android|ios|windows|macos|k8s|helm|terraform|external|cdn|secrets-history)/i.test(name) ||
    contents.includes("if: false")
  );
}

function collectDebtMetrics({ scripts, hardeningDebt, objectives, waivers }) {
  const scriptEntries = Object.entries(scripts).sort(([a], [b]) => a.localeCompare(b));
  const optionalChecks = scriptEntries
    .filter(([name, command]) => (
      name.startsWith("check:") &&
      (name.includes("optional") || name === "check:supabase:prod" || name === "check:supabase:prod:deep" || /optional/i.test(command))
    ))
    .map(([name]) => name);
  const warnOnlyScripts = scriptEntries
    .filter(([name, command]) => /(?:--warn|warn-summary|\|\| true|continue)/i.test(`${name} ${command}`))
    .map(([name]) => name);
  const stubWorkflows = collectWorkflowFiles().filter((name) => {
    const contents = fs.readFileSync(path.join(ROOT, ".github", "workflows", name), "utf8");
    return isStubWorkflow(name, contents);
  });
  const waivedObjectiveCount = objectives.filter((row) => row.status === "waived").length;

  return {
    metrics: {
      optionalChecks: optionalChecks.length,
      stubWorkflows: stubWorkflows.length,
      warnOnlyScripts: warnOnlyScripts.length,
      skippedTests: Number(hardeningDebt.skipCount ?? 0),
      allowlistRows: Number(hardeningDebt.allowlistEntryCount ?? 0),
      uncoveredRoutes: Number(hardeningDebt.uncoveredApiRoutes ?? 0),
      waivedObjectives: waivedObjectiveCount + waivers.length,
    },
    detail: {
      optionalChecks,
      stubWorkflows,
      warnOnlyScripts,
      waivedObjectiveCount,
      waiverRows: waivers.map((row) => row.id).sort((a, b) => a.localeCompare(b)),
      hardeningDebtSource: {
        skipCount: hardeningDebt.skipCount ?? 0,
        allowlistEntryCount: hardeningDebt.allowlistEntryCount ?? 0,
        uncoveredApiRoutes: hardeningDebt.uncoveredApiRoutes ?? 0,
      },
    },
  };
}

function validateWaivers({ config, waiverRegistry, objectives, scripts }) {
  const issues = [];
  const asOfDate = config.asOfDate;
  const requiredFields = Array.isArray(config.requiredWaiverFields) ? config.requiredWaiverFields : [];
  const allowedRiskLevels = new Set(config.allowedRiskLevels ?? []);
  const allowedBlockerClasses = new Set(config.allowedBlockerClasses ?? []);
  const objectiveIds = new Set(objectives.map((row) => row.id));
  const waivers = Array.isArray(waiverRegistry.waivers) ? waiverRegistry.waivers : [];
  const ids = new Map();
  const scopes = new Map();
  const issuePattern = /^(GH-\d+|https:\/\/)/i;

  if (waiverRegistry.version !== 1) {
    issues.push(issue("operational_waiver_invalid_registry_version", { version: waiverRegistry.version }));
  }
  if (!Array.isArray(waiverRegistry.waivers)) {
    issues.push(issue("operational_waiver_registry_missing_array"));
  }

  for (const row of waivers) {
    for (const field of requiredFields) {
      if (row[field] === undefined || row[field] === null || String(row[field]).trim() === "") {
        issues.push(issue("operational_waiver_missing_required_field", { id: row.id ?? "(missing)", field }));
      }
    }

    if (typeof row.id === "string") {
      if (ids.has(row.id)) {
        issues.push(issue("operational_waiver_duplicate_id", { id: row.id, firstScope: ids.get(row.id), duplicateScope: row.scope }));
      }
      ids.set(row.id, row.scope);
    }
    if (typeof row.scope === "string") {
      if (scopes.has(row.scope)) {
        issues.push(issue("operational_waiver_duplicate_scope", { scope: row.scope, firstId: scopes.get(row.scope), duplicateId: row.id }));
      }
      scopes.set(row.scope, row.id);
    }

    if (row.issue && !issuePattern.test(String(row.issue))) {
      issues.push(issue("operational_waiver_invalid_issue_reference", { id: row.id, issue: row.issue }));
    }
    if (!allowedRiskLevels.has(row.risk)) {
      issues.push(issue("operational_waiver_invalid_risk", { id: row.id, risk: row.risk }));
    }
    if (!allowedBlockerClasses.has(row.blockerClass)) {
      issues.push(issue("operational_waiver_invalid_blocker_class", { id: row.id, blockerClass: row.blockerClass }));
    }
    if (row.expiry !== row.expires) {
      issues.push(issue("operational_waiver_expiry_alias_mismatch", { id: row.id, expiry: row.expiry, expires: row.expires }));
    }
    if (dateOnly(row.expiry) === null) {
      issues.push(issue("operational_waiver_invalid_expiry", { id: row.id, expiry: row.expiry }));
    } else if (daysBetween(todayUtcDateOnly(), row.expiry) < 0) {
      issues.push(issue("operational_waiver_expired", { id: row.id, expiry: row.expiry }));
    }
    if (dateOnly(row.lastReviewedDate) === null) {
      issues.push(issue("operational_waiver_invalid_last_reviewed_date", { id: row.id, lastReviewedDate: row.lastReviewedDate }));
    } else if (daysBetween(row.lastReviewedDate, asOfDate) < 0) {
      issues.push(issue("operational_waiver_review_date_after_as_of", { id: row.id, lastReviewedDate: row.lastReviewedDate, asOfDate }));
    }
    if (!scripts[row.validationCommand]) {
      issues.push(issue("operational_waiver_unknown_validation_command", { id: row.id, validationCommand: row.validationCommand }));
    }
    if (!objectiveIds.has(row.replacementObjective)) {
      issues.push(issue("operational_waiver_unknown_replacement_objective", { id: row.id, replacementObjective: row.replacementObjective }));
    }

    const usagePaths = [
      row.policy_path,
      row.workflow_path,
      ...(Array.isArray(row.usagePaths) ? row.usagePaths : []),
    ].filter(Boolean);
    if (usagePaths.length === 0) {
      issues.push(issue("operational_waiver_unused_no_usage_path", { id: row.id }));
    }
    for (const usagePath of usagePaths) {
      if (!fileExists(usagePath)) {
        issues.push(issue("operational_waiver_usage_path_missing", { id: row.id, usagePath }));
      }
    }
  }

  const preExpiryReport = {};
  for (const dayCount of config.preExpiryWarningDays ?? []) {
    const key = `within${dayCount}Days`;
    preExpiryReport[key] = waivers
      .map((row) => ({ id: row.id, owner: row.owner, scope: row.scope, expiry: row.expiry, daysUntilExpiry: daysBetween(asOfDate, row.expiry) }))
      .filter((row) => Number.isFinite(row.daysUntilExpiry) && row.daysUntilExpiry >= 0 && row.daysUntilExpiry <= dayCount)
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry || String(a.id).localeCompare(String(b.id)));
  }

  const activeWaiverCount = waivers.filter((row) => Number.isFinite(daysBetween(todayUtcDateOnly(), row.expiry)) && daysBetween(todayUtcDateOnly(), row.expiry) >= 0).length;

  return {
    issueCount: issues.length,
    issues,
    waiverCount: waivers.length,
    activeWaiverCount,
    preExpiryReport: {
      asOfDate,
      horizons: config.preExpiryWarningDays ?? [],
      buckets: preExpiryReport,
    },
    waivers: waivers
      .map((row) => ({
        id: row.id,
        scope: row.scope,
        owner: row.owner,
        risk: row.risk,
        blockerClass: row.blockerClass,
        expiry: row.expiry,
        validationCommand: row.validationCommand,
        replacementObjective: row.replacementObjective,
        lastReviewedDate: row.lastReviewedDate,
      }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),
  };
}

function validateDebtRatchet({ config, currentDebt, scripts }) {
  const issues = [];
  const ratchet = config.debtRatchet ?? {};
  const baselineMetrics = ratchet.metrics ?? {};

  if (!ratchet.owner || !String(ratchet.owner).trim()) {
    issues.push(issue("operational_debt_ratchet_missing_owner"));
  }
  if (!scripts[ratchet.validationCommand]) {
    issues.push(issue("operational_debt_ratchet_unknown_validation_command", { validationCommand: ratchet.validationCommand }));
  }
  if (dateOnly(ratchet.baselineDate) === null) {
    issues.push(issue("operational_debt_ratchet_invalid_baseline_date", { baselineDate: ratchet.baselineDate }));
  }

  const checks = REQUIRED_DEBT_METRICS.map((metric) => {
    const baseline = Number(baselineMetrics[metric]);
    const current = Number(currentDebt.metrics[metric]);
    if (!Number.isFinite(baseline)) {
      issues.push(issue("operational_debt_ratchet_missing_metric_baseline", { metric }));
    }
    if (!Number.isFinite(current)) {
      issues.push(issue("operational_debt_ratchet_missing_current_metric", { metric }));
    }
    return {
      metric,
      baseline,
      current,
      delta: Number.isFinite(baseline) && Number.isFinite(current) ? current - baseline : null,
    };
  });

  const regressions = checks.filter((row) => Number.isFinite(row.delta) && row.delta > 0);
  const ratchetCandidates = checks.filter((row) => Number.isFinite(row.delta) && row.delta < 0);
  for (const row of regressions) {
    issues.push(issue("operational_debt_ratchet_regression", row));
  }

  return {
    issueCount: issues.length,
    issues,
    owner: ratchet.owner,
    baselineDate: ratchet.baselineDate,
    validationCommand: ratchet.validationCommand,
    current: currentDebt.metrics,
    baseline: Object.fromEntries(REQUIRED_DEBT_METRICS.map((metric) => [metric, baselineMetrics[metric]])),
    checks,
    regressionCount: regressions.length,
    regressions,
    ratchetCandidateCount: ratchetCandidates.length,
    ratchetCandidates,
    detail: currentDebt.detail,
  };
}

function validateManualBoundaries({ config, objectives, manualBoundaries, scripts }) {
  const issues = [];
  const requiredClasses = new Set(config.manualBoundary?.requiredClasses ?? []);
  const coverageRows = Array.isArray(config.manualBoundary?.objectiveCoverage) ? config.manualBoundary.objectiveCoverage : [];
  const manualActions = Array.isArray(manualBoundaries.manualActions) ? manualBoundaries.manualActions : [];
  const manualActionById = new Map(manualActions.map((row) => [row.id, row]));
  const coverageByObjectiveId = new Map(coverageRows.map((row) => [row.objectiveId, row]));
  const objectivesById = new Map(objectives.map((row) => [row.id, row]));
  const classToActions = new Map();

  for (const action of manualActions) {
    if (!Array.isArray(action.boundaryClasses) || action.boundaryClasses.length === 0) {
      issues.push(issue("operational_manual_boundary_missing_classes", { id: action.id }));
    }
    for (const classId of action.boundaryClasses ?? []) {
      if (!classToActions.has(classId)) classToActions.set(classId, []);
      classToActions.get(classId).push(action.id);
    }
    if (!action.smallestNextAction || !String(action.smallestNextAction).trim()) {
      issues.push(issue("operational_manual_boundary_missing_smallest_action", { id: action.id }));
    }
    if (!scripts[action.readinessCommand]) {
      issues.push(issue("operational_manual_boundary_unknown_readiness_command", { id: action.id, readinessCommand: action.readinessCommand }));
    }
  }

  for (const classId of requiredClasses) {
    if (!classToActions.has(classId)) {
      issues.push(issue("operational_manual_boundary_required_class_uncovered", { classId }));
    }
  }

  for (const objective of objectives.filter((row) => row.manualBoundary)) {
    const coverage = coverageByObjectiveId.get(objective.id);
    if (!coverage) {
      issues.push(issue("operational_manual_boundary_objective_missing_coverage", { id: objective.id }));
      continue;
    }
    if (!Array.isArray(coverage.manualActionIds) || coverage.manualActionIds.length === 0) {
      issues.push(issue("operational_manual_boundary_objective_missing_actions", { id: objective.id }));
    }
    for (const actionId of coverage.manualActionIds ?? []) {
      if (!manualActionById.has(actionId)) {
        issues.push(issue("operational_manual_boundary_objective_unknown_action", { id: objective.id, actionId }));
      }
    }
    if (!Array.isArray(coverage.codeEvidence) || coverage.codeEvidence.length === 0) {
      issues.push(issue("operational_manual_boundary_objective_missing_code_evidence", { id: objective.id }));
    }
    for (const evidence of coverage.codeEvidence ?? []) {
      if (!scripts[evidence] && evidence !== ARTIFACT_REL && !fileExists(evidence)) {
        issues.push(issue("operational_manual_boundary_objective_missing_code_evidence_ref", { id: objective.id, evidence }));
      }
    }
    if (!coverage.codeEvidence?.includes(objective.validationCommand)) {
      issues.push(issue("operational_manual_boundary_objective_missing_validation_command_evidence", {
        id: objective.id,
        validationCommand: objective.validationCommand,
      }));
    }
  }

  for (const row of coverageRows) {
    if (!objectivesById.has(row.objectiveId)) {
      issues.push(issue("operational_manual_boundary_coverage_unknown_objective", { objectiveId: row.objectiveId }));
    }
  }

  const coverage = coverageRows
    .map((row) => {
      const objective = objectivesById.get(row.objectiveId);
      return {
        objectiveId: row.objectiveId,
        status: objective?.status ?? null,
        manualActions: (row.manualActionIds ?? [])
          .map((actionId) => {
            const action = manualActionById.get(actionId);
            return action
              ? {
                  id: action.id,
                  boundaryClasses: action.boundaryClasses ?? [],
                  smallestNextAction: action.smallestNextAction,
                  readinessCommand: action.readinessCommand,
                }
              : { id: actionId, missing: true };
          })
          .sort((a, b) => String(a.id).localeCompare(String(b.id))),
        codeEvidence: row.codeEvidence ?? [],
      };
    })
    .sort((a, b) => String(a.objectiveId).localeCompare(String(b.objectiveId)));

  return {
    issueCount: issues.length,
    issues,
    requiredClasses: [...requiredClasses].sort((a, b) => a.localeCompare(b)),
    requiredClassCoverage: Object.fromEntries(
      [...requiredClasses]
        .sort((a, b) => a.localeCompare(b))
        .map((classId) => [classId, (classToActions.get(classId) ?? []).sort((a, b) => a.localeCompare(b))]),
    ),
    manualActionCount: manualActions.length,
    objectiveCoverageCount: coverageRows.length,
    coverage,
  };
}

function buildReport() {
  const config = readJson(CONFIG_REL);
  const waiverRegistry = readJson(config.waiverRegistry ?? WAIVER_REGISTRY_REL);
  const objectives = readJson(OBJECTIVES_REL).objectives ?? [];
  const manualBoundaries = readJson(MANUAL_BOUNDARIES_REL);
  const scripts = packageScripts();
  const hardeningDebt = runJsonScript("report-hardening-debt.mjs");
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-waivers-ratchets") {
    issues.push(issue("operational_waivers_ratchets_invalid_config_metadata"));
  }
  if (dateOnly(config.asOfDate) === null) {
    issues.push(issue("operational_waivers_ratchets_invalid_as_of_date", { asOfDate: config.asOfDate }));
  } else if (daysBetween(config.asOfDate, todayUtcDateOnly()) > 45) {
    issues.push(issue("operational_waivers_ratchets_stale_as_of_date", { asOfDate: config.asOfDate, today: todayUtcDateOnly() }));
  }
  if ((config.waiverRegistry ?? WAIVER_REGISTRY_REL) !== WAIVER_REGISTRY_REL) {
    issues.push(issue("operational_waivers_ratchets_unexpected_waiver_registry", { waiverRegistry: config.waiverRegistry }));
  }

  const waiverReport = validateWaivers({ config, waiverRegistry, objectives, scripts });
  const currentDebt = collectDebtMetrics({ scripts, hardeningDebt, objectives, waivers: waiverRegistry.waivers ?? [] });
  const debtReport = validateDebtRatchet({ config, currentDebt, scripts });
  const manualBoundaryReport = validateManualBoundaries({ config, objectives, manualBoundaries, scripts });

  issues.push(...waiverReport.issues, ...debtReport.issues, ...manualBoundaryReport.issues);

  return {
    schemaVersion: 1,
    source: "code-owned-operational-waivers-ratchets",
    generatedFrom: CONFIG_REL,
    waiverRegistry: config.waiverRegistry ?? WAIVER_REGISTRY_REL,
    objectiveRegistry: OBJECTIVES_REL,
    manualBoundaryRegistry: MANUAL_BOUNDARIES_REL,
    asOfDate: config.asOfDate,
    waiverSchema: {
      requiredFields: config.requiredWaiverFields ?? [],
      allowedRiskLevels: config.allowedRiskLevels ?? [],
      allowedBlockerClasses: config.allowedBlockerClasses ?? [],
    },
    waiverReport: {
      waiverCount: waiverReport.waiverCount,
      activeWaiverCount: waiverReport.activeWaiverCount,
      preExpiryReport: waiverReport.preExpiryReport,
      waivers: waiverReport.waivers,
    },
    debtRatchet: {
      owner: debtReport.owner,
      baselineDate: debtReport.baselineDate,
      validationCommand: debtReport.validationCommand,
      current: debtReport.current,
      baseline: debtReport.baseline,
      checks: debtReport.checks,
      regressionCount: debtReport.regressionCount,
      regressions: debtReport.regressions,
      ratchetCandidateCount: debtReport.ratchetCandidateCount,
      ratchetCandidates: debtReport.ratchetCandidates,
      detail: debtReport.detail,
    },
    manualBoundaryClassification: {
      requiredClasses: manualBoundaryReport.requiredClasses,
      requiredClassCoverage: manualBoundaryReport.requiredClassCoverage,
      manualActionCount: manualBoundaryReport.manualActionCount,
      objectiveCoverageCount: manualBoundaryReport.objectiveCoverageCount,
      coverage: manualBoundaryReport.coverage,
    },
    issueCount: issues.length,
    issues,
  };
}

function main() {
  let report;
  try {
    report = buildReport();
  } catch (error) {
    console.error(stableStringify({ ok: false, error: error.message }));
    process.exit(1);
  }

  const artifactPath = path.join(ROOT, ARTIFACT_REL);
  const serialized = stableStringify(report);
  if (WRITE) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, serialized);
  } else if (!fs.existsSync(artifactPath)) {
    report.issues.push(issue("operational_waivers_ratchets_artifact_missing", { artifact: ARTIFACT_REL }));
    report.issueCount = report.issues.length;
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    report.issues.push(issue("operational_waivers_ratchets_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-waivers-ratchets",
    }));
    report.issueCount = report.issues.length;
  }

  if (report.issueCount > 0) {
    console.error(stableStringify({ ok: false, ...report }));
    process.exit(1);
  }

  console.log(stableStringify({ ok: true, ...report }));
}

main();
