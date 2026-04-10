#!/usr/bin/env node
/**
 * Static security checks: npm audit + safe greps under src/.
 *
 * Default: npm audit --audit-level=high (fails on high+); greps warn on risky patterns.
 * --strict: npm audit --audit-level=moderate; greps fail on dangerouslySetInnerHTML / eval / new Function.
 *
 * child_process matches are always informational (human review), never fail.
 *
 * Optional path allowlist: scripts/security-static-audit-allowlist.txt (one substring per line;
 * if a source path includes the substring, grep hits in that file are skipped).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcRoot = path.join(root, "src");
const allowlistPath = path.join(__dirname, "security-static-audit-allowlist.txt");

const strict = process.argv.includes("--strict");
const auditLevel = strict ? "moderate" : "high";

function loadGrepAllowlist() {
  if (!fs.existsSync(allowlistPath)) return [];
  return fs
    .readFileSync(allowlistPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function isGrepAllowed(relPath, allowSubstrings) {
  const n = relPath.replace(/\\/g, "/");
  return allowSubstrings.some((sub) => n.includes(sub));
}

function walkSrcFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkSrcFiles(p, acc);
    else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(name)) acc.push(p);
  }
  return acc;
}

const patterns = [
  { label: "dangerouslySetInnerHTML", re: /dangerouslySetInnerHTML/, failInStrict: true },
  { label: "eval(", re: /\beval\s*\(/, failInStrict: true },
  { label: "new Function(", re: /new\s+Function\s*\(/, failInStrict: true },
  { label: "child_process", re: /child_process/, infoOnly: true },
];

function runNpmAudit() {
  const r = spawnSync("npm", ["audit", "--audit-level", auditLevel], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    console.error(`FAIL npm audit (level=${auditLevel}, exit ${r.status})`);
    return false;
  }
  console.log(`PASS npm audit (level=${auditLevel})`);
  return true;
}

function runGreps() {
  const allowSubstrings = loadGrepAllowlist();
  const files = walkSrcFiles(srcRoot).sort();
  let strictFailures = 0;
  const infos = [];

  for (const abs of files) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    if (isGrepAllowed(rel, allowSubstrings)) continue;

    const content = fs.readFileSync(abs, "utf8");
    for (const { label, re, failInStrict, infoOnly } of patterns) {
      if (!re.test(content)) continue;
      if (infoOnly) {
        infos.push({ rel, label });
        continue;
      }
      const msg = `MATCH ${label} in ${rel}`;
      if (strict && failInStrict) {
        console.error(`FAIL ${msg}`);
        strictFailures++;
      } else {
        console.warn(`WARN ${msg}`);
      }
    }
  }

  for (const { rel, label } of infos) {
    console.log(`INFO Review ${label} usage in ${rel} (child_process / subprocess — verify no user-controlled args)`);
  }

  if (strict && strictFailures > 0) {
    console.error(`FAIL ${strictFailures} strict grep match(es). Fix or add a documented line to scripts/security-static-audit-allowlist.txt`);
    return false;
  }
  return true;
}

console.log(`Security static audit (strict=${strict}, audit-level=${auditLevel})`);
const auditOk = runNpmAudit();
const grepOk = runGreps();
if (!auditOk || !grepOk) process.exit(1);
console.log("PASS security-static-audit");
