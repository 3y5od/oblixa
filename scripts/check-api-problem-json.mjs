#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const rawErrorPattern = /NextResponse\.json\s*\(\s*\{[\s\S]{0,240}?\berror\s*:/;
const STACK_RESPONSE_RE = /\b(?:stack|stack_trace)\s*:\s*(?:error|err|exception|e)\.stack\b|\b(?:error|err|exception|e)\.stack\b[\s\S]{0,160}?(?:NextResponse\.json|jsonProblem|Response\.json)/;
const RAW_EXCEPTION_MESSAGE_RE =
  /\bdetails\s*:\s*\{[\s\S]{0,240}\b(?:message|error_message)\s*:\s*(?:error|err|exception|e)\.message\b|\b(?:NextResponse|Response)\.json\s*\([\s\S]{0,240}\berror\s*:\s*(?:error|err|exception|e)\.message\b/;
const SERVER_JSON_PROBLEM_EXCEPTION_RE =
  /\bjsonProblem\s*\(\s*(?:500|502|503)\s*,\s*\{[\s\S]{0,360}?\berror\s*:\s*(?:error|err|exception|e)\.message\b/;

const REQUIRED_MARKERS = [
  {
    rel: "src/lib/http/problem.ts",
    markers: [
      "SUPPORT_SAFE_PROBLEM_STATUSES = [400, 401, 403, 404, 405, 409, 413, 415, 422, 429, 500, 502, 503]",
      "export function jsonBadRequest(",
      "export function jsonMethodNotAllowed(",
      "export function jsonConflict(",
      "export function jsonPayloadTooLarge(",
      "export function jsonUnsupportedMediaType(",
      "export function jsonUnprocessableEntity(",
      "export function jsonRateLimited(",
      "export function jsonUnhandled(",
      "export function jsonBadGateway(",
      "export function jsonServiceUnavailable(",
      "redactProblemErrorMessage(body.error)",
      "sanitizeProblemDetails(body.details)",
      "SENSITIVE_PROBLEM_DETAIL_KEY_RE",
    ],
  },
  {
    rel: "src/lib/http/problem.test.ts",
    markers: [
      "covers representative support-safe status helpers",
      "jsonBadRequest(\"/api/example\")",
      "jsonMethodNotAllowed(\"/api/example\"",
      "jsonConflict(\"/api/example\")",
      "jsonPayloadTooLarge(\"/api/example\")",
      "jsonUnsupportedMediaType(\"/api/example\")",
      "jsonUnprocessableEntity(\"/api/example\")",
      "jsonBadGateway(\"/api/example\")",
      "jsonServiceUnavailable(\"/api/example\")",
      "SUPPORT_SAFE_PROBLEM_STATUSES",
    ],
  },
  {
    rel: "src/lib/security/read-json-body-limited.ts",
    markers: [
      "jsonBadRequest",
      "jsonPayloadTooLarge",
      "jsonUnsupportedMediaType",
      "reason: \"invalid_json\"",
      "reason: \"invalid_content_length\"",
    ],
  },
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name === "route.ts") {
      acc.push(p);
    }
  }
  return acc;
}

function rel(root, file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function loadAllowlist(allowlistPath) {
  if (!fs.existsSync(allowlistPath)) {
    return { version: 1, entries: [] };
  }
  return JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
}

export function analyzeApiProblemJson(root = process.cwd()) {
  const appRoot = path.join(root, "src", "app");
  const allowlistPath = path.join(root, "artifacts", "assurance", "api-problem-json-allowlist.json");
  const today = new Date().toISOString().slice(0, 10);
  const routeFiles = walk(appRoot).sort((a, b) => a.localeCompare(b));
  const routeFileEntries = routeFiles.map((file) => ({ file, rel: rel(root, file), text: fs.readFileSync(file, "utf8") }));
  const rawErrorFiles = routeFileEntries
    .filter(({ text }) => rawErrorPattern.test(text))
    .map(({ rel }) => rel)
    .sort();

  const allowlist = loadAllowlist(allowlistPath);
  const entries = Array.isArray(allowlist.entries) ? allowlist.entries : [];
  const allowlisted = new Set(entries.map((entry) => entry.path));
  const rawSet = new Set(rawErrorFiles);
  const errors = [];
  const issues = [];

  for (const entry of entries) {
    if (typeof entry.path !== "string" || !entry.path.endsWith("/route.ts")) {
      errors.push(`allowlist entry has invalid path: ${JSON.stringify(entry.path)}`);
      issues.push({ issue: "invalid_allowlist_path", path: entry.path });
      continue;
    }
    if (entry.path.includes("*")) {
      errors.push(`${entry.path}: wildcard paths are not allowed`);
      issues.push({ issue: "wildcard_allowlist_path", path: entry.path });
    }
    if (typeof entry.owner !== "string" || entry.owner.trim().length < 2) {
      errors.push(`${entry.path}: missing owner`);
      issues.push({ issue: "allowlist_missing_owner", path: entry.path });
    }
    if (typeof entry.reason !== "string" || entry.reason.trim().length < 12) {
      errors.push(`${entry.path}: missing specific reason`);
      issues.push({ issue: "allowlist_missing_reason", path: entry.path });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.expiresOn ?? ""))) {
      errors.push(`${entry.path}: expiresOn must be YYYY-MM-DD`);
      issues.push({ issue: "allowlist_invalid_expiry", path: entry.path });
    } else if (entry.expiresOn < today) {
      errors.push(`${entry.path}: allowlist expired on ${entry.expiresOn}`);
      issues.push({ issue: "allowlist_expired", path: entry.path });
    }
    if (!rawSet.has(entry.path)) {
      errors.push(`${entry.path}: stale allowlist entry (no raw NextResponse.json({ error }) match)`);
      issues.push({ issue: "stale_allowlist_entry", path: entry.path });
    }
  }

  for (const file of rawErrorFiles) {
    if (!allowlisted.has(file)) {
      errors.push(`${file}: raw error JSON must migrate to jsonProblem/jsonOk or be explicitly allowlisted`);
      issues.push({ issue: "raw_error_json", path: file });
    }
  }

  for (const { rel: routeRel, text } of routeFileEntries) {
    if (STACK_RESPONSE_RE.test(text)) {
      errors.push(`${routeRel}: route responses must not include stack traces`);
      issues.push({ issue: "stack_in_route_response", path: routeRel });
    }
    if (RAW_EXCEPTION_MESSAGE_RE.test(text)) {
      errors.push(`${routeRel}: route responses must not include raw exception messages`);
      issues.push({ issue: "raw_exception_message_in_route_response", path: routeRel });
    }
    if (SERVER_JSON_PROBLEM_EXCEPTION_RE.test(text)) {
      errors.push(`${routeRel}: 5xx problem responses must not use raw exception messages`);
      issues.push({ issue: "raw_exception_message_in_server_problem", path: routeRel });
    }
  }

  for (const required of REQUIRED_MARKERS) {
    const abs = path.join(root, required.rel);
    if (!fs.existsSync(abs)) {
      errors.push(`${required.rel}: missing required support-safe problem helper file`);
      issues.push({ issue: "missing_required_problem_file", path: required.rel });
      continue;
    }
    const text = fs.readFileSync(abs, "utf8");
    for (const marker of required.markers) {
      if (!text.includes(marker)) {
        errors.push(`${required.rel}: missing support-safe problem marker ${JSON.stringify(marker)}`);
        issues.push({ issue: "missing_support_safe_problem_marker", path: required.rel, marker });
      }
    }
  }

  return {
    ok: errors.length === 0,
    routeTsFiles: routeFiles.length,
    rawErrorRouteFiles: rawErrorFiles.length,
    allowlistedRawErrorRouteFiles: entries.length,
    issueCount: issues.length,
    issues,
    errors: errors.slice(0, 80),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const payload = analyzeApiProblemJson();
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    if (payload.errors.length > 80) console.error(`... ${payload.errors.length - 80} more`);
    console.error("Run npm run generate:api-problem-json-allowlist for the legacy baseline, or migrate routes.");
    process.exit(1);
  }
}
