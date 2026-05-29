#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const REGISTRY_REL = "config/operational-hardening-objectives.json";
const RATCHET_REL = "config/operational-hardening-ratchet.json";
const MANUAL_BOUNDARIES_REL = "config/operational-manual-boundaries.json";
const ARTIFACT_REL = "artifacts/operational-hardening-closure.json";
const WRITE = process.argv.includes("--write");

const VALID_STATUSES = new Set(["implemented", "pending", "manual_boundary", "waived"]);
const VALID_SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const REQUIRED_KEYS = [
  "id",
  "section",
  "title",
  "status",
  "ownerArea",
  "severity",
  "objectiveClass",
  "validationCommand",
  "ciLane",
];

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJson(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    throw new Error(`Missing required JSON file: ${rel}`);
  }
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function packageScripts() {
  return readJson("package.json").scripts ?? {};
}

function validateObjective(row, seenIds, scripts) {
  const issues = [];
  for (const key of REQUIRED_KEYS) {
    if (row[key] === undefined || row[key] === null || String(row[key]).trim() === "") {
      issues.push(issue("operational_hardening_missing_required_field", { id: row.id ?? "(missing)", key }));
    }
  }

  if (typeof row.id === "string") {
    if (!/^oph-\d{3}-[a-z0-9-]+$/.test(row.id)) {
      issues.push(issue("operational_hardening_invalid_id", { id: row.id }));
    }
    if (seenIds.has(row.id)) {
      issues.push(issue("operational_hardening_duplicate_id", { id: row.id }));
    }
    seenIds.add(row.id);
  }

  if (!VALID_STATUSES.has(row.status)) {
    issues.push(issue("operational_hardening_invalid_status", { id: row.id, status: row.status }));
  }
  if (!VALID_SEVERITIES.has(row.severity)) {
    issues.push(issue("operational_hardening_invalid_severity", { id: row.id, severity: row.severity }));
  }

  if (typeof row.validationCommand === "string" && row.validationCommand.trim()) {
    if (!scripts[row.validationCommand]) {
      issues.push(issue("operational_hardening_unknown_validation_command", { id: row.id, validationCommand: row.validationCommand }));
    }
  }

  if (row.status === "implemented") {
    if (typeof row.evidenceArtifact !== "string" || !row.evidenceArtifact.trim()) {
      issues.push(issue("operational_hardening_implemented_missing_evidence_artifact", { id: row.id }));
    } else if (row.evidenceArtifact !== ARTIFACT_REL && !fileExists(row.evidenceArtifact)) {
      issues.push(issue("operational_hardening_implemented_evidence_artifact_missing", { id: row.id, evidenceArtifact: row.evidenceArtifact }));
    }
  }

  if ((row.status === "manual_boundary" || row.status === "waived") && (!row.manualBoundary || !String(row.manualBoundary).trim())) {
    issues.push(issue("operational_hardening_boundary_missing_reason", { id: row.id, status: row.status }));
  }

  return issues;
}

