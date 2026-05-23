#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import YAML from "yaml";

const WORKFLOW_EXT_RE = /\.(ya?ml)$/i;
const SECRET_GATE_HELPER = "scripts/github-actions/secret-gate.sh";
const IGNORED_SECRET_KEYS = new Set(["GITHUB_TOKEN"]);
const UNTRUSTED_SECRET_EVENTS = new Set(["pull_request", "pull_request_target"]);
const DANGEROUS_WRITE_PERMISSIONS = new Set([
  "actions",
  "attestations",
  "checks",
  "contents",
  "deployments",
  "discussions",
  "id-token",
  "issues",
  "packages",
  "pages",
  "pull-requests",
  "repository-projects",
  "security-events",
  "statuses",
]);

const ALLOWED_WRITE_PERMISSIONS = new Map([
  ["codeql.yml:security-events", "CodeQL code scanning permission; upload is disabled for fork-safe PR behavior."],
  ["semgrep-sarif.yml:security-events", "SARIF upload permission for the dedicated Semgrep workflow."],
  ["openssf-scorecard.yml:security-events", "Scorecard SARIF upload permission."],
  ["openssf-scorecard.yml:id-token", "Scorecard OIDC token permission."],
]);
const MIN_JOB_TIMEOUT_MINUTES = 1;
const MAX_JOB_TIMEOUT_MINUTES = 720;
const GITHUB_EXPRESSION_RE = /\$\{\{\s*([\s\S]*?)\s*\}\}/gu;
const UNTRUSTED_GITHUB_SHELL_CONTEXTS = [
  {
    label: "github.event.pull_request.title",
    re: /\bgithub\.event\.pull_request\.title\b/iu,
  },
  {
    label: "github.event.pull_request.body",
    re: /\bgithub\.event\.pull_request\.body\b/iu,
  },
  {
    label: "github.event.pull_request.head.ref",
    re: /\bgithub\.event\.pull_request\.head\.ref\b/iu,
  },
  {
    label: "github.event.pull_request.head.label",
    re: /\bgithub\.event\.pull_request\.head\.label\b/iu,
  },
  {
    label: "github.head_ref",
    re: /\bgithub\.head_ref\b/iu,
  },
  {
    label: "github.event.issue.title",
    re: /\bgithub\.event\.issue\.title\b/iu,
  },
  {
    label: "github.event.issue.body",
    re: /\bgithub\.event\.issue\.body\b/iu,
  },
  {
    label: "github.event.comment.body",
    re: /\bgithub\.event\.comment\.body\b/iu,
  },
  {
    label: "github.event.review.body",
    re: /\bgithub\.event\.review\.body\b/iu,
  },
  {
    label: "github.event.review_comment.body",
    re: /\bgithub\.event\.review_comment\.body\b/iu,
  },
  {
    label: "github.event.discussion.title",
    re: /\bgithub\.event\.discussion\.title\b/iu,
  },
  {
    label: "github.event.discussion.body",
    re: /\bgithub\.event\.discussion\.body\b/iu,
  },
  {
    label: "github.event.discussion_comment.body",
    re: /\bgithub\.event\.discussion_comment\.body\b/iu,
  },
];

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

function eventNames(workflow) {
  const on = workflow.on;
  if (typeof on === "string") return [on];
  if (Array.isArray(on)) return on.map(String);
  if (on && typeof on === "object") return Object.keys(on);
  return [];
}

function hasEvent(workflow, eventName) {
  return eventNames(workflow).includes(eventName);
}

function isTrustedForSecrets(workflow) {
  return !eventNames(workflow).some((name) => UNTRUSTED_SECRET_EVENTS.has(name));
}

function findGateStepIds(steps) {
  return (steps ?? [])
    .filter((step) => typeof step.run === "string" && step.run.includes(SECRET_GATE_HELPER))
    .map((step) => step.id)
    .filter((id) => typeof id === "string" && id.length > 0);
}

function isGateStep(step) {
  return typeof step?.run === "string" && step.run.includes(SECRET_GATE_HELPER);
}

function isStepGatedBySecretGate(step, gateIds) {
  const condition = String(step?.if ?? "");
  return gateIds.some((id) => {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return new RegExp(`steps\\.${escaped}\\.outputs\\.run\\s*==\\s*['"]true['"]`, "iu").test(condition);
  });
}

function listUses(value, acc = []) {
  if (Array.isArray(value)) {
    for (const entry of value) listUses(entry, acc);
    return acc;
  }
  if (value && typeof value === "object") {
    if (typeof value.uses === "string") acc.push(value.uses.trim());
    for (const entry of Object.values(value)) listUses(entry, acc);
  }
  return acc;
}

