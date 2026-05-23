#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:duplicate-execution-policy"];
const REQUIRED_CI_COMMANDS = ["npm run check:duplicate-execution-policy"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:duplicate-execution-policy"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/idempotency.ts": [
    "const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9:_\\-]{8,200}$/;",
    'const limiterKey = `idem:${input.scope}:${input.actorKey}:${key}`;',
    'headers: { "Retry-After": String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))) },',
  ],
  "src/app/api/external-actions/create-link/route.ts": [
    'const duplicate = await enforceIdempotency(request, {',
    'scope: "external-action.create-link",',
    'actorKey: `${ctx.orgId}:${ctx.userId}`,',
  ],
  "src/app/api/external-actions/create-link/route.test.ts": [
    'it("blocks duplicate replay of create-link with x-idempotency-key", async () => {',
    'error: "Duplicate request blocked by idempotency key",',
  ],
  "src/app/api/external-actions/[token]/workflow-step/route.ts": [
    'const duplicate = await enforceIdempotency(request, {',
    'scope: "external-workflow.internal-step",',
    'actorKey: `${ctx.orgId}:${ctx.userId}:${tokenKey}`,',
  ],
  "src/app/api/external-actions/[token]/workflow-step/route.test.ts": [
    'it("blocks duplicate replay of internal workflow-step with x-idempotency-key", async () => {',
    'error: "Duplicate request blocked by idempotency key",',
  ],
  "src/app/api/external-actions/[token]/participant/workflow-step/route.ts": [
    'const duplicate = await enforceIdempotency(request, {',
    'scope: "external-workflow.participant-step",',
    'actorKey: tokenKey,',
  ],
  "src/app/api/external-actions/[token]/participant/workflow-step/route.test.ts": [
    'it("blocks duplicate replay of participant workflow-step with x-idempotency-key", async () => {',
    'error: "Duplicate request blocked by idempotency key",',
  ],
  "src/app/api/external-actions/[token]/submit/route.ts": [
    'const duplicate = await enforceIdempotency(request, {',
    'scope: "external-action.submit",',
    'actorKey: tokenKey,',
  ],
  "src/app/api/stripe/webhook/route.ts": [
    ".insert({ id: event.id, status: \"processing\" });",
    'if (claimErr.code === "23505")',
    "duplicate: true",
  ],
  "src/lib/cron/route-runner.ts": [
    'const duplicate = await enforceIdempotency(request, {',
    'scope: `cron:${options.route}`,',
    'actorKey: "cron",',
    'reason: "duplicate_request",',
  ],
  "artifacts/security-route-matrix.json": [
    '"idempotency_or_job_lock_policy"',
    '"idempotency_or_duplicate_guard"',
    '"job_lock_or_claim"',
    '"terminal_state_guard"',
  ],
};

function fileExists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeDuplicateExecutionPolicy(root = ROOT) {
  const issues = [];

  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!fileExists(root, rel)) issues.push({ issue: "missing_required_file", rel });
  }

  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }

  const ci = read(root, ".github/workflows/ci.yml");
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
  }

  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!securityPipeline.includes(step)) {
      issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
    }
  }

  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    if (!fileExists(root, rel)) continue;
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  return { checkId: "duplicate-execution-policy", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeDuplicateExecutionPolicy();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
