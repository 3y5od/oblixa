#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import YAML from "yaml";

import { analyzeCiArtifactSecretLeakage } from "./check-ci-artifact-secret-leakage.mjs";
import { analyzeGithubWorkflowsSecurity } from "./check-github-workflows-security.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-ci-enforcement.json";
const SECRET_GATE_REGISTRY_REL = "artifacts/assurance/github-workflow-secret-gates.json";
const ARTIFACT_REL = "artifacts/operational-ci-enforcement.json";
const WORKFLOW_EXT_RE = /\.(ya?ml)$/iu;
const SECRET_GATE_HELPER = "scripts/github-actions/secret-gate.sh";
const WRITE = process.argv.includes("--write");

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  return fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), "utf8") : "";
}

function readJson(root, rel) {
  const text = read(root, rel);
  if (!text) throw new Error(`Missing JSON file: ${rel}`);
  return JSON.parse(text);
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function toRegex(value) {
  return value ? new RegExp(value, "u") : null;
}

function normalizeIf(value) {
  return String(value ?? "")
    .trim()
    .replace(/^\$\{\{\s*/u, "")
    .replace(/\s*\}\}$/u, "")
    .trim();
}

function readWorkflowFiles(root) {
  const workflowsDir = path.join(root, ".github", "workflows");
  if (!fs.existsSync(workflowsDir)) return [];
  return fs
    .readdirSync(workflowsDir)
    .filter((name) => WORKFLOW_EXT_RE.test(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const rel = `.github/workflows/${name}`;
      const text = read(root, rel);
      return { name, rel, text, workflow: YAML.parse(text) ?? {} };
    });
}

function eventNames(workflow) {
  const on = workflow.on;
  if (typeof on === "string") return [on];
  if (Array.isArray(on)) return on.map(String);
  if (on && typeof on === "object") return Object.keys(on);
  return [];
}

function isUploadArtifactStep(step) {
  return typeof step?.uses === "string" && /^actions\/upload-artifact@/iu.test(step.uses.trim());
}

function stepName(step, index) {
  return String(step?.name ?? step?.id ?? `step_${index + 1}`);
}

function hasIntentionalShellIgnore(run) {
  return /\|\|\s*true\b/u.test(run) || /^\s*set\s+\+e\s*$/mu.test(run);
}

function collectSecretGateObservation(file, jobName, step, index) {
  if (typeof step?.run !== "string" || !step.run.includes(SECRET_GATE_HELPER)) return null;
  const match = /secret-gate\.sh\s+["']([^"']+)["']\s+["']([^"']+)["']\s+["']([^"']*)["']/u.exec(step.run);
  return {
    issue: "secret_gated_skip",
    file: file.name,
    job: jobName,
    step: stepName(step, index),
    label: match?.[1] ?? null,
    strictVariable: match?.[2] ?? null,
    requiredSecrets: match?.[3] ? match[3].split(",").map((value) => value.trim()).filter(Boolean).sort() : [],
  };
}

function collectWorkflowObservations(files) {
  const observations = [];
  const secretGates = [];
  const matrixExclusions = [];

  for (const file of files) {
    for (const [jobName, job] of Object.entries(file.workflow.jobs ?? {})) {
      const jobIf = normalizeIf(job?.if);
      if (jobIf && jobIf !== "always()") {
        observations.push({
          issue: "optional_job",
          file: file.name,
          job: jobName,
          condition: jobIf,
        });
      }

      const matrixExclude = job?.strategy?.matrix?.exclude;
      if (Array.isArray(matrixExclude) && matrixExclude.length > 0) {
        matrixExclusions.push({
          issue: "matrix_exclude",
          file: file.name,
          job: jobName,
          excludedCombinationCount: matrixExclude.length,
        });
      }

      if (job?.["continue-on-error"] === true || (typeof job?.["continue-on-error"] === "string" && job["continue-on-error"].trim() !== "false")) {
        observations.push({
          issue: "continue_on_error",
          file: file.name,
          job: jobName,
          scope: "job",
          value: job["continue-on-error"],
        });
      }

      for (const [index, step] of (job?.steps ?? []).entries()) {
        const gate = collectSecretGateObservation(file, jobName, step, index);
        if (gate) secretGates.push(gate);

        if (step?.["continue-on-error"] === true || (typeof step?.["continue-on-error"] === "string" && step["continue-on-error"].trim() !== "false")) {
          observations.push({
            issue: "continue_on_error",
            file: file.name,
            job: jobName,
            step: stepName(step, index),
            scope: "step",
            value: step["continue-on-error"],
          });
        }

        if (typeof step?.run === "string" && hasIntentionalShellIgnore(step.run)) {
          observations.push({
            issue: "shell_ignores_error",
            file: file.name,
            job: jobName,
            step: stepName(step, index),
            pattern: step.run,
          });
        }
      }
    }
  }

  return { observations: [...observations, ...matrixExclusions], secretGates };
}

function matchesField(entry, observation, field) {
  if (entry[field] != null && String(entry[field]) !== String(observation[field] ?? "")) return false;
  const regex = toRegex(entry[`${field}Regex`]);
  if (regex && !regex.test(String(observation[field] ?? ""))) return false;
  return true;
}

function allowlistEntryMatches(entry, observation) {
  if (entry.issue !== observation.issue) return false;
  for (const field of ["file", "job", "step", "condition"]) {
    if (!matchesField(entry, observation, field)) return false;
  }
  const patternRegex = toRegex(entry.patternRegex);
  if (patternRegex && !patternRegex.test(String(observation.pattern ?? ""))) return false;
  return true;
}

function secretGateEntryMatches(entry, gate) {
  return entry.file === gate.file && entry.job === gate.job && entry.strictVariable === gate.strictVariable;
}

function validateGovernedRow(row, section, packageScripts, issues) {
  for (const key of ["id", "owner", "reason", "expiresOn", "validationCommand"]) {
    if (!row[key] || !String(row[key]).trim()) {
      issues.push(issue("operational_ci_governance_row_missing_field", { section, id: row.id ?? "(missing)", key }));
    }
  }

  if (row.expiresOn) {
    const expiryMs = Date.parse(`${row.expiresOn}T00:00:00Z`);
    if (!Number.isFinite(expiryMs)) {
      issues.push(issue("operational_ci_governance_row_invalid_expiry", { section, id: row.id, expiresOn: row.expiresOn }));
    } else if (expiryMs <= Date.now()) {
      issues.push(issue("operational_ci_governance_row_expired", { section, id: row.id, expiresOn: row.expiresOn }));
    }
  }

  if (row.validationCommand && !packageScripts[row.validationCommand]) {
    issues.push(issue("operational_ci_governance_row_unknown_validation_command", { section, id: row.id, validationCommand: row.validationCommand }));
  }
}

function secretGateRegistryRows(registry) {
  const rows = [];
  for (const [file, meta] of Object.entries(registry.workflows ?? {})) {
    for (const gate of meta.gates ?? []) {
      rows.push({
        file,
        job: gate.job,
        strictVariable: gate.strictVariable,
        requiredSecrets: [...(gate.requiredSecrets ?? [])].sort(),
        defaultBehavior: gate.defaultBehavior,
      });
    }
  }
  return rows;
}

function validateSecretGateGovernance(config, gates, registry, issues, packageScripts) {
  const registryRows = secretGateRegistryRows(registry);
  const governed = [];
  const usedEntries = new Set();

  for (const row of config.secretGateAllowlist ?? []) {
    validateGovernedRow(row, "secretGateAllowlist", packageScripts, issues);
  }

  for (const gate of gates) {
    const entry = (config.secretGateAllowlist ?? []).find((candidate, index) => {
      if (!secretGateEntryMatches(candidate, gate)) return false;
      usedEntries.add(index);
      return true;
    });
    if (!entry) {
      issues.push(issue("operational_ci_secret_gate_missing_governance", gate));
      continue;
    }

    const registryRow = registryRows.find((row) => row.file === gate.file && row.job === gate.job && row.strictVariable === gate.strictVariable);
    if (!registryRow) {
      issues.push(issue("operational_ci_secret_gate_missing_registry_row", gate));
      continue;
    }

    governed.push({
      file: gate.file,
      job: gate.job,
      strictVariable: gate.strictVariable,
      requiredSecrets: gate.requiredSecrets,
      defaultBehavior: registryRow.defaultBehavior,
      owner: entry.owner,
      expiresOn: entry.expiresOn,
      validationCommand: entry.validationCommand,
    });
  }

  for (const [index, row] of (config.secretGateAllowlist ?? []).entries()) {
    if (!usedEntries.has(index)) {
      issues.push(issue("operational_ci_secret_gate_governance_stale", { id: row.id, file: row.file, job: row.job, strictVariable: row.strictVariable }));
    }
  }

  return governed.sort((a, b) => `${a.file}:${a.job}:${a.strictVariable}`.localeCompare(`${b.file}:${b.job}:${b.strictVariable}`));
}

function validateFailClosedAllowlist(config, observations, issues, packageScripts) {
  const governed = [];
  const usedEntries = new Set();

  for (const row of config.failClosedAllowlist ?? []) {
    validateGovernedRow(row, "failClosedAllowlist", packageScripts, issues);
  }

  for (const observation of observations) {
    const entry = (config.failClosedAllowlist ?? []).find((candidate, index) => {
      if (!allowlistEntryMatches(candidate, observation)) return false;
      usedEntries.add(index);
      return true;
    });
    if (!entry) {
      issues.push(issue("operational_ci_fail_closed_observation_missing_allowlist", observation));
      continue;
    }
    governed.push({
      issue: observation.issue,
      file: observation.file,
      job: observation.job ?? null,
      step: observation.step ?? null,
      condition: observation.condition ?? null,
      allowedBy: entry.id,
      owner: entry.owner,
      expiresOn: entry.expiresOn,
      validationCommand: entry.validationCommand,
    });
  }

  for (const [index, row] of (config.failClosedAllowlist ?? []).entries()) {
    if (!usedEntries.has(index)) {
      issues.push(issue("operational_ci_fail_closed_allowlist_stale", { id: row.id, issue: row.issue }));
    }
  }

  return governed.sort((a, b) => `${a.issue}:${a.file}:${a.job ?? ""}:${a.step ?? ""}`.localeCompare(`${b.issue}:${b.file}:${b.job ?? ""}:${b.step ?? ""}`));
}

function findWorkflow(files, name) {
  return files.find((file) => file.name === name) ?? null;
}

function validateRequiredCommands(config, packageScripts, issues) {
  const commands = [];
  const seen = new Set();
  for (const row of config.requiredCommands ?? []) {
    if (!row.id || seen.has(row.id)) issues.push(issue("operational_ci_required_command_duplicate_or_missing_id", { id: row.id }));
    seen.add(row.id);
    if (!row.command || !packageScripts[row.command]) {
      issues.push(issue("operational_ci_required_command_missing_package_script", { id: row.id, command: row.command }));
    }
    commands.push({ id: row.id, objective: row.objective, command: row.command });
  }
  return commands.sort((a, b) => a.id.localeCompare(b.id));
}

function validateBranchProtectionFallback(config, files, issues) {
  const ci = findWorkflow(files, "ci.yml");
  const jobs = new Set(Object.keys(ci?.workflow.jobs ?? {}));
  const rows = [];
  for (const job of config.requiredBranchProtectionJobs ?? []) {
    if (!jobs.has(job)) issues.push(issue("operational_ci_branch_protection_expected_job_missing", { job }));
    rows.push({ workflow: "ci.yml", job, present: jobs.has(job) });
  }
  return rows;
}

function validateMergeQueue(config, files, issues) {
  const workflow = findWorkflow(files, "qa-merge-queue-canary.yml");
  if (!workflow) {
    issues.push(issue("operational_ci_merge_queue_workflow_missing"));
    return { workflow: "qa-merge-queue-canary.yml", hasMergeGroup: false, expectedChecks: [], categories: [] };
  }

  const events = eventNames(workflow.workflow);
  const hasMergeGroup = events.includes("merge_group");
  if (!hasMergeGroup) {
    issues.push(issue("operational_ci_merge_queue_missing_merge_group_trigger", { workflow: workflow.name, events }));
  }

  const expectedChecks = [];
  for (const expectedCheck of config.requiredMergeQueueExpectedChecks ?? []) {
    const present = workflow.text.includes(expectedCheck);
    if (!present) issues.push(issue("operational_ci_merge_queue_expected_check_missing", { expectedCheck }));
    expectedChecks.push({ expectedCheck, present });
  }

  const categories = [];
  for (const category of config.requiredMergeQueueCategories ?? []) {
    const present = workflow.text.includes(`"${category}"`) || workflow.text.includes(`'${category}'`);
    if (!present) issues.push(issue("operational_ci_merge_queue_category_missing", { category }));
    categories.push({ category, present });
  }

  return { workflow: workflow.name, hasMergeGroup, expectedChecks, categories };
}

function validateRequiredArtifactJobs(config, files, issues) {
  const rows = [];
  for (const row of config.requiredArtifactJobs ?? []) {
    const workflow = findWorkflow(files, row.file);
    const job = workflow?.workflow.jobs?.[row.job];
    const uploadCount = (job?.steps ?? []).filter(isUploadArtifactStep).length;
    if (!workflow) {
      issues.push(issue("operational_ci_artifact_required_workflow_missing", row));
    } else if (!job) {
      issues.push(issue("operational_ci_artifact_required_job_missing", row));
    } else if (uploadCount === 0) {
      issues.push(issue("operational_ci_artifact_required_upload_missing", row));
    }
    rows.push({ file: row.file, job: row.job, purpose: row.purpose, uploadCount });
  }
  return rows.sort((a, b) => `${a.file}:${a.job}`.localeCompare(`${b.file}:${b.job}`));
}

function buildReport(root = ROOT) {
  const issues = [];
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const secretGateRegistry = readJson(root, SECRET_GATE_REGISTRY_REL);
  const workflowFiles = readWorkflowFiles(root);

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-ci-enforcement") {
    issues.push(issue("operational_ci_invalid_config_metadata"));
  }

  const requiredCommands = validateRequiredCommands(config, packageScripts, issues);
  const { observations, secretGates } = collectWorkflowObservations(workflowFiles);
  const governedFailClosedObservations = validateFailClosedAllowlist(config, observations, issues, packageScripts);
  const governedSecretGates = validateSecretGateGovernance(config, secretGates, secretGateRegistry, issues, packageScripts);
  const branchProtectionFallback = validateBranchProtectionFallback(config, workflowFiles, issues);
  const mergeQueue = validateMergeQueue(config, workflowFiles, issues);
  const requiredArtifactJobs = validateRequiredArtifactJobs(config, workflowFiles, issues);

  const workflowSecurity = analyzeGithubWorkflowsSecurity(root);
  if (!workflowSecurity.ok) {
    issues.push(issue("operational_ci_delegated_workflow_security_failed", { issueCount: workflowSecurity.issueCount }));
  }

  const artifactHygiene = analyzeCiArtifactSecretLeakage(root);
  if (!artifactHygiene.ok) {
    issues.push(issue("operational_ci_delegated_artifact_hygiene_failed", { issueCount: artifactHygiene.issueCount }));
  }

  return {
    schemaVersion: 1,
    source: "code-owned-operational-ci-enforcement",
    generatedFrom: CONFIG_REL,
    secretGateRegistry: SECRET_GATE_REGISTRY_REL,
    workflowCount: workflowFiles.length,
    requiredCommandCount: requiredCommands.length,
    requiredCommands,
    failClosedObservationCount: observations.length,
    governedFailClosedObservations,
    secretGateCount: secretGates.length,
    governedSecretGates,
    branchProtectionFallback,
    mergeQueue,
    requiredArtifactJobs,
    delegatedChecks: {
      githubWorkflowsSecurity: {
        ok: workflowSecurity.ok,
        workflowCount: workflowSecurity.workflowCount,
        issueCount: workflowSecurity.issueCount,
      },
      ciArtifactSecretLeakage: {
        ok: artifactHygiene.ok,
        workflowCount: artifactHygiene.workflowCount,
        uploadStepCount: artifactHygiene.uploadStepCount,
        downloadStepCount: artifactHygiene.downloadStepCount,
        issueCount: artifactHygiene.issueCount,
      },
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
    report.issues.push(issue("operational_ci_artifact_missing", { artifact: ARTIFACT_REL }));
    report.issueCount = report.issues.length;
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    report.issues.push(issue("operational_ci_artifact_drift", { artifact: ARTIFACT_REL, writeCommand: "npm run write:operational-ci-enforcement" }));
    report.issueCount = report.issues.length;
  }

  if (report.issueCount > 0) {
    console.error(stableStringify({ ok: false, ...report }));
    process.exit(1);
  }
  console.log(stableStringify({ ok: true, ...report }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