function checkActionPin(fileName, ref) {
  if (ref.startsWith("./")) return null;
  if (ref.startsWith("docker://")) {
    if (/:latest$/iu.test(ref)) return { issue: "floating_docker_action_tag", ref };
    return null;
  }

  const atIndex = ref.lastIndexOf("@");
  if (atIndex === -1) return { issue: "unpinned_action", ref };
  const version = ref.slice(atIndex + 1);
  if (!/^[0-9a-f]{40,64}$/iu.test(version)) {
    return { issue: "action_not_pinned_to_commit_sha", ref };
  }
  return null;
}

function isCheckoutAction(ref) {
  return /^actions\/checkout@/iu.test(String(ref));
}

function checkoutPersistsCredentials(step) {
  if (!isCheckoutAction(step?.uses)) return false;
  const persistCredentials = step?.with?.["persist-credentials"];
  return persistCredentials !== false && String(persistCredentials).toLowerCase() !== "false";
}

function isReusableWorkflowCallJob(job) {
  return typeof job?.uses === "string" && job["runs-on"] == null && job.steps == null;
}

function parseStaticTimeoutMinutes(value) {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value === "string" && /^\d+$/u.test(value.trim())) return Number(value);
  return null;
}

function checkJobTimeout(file, jobName, job) {
  if (!job || typeof job !== "object" || isReusableWorkflowCallJob(job)) return [];

  const timeout = job["timeout-minutes"];
  if (timeout == null) {
    return [{ file: file.name, job: jobName, issue: "missing_job_timeout_minutes" }];
  }

  const timeoutMinutes = parseStaticTimeoutMinutes(timeout);
  if (
    timeoutMinutes == null ||
    timeoutMinutes < MIN_JOB_TIMEOUT_MINUTES ||
    timeoutMinutes > MAX_JOB_TIMEOUT_MINUTES
  ) {
    return [{
      file: file.name,
      job: jobName,
      issue: "invalid_job_timeout_minutes",
      timeout,
      min: MIN_JOB_TIMEOUT_MINUTES,
      max: MAX_JOB_TIMEOUT_MINUTES,
    }];
  }

  return [];
}

function checkPermissionWriteAllowed(fileName, permission, workflowText, workflow) {
  const allowKey = `${fileName}:${permission}`;
  if (!ALLOWED_WRITE_PERMISSIONS.has(allowKey)) return false;

  if (permission === "security-events" && fileName === "codeql.yml" && hasEvent(workflow, "pull_request")) {
    return /github\/codeql-action\/analyze@/u.test(workflowText) && /\bupload:\s*never\b/u.test(workflowText);
  }
  if (permission === "security-events" && fileName === "semgrep-sarif.yml") {
    return /github\/codeql-action\/upload-sarif@/u.test(workflowText);
  }
  if (fileName === "openssf-scorecard.yml") {
    return /ossf\/scorecard-action@/u.test(workflowText);
  }
  return true;
}

function checkPermissions(file, permissions, scope, workflow) {
  const issues = [];
  if (permissions == null) return issues;
  if (typeof permissions === "string") {
    if (permissions === "write-all") {
      issues.push({ file: file.name, scope, issue: "permissions_write_all" });
    }
    return issues;
  }

  if (typeof permissions !== "object") return issues;
  for (const [permission, level] of Object.entries(permissions)) {
    if (String(level).toLowerCase() !== "write") continue;
    if (!DANGEROUS_WRITE_PERMISSIONS.has(permission)) continue;
    if (checkPermissionWriteAllowed(file.name, permission, file.text, workflow)) continue;
    issues.push({ file: file.name, scope, issue: "dangerous_write_permission", permission });
  }
  return issues;
}

function collectStringEntries(value, pathParts = [], acc = []) {
  if (typeof value === "string") {
    acc.push({ path: pathParts.join("."), value });
    return acc;
  }
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) collectStringEntries(entry, [...pathParts, String(index)], acc);
    return acc;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) collectStringEntries(entry, [...pathParts, key], acc);
  }
  return acc;
}

function findUntrustedGithubShellContexts(value) {
  if (typeof value !== "string") return [];

  const contexts = new Set();
  for (const match of value.matchAll(GITHUB_EXPRESSION_RE)) {
    const expression = match[1].replace(/\s+/gu, " ").trim();
    for (const context of UNTRUSTED_GITHUB_SHELL_CONTEXTS) {
      if (context.re.test(expression)) contexts.add(context.label);
    }
  }
  return [...contexts].sort((a, b) => a.localeCompare(b));
}

function hasShellStep(job) {
  return (job?.steps ?? []).some((step) => typeof step?.run === "string");
}

function pushUntrustedGithubEnvIssues(issues, file, jobName, env, issue) {
  if (env == null) return;
  for (const entry of collectStringEntries(env)) {
    for (const context of findUntrustedGithubShellContexts(entry.value)) {
      issues.push({
        file: file.name,
        ...(jobName ? { job: jobName } : {}),
        issue,
        env: entry.path,
        context,
      });
    }
  }
}

