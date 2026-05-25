#!/usr/bin/env node
/**
 * Static security checks: npm audit + safe greps under src/.
 *
 * Default: npm audit --audit-level=high (fails on high+); greps warn on risky patterns.
 * --strict: npm audit --audit-level=moderate; greps fail on strict patterns.
 * --no-audit: skip npm audit (use in CI when audit already ran separately).
 *
 * child_process matches are always informational (human review), never fail.
 *
 * Optional path allowlist: scripts/security-static-audit-allowlist.txt (one substring per line;
 * if a source path includes the substring, grep hits in that file are skipped).
 *
 * V8 cross-surface dashboard href policy is enforced separately by `npm run check:surface:hrefs:strict`
 * (scripts/audit-product-surface-cross-surface-hrefs.mjs); keep that as the canonical strict gate for raw /decisions,
 * /campaigns, /assurance, etc. in UI trees.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createResult, finishWithResult } from "./lib/result.mjs";
import { nowMs } from "./lib/timing.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcRoot = path.join(root, "src");
const allowlistPath = path.join(__dirname, "security-static-audit-allowlist.txt");

const strict = process.argv.includes("--strict");
const skipAudit = process.argv.includes("--no-audit");
const auditLevel = strict ? "moderate" : "high";
const startMs = nowMs();

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

/** @type {{ label: string, re: RegExp, failInStrict?: boolean, infoOnly?: boolean, warnOnly?: boolean }[]} */
const patterns = [
  { label: "dangerouslySetInnerHTML", re: /dangerouslySetInnerHTML/, failInStrict: true },
  { label: "eval(", re: /\beval\s*\(/, failInStrict: true },
  { label: "new Function(", re: /new\s+Function\s*\(/, failInStrict: true },
  {
    label: "Node vm / runInNewContext",
    re: /runInNewContext\b|from\s+["']vm["']|require\s*\(\s*["']vm["']\s*\)/,
    failInStrict: true,
  },
  { label: "child_process", re: /child_process/, infoOnly: true },
  {
    label: "fs.writeFile / createWriteStream",
    re: /\bfs\.(?:writeFile|writeFileSync|createWriteStream)\s*\(/,
    infoOnly: true,
  },
  {
    label: "NEXT_PUBLIC_ with sensitive substring",
    re: /NEXT_PUBLIC_[A-Z0-9_]*.*(?:SECRET|SERVICE_ROLE|PRIVATE_KEY|STRIPE_SECRET|WEBHOOK_SECRET)/i,
    warnOnly: true,
  },
  {
    label: "Object.assign merge from request-like identifier",
    re: /Object\.assign\s*\(\s*\{[^}]*\}\s*,\s*(?:body|json|payload|formData|data|input)\s*\)/i,
    warnOnly: true,
  },
  { label: ".innerHTML assignment", re: /\.innerHTML\s*=/, warnOnly: true },
  { label: "document.write(", re: /\bdocument\.write\s*\(/, warnOnly: true },
  {
    label: "child_process execSync/spawnSync",
    re: /\b(?:execSync|spawnSync)\s*\(/,
    infoOnly: true,
  },
  {
    label: "dynamic import() with non-literal",
    re: /\bimport\s*\(\s*[a-zA-Z_$][\w$]*\s*\)/,
    warnOnly: true,
  },
  {
    label: "worker_threads",
    re: /\bworker_threads\b|from\s+["']node:worker_threads["']/,
    warnOnly: true,
  },
  {
    label: "WebAssembly / .wasm",
    re: /\.wasm\b|WebAssembly\./,
    warnOnly: true,
  },
];

function warnJsonParseWithRequestBody(rel, content) {
  if (!/\bJSON\.parse\s*\(/.test(content)) return;
  if (!/\b(?:request|req)\.json\s*\(/.test(content)) return;
  console.warn(
    `WARN JSON.parse in same module as request/req.json() in ${rel} — confirm parsing is safe (no untrusted prototype chains)`
  );
}

/** child_process.exec (not RegExp.prototype.exec) — info-only when import is present */
function infoChildProcessExec(rel, content) {
  if (
    !/from\s+["']child_process["']|require\s*\(\s*["']child_process["']\s*\)/.test(
      content
    )
  ) {
    return;
  }
  if (!/\bexec\s*\(/.test(content)) return;
  for (const line of content.split("\n")) {
    if (!/\bexec\s*\(/.test(line)) continue;
    if (/\.\s*exec\s*\(/.test(line)) continue;
    console.log(
      `INFO Review child_process exec(...) in ${rel} (verify argv and shell usage)`
    );
    return;
  }
}

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
    for (const { label, re, failInStrict, infoOnly, warnOnly } of patterns) {
      if (!re.test(content)) continue;
      if (infoOnly) {
        infos.push({ rel, label });
        continue;
      }
      const msg = `MATCH ${label} in ${rel}`;
      if (warnOnly) {
        console.warn(`WARN ${msg}`);
        continue;
      }
      if (strict && failInStrict) {
        console.error(`FAIL ${msg}`);
        strictFailures++;
      } else {
        console.warn(`WARN ${msg}`);
      }
    }
    warnJsonParseWithRequestBody(rel, content);
    infoChildProcessExec(rel, content);
  }

  for (const { rel, label } of infos) {
    console.log(
      `INFO Review ${label} in ${rel} (verify no user-controlled paths or args)`
    );
  }

  if (strict && strictFailures > 0) {
    console.error(
      `FAIL ${strictFailures} strict grep match(es). Fix or add a documented line to scripts/security-static-audit-allowlist.txt`
    );
    return false;
  }
  return true;
}

console.log(
  `Security static audit (strict=${strict}, audit-level=${auditLevel}, no-audit=${skipAudit})`
);
const auditOk = skipAudit ? true : runNpmAudit();
const grepOk = runGreps();
finishWithResult(
  createResult({
    checkId: "security-static-audit",
    ok: auditOk && grepOk,
    strict,
    errors: [
      ...(auditOk ? [] : [`npm audit failed at level=${auditLevel}`]),
      ...(grepOk ? [] : ["strict grep checks failed"]),
    ],
    meta: { skipAudit, auditLevel },
    startMs,
  })
);