function validateManualBoundaries(manualBoundaries, scripts) {
  const issues = [];
  if (manualBoundaries.schemaVersion !== 1 || manualBoundaries.source !== "code-owned-operational-manual-boundaries") {
    issues.push(issue("operational_hardening_invalid_manual_boundary_metadata"));
  }

  const manualActions = Array.isArray(manualBoundaries.manualActions) ? manualBoundaries.manualActions : [];
  const providerRows = Array.isArray(manualBoundaries.providerConsoleVerification) ? manualBoundaries.providerConsoleVerification : [];
  const riskClasses = Array.isArray(manualBoundaries.environmentRiskClasses) ? manualBoundaries.environmentRiskClasses : [];
  const seenIds = new Set();

  for (const row of manualActions) {
    for (const key of ["id", "category", "ownerArea", "externalSystem", "smallestNextAction", "readinessCommand"]) {
      if (!row[key] || !String(row[key]).trim()) {
        issues.push(issue("operational_hardening_manual_action_missing_field", { id: row.id ?? "(missing)", key }));
      }
    }
    if (seenIds.has(row.id)) {
      issues.push(issue("operational_hardening_duplicate_manual_action", { id: row.id }));
    }
    seenIds.add(row.id);
    if (row.readinessCommand && !scripts[row.readinessCommand]) {
      issues.push(issue("operational_hardening_manual_action_unknown_readiness_command", { id: row.id, readinessCommand: row.readinessCommand }));
    }
    if (typeof row.productionOnly !== "boolean") {
      issues.push(issue("operational_hardening_manual_action_missing_production_class", { id: row.id }));
    }
  }

  for (const row of providerRows) {
    for (const key of ["provider", "ownerArea", "readinessCommand"]) {
      if (!row[key] || !String(row[key]).trim()) {
        issues.push(issue("operational_hardening_provider_stub_missing_field", { provider: row.provider ?? "(missing)", key }));
      }
    }
    if (!Array.isArray(row.codeCanVerify) || row.codeCanVerify.length === 0) {
      issues.push(issue("operational_hardening_provider_stub_missing_code_verification", { provider: row.provider }));
    }
    if (!Array.isArray(row.manualMustVerify) || row.manualMustVerify.length === 0) {
      issues.push(issue("operational_hardening_provider_stub_missing_manual_verification", { provider: row.provider }));
    }
    if (row.readinessCommand && !scripts[row.readinessCommand]) {
      issues.push(issue("operational_hardening_provider_stub_unknown_readiness_command", { provider: row.provider, readinessCommand: row.readinessCommand }));
    }
  }

  const riskIds = new Set();
  for (const row of riskClasses) {
    for (const key of ["id", "description"]) {
      if (!row[key] || !String(row[key]).trim()) {
        issues.push(issue("operational_hardening_risk_class_missing_field", { id: row.id ?? "(missing)", key }));
      }
    }
    if (riskIds.has(row.id)) {
      issues.push(issue("operational_hardening_duplicate_risk_class", { id: row.id }));
    }
    riskIds.add(row.id);
    if (!Array.isArray(row.examples) || row.examples.length === 0) {
      issues.push(issue("operational_hardening_risk_class_missing_examples", { id: row.id }));
    }
    if (typeof row.defaultCommandAllowed !== "boolean") {
      issues.push(issue("operational_hardening_risk_class_missing_default_policy", { id: row.id }));
    }
  }

  return {
    issueCount: issues.length,
    issues,
    manualActionCount: manualActions.length,
    providerVerificationCount: providerRows.length,
    environmentRiskClassCount: riskClasses.length,
    productionOnlyManualActionCount: manualActions.filter((row) => row.productionOnly).length,
  };
}

