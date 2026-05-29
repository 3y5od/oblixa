#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-dr-incident-readiness.json";
const MANUAL_BOUNDARIES_REL = "config/operational-manual-boundaries.json";
const ARTIFACT_REL = "artifacts/operational-dr-incident-readiness.json";
const FOLLOW_UP_ARTIFACT_REL = "artifacts/operational-incident-follow-up-template.json";
const CI_REL = ".github/workflows/ci.yml";
const ENV_EXAMPLE_REL = ".env.example";
const WRITE = process.argv.includes("--write");

const REQUIRED_DR_DRILLS = new Set([
  "backup-metadata",
  "env-presence",
  "redacted-evidence",
  "restore-runbook-completeness",
]);

const REQUIRED_SCENARIOS = new Set([
  "auth-outage",
  "bad-deploy",
  "bad-migration",
  "cron-failure",
  "data-leak",
  "db-outage",
  "elevated-5xx",
  "provider-outage",
  "secret-exposure",
  "webhook-replay",
]);

const REQUIRED_RUNBOOKS = new Set([
  "bad-deploy-rollback",
  "bad-migration-forward-fix",
  "database-restore",
  "provider-outage-degrade",
  "security-incident-containment",
]);

const REQUIRED_GAME_DAY_WORKFLOWS = new Set(["qa-game-day"]);

const REQUIRED_FOLLOW_UP_FIELDS = new Set([
  "affectedControls",
  "dueDates",
  "evidenceArtifacts",
  "failedChecks",
  "incidentId",
  "newTests",
  "owners",
  "redactionReview",
  "severity",
  "timeline",
  "validationCommands",
]);

