#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SCAN_DIRS = ["src", "scripts", "semgrep", ".github/workflows"];
const TEXT_EXT_RE = /\.(ts|tsx|js|mjs|cjs|json|yml|yaml|md)$/i;

function walk(dir, acc = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return acc;
  for (const name of fs.readdirSync(abs)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const p = path.join(abs, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(path.relative(ROOT, p), acc);
    else if (TEXT_EXT_RE.test(name)) acc.push(p);
  }
  return acc;
}

function derivePatterns(baseName) {
  const key = baseName.replace(/\.(mjs|ts|js)$/i, "").toLowerCase();
  /** @type {RegExp[]} */
  const patterns = [];
  if (key.includes("auth")) patterns.push(/\bauth\b/i, /\b401\b/, /\b403\b/);
  if (key.includes("token")) patterns.push(/\btoken\b/i, /\bbearer\b/i);
  if (key.includes("csrf")) patterns.push(/\borigin\b/i, /\breferrer\b/i);
  if (key.includes("rate-limit")) patterns.push(/\brateLimitCheck\b/i, /\bratelimit\b/i);
  if (key.includes("cors")) patterns.push(/\baccess-control-allow-origin\b/i, /\bcors\b/i);
  if (key.includes("header")) patterns.push(/\bheader\b/i, /\bnextresponse\b/i);
  if (key.includes("cron")) patterns.push(/\bcron\b/i, /\bauthorizeCronRequest\b/);
  if (key.includes("replay")) patterns.push(/\breplay\b/i, /\bnonce\b/i);
  if (key.includes("crypto")) patterns.push(/\bcrypto\b/i, /\bsecureCompare\b/);
  if (key.includes("sentry") || key.includes("redaction") || key.includes("scrub")) {
    patterns.push(/\bscrub\b/i, /\bredact\b/i, /\bsentry\b/i);
  }
  if (key.includes("workspace") || key.includes("org-scope") || key.includes("tenant")) {
    patterns.push(/\borganization_id\b/, /\borgId\b/);
  }
  if (patterns.length === 0) patterns.push(new RegExp(key.split("-").slice(-1)[0] || "security", "i"));
  return patterns;
}

/**
 * Generic checker/reporter used for broad plan coverage.
 * @param {string} callerPath
 */
export function runGenericSecurityCheck(callerPath) {
  const strict = process.argv.includes("--strict");
  const failOnFindings = process.argv.includes("--fail-on-findings");
  const baseName = path.basename(callerPath || process.argv[1] || "unknown.mjs");
  const scriptId = baseName.replace(/\.mjs$/i, "");
  const patterns = derivePatterns(baseName);
  const files = SCAN_DIRS.flatMap((d) => walk(d)).sort();

  const findings = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");
    for (const re of patterns) {
      if (re.test(content)) {
        findings.push({ file: rel, signal: String(re) });
        break;
      }
    }
  }

  const payload = {
    scriptId,
    generatedAt: new Date().toISOString(),
    strict,
    scannedFileCount: files.length,
    signalCount: findings.length,
    summary: findings.length
      ? `Detected ${findings.length} matching signal(s) for ${scriptId}.`
      : `No matching signals detected for ${scriptId}.`,
    sampleFindings: findings.slice(0, 50),
  };

  console.log(JSON.stringify(payload, null, 2));
  if (strict && failOnFindings && findings.length > 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runGenericSecurityCheck(import.meta.url);
}
