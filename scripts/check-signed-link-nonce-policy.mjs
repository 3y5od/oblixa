#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:signed-link-nonce-policy"];
const REQUIRED_CI_COMMANDS = ["npm run check:signed-link-nonce-policy"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:signed-link-nonce-policy"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/v5/api.ts": [
    "const SUBMIT_TICKET_TTL_MS = 15 * 60 * 1000;",
    "`EXTERNAL_ACTION_SUBMIT_TICKET_SECRET` (must not reuse CRON_SECRET or the passcode pepper).",
    'const exp = Date.now() + SUBMIT_TICKET_TTL_MS;',
    'const body = JSON.stringify({ lid: input.linkId, t: input.urlToken, exp });',
    'const sig = createHmac("sha256", externalSubmitTicketSecret()).update(body, "utf8").digest("base64url");',
    'if (raw.lid !== expectedLinkId) return { ok: false, reason: "submit_ticket_invalid" };',
    'return { ok: false, reason: "submit_ticket_expired" };',
  ],
  "src/lib/v5/api.external.test.ts": [
    'it("signExternalSubmitTicket works in production with dedicated submit secret", () => {',
    'it("rejects CRON_SECRET as submit-ticket HMAC key in production", () => {',
  ],
  "src/app/api/external-actions/[token]/status/route.ts": [
    'import { nowIso, signExternalSubmitTicket } from "@/lib/v5/api";',
    'data.requires_reauth && effectiveStatus === "open" && !expired',
    '? signExternalSubmitTicket({ linkId: data.id, urlToken: token })',
    'Call GET status before each submit; include submitTicket from this response in your POST body.',
  ],
  "src/app/api/external-actions/[token]/status/route.test.ts": [
    'it("includes submitTicket when requires_reauth and link is open", async () => {',
  ],
  "src/app/api/external-actions/[token]/submit/route.ts": [
    'import { nowIso, verifyExternalPasscode, verifyExternalSubmitTicket } from "@/lib/v5/api";',
    'const ticketCheck = verifyExternalSubmitTicket(token, submitTicket, String(link.id));',
    'ticketCheck.reason === "submit_ticket_required"',
    ': "Invalid or expired submit ticket. Refresh the page to obtain a new ticket.",',
  ],
  "src/app/api/external-actions/[token]/submit/route.test.ts": [
    'it("returns 403 when requires_reauth and submit ticket missing", async () => {',
    'it("accepts submit when requires_reauth and valid ticket", async () => {',
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

export function analyzeSignedLinkNoncePolicy(root = ROOT) {
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

  return { checkId: "signed-link-nonce-policy", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSignedLinkNoncePolicy();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