function buildReport(registry, ratchet, manualBoundaries, scripts) {
  const seenIds = new Set();
  const objectives = Array.isArray(registry.objectives) ? registry.objectives : [];
  const validationIssues = [];

  if (registry.schemaVersion !== 1) {
    validationIssues.push(issue("operational_hardening_invalid_schema_version", { schemaVersion: registry.schemaVersion }));
  }
  if (registry.source !== "code-owned-operational-hardening-closure") {
    validationIssues.push(issue("operational_hardening_invalid_source", { source: registry.source }));
  }
  if (!Array.isArray(registry.objectives)) {
    validationIssues.push(issue("operational_hardening_objectives_not_array"));
  }

  for (const row of objectives) {
    validationIssues.push(...validateObjective(row, seenIds, scripts));
  }

  const countsByStatus = {};
  const countsBySeverity = {};
  const countsByOwnerArea = {};
  const manualBoundaryObjectives = [];
  const manualBoundaryReport = validateManualBoundaries(manualBoundaries, scripts);
  validationIssues.push(...manualBoundaryReport.issues);

  for (const row of objectives) {
    countsByStatus[row.status] = (countsByStatus[row.status] ?? 0) + 1;
    countsBySeverity[row.severity] = (countsBySeverity[row.severity] ?? 0) + 1;
    countsByOwnerArea[row.ownerArea] = (countsByOwnerArea[row.ownerArea] ?? 0) + 1;
    if (row.manualBoundary) {
      manualBoundaryObjectives.push({
        id: row.id,
        section: row.section,
        ownerArea: row.ownerArea,
        manualBoundary: row.manualBoundary,
        validationCommand: row.validationCommand,
      });
    }
  }

  const implementedCount = countsByStatus.implemented ?? 0;
  const objectiveCount = objectives.length;
  const readinessScore = objectiveCount === 0 ? 0 : Number((implementedCount / objectiveCount).toFixed(4));
  const pendingCount = (countsByStatus.pending ?? 0) + (countsByStatus.manual_boundary ?? 0) + (countsByStatus.waived ?? 0);
  const scoresByOwnerArea = Object.fromEntries(
    Object.keys(countsByOwnerArea)
      .sort((a, b) => a.localeCompare(b))
      .map((ownerArea) => {
        const ownerRows = objectives.filter((row) => row.ownerArea === ownerArea);
        const ownerImplemented = ownerRows.filter((row) => row.status === "implemented").length;
        return [ownerArea, Number((ownerImplemented / ownerRows.length).toFixed(4))];
      }),
  );

  if (objectiveCount === 0) {
    validationIssues.push(issue("operational_hardening_empty_registry"));
  }
  if (ratchet.schemaVersion !== 1 || ratchet.source !== "code-owned-operational-hardening-ratchet") {
    validationIssues.push(issue("operational_hardening_invalid_ratchet_metadata"));
  }
  if (readinessScore < Number(ratchet.minimumReadinessScore)) {
    validationIssues.push(issue("operational_hardening_readiness_score_below_ratchet", {
      readinessScore,
      minimumReadinessScore: ratchet.minimumReadinessScore,
    }));
  }
  if (implementedCount < Number(ratchet.minimumImplementedCount)) {
    validationIssues.push(issue("operational_hardening_implemented_count_below_ratchet", {
      implementedCount,
      minimumImplementedCount: ratchet.minimumImplementedCount,
    }));
  }
  if (pendingCount > Number(ratchet.maximumPendingCount)) {
    validationIssues.push(issue("operational_hardening_pending_count_above_ratchet", {
      pendingCount,
      maximumPendingCount: ratchet.maximumPendingCount,
    }));
  }

  return {
    schemaVersion: 1,
    source: "code-owned-operational-hardening-closure",
    generatedFrom: REGISTRY_REL,
    ratchetSource: RATCHET_REL,
    manualBoundariesSource: MANUAL_BOUNDARIES_REL,
    ratchet: {
      minimumReadinessScore: ratchet.minimumReadinessScore,
      minimumImplementedCount: ratchet.minimumImplementedCount,
      maximumPendingCount: ratchet.maximumPendingCount,
    },
    objectiveCount,
    implementedCount,
    pendingCount,
    readinessScore,
    countsByStatus: Object.fromEntries(Object.entries(countsByStatus).sort(([a], [b]) => a.localeCompare(b))),
    countsBySeverity: Object.fromEntries(Object.entries(countsBySeverity).sort(([a], [b]) => a.localeCompare(b))),
    countsByOwnerArea: Object.fromEntries(Object.entries(countsByOwnerArea).sort(([a], [b]) => a.localeCompare(b))),
    scoresByOwnerArea,
    manualBoundaryCount: manualBoundaryObjectives.length,
    manualBoundaryBacklog: {
      manualActionCount: manualBoundaryReport.manualActionCount,
      providerVerificationCount: manualBoundaryReport.providerVerificationCount,
      environmentRiskClassCount: manualBoundaryReport.environmentRiskClassCount,
      productionOnlyManualActionCount: manualBoundaryReport.productionOnlyManualActionCount,
    },
    manualBoundaryObjectives: manualBoundaryObjectives.sort((a, b) => a.id.localeCompare(b.id)),
    implementedObjectives: objectives
      .filter((row) => row.status === "implemented")
      .map((row) => ({
        id: row.id,
        section: row.section,
        title: row.title,
        validationCommand: row.validationCommand,
        evidenceArtifact: row.evidenceArtifact,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    pendingObjectives: objectives
      .filter((row) => row.status !== "implemented")
      .map((row) => ({
        id: row.id,
        section: row.section,
        title: row.title,
        status: row.status,
        validationCommand: row.validationCommand,
        manualBoundary: row.manualBoundary,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    issueCount: validationIssues.length,
    issues: validationIssues,
  };
}

function main() {
  let registry;
  let ratchet;
  let manualBoundaries;
  let scripts;
  try {
    registry = readJson(REGISTRY_REL);
    ratchet = readJson(RATCHET_REL);
    manualBoundaries = readJson(MANUAL_BOUNDARIES_REL);
    scripts = packageScripts();
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  }

  const report = buildReport(registry, ratchet, manualBoundaries, scripts);
  const serialized = stableStringify(report);
  const artifactPath = path.join(ROOT, ARTIFACT_REL);

  if (WRITE) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, serialized);
  } else if (!fs.existsSync(artifactPath)) {
    report.issues.push(issue("operational_hardening_closure_artifact_missing", { artifact: ARTIFACT_REL }));
    report.issueCount = report.issues.length;
  } else {
    const current = fs.readFileSync(artifactPath, "utf8");
    if (current !== serialized) {
      report.issues.push(issue("operational_hardening_closure_artifact_drift", { artifact: ARTIFACT_REL, writeCommand: "npm run write:operational-hardening-objectives" }));
      report.issueCount = report.issues.length;
    }
  }

  if (report.issueCount > 0) {
    console.error(stableStringify({ ok: false, ...report }));
    process.exit(1);
  }

  console.log(stableStringify({ ok: true, ...report }));
}

main();
