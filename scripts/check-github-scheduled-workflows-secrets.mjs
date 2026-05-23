#!/usr/bin/env node
/**
 * Epic 2 — Secret-gated workflow registry drift.
 * Ensures every workflow file is listed in artifacts/assurance/github-workflow-secret-gates.json,
 * that secret-gated jobs use the shared helper, and that scheduled secret use is explicit.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import YAML from "yaml";

const WORKFLOW_EXT_RE = /\.(ya?ml)$/i;
const IGNORED_SECRET_KEYS = new Set(["GITHUB_TOKEN"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readWorkflowFiles(root) {
  const workflowsDir = path.join(root, ".github", "workflows");
  if (!fs.existsSync(workflowsDir)) return [];
  return fs
    .readdirSync(workflowsDir)
    .filter((name) => WORKFLOW_EXT_RE.test(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const fullPath = path.join(workflowsDir, name);
      const text = fs.readFileSync(fullPath, "utf8");
      return { name, fullPath, text, workflow: YAML.parse(text) ?? {} };
    });
}

function eventNames(workflow) {
  const on = workflow.on;
  if (typeof on === "string") return [on];
  if (Array.isArray(on)) return on.map(String);
  if (on && typeof on === "object") return Object.keys(on);
  return [];
}

function collectSecretRefs(value, refs = new Set()) {
  if (typeof value === "string") {
    const re = /\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/giu;
    for (const match of value.matchAll(re)) {
      if (!IGNORED_SECRET_KEYS.has(match[1])) refs.add(match[1]);
    }
    return refs;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectSecretRefs(entry, refs);
    return refs;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) collectSecretRefs(entry, refs);
  }
  return refs;
}

function hasSecretsInherit(value) {
  if (value === "inherit") return true;
  if (Array.isArray(value)) return value.some((entry) => hasSecretsInherit(entry));
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, entry]) => key === "secrets" && entry === "inherit") ||
      Object.values(value).some((entry) => hasSecretsInherit(entry));
  }
  return false;
}

function scheduledSecretEntries(meta) {
  return meta.scheduledSecretUsage ?? [];
}

function listedSecrets(entry) {
  return new Set([...(entry.requiredSecrets ?? []), ...(entry.optionalSecrets ?? [])]);
}

function normalizeSecrets(secrets) {
  return [...new Set(secrets ?? [])].map(String).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function sameSecretSet(left, right) {
  return JSON.stringify(normalizeSecrets(left)) === JSON.stringify(normalizeSecrets(right));
}

function gateKey(gate) {
  return `${gate.job}:${gate.strictVariable}:${normalizeSecrets(gate.requiredSecrets).join(",")}`;
}

function shellWords(line) {
  const words = [];
  let current = "";
  let quote = "";
  let escaped = false;

  function pushCurrent() {
    if (current.length > 0) {
      words.push(current);
      current = "";
    }
  }

  for (const char of line) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = "";
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/u.test(char)) {
      pushCurrent();
      continue;
    }
    current += char;
  }

  pushCurrent();
  return words;
}

function extractSecretGateInvocations(jobName, steps, helperScript) {
  const invocations = [];

  for (const [stepIndex, step] of (steps ?? []).entries()) {
    if (typeof step?.run !== "string") continue;
    for (const [lineIndex, line] of step.run.split(/\r?\n/u).entries()) {
      if (!line.includes(helperScript)) continue;
      const words = shellWords(line.trim());
      const helperIndex = words.findIndex((word, index) => word === helperScript && (index === 0 || words[index - 1] === "bash"));
      if (helperIndex === -1) continue;
      const [label, strictVariable, requiredSecretsCsv] = words.slice(helperIndex + 1, helperIndex + 4);
      invocations.push({
        job: jobName,
        step: step.name ?? `step_${stepIndex + 1}`,
        stepId: typeof step.id === "string" ? step.id : "",
        line: lineIndex + 1,
        label: label ?? "",
        strictVariable: strictVariable ?? "",
        requiredSecrets: normalizeSecrets((requiredSecretsCsv ?? "").split(",")),
        envSecrets: normalizeSecrets([...collectSecretRefs(step.env)]),
        envKeys: step.env && typeof step.env === "object" ? new Set(Object.keys(step.env)) : new Set(),
      });
    }
  }

  return invocations;
}

function jobCanRunOnSchedule(job) {
  const condition = String(job?.if ?? "").trim();
  if (!condition) return true;
  if (/github\.event_name\s*==\s*['"]schedule['"]/u.test(condition)) return true;
  if (/github\.event_name/u.test(condition) && !/schedule/u.test(condition)) return false;
  return true;
}

export function analyzeGithubScheduledWorkflowsSecrets(root = process.cwd()) {
  const workflowsDir = path.join(root, ".github", "workflows");
  const registryPath = path.join(root, "artifacts", "assurance", "github-workflow-secret-gates.json");
  const registry = readJson(registryPath);
  const helperScript = registry.helperScript ?? "scripts/github-actions/secret-gate.sh";
  const workflowFiles = readWorkflowFiles(root);
  const workflowByName = new Map(workflowFiles.map((file) => [file.name, file]));
  const onDisk = workflowFiles.map((file) => file.name).sort();
  const registered = Object.keys(registry.workflows ?? {}).sort();
  const errors = [];

  if (JSON.stringify(onDisk) !== JSON.stringify(registered)) {
    const onlyDisk = onDisk.filter((file) => !registered.includes(file));
    const onlyReg = registered.filter((file) => !onDisk.includes(file));
    if (onlyDisk.length) errors.push({ issue: "workflow_not_registered", files: onlyDisk });
    if (onlyReg.length) errors.push({ issue: "registry_entry_missing_on_disk", files: onlyReg });
  }

  for (const [name, meta] of Object.entries(registry.workflows ?? {})) {
    const file = workflowByName.get(name);
    if (!file) continue;
    const text = file.text;
    const workflow = file.workflow;
    const jobs = workflow.jobs ?? {};
    const registeredGates = meta.gates ?? [];
    const actualGates = Object.entries(jobs).flatMap(([jobName, job]) =>
      extractSecretGateInvocations(jobName, job.steps ?? [], helperScript)
    );
    const actualGateKeys = new Set(actualGates.map(gateKey));
    const registeredGateKeys = new Set(registeredGates.map(gateKey));

    for (const gate of actualGates) {
      if (!gate.stepId) {
        errors.push({ file: name, job: gate.job, step: gate.step, issue: "secret_gate_step_missing_id" });
      }
      if (!gate.strictVariable || gate.requiredSecrets.length === 0) {
        errors.push({ file: name, job: gate.job, step: gate.step, issue: "secret_gate_invocation_unparseable" });
        continue;
      }
      if (!gate.envKeys.has(gate.strictVariable)) {
        errors.push({ file: name, job: gate.job, step: gate.step, issue: "secret_gate_step_missing_strict_env", strictVariable: gate.strictVariable });
      }
      for (const secret of gate.requiredSecrets) {
        if (!gate.envSecrets.includes(secret)) {
          errors.push({ file: name, job: gate.job, step: gate.step, issue: "secret_gate_step_missing_required_secret_env", secret });
        }
      }
      if (registeredGateKeys.has(gateKey(gate))) continue;
      const sameJobGate = registeredGates.find((entry) => entry.job === gate.job);
      if (sameJobGate && gate.strictVariable === sameJobGate.strictVariable) {
        errors.push({
          file: name,
          job: gate.job,
          step: gate.step,
          issue: "secret_gate_invocation_secret_mismatch",
          actualSecrets: gate.requiredSecrets,
          registeredSecrets: normalizeSecrets(sameJobGate.requiredSecrets),
        });
      } else if (sameJobGate) {
        errors.push({
          file: name,
          job: gate.job,
          step: gate.step,
          issue: "secret_gate_invocation_strict_variable_mismatch",
          actualStrictVariable: gate.strictVariable,
          registeredStrictVariable: sameJobGate.strictVariable,
        });
      } else {
        errors.push({
          file: name,
          job: gate.job,
          step: gate.step,
          issue: "secret_gate_invocation_not_registered",
          strictVariable: gate.strictVariable,
          requiredSecrets: gate.requiredSecrets,
        });
      }
    }

    for (const gate of registeredGates) {
      if (!jobs[gate.job]) {
        errors.push({ file: name, job: gate.job, issue: "secret_gate_registry_unknown_job" });
      }
      if (!actualGateKeys.has(gateKey(gate))) {
        errors.push({
          file: name,
          job: gate.job,
          issue: "secret_gate_registry_missing_invocation",
          strictVariable: gate.strictVariable,
          requiredSecrets: normalizeSecrets(gate.requiredSecrets),
        });
      }
      if (gate.defaultBehavior !== "skip") {
        errors.push({ file: name, job: gate.job, issue: "secret_gate_must_default_skip" });
      }
      if (!text.includes(helperScript)) {
        errors.push({ file: name, job: gate.job, issue: "missing_shared_secret_gate_helper", helperScript });
      }
      if (!text.includes(gate.strictVariable)) {
        errors.push({ file: name, job: gate.job, issue: "missing_strict_variable", strictVariable: gate.strictVariable });
      }
      for (const secret of gate.requiredSecrets ?? []) {
        if (!text.includes(secret)) {
          errors.push({ file: name, job: gate.job, issue: "missing_required_secret_reference", secret });
        }
      }
      if (/ALLOW_[A-Z0-9_]+_SKIP/u.test(text) || text.includes("ALLOW_SECRET_GATED_SKIP")) {
        errors.push({ file: name, job: gate.job, issue: "legacy_allow_skip_variable" });
      }
      if (gate.optionalName === true && gate.defaultBehavior !== "skip") {
        errors.push({ file: name, job: gate.job, issue: "optional_gate_not_skip_default" });
      }
    }

    if (eventNames(workflow).includes("schedule")) {
      const entriesByJob = new Map(scheduledSecretEntries(meta).map((entry) => [entry.job, entry]));

      for (const [jobName, job] of Object.entries(jobs)) {
        if (!jobCanRunOnSchedule(job)) continue;
        const secrets = [...collectSecretRefs(job)].sort();
        const gate = registeredGates.find((entry) => entry.job === jobName);
        const entry = entriesByJob.get(jobName);

        if (hasSecretsInherit(job)) {
          errors.push({ file: name, job: jobName, issue: "scheduled_job_uses_secrets_inherit" });
        }

        if (secrets.length === 0) continue;
        if (gate) continue;
        if (!entry) {
          errors.push({ file: name, job: jobName, issue: "scheduled_secret_usage_not_registered", secrets });
          continue;
        }

        if (!entry.reason || String(entry.reason).trim().length < 16) {
          errors.push({ file: name, job: jobName, issue: "scheduled_secret_usage_missing_reason" });
        }
        if (!(entry.allowedEvents ?? []).includes("schedule")) {
          errors.push({ file: name, job: jobName, issue: "scheduled_secret_usage_missing_schedule_event" });
        }

        const expected = listedSecrets(entry);
        for (const secret of secrets) {
          if (!expected.has(secret)) {
            errors.push({ file: name, job: jobName, issue: "scheduled_secret_not_registered", secret });
          }
        }
      }
    }

    for (const entry of scheduledSecretEntries(meta)) {
      if (!eventNames(workflow).includes("schedule")) {
        errors.push({ file: name, job: entry.job, issue: "scheduled_secret_registry_for_unscheduled_workflow" });
      }
      if (!jobs[entry.job]) {
        errors.push({ file: name, job: entry.job, issue: "scheduled_secret_registry_unknown_job" });
      }
    }

    if (name === "ci.yml") {
      const qualityNeeds = /quality:\s*[\s\S]*?needs:\s*\[([^\]]+)\]/mu.exec(text)?.[1] ?? "";
      if (qualityNeeds.includes("quality_build_e2e")) {
        errors.push({ file: name, issue: "quality_aggregate_depends_on_optional_e2e" });
      }
    }
  }

  return {
    ok: errors.length === 0,
    issueCount: errors.length,
    workflowCount: onDisk.length,
    helperScript,
    issues: errors,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeGithubScheduledWorkflowsSecrets();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
