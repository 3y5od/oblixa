#!/usr/bin/env node
/**
 * Fails if git tracks obvious secret material, weakens env-file ignore rules,
 * or lets .env.example carry real-looking secret values.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const CHECK_ID = "tracked-secrets-hygiene";
const REQUIRED_GITIGNORE_ENV_PATTERNS = [".env*", "!.env.example"];
const SENSITIVE_ENV_KEY_RE =
  /(?:SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE|API_KEY|_KEY\b|HMAC|PEPPER|BEARER|CLIENT_SECRET|ENCRYPTION_KEY|DSN|PASSCODE)/i;
const SECRET_VALUE_PATTERNS = [
  { issue: "env_example_private_key_block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/ },
  { issue: "env_example_aws_access_key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { issue: "env_example_github_token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{80,})\b/ },
  { issue: "env_example_openai_key", pattern: /\b(?:sk-proj-[A-Za-z0-9_-]{48,}|sk-[A-Za-z0-9]{48,})\b/ },
  { issue: "env_example_stripe_key", pattern: /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { issue: "env_example_stripe_webhook_secret", pattern: /\bwhsec_[A-Za-z0-9]{16,}\b/ },
  { issue: "env_example_slack_token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { issue: "env_example_jwt_value", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  { issue: "env_example_url_embeds_credentials", pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^@\s]+@/i },
];

function listTrackedFiles(root) {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function normalizeGitignoreLines(text) {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ index: index + 1, pattern: line.trim() }))
    .filter(({ pattern }) => pattern && !pattern.startsWith("#"));
}

function normalizeEnvValue(rawValue) {
  let value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function analyzeGitignoreEnvRules(root, issues) {
  const rel = ".gitignore";
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    issues.push({ issue: "missing_gitignore", file: rel });
    return;
  }
  const lines = normalizeGitignoreLines(fs.readFileSync(abs, "utf8"));
  const patterns = new Set(lines.map(({ pattern }) => pattern));
  for (const pattern of REQUIRED_GITIGNORE_ENV_PATTERNS) {
    if (!patterns.has(pattern)) {
      issues.push({ issue: "missing_gitignore_env_pattern", file: rel, pattern });
    }
  }
  const envExampleUnignore = lines.find(({ pattern }) => pattern === "!.env.example");
  const envIgnore = lines.find(({ pattern }) => pattern === ".env*");
  if (envIgnore && envExampleUnignore && envIgnore.index > envExampleUnignore.index) {
    issues.push({
      issue: "env_example_unignore_shadowed",
      file: rel,
      envIgnoreLine: envIgnore.index,
      envExampleUnignoreLine: envExampleUnignore.index,
    });
  }
  for (const { index, pattern } of lines) {
    if (pattern.startsWith("!.env") && pattern !== "!.env.example") {
      issues.push({ issue: "unsafe_env_unignore_pattern", file: rel, line: index, pattern });
    }
  }
}

function analyzeEnvExample(root, issues) {
  const rel = ".env.example";
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    issues.push({ issue: "missing_env_example", file: rel });
    return;
  }
  const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  for (const [offset, line] of lines.entries()) {
    const match = /^\s*#?\s*([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = normalizeEnvValue(rawValue);
    const lineNumber = offset + 1;
    if (SENSITIVE_ENV_KEY_RE.test(key) && value.length > 0) {
      issues.push({ issue: "env_example_secret_value_must_be_empty", file: rel, line: lineNumber, key });
      continue;
    }
    for (const { issue, pattern } of SECRET_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        issues.push({ issue, file: rel, line: lineNumber, key });
      }
    }
  }
}

export function analyzeTrackedSecretsHygiene(root = process.cwd(), options = {}) {
  const issues = [];
  let tracked;
  try {
    tracked = options.trackedFiles ?? listTrackedFiles(root);
  } catch {
    return {
      checkId: CHECK_ID,
      ok: false,
      issueCount: 1,
      issues: [{ issue: "git_ls_files_failed" }],
      filesChecked: 0,
    };
  }

  for (const f of tracked) {
    const base = f.split("/").pop() ?? f;
    if (base.startsWith(".env") && base !== ".env.example") {
      issues.push({ issue: "tracked_env_file", file: f });
    }
    if (/\.(pem|p12)$/i.test(f)) {
      issues.push({ issue: "tracked_key_material", file: f });
    }
    if (f.startsWith("coverage/") || f === "coverage") {
      issues.push({ issue: "tracked_coverage_output", file: f });
    }
  }

  analyzeGitignoreEnvRules(root, issues);
  analyzeEnvExample(root, issues);

  return {
    checkId: CHECK_ID,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    filesChecked: tracked.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeTrackedSecretsHygiene();
  if (!report.ok) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(`OK: ${report.filesChecked} tracked file(s) pass secrets/coverage hygiene check.`);
}
