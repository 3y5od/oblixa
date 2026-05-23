#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const SECURITY_OWNER_RE = /(?:security|secops|appsec|backend|platform|infra|devops|qa)/iu;
const CODEOWNERS_OWNER_RE = /^(?:@[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?|[^@\s]+@[^@\s]+\.[^@\s]+)$/u;

const STATIC_REQUIRED_PATHS = [
  { category: "api_route_guards", path: "src/app/api/" },
  { category: "api_route_guards", path: "src/lib/security/api-guards.ts" },
  { category: "auth", path: "src/lib/auth/" },
  { category: "auth", path: "src/actions/auth.ts" },
  { category: "auth", path: "src/app/(auth)/" },
  { category: "security_helpers", path: "src/lib/security/" },
  { category: "security_helpers", path: "src/proxy.ts" },
  { category: "migrations", path: "supabase/migrations/" },
  { category: "workflows", path: ".github/workflows/" },
  { category: "workflows", path: ".github/CODEOWNERS" },
  { category: "env_contracts", path: ".env.example" },
  { category: "env_contracts", path: "src/lib/env/" },
  { category: "env_contracts", path: "scripts/env-example-parity-allowlist.txt" },
  { category: "outbound_fetch", path: "scripts/outbound-fetch-allowlist.txt" },
  { category: "outbound_fetch", path: "scripts/outbound-domain-allowlist.txt" },
  { category: "outbound_fetch", path: "src/lib/security/safe-fetch.ts" },
  { category: "token_handling", path: "src/lib/security/token-crypto.ts" },
  { category: "token_handling", path: "src/lib/security/secret-compare.ts" },
  { category: "token_handling", path: "src/app/api/export/calendar/feed/" },
  { category: "supply_chain", path: "package.json" },
  { category: "supply_chain", path: "package-lock.json" },
  { category: "allowlists", path: "scripts/" },
  { category: "allowlists", path: "artifacts/" },
  { category: "allowlists", path: "config/" },
];

const SCAN_ROOTS = [".github", "artifacts", "config", "scripts", "src", "supabase"];
const SKIP_DIRS = new Set([".git", ".next", "coverage", "node_modules", "test-results", "playwright-report"]);

function normalizeRel(rel) {
  return rel.replace(/\\/gu, "/").replace(/^\.\/+/u, "").replace(/^\/+/u, "");
}

function parseCodeowners(raw) {
  return raw
    .split("\n")
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return null;
      const parts = trimmed.split(/\s+/u);
      const pattern = parts[0];
      const owners = parts.slice(1).filter(Boolean);
      return { line: index + 1, pattern, owners };
    })
    .filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");
}

function globToRegExp(glob) {
  let out = "";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    const next = glob[index + 1];
    if (char === "*" && next === "*") {
      out += ".*";
      index += 1;
      continue;
    }
    if (char === "*") {
      out += "[^/]*";
      continue;
    }
    out += escapeRegExp(char);
  }
  return new RegExp(`^${out}$`, "u");
}

function codeownersPatternMatches(pattern, relPath) {
  const rel = normalizeRel(relPath);
  const rawPattern = pattern.trim();
  if (!rawPattern || rawPattern.startsWith("!")) return false;

  const rootAnchored = rawPattern.startsWith("/");
  const normalized = normalizeRel(rawPattern);

  if (normalized.endsWith("/")) {
    return rel.startsWith(normalized);
  }

  if (normalized.includes("*")) {
    if (globToRegExp(normalized).test(rel)) return true;
    return !rootAnchored && globToRegExp(`**/${normalized}`).test(rel);
  }

  if (!rootAnchored && !normalized.includes("/")) {
    return rel === normalized || rel.endsWith(`/${normalized}`);
  }

  return rel === normalized || rel.startsWith(`${normalized}/`);
}

function ownersAreValid(owners) {
  return owners.length > 0 && owners.every((owner) => CODEOWNERS_OWNER_RE.test(owner));
}

function ownersAreSecurityAware(owners) {
  return owners.some((owner) => SECURITY_OWNER_RE.test(owner));
}

function walkFiles(root, relDir, files = []) {
  const absDir = path.join(root, relDir);
  if (!fs.existsSync(absDir)) return files;

  for (const name of fs.readdirSync(absDir)) {
    if (SKIP_DIRS.has(name)) continue;
    const rel = normalizeRel(path.join(relDir, name));
    const abs = path.join(root, rel);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      walkFiles(root, rel, files);
    } else if (stat.isFile()) {
      files.push(rel);
    }
  }
  return files;
}

function discoverAllowlistFiles(root) {
  return SCAN_ROOTS.flatMap((scanRoot) => walkFiles(root, scanRoot))
    .filter((rel) => /(^|[-_/])allowlist(?:[-_.]|$)/iu.test(rel))
    .sort((a, b) => a.localeCompare(b));
}

function pathExistsForCoverage(root, relPath) {
  const normalized = normalizeRel(relPath);
  if (normalized.endsWith("/")) return fs.existsSync(path.join(root, normalized));
  return fs.existsSync(path.join(root, normalized));
}

function findCoveringEntries(entries, relPath) {
  return entries.filter((entry) => codeownersPatternMatches(entry.pattern, relPath));
}

function pushCoverageIssues(issues, entries, relPath, category, issueName = "missing_codeowner_coverage") {
  const covering = findCoveringEntries(entries, relPath);
  if (covering.length === 0) {
    issues.push({ issue: issueName, category, path: relPath });
    return;
  }

  const invalidOwners = covering.filter((entry) => !ownersAreValid(entry.owners));
  for (const entry of invalidOwners) {
    issues.push({
      issue: "invalid_codeowner_owner",
      category,
      path: relPath,
      pattern: entry.pattern,
      line: entry.line,
      owners: entry.owners,
    });
  }

  if (!covering.some((entry) => ownersAreSecurityAware(entry.owners))) {
    issues.push({
      issue: "missing_security_aware_owner",
      category,
      path: relPath,
      patterns: covering.map((entry) => entry.pattern),
      owners: [...new Set(covering.flatMap((entry) => entry.owners))].sort(),
    });
  }
}

export function analyzeCodeownersSecurityPaths(root = ROOT) {
  const codeownersPath = path.join(root, ".github", "CODEOWNERS");
  if (!fs.existsSync(codeownersPath)) {
    return { checkId: "codeowners-security-paths", ok: false, issueCount: 1, issues: [{ issue: "missing_codeowners" }] };
  }

  const raw = fs.readFileSync(codeownersPath, "utf8");
  const entries = parseCodeowners(raw);
  const issues = [];

  for (const entry of entries) {
    if (!ownersAreValid(entry.owners)) {
      issues.push({
        issue: "invalid_codeowners_entry",
        line: entry.line,
        pattern: entry.pattern,
        owners: entry.owners,
      });
    }
  }

  for (const required of STATIC_REQUIRED_PATHS) {
    if (!pathExistsForCoverage(root, required.path)) continue;
    pushCoverageIssues(issues, entries, required.path, required.category);
  }

  const allowlistFiles = discoverAllowlistFiles(root);
  for (const allowlistPath of allowlistFiles) {
    pushCoverageIssues(issues, entries, allowlistPath, "allowlists", "allowlist_missing_codeowner_coverage");
  }

  return {
    checkId: "codeowners-security-paths",
    ok: issues.length === 0,
    issueCount: issues.length,
    checkedPathCount: STATIC_REQUIRED_PATHS.filter((required) => pathExistsForCoverage(root, required.path)).length,
    allowlistFileCount: allowlistFiles.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeCodeownersSecurityPaths();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
