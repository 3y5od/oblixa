#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGETS = ["e2e", "src"];
const reportOnly = process.argv.includes("--report");
const strict = process.argv.includes("--strict");

// Expected inline marker near a skip:
// test.skip(/* skip-meta: owner=@team expiry=2026-12-31 reason=... */ ...)
const META_RE = /skip-meta:\s*owner=([^\s]+)\s+expiry=(\d{4}-\d{2}-\d{2})\s+reason=([^)]+)/;
// Optional file-level default marker (usually at top of test files with many gated skips):
// skip-meta-default: owner=@team expiry=2026-12-31 reason=fixture_or_secret_condition
const DEFAULT_META_RE =
  /skip-meta-default:\s*owner=([^\s]+)\s+expiry=(\d{4}-\d{2}-\d{2})\s+reason=([^\n]+)/;
const SKIP_RE = /test\.skip\s*\(/g;
const DEFAULT_WINDOW_CHARS = 6000;

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, files);
    } else if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

function isExpired(dateStr) {
  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) return true;
  return parsed < Date.now();
}

function parseDefaultMeta(raw) {
  const fromHeader = raw.slice(0, DEFAULT_WINDOW_CHARS).match(DEFAULT_META_RE);
  if (!fromHeader) return null;
  return {
    owner: fromHeader[1],
    expiry: fromHeader[2],
    reason: fromHeader[3].trim(),
  };
}

const problems = [];
const rows = [];
let skipCount = 0;

for (const relTarget of TARGETS) {
  const absTarget = path.join(ROOT, relTarget);
  let files = [];
  try {
    files = walk(absTarget);
  } catch {
    continue;
  }

  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    const defaultMeta = parseDefaultMeta(raw);
    SKIP_RE.lastIndex = 0;
    let m;
    while ((m = SKIP_RE.exec(raw))) {
      skipCount += 1;
      const before = raw.slice(Math.max(0, m.index - 240), m.index + 40);
      const meta = before.match(META_RE);
      const owner = meta?.[1] ?? defaultMeta?.owner ?? null;
      const expiry = meta?.[2] ?? defaultMeta?.expiry ?? null;
      const reason = meta?.[3]?.trim() ?? defaultMeta?.reason ?? null;
      const record = {
        file: path.relative(ROOT, file).replace(/\\/g, "/"),
        index: m.index,
        owner,
        expiry,
        reason,
        expired: expiry ? isExpired(expiry) : true,
        usedFileDefaultMeta: !meta && Boolean(defaultMeta),
      };
      rows.push(record);

      if (!owner || !expiry || !reason) {
        problems.push({ ...record, issue: "missing_skip_meta" });
      } else if (!String(owner).startsWith("@")) {
        problems.push({ ...record, issue: "invalid_skip_owner" });
      } else if (!record.reason) {
        problems.push({ ...record, issue: "invalid_skip_meta" });
      } else if (record.expired) {
        problems.push({ ...record, issue: "expired_skip_meta" });
      }
    }
  }
}

console.log(
  JSON.stringify(
    {
      skipCount,
      problemCount: problems.length,
      defaultMetaAppliedCount: rows.filter((r) => r.usedFileDefaultMeta).length,
      problems,
      rows,
      mode: strict ? "strict" : reportOnly ? "report" : "warn",
    },
    null,
    2
  )
);

if (strict && problems.length > 0) {
  process.exit(1);
}
