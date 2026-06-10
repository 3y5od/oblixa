#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const DEFAULT_MAX_COMMITS = Number.parseInt(process.env.GIT_HISTORY_SCAN_MAX_COMMITS ?? "1000", 10);
const SKIP_PATH_RE = /^(?:\.git|\.next|coverage|node_modules|playwright-report|test-results|artifacts\/(?:security-external-obligations-evidence|zap-baseline)\.json)\//u;
const ALLOW_MARKERS = ["security:test-fixture-secret-placeholder", "secretlint-disable-line", "gitleaks:allow"];
const HISTORICAL_SYNTHETIC_FIXTURES = new Set([
  [
    "a588f6b5141a3b571f8d7e5f6a2bb3431fae4a3a",
    "scripts/check-tracked-secrets-hygiene.test.mjs",
    "credentialed_url",
    75,
  ].join("\0"),
  [
    "a588f6b5141a3b571f8d7e5f6a2bb3431fae4a3a",
    "scripts/rls-smoke.test.mjs",
    "credentialed_url",
    50,
  ].join("\0"),
  [
    "a588f6b5141a3b571f8d7e5f6a2bb3431fae4a3a",
    "src/lib/extraction/model-context-redaction.test.ts",
    "openai_api_key",
    16,
  ].join("\0"),
  [
    "a588f6b5141a3b571f8d7e5f6a2bb3431fae4a3a",
    "src/lib/extraction/model-context-redaction.test.ts",
    "openai_api_key",
    35,
  ].join("\0"),
  [
    "a588f6b5141a3b571f8d7e5f6a2bb3431fae4a3a",
    "src/lib/observability/log-redaction.test.ts",
    "openai_api_key",
    28,
  ].join("\0"),
  [
    "a588f6b5141a3b571f8d7e5f6a2bb3431fae4a3a",
    "src/lib/observability/sentry-scrub.test.ts",
    "openai_api_key",
    173,
  ].join("\0"),
]);
const SECRET_PATTERNS = [
  { issue: "private_key_material", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PRIVATE )?PRIVATE KEY-----/gu },
  { issue: "aws_access_key_id", pattern: /\bAKIA[0-9A-Z]{16}\b/gu },
  { issue: "github_token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/gu },
  { issue: "openai_api_key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/gu },
  { issue: "stripe_live_secret_key", pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{24,}\b/gu },
  { issue: "slack_token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{24,}\b/gu },
  { issue: "webhook_secret", pattern: /\bwhsec_[A-Za-z0-9]{16,}\b/gu },
  { issue: "credentialed_url", pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^:\s/@]{3,}:[^@\s]{6,}@/giu },
  { issue: "supabase_service_role_jwt", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu, jwtRole: "service_role" },
];
const PATCH_EXCLUDE_PATHS = [
  ":(exclude)package-lock.json",
  ":(exclude)artifacts/**",
  ":(exclude).next/**",
  ":(exclude)coverage/**",
  ":(exclude)node_modules/**",
  ":(exclude)playwright-report/**",
  ":(exclude)test-results/**",
];

function toPosix(value) {
  return String(value ?? "").replace(/\\/gu, "/");
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function runGit(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function listCommits(root, maxCommits = DEFAULT_MAX_COMMITS) {
  const args = ["rev-list", "--all"];
  if (Number.isFinite(maxCommits) && maxCommits > 0) args.push(`--max-count=${maxCommits}`);
  return runGit(root, args).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

function commitPatch(root, commit) {
  const args = [
    "show",
    "--format=",
    "--unified=0",
    "--no-ext-diff",
    "--no-renames",
    commit,
    "--",
    ".",
    ...PATCH_EXCLUDE_PATHS,
  ];
  try {
    return runGit(root, args);
  } catch (error) {
    return "";
  }
}

function hasAllowMarker(line) {
  return ALLOW_MARKERS.some((marker) => line.includes(marker));
}

function isSyntheticCredentialedUrl(text, token) {
  return (
    token === "postgresql://postgres:postgres@" &&
    /\bpostgresql:\/\/postgres:postgres@(?:localhost|127\.0\.0\.1):5432\/postgres\b/iu.test(text)
  );
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

function redact(value) {
  const text = String(value ?? "");
  if (text.length <= 16) return "[redacted]";
  return `${text.slice(0, 8)}[redacted]${text.slice(-6)}`;
}

function scanLine(text, rel, lineNumber) {
  const findings = [];
  for (const row of SECRET_PATTERNS) {
    row.pattern.lastIndex = 0;
    let match;
    while ((match = row.pattern.exec(text)) !== null) {
      const token = match[0];
      if (row.jwtRole) {
        const payload = decodeJwtPayload(token);
        if (!payload || payload.role !== row.jwtRole) continue;
      }
      if (row.issue === "credentialed_url" && isSyntheticCredentialedUrl(text, token)) continue;
      if (hasAllowMarker(text)) continue;
      findings.push(issue(row.issue, { path: rel, line: lineNumber, evidence: redact(token) }));
    }
  }
  return findings;
}

function scanPatch(commit, patch) {
  const findings = [];
  let currentRel = null;
  let nextLine = null;

  for (const rawLine of patch.split(/\r?\n/u)) {
    if (rawLine.startsWith("+++ ")) {
      const rel = rawLine.slice(4).trim().replace(/^b\//u, "");
      currentRel = rel === "/dev/null" ? null : toPosix(rel);
      nextLine = null;
      continue;
    }

    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/u.exec(rawLine);
    if (hunk) {
      nextLine = Number.parseInt(hunk[1], 10);
      continue;
    }

    if (!currentRel || SKIP_PATH_RE.test(currentRel)) continue;

    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      const lineNumber = nextLine ?? 0;
      for (const finding of scanLine(rawLine.slice(1), currentRel, lineNumber)) {
        findings.push({ ...finding, commit });
      }
      if (nextLine != null) nextLine += 1;
    } else if (rawLine.startsWith(" ") && nextLine != null) {
      nextLine += 1;
    }
  }

  return findings;
}

function isHistoricalSyntheticFixture(finding) {
  return HISTORICAL_SYNTHETIC_FIXTURES.has([
    finding.commit,
    finding.path,
    finding.issue,
    Number(finding.line),
  ].join("\0"));
}

export function analyzeGitHistorySecretExposure(root = ROOT, options = {}) {
  const maxCommits = options.maxCommits ?? DEFAULT_MAX_COMMITS;
  const findings = [];
  const issues = [];
  let commits = [];
  try {
    commits = listCommits(root, maxCommits);
  } catch (error) {
    return {
      checkId: "git-history-secret-exposure",
      ok: false,
      issueCount: 1,
      commitCount: 0,
      findings: [],
      issues: [issue("git_history_unavailable", { error: String(error.message ?? error) })],
    };
  }

  for (const commit of commits) {
    for (const finding of scanPatch(commit, commitPatch(root, commit))) {
      if (isHistoricalSyntheticFixture(finding)) continue;
      findings.push(finding);
    }
  }

  issues.push(...findings);

  return {
    checkId: "git-history-secret-exposure",
    ok: issues.length === 0,
    maxCommits: Number.isFinite(maxCommits) && maxCommits > 0 ? maxCommits : "all",
    commitCount: commits.length,
    issueCount: issues.length,
    findings: findings.slice(0, 100),
    issues,
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--max-commits") {
      options.maxCommits = Number.parseInt(argv[index + 1] ?? "0", 10);
      index += 1;
    } else if (arg.startsWith("--max-commits=")) {
      options.maxCommits = Number.parseInt(arg.slice("--max-commits=".length), 10);
    }
  }
  return options;
}

export function runGitHistorySecretExposure(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeGitHistorySecretExposure(options.root ?? ROOT, options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runGitHistorySecretExposure();
}
