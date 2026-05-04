#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:signed-link-scope-narrowing"];
const REQUIRED_CI_COMMANDS = ["npm run check:signed-link-scope-narrowing"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:signed-link-scope-narrowing"'];
const REQUIRED_FILE_MARKERS = {
  "src/app/api/external-actions/create-link/route.ts": [
    'if (!isValidExternalActionType(rawAction)) {',
    'const expiresInHours = Math.max(1, Math.min(720, Number(body.expiresInHours ?? 72)));',
    'const scope: Record<string, unknown> = {',
    'workflow_config: body.workflowConfig ?? {},',
    'collaboration_version: "v6",',
    '{ error: "workflowDeadlineIso must be a future ISO timestamp" },',
    '{ error: "workflowDeadlineIso must be on or before the link expires_at" },',
    'const decisionWorkspaceId =',
    'typeof rawDw === "string" && /^[0-9a-f-]{36}$/i.test(rawDw) ? rawDw : null;',
    'passcode_hash: passcodeHash,',
    'requires_reauth: Boolean(body.requiresReauth),',
  ],
  "src/app/api/external-actions/create-link/route.test.ts": [
    'it("returns 400 for invalid actionType", async () => {',
    'it("returns 400 when workflowDeadlineIso is in the past", async () => {',
    'it("returns 400 when workflowDeadlineIso is after link expiry", async () => {',
    'it("returns 201 externalAction payload shape and stores workflow_deadline_iso on scope_json when deadline is valid", async () => {',
    'expect(captured.scope_json?.workflow_ack_required).toBe(true);',
  ],
  "src/app/api/external-actions/[token]/submit/route.ts": [
    'const bodyForValidation = { ...rawPayload };',
    'delete bodyForValidation.passcode;',
    'delete bodyForValidation.submitTicket;',
    'const validated = validateExternalActionPayload(at as ExternalActionType, bodyForValidation);',
    'correction_message: validated.error,',
  ],
  "src/app/api/external-actions/[token]/status/route.ts": [
    'const { passcode_hash: _h, ...rest } = data;',
    'requires_passcode: Boolean(_h),',
    'workflow_chain: Array.isArray(scope.workflow_chain) ? scope.workflow_chain : [],',
  ],
  "src/app/api/external-actions/[token]/participant/workflow-step/route.ts": [
    'if (link.expires_at && link.expires_at < nowIso()) {',
    'if (!verifyExternalPasscode(body.passcode, link.passcode_hash ?? null)) {',
  ],
  "src/lib/product-surface/v8-external-actions-token-contract.test.ts": [
    'const BEARER_STYLE_POST_ROUTES = [',
    'raw.includes("verifyExternalSubmitTicket(") || raw.includes("verifyExternalPasscode(");',
    'it("internal workflow-step POST is session-governed (not anonymous token crypto)", () => {',
    'expect(raw.includes("getApiAuthContext(")).toBe(true);',
    'expect(raw.includes("requireApiWorkspaceEligibility(")).toBe(true);',
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

export function analyzeSignedLinkScopeNarrowing(root = ROOT) {
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

  return { checkId: "signed-link-scope-narrowing", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSignedLinkScopeNarrowing();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
