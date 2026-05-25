#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { analyzeTestFixtureSecrets } from "./check-test-fixture-secrets.mjs";
import { analyzeTrackedSecretsHygiene } from "./check-tracked-secrets-hygiene.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ALLOWLIST_REL = "scripts/static-secret-placeholder-allowlist.json";
const REVIEWABLE_FILE_RE = /\.(?:cjs|css|csv|env|html|js|json|jsx|md|mdx|mjs|sql|toml|ts|tsx|txt|ya?ml)$/iu;
const SKIP_PATH_RE = /^(?:\.git|\.next|coverage|node_modules|playwright-report|test-results)\//u;
const LOCAL_ENV_RE = /(^|\/)\.env\.(?:local|development|production|test)(?:\.local)?$/u;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const SECRET_PATTERNS = [
  {
    issue: "supabase_db_url_embeds_credentials",
    pattern: /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@db\.[a-z0-9-]+\.supabase\.co(?::\d+)?\/[^\s"'`)]*/giu,
  },
  {
    issue: "provider_webhook_secret",
    pattern: /\bwhsec_[A-Za-z0-9]{16,}\b/gu,
  },
];

function toPosix(value) {
  return String(value ?? "").replace(/\\/g, "/");
}

function sortedUnique(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function runGitList(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" })
    .split(/\r?\n/u)
    .map((line) => toPosix(line.trim()))
    .filter(Boolean);
}

function defaultCandidateFiles(root) {
  try {
    return sortedUnique([
      ...runGitList(root, ["ls-files"]),
      ...runGitList(root, ["ls-files", "--others", "--exclude-standard"]),
    ]);
  } catch {
    return [];
  }
}

function isReviewableFile(root, rel) {
  if (!rel || SKIP_PATH_RE.test(rel) || LOCAL_ENV_RE.test(rel)) return false;
  if (rel === ".env.example") return true;
  if (!REVIEWABLE_FILE_RE.test(rel)) return false;
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return false;
  return fs.statSync(abs).size <= MAX_FILE_BYTES;
}

function redact(value) {
  const text = String(value ?? "");
  if (text.length <= 16) return "[redacted]";
  return `${text.slice(0, 8)}[redacted]${text.slice(-6)}`;
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split(/\r?\n/u).length;
}

function loadAllowlist(root, allowlistRel, issues) {
  const abs = path.join(root, allowlistRel);
  if (!fs.existsSync(abs)) {
    issues.push({ issue: "secret_placeholder_allowlist_missing", path: allowlistRel });
    return { markers: new Set(), entries: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch {
    issues.push({ issue: "secret_placeholder_allowlist_invalid_json", path: allowlistRel });
    return { markers: new Set(), entries: [] };
  }

  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  if (parsed.schemaVersion !== 1) {
    issues.push({ issue: "secret_placeholder_allowlist_schema_version_mismatch", path: allowlistRel });
  }
  if (!Array.isArray(parsed.entries)) {
    issues.push({ issue: "secret_placeholder_allowlist_entries_missing", path: allowlistRel });
  }

  const bannedFields = new Set(["value", "secret", "token", "password", "key"]);
  const markers = new Set();
  for (const [index, entry] of entries.entries()) {
    for (const field of ["marker", "owner", "reason"]) {
      if (typeof entry?.[field] !== "string" || entry[field].trim() === "") {
        issues.push({ issue: "secret_placeholder_allowlist_entry_missing_metadata", path: allowlistRel, index, field });
      }
    }
    for (const field of Object.keys(entry ?? {})) {
      if (bannedFields.has(field.toLowerCase())) {
        issues.push({ issue: "secret_placeholder_allowlist_entry_must_not_store_secret_values", path: allowlistRel, index, field });
      }
    }
    if (typeof entry?.marker === "string" && entry.marker.trim()) markers.add(entry.marker);
  }

  return { markers, entries };
}

function hasAllowMarker(line, markers) {
  for (const marker of markers) {
    if (line.includes(marker)) return true;
  }
  return false;
}

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const normalized = parts[1].replace(/-/gu, "+").replace(/_/gu, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function scanFileForSecretShapes(root, rel, markers) {
  const issues = [];
  const text = read(root, rel);
  const lines = text.split(/\r?\n/u);

  for (const { issue, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const line = lineForOffset(text, match.index);
      if (hasAllowMarker(lines[line - 1] ?? "", markers)) continue;
      issues.push({ issue, path: rel, line, evidence: redact(match[0]) });
    }
  }

  const jwtPattern = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu;
  let jwtMatch;
  while ((jwtMatch = jwtPattern.exec(text)) !== null) {
    const payload = decodeJwtPayload(jwtMatch[0]);
    if (!payload || payload.role !== "service_role") continue;
    const line = lineForOffset(text, jwtMatch.index);
    if (hasAllowMarker(lines[line - 1] ?? "", markers)) continue;
    issues.push({ issue: "supabase_service_role_jwt", path: rel, line, evidence: redact(jwtMatch[0]) });
  }

  return issues;
}

function prefixedIssues(prefix, report) {
  return (report?.issues ?? []).map((issue) => ({ ...issue, source: prefix }));
}

export function analyzeStaticSecretSafety(root = DEFAULT_ROOT, options = {}) {
  const includeAggregates = options.includeAggregates !== false;
  const allowlistRel = options.allowlistRel ?? DEFAULT_ALLOWLIST_REL;
  const issues = [];
  const { markers, entries } = loadAllowlist(root, allowlistRel, issues);
  const files = (options.files ?? defaultCandidateFiles(root)).filter((rel) => isReviewableFile(root, rel));

  for (const rel of files) {
    issues.push(...scanFileForSecretShapes(root, rel, markers));
  }

  const aggregateReports = [];
  if (includeAggregates) {
    const trackedSecrets = analyzeTrackedSecretsHygiene(root);
    const fixtureSecrets = analyzeTestFixtureSecrets(root);
    aggregateReports.push(trackedSecrets, fixtureSecrets);
    issues.push(...prefixedIssues("tracked-secrets-hygiene", trackedSecrets));
    issues.push(...prefixedIssues("test-fixture-secrets", fixtureSecrets));
  }

  return {
    checkId: "static-secret-safety",
    ok: issues.length === 0,
    issueCount: issues.length,
    filesChecked: files.length,
    allowlist: {
      path: allowlistRel,
      markerCount: markers.size,
      entryCount: entries.length,
    },
    aggregateReports: aggregateReports.map((report) => ({
      checkId: report.checkId,
      ok: Boolean(report.ok),
      issueCount: Number(report.issueCount ?? report.issues?.length ?? 0),
    })),
    issues,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, includeAggregates: true, allowlistRel: DEFAULT_ALLOWLIST_REL };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--allowlist") {
      options.allowlistRel = argv[index + 1] ?? DEFAULT_ALLOWLIST_REL;
      index += 1;
    } else if (arg.startsWith("--allowlist=")) {
      options.allowlistRel = arg.slice("--allowlist=".length);
    } else if (arg === "--no-aggregates") {
      options.includeAggregates = false;
    }
  }
  return options;
}

export function runStaticSecretSafety(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeStaticSecretSafety(options.root, options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runStaticSecretSafety();
}