function pushUntrustedGithubShellContextIssues(issues, file, jobName, step, stepIndex) {
  const stepName = step.name ?? step.id ?? `step_${stepIndex + 1}`;
  const runContexts = findUntrustedGithubShellContexts(step.run);
  for (const context of runContexts) {
    issues.push({
      file: file.name,
      job: jobName,
      step: stepName,
      issue: "untrusted_github_context_in_shell_run",
      context,
    });
  }

  if (typeof step.run !== "string" || step.env == null) return;
  const envIssues = [];
  pushUntrustedGithubEnvIssues(envIssues, file, jobName, step.env, "untrusted_github_context_in_shell_env");
  for (const issue of envIssues) {
    issues.push({ ...issue, step: stepName });
  }
}

function runBlockInterpolatesPrInput(text) {
  const runBlocks = text.match(/run:\s*\|[\s\S]*?(?=\n\s*[a-zA-Z_-]+:|\n\s*-\s*name:|\n\s*jobs:|\n\s*$)/gu) ?? [];
  return runBlocks.some((block) => /\$\{\{\s*github\.event\.pull_request\.(?:title|body)\s*\}\}/iu.test(block));
}

export function analyzeGithubWorkflowsSecurity(root = process.cwd()) {
  const issues = [];
  const files = readWorkflowFiles(root);

  for (const file of files) {
    const workflow = file.workflow;
    const events = eventNames(workflow);
    const hasPullRequest = events.includes("pull_request");
    const workflowHasShellStep = Object.values(workflow.jobs ?? {}).some((job) => hasShellStep(job));

    if (events.includes("pull_request_target")) {
      issues.push({ file: file.name, issue: "pull_request_target_trigger" });
    }

    if (runBlockInterpolatesPrInput(file.text)) {
      issues.push({ file: file.name, issue: "pull_request_input_in_shell_run" });
    }

    if (collectSecretRefs(workflow.env).size > 0) {
      issues.push({ file: file.name, issue: "top_level_secret_env" });
    }

    if (workflow.permissions == null) {
      issues.push({ file: file.name, issue: "missing_workflow_permissions" });
    }

    for (const ref of listUses(workflow)) {
      const pinIssue = checkActionPin(file.name, ref);
      if (pinIssue) issues.push({ file: file.name, ...pinIssue });
    }

    issues.push(...checkPermissions(file, workflow.permissions, "workflow", workflow));

    if (workflowHasShellStep) {
      pushUntrustedGithubEnvIssues(
        issues,
        file,
        "",
        workflow.env,
        "untrusted_github_context_in_workflow_env"
      );
    }

    for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
      const jobSecretRefs = [...collectSecretRefs(job)];
      const gateIds = findGateStepIds(job.steps ?? []);
      const jobHasSecretGate = gateIds.length > 0;
      const jobRunsShell = hasShellStep(job);

      issues.push(...checkJobTimeout(file, jobName, job));
      issues.push(...checkPermissions(file, job.permissions, `job:${jobName}`, workflow));

      if (jobRunsShell) {
        pushUntrustedGithubEnvIssues(issues, file, jobName, job.env, "untrusted_github_context_in_job_env");
      }

      if (hasPullRequest && collectSecretRefs(job.env).size > 0) {
        issues.push({ file: file.name, job: jobName, issue: "job_level_secret_env_in_pull_request_workflow" });
      }

      if (jobSecretRefs.length > 0 && !isTrustedForSecrets(workflow) && !jobHasSecretGate) {
        issues.push({
          file: file.name,
          job: jobName,
          issue: "secret_job_not_trusted_or_gated",
          events,
          secrets: jobSecretRefs.sort(),
        });
      }

      if (hasPullRequest && jobSecretRefs.length > 0 && !jobHasSecretGate) {
        issues.push({
          file: file.name,
          job: jobName,
          issue: "pull_request_secret_job_without_gate",
          secrets: jobSecretRefs.sort(),
        });
      }

      if (hasPullRequest && hasSecretsInherit(job)) {
        issues.push({ file: file.name, job: jobName, issue: "pull_request_secrets_inherit" });
      }

      for (const [index, step] of (job.steps ?? []).entries()) {
        if (checkoutPersistsCredentials(step)) {
          issues.push({
            file: file.name,
            job: jobName,
            step: step.name ?? step.id ?? `step_${index + 1}`,
            issue: "checkout_persist_credentials_not_disabled",
            ref: step.uses,
          });
        }

        pushUntrustedGithubShellContextIssues(issues, file, jobName, step, index);

        const stepSecretRefs = [...collectSecretRefs(step)];
        if (
          hasPullRequest &&
          stepSecretRefs.length > 0 &&
          !isGateStep(step) &&
          !isStepGatedBySecretGate(step, gateIds)
        ) {
          issues.push({
            file: file.name,
            job: jobName,
            step: step.name ?? `step_${index + 1}`,
            issue: "pull_request_secret_step_without_gate",
            secrets: stepSecretRefs.sort(),
          });
        }
      }
    }
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    workflowCount: files.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeGithubWorkflowsSecurity();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