const SENSITIVE_KEY_PATTERN =
  /^(?:api[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role[_-]?key|secret|password|authorization|cookie|set-cookie|private[_-]?key|connection[_-]?string)$/iu;

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  if (!rel) return "";
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel) {
  const text = read(root, rel);
  if (!text) throw new Error(`Missing JSON file: ${rel}`);
  return JSON.parse(text);
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function commandText(script) {
  return `npm run ${script}`;
}

function scriptSourcePath(command) {
  const match = /\bnode\s+(scripts\/[A-Za-z0-9._/-]+\.mjs)\b/u.exec(command ?? "");
  return match?.[1] ?? null;
}

function validateCommands(root, config, packageScripts, ci, issues) {
  const rows = [];
  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(packageScripts[script]);
      const ciPresent = ci.includes(commandText(script));
      if (!packageScriptPresent) {
        issues.push(issue("incident_readiness_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("incident_readiness_missing_ci_command", { objective: objective.id, script }));
      }
      rows.push({
        objective: objective.id,
        script,
        ciRequired: Boolean(row.ciRequired),
        packageScriptPresent,
        ciPresent,
        covers: [...(row.covers ?? [])].sort((a, b) => a.localeCompare(b)),
      });
    }
    for (const rel of objective.artifacts ?? []) {
      if (rel !== ARTIFACT_REL && rel !== FOLLOW_UP_ARTIFACT_REL && !fs.existsSync(path.join(root, rel))) {
        issues.push(issue("incident_readiness_missing_objective_artifact", { objective: objective.id, path: rel }));
      }
    }
  }
  return rows.sort((a, b) => `${a.objective}:${a.script}`.localeCompare(`${b.objective}:${b.script}`));
}

function validateManualBoundaries(root, config, issues) {
  const manual = readJson(root, MANUAL_BOUNDARIES_REL);
  const rows = [];
  for (const id of config.manualBoundaryIds ?? []) {
    const row = (manual.manualActions ?? []).find((entry) => entry.id === id) ?? null;
    if (!row) {
      issues.push(issue("incident_readiness_missing_manual_boundary", { id }));
      rows.push({ id, present: false, readinessCommand: null, productionOnly: null });
      continue;
    }
    rows.push({
      id,
      present: true,
      category: row.category,
      ownerArea: row.ownerArea,
      externalSystem: row.externalSystem,
      readinessCommand: row.readinessCommand,
      productionOnly: Boolean(row.productionOnly),
    });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

function validateNoMutationSurface(root, label, relOrCommand, forbiddenPatterns, issues) {
  const text = relOrCommand && fs.existsSync(path.join(root, relOrCommand)) ? read(root, relOrCommand) : (relOrCommand ?? "");
  const findings = [];
  for (const patternText of forbiddenPatterns) {
    const pattern = new RegExp(patternText, "iu");
    if (pattern.test(text)) {
      findings.push(patternText);
      issues.push(issue("incident_readiness_forbidden_mutation_surface", { label, pattern: patternText }));
    }
  }
  return findings;
}

function validateEnvNames(envNames, envExample, source, id, issues) {
  const rows = [];
  for (const envName of envNames ?? []) {
    const declaredInExample = envExample.includes(envName);
    const referencedInSource = !source || source.includes(envName);
    if (!declaredInExample) {
      issues.push(issue("incident_readiness_env_not_declared", { id, envName, path: ENV_EXAMPLE_REL }));
    }
    if (!referencedInSource) {
      issues.push(issue("incident_readiness_env_not_referenced_by_source", { id, envName }));
    }
    rows.push({ envName, declaredInExample, referencedInSource });
  }
  return rows.sort((a, b) => a.envName.localeCompare(b.envName));
}

function validateDrDrills(root, config, packageScripts, envExample, issues) {
  const seen = new Set();
  const rows = [];
  const forbiddenPatterns = config.forbiddenMutationPatterns ?? [];
  for (const row of config.drDrills ?? []) {
    if (seen.has(row.id)) issues.push(issue("incident_readiness_dr_drill_duplicate_id", { id: row.id }));
    seen.add(row.id);
    const packageCommand = packageScripts[row.command] ?? "";
    const sourcePath = scriptSourcePath(packageCommand);
    const source = sourcePath ? read(root, sourcePath) : "";
    const sourceFindings = validateNoMutationSurface(root, row.id, sourcePath ?? packageCommand, forbiddenPatterns, issues);
    const commandFindings = validateNoMutationSurface(root, `${row.id}:package-command`, packageCommand, forbiddenPatterns, issues);
    const evidenceExists = row.evidenceArtifact === ARTIFACT_REL || fs.existsSync(path.join(root, row.evidenceArtifact ?? ""));
    if (!packageCommand) {
      issues.push(issue("incident_readiness_dr_drill_missing_command", { id: row.id, command: row.command }));
    }
    if (row.mutatesProduction !== false) {
      issues.push(issue("incident_readiness_dr_drill_may_mutate_production", { id: row.id }));
    }
    if (!evidenceExists) {
      issues.push(issue("incident_readiness_dr_drill_missing_evidence", { id: row.id, evidenceArtifact: row.evidenceArtifact }));
    }
    rows.push({
      id: row.id,
      command: row.command,
      packageScriptPresent: Boolean(packageCommand),
      sourcePath,
      env: validateEnvNames(row.envNames, envExample, source, row.id, issues),
      evidenceArtifact: row.evidenceArtifact,
      evidenceExists,
      redaction: row.redaction,
      mutatesProduction: row.mutatesProduction,
      forbiddenMutationFindingCount: sourceFindings.length + commandFindings.length,
      ok:
        Boolean(packageCommand) &&
        evidenceExists &&
        row.mutatesProduction === false &&
        sourceFindings.length + commandFindings.length === 0,
    });
  }
  for (const id of REQUIRED_DR_DRILLS) {
    if (!seen.has(id)) issues.push(issue("incident_readiness_dr_drill_missing_required_id", { id }));
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

function validateIncidentScenarios(root, config, packageScripts, issues) {
  const seen = new Set();
  const rows = [];
  for (const row of config.incidentScenarios ?? []) {
    if (seen.has(row.id)) issues.push(issue("incident_readiness_scenario_duplicate_id", { id: row.id }));
    seen.add(row.id);
    const missingFields = [];
    for (const field of ["ownerArea", "detectionSignal", "firstAction", "rollbackPath", "validationCommand", "evidenceArtifact"]) {
      if (typeof row[field] !== "string" || row[field].trim() === "") missingFields.push(field);
    }
    for (const field of missingFields) {
      issues.push(issue("incident_readiness_scenario_missing_field", { id: row.id, field }));
    }
    const validationCommandPresent = Boolean(packageScripts[row.validationCommand]);
    const evidenceExists = fs.existsSync(path.join(root, row.evidenceArtifact ?? ""));
    if (!validationCommandPresent) {
      issues.push(issue("incident_readiness_scenario_missing_validation_command", { id: row.id, command: row.validationCommand }));
    }
    if (!evidenceExists) {
      issues.push(issue("incident_readiness_scenario_missing_evidence", { id: row.id, evidenceArtifact: row.evidenceArtifact }));
    }
    rows.push({
      id: row.id,
      ownerArea: row.ownerArea,
      detectionSignal: row.detectionSignal,
      firstAction: row.firstAction,
      rollbackPath: row.rollbackPath,
      validationCommand: row.validationCommand,
      validationCommandPresent,
      evidenceArtifact: row.evidenceArtifact,
      evidenceExists,
      missingFieldCount: missingFields.length,
      ok: missingFields.length === 0 && validationCommandPresent && evidenceExists,
    });
  }
  for (const id of REQUIRED_SCENARIOS) {
    if (!seen.has(id)) issues.push(issue("incident_readiness_scenario_missing_required_id", { id }));
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

function validateGameDayWorkflows(root, config, packageScripts, issues) {
  const seen = new Set();
  const rows = [];
  const forbiddenPatterns = config.forbiddenMutationPatterns ?? [];
  for (const row of config.gameDayWorkflows ?? []) {
    if (seen.has(row.id)) issues.push(issue("incident_readiness_game_day_duplicate_id", { id: row.id }));
    seen.add(row.id);
    const workflow = read(root, row.workflow);
    const missingCommands = [];
    for (const script of row.requiredCommands ?? []) {
      if (!packageScripts[script]) {
        missingCommands.push(script);
        issues.push(issue("incident_readiness_game_day_missing_package_script", { id: row.id, script }));
      }
      if (!workflow.includes(commandText(script))) {
        missingCommands.push(`workflow:${script}`);
        issues.push(issue("incident_readiness_game_day_missing_workflow_command", { id: row.id, script }));
      }
    }
    const hasAllowedTrigger = (row.allowedTriggers ?? []).some((trigger) => workflow.includes(trigger));
    const hasStrictEvidence = workflow.includes("GAME_DAY_STRICT") && workflow.includes("check:game-day-exec");
    const hasArtifactUpload = workflow.includes("actions/upload-artifact") && workflow.includes(row.uploadArtifactName ?? "");
    const usesSecrets = workflow.includes("secrets.");
    const mutationFindings = validateNoMutationSurface(root, row.id, row.workflow, forbiddenPatterns, issues);
    const evidenceExists = fs.existsSync(path.join(root, row.evidenceArtifact ?? ""));
    if (!workflow) issues.push(issue("incident_readiness_game_day_missing_workflow", { id: row.id, workflow: row.workflow }));
    if (!hasAllowedTrigger) issues.push(issue("incident_readiness_game_day_missing_allowed_trigger", { id: row.id }));
    if (!hasStrictEvidence) issues.push(issue("incident_readiness_game_day_missing_strict_evidence_check", { id: row.id }));
    if (!hasArtifactUpload) issues.push(issue("incident_readiness_game_day_missing_artifact_upload", { id: row.id }));
    if (usesSecrets) issues.push(issue("incident_readiness_game_day_uses_secrets", { id: row.id }));
    if (row.mutatesProduction !== false) issues.push(issue("incident_readiness_game_day_may_mutate_production", { id: row.id }));
    if (!evidenceExists) issues.push(issue("incident_readiness_game_day_missing_evidence_artifact", { id: row.id, path: row.evidenceArtifact }));
    rows.push({
      id: row.id,
      workflow: row.workflow,
      allowedTriggers: [...(row.allowedTriggers ?? [])].sort((a, b) => a.localeCompare(b)),
      hasAllowedTrigger,
      requiredCommands: [...(row.requiredCommands ?? [])].sort((a, b) => a.localeCompare(b)),
      missingCommandCount: missingCommands.length,
      hasStrictEvidence,
      hasArtifactUpload,
      usesSecrets,
      evidenceArtifact: row.evidenceArtifact,
      evidenceExists,
      mutatesProduction: row.mutatesProduction,
      forbiddenMutationFindingCount: mutationFindings.length,
      ok:
        Boolean(workflow) &&
        hasAllowedTrigger &&
        missingCommands.length === 0 &&
        hasStrictEvidence &&
        hasArtifactUpload &&
        !usesSecrets &&
        evidenceExists &&
        row.mutatesProduction === false &&
        mutationFindings.length === 0,
    });
  }
  for (const id of REQUIRED_GAME_DAY_WORKFLOWS) {
    if (!seen.has(id)) issues.push(issue("incident_readiness_game_day_missing_required_id", { id }));
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

function validateRunbookReferences(root, config, packageScripts, envExample, issues) {
  const seen = new Set();
  const rows = [];
  for (const row of config.runbookReferences ?? []) {
    if (seen.has(row.id)) issues.push(issue("incident_readiness_runbook_duplicate_id", { id: row.id }));
    seen.add(row.id);
    const missingCommands = [];
    for (const script of row.commands ?? []) {
      if (!packageScripts[script]) {
        missingCommands.push(script);
        issues.push(issue("incident_readiness_runbook_missing_command", { id: row.id, script }));
      }
    }
    const rollbackValidationPresent = Boolean(packageScripts[row.rollbackValidationCommand]);
    if (!rollbackValidationPresent) {
      issues.push(issue("incident_readiness_runbook_missing_rollback_validation", {
        id: row.id,
        command: row.rollbackValidationCommand,
      }));
    }
    const missingArtifacts = [];
    for (const artifact of row.sourceArtifacts ?? []) {
      if (!fs.existsSync(path.join(root, artifact))) {
        missingArtifacts.push(artifact);
        issues.push(issue("incident_readiness_runbook_missing_source_artifact", { id: row.id, artifact }));
      }
    }
    const env = validateEnvNames(row.envNames, envExample, "", row.id, issues);
    if (typeof row.dashboardPlaceholder !== "string" || row.dashboardPlaceholder.trim() === "") {
      issues.push(issue("incident_readiness_runbook_missing_dashboard_placeholder", { id: row.id }));
    }
    rows.push({
      id: row.id,
      dashboardPlaceholder: row.dashboardPlaceholder,
      commands: [...(row.commands ?? [])].sort((a, b) => a.localeCompare(b)),
      missingCommandCount: missingCommands.length,
      env,
      rollbackValidationCommand: row.rollbackValidationCommand,
      rollbackValidationPresent,
      sourceArtifacts: [...(row.sourceArtifacts ?? [])].sort((a, b) => a.localeCompare(b)),
      missingArtifactCount: missingArtifacts.length,
      ok:
        missingCommands.length === 0 &&
        rollbackValidationPresent &&
        missingArtifacts.length === 0 &&
        env.every((entry) => entry.declaredInExample),
    });
  }
  for (const id of REQUIRED_RUNBOOKS) {
    if (!seen.has(id)) issues.push(issue("incident_readiness_runbook_missing_required_id", { id }));
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

function collectSensitiveKeys(value, pathParts = []) {
  if (!value || typeof value !== "object") return [];
  const findings = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => findings.push(...collectSensitiveKeys(item, [...pathParts, String(index)])));
    return findings;
  }
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) findings.push([...pathParts, key].join("."));
    findings.push(...collectSensitiveKeys(child, [...pathParts, key]));
  }
  return findings;
}

export function buildPostIncidentFollowUpTemplate(config) {
  const template = config.postIncidentFollowUpTemplate ?? {};
  const fields = [...(template.fields ?? [])].sort((a, b) => a.localeCompare(b));
  return {
    schemaVersion: 1,
    source: "code-owned-post-incident-follow-up-template",
    generatedBy: "scripts/check-incident-readiness.mjs --write",
    generatedFrom: CONFIG_REL,
    templateId: template.templateId,
    deterministic: Boolean(template.deterministic),
    redactionPolicy: template.redactionPolicy,
    defaultSeverity: template.defaultSeverity,
    fields: fields.map((field) => ({
      name: field,
      required: true,
      evidencePolicy:
        field === "timeline" || field === "redactionReview" || field === "evidenceArtifacts"
          ? "metadata-only"
          : "owner-reviewed",
    })),
    emptyRecord: Object.fromEntries(fields.map((field) => [field, field === "timeline" ? [] : null])),
  };
}

function validateFollowUpTemplate(config, issues) {
  const template = buildPostIncidentFollowUpTemplate(config);
  const fieldNames = new Set(template.fields.map((field) => field.name));
  for (const field of REQUIRED_FOLLOW_UP_FIELDS) {
    if (!fieldNames.has(field)) issues.push(issue("incident_readiness_follow_up_missing_required_field", { field }));
  }
  if (!template.deterministic) issues.push(issue("incident_readiness_follow_up_not_deterministic"));
  if (template.redactionPolicy !== "metadata-only") issues.push(issue("incident_readiness_follow_up_invalid_redaction_policy"));
  for (const keyPath of collectSensitiveKeys(template)) {
    issues.push(issue("incident_readiness_follow_up_sensitive_key", { keyPath }));
  }
  return template;
}

export function buildIncidentReadinessReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const envExample = read(root, ENV_EXAMPLE_REL);
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-dr-incident-readiness") {
    issues.push(issue("incident_readiness_invalid_config_metadata"));
  }
  if (config.redactionPolicy?.mode !== "metadata-only" || config.redactionPolicy?.allowedEnvEvidence !== "presence-only") {
    issues.push(issue("incident_readiness_invalid_redaction_policy"));
  }

  const commands = validateCommands(root, config, packageScripts, ci, issues);
  const manualBoundaries = validateManualBoundaries(root, config, issues);
  const drDrills = validateDrDrills(root, config, packageScripts, envExample, issues);
  const incidentScenarios = validateIncidentScenarios(root, config, packageScripts, issues);
  const gameDayWorkflows = validateGameDayWorkflows(root, config, packageScripts, issues);
  const runbookReferences = validateRunbookReferences(root, config, packageScripts, envExample, issues);
  const postIncidentFollowUpTemplate = validateFollowUpTemplate(config, issues);

  return {
    schemaVersion: 1,
    source: "code-owned-operational-dr-incident-readiness",
    generatedBy: "scripts/check-incident-readiness.mjs --write",
    generatedFrom: CONFIG_REL,
    manualBoundariesSource: MANUAL_BOUNDARIES_REL,
    ciWorkflow: CI_REL,
    commandCount: commands.length,
    drDrillCount: drDrills.length,
    incidentScenarioCount: incidentScenarios.length,
    gameDayWorkflowCount: gameDayWorkflows.length,
    runbookReferenceCount: runbookReferences.length,
    followUpFieldCount: postIncidentFollowUpTemplate.fields.length,
    manualBoundaries,
    commands,
    drDrills,
    incidentScenarios,
    gameDayWorkflows,
    runbookReferences,
    postIncidentFollowUpTemplate: {
      artifact: FOLLOW_UP_ARTIFACT_REL,
      templateId: postIncidentFollowUpTemplate.templateId,
      deterministic: postIncidentFollowUpTemplate.deterministic,
      redactionPolicy: postIncidentFollowUpTemplate.redactionPolicy,
      fieldNames: postIncidentFollowUpTemplate.fields.map((field) => field.name),
    },
    manualBoundary: config.manualBoundary,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeIncidentReadiness(root = ROOT, options = {}) {
  const report = buildIncidentReadinessReport(root);
  const followUpTemplate = buildPostIncidentFollowUpTemplate(readJson(root, CONFIG_REL));
  const artifactRel = options.artifactRel ?? ARTIFACT_REL;
  const followUpRel = options.followUpRel ?? FOLLOW_UP_ARTIFACT_REL;
  const artifactPath = path.join(root, artifactRel);
  const followUpPath = path.join(root, followUpRel);
  const serialized = stableStringify(report);
  const followUpSerialized = stableStringify(followUpTemplate);
  const issues = [...report.issues];

  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("incident_readiness_artifact_missing", { artifact: artifactRel }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("incident_readiness_artifact_drift", {
      artifact: artifactRel,
      writeCommand: "npm run write:incident-readiness",
    }));
  }

  if (!fs.existsSync(followUpPath)) {
    issues.push(issue("incident_readiness_follow_up_artifact_missing", { artifact: followUpRel }));
  } else if (fs.readFileSync(followUpPath, "utf8") !== followUpSerialized) {
    issues.push(issue("incident_readiness_follow_up_artifact_drift", {
      artifact: followUpRel,
      writeCommand: "npm run write:incident-readiness",
    }));
  }

  return {
    ...report,
    issueCount: issues.length,
    issues,
    ok: issues.length === 0,
  };
}

export function runIncidentReadiness(root = ROOT) {
  if (WRITE) {
    const report = buildIncidentReadinessReport(root);
    const followUpTemplate = buildPostIncidentFollowUpTemplate(readJson(root, CONFIG_REL));
    const artifactPath = path.join(root, ARTIFACT_REL);
    const followUpPath = path.join(root, FOLLOW_UP_ARTIFACT_REL);
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.mkdirSync(path.dirname(followUpPath), { recursive: true });
    fs.writeFileSync(artifactPath, stableStringify(report));
    fs.writeFileSync(followUpPath, stableStringify(followUpTemplate));
    console.log(stableStringify({ ok: report.issueCount === 0, wrote: [ARTIFACT_REL, FOLLOW_UP_ARTIFACT_REL], ...report }));
    if (report.issueCount > 0) process.exitCode = 1;
    return report;
  }

  const report = analyzeIncidentReadiness(root);
  console.log(stableStringify(report));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runIncidentReadiness();
}
