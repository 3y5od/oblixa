#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const TARGETS = ["e2e", "src"];
const REPORT_ONLY = process.argv.includes("--report");
const STRICT = process.argv.includes("--strict");

// Expected inline marker near a skip:
// test.skip(/* skip-meta: owner=@team expiry=2026-12-31 reason=... */ ...)
const META_RE = /skip-meta:\s*owner=([^\s]+)\s+expiry=(\d{4}-\d{2}-\d{2})\s+reason=([^)]+)/;
// Optional file-level default marker (usually at top of test files with many gated skips):
// skip-meta-default: owner=@team expiry=2026-12-31 reason=fixture_or_secret_condition
const DEFAULT_META_RE =
  /skip-meta-default:\s*owner=([^\s]+)\s+expiry=(\d{4}-\d{2}-\d{2})\s+reason=([^\n]+)/;
const DEFAULT_WINDOW_CHARS = 6000;

export const SKIP_DETECTORS = [
  "test.skip",
  "test.fixme",
  "test.describe.skip",
  "describe.skip",
  "it.skip",
  "file-name.skip",
  "environment-skip",
  "browser-skip",
  "ci-only-skip",
];

const CALL_RE =
  /\b(?:test\s*\.\s*describe\s*\.\s*skip|test\s*\.\s*fixme|test\s*\.\s*skip|describe\s*\.\s*skip|it\s*\.\s*skip)\s*\(/gu;
const SKIP_REFERENCE_RE = /\btest\s*\.\s*describe\s*\.\s*skip\b(?!\s*\()/gu;

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

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

function lineForIndex(raw, index) {
  return raw.slice(0, index).split("\n").length;
}

function isExpired(dateStr) {
  const parsed = Date.parse(`${dateStr}T23:59:59.999Z`);
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

function maskStringsAndComments(raw) {
  const out = raw.split("");
  let state = "code";
  let templateDepth = 0;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    const next = raw[i + 1];

    if (state === "code") {
      if (ch === "/" && next === "/") {
        out[i] = " ";
        out[i + 1] = " ";
        i += 1;
        state = "line-comment";
      } else if (ch === "/" && next === "*") {
        out[i] = " ";
        out[i + 1] = " ";
        i += 1;
        state = "block-comment";
      } else if (ch === '"' || ch === "'") {
        out[i] = " ";
        state = ch === '"' ? "double" : "single";
      } else if (ch === "`") {
        out[i] = " ";
        state = "template";
        templateDepth = 0;
      }
      continue;
    }

    if (state === "line-comment") {
      if (ch === "\n") state = "code";
      else out[i] = " ";
      continue;
    }

    if (state === "block-comment") {
      out[i] = ch === "\n" ? "\n" : " ";
      if (ch === "*" && next === "/") {
        out[i + 1] = " ";
        i += 1;
        state = "code";
      }
      continue;
    }

    if (state === "single" || state === "double") {
      out[i] = ch === "\n" ? "\n" : " ";
      if (ch === "\\") {
        if (next) {
          out[i + 1] = next === "\n" ? "\n" : " ";
          i += 1;
        }
      } else if ((state === "single" && ch === "'") || (state === "double" && ch === '"')) {
        state = "code";
      }
      continue;
    }

    if (state === "template") {
      out[i] = ch === "\n" ? "\n" : " ";
      if (ch === "\\") {
        if (next) {
          out[i + 1] = next === "\n" ? "\n" : " ";
          i += 1;
        }
      } else if (ch === "$" && next === "{") {
        out[i + 1] = " ";
        i += 1;
        templateDepth += 1;
        state = "template-expression";
      } else if (ch === "`" && templateDepth === 0) {
        state = "code";
      }
      continue;
    }

    if (state === "template-expression") {
      if (ch === "{") templateDepth += 1;
      if (ch === "}") {
        templateDepth -= 1;
        if (templateDepth === 0) state = "template";
      }
    }
  }

  return out.join("");
}

function detectorKind(matchText) {
  const normalized = matchText.replace(/\s+/gu, "");
  if (normalized.startsWith("test.describe.skip")) return "test.describe.skip";
  if (normalized.startsWith("test.fixme")) return "test.fixme";
  if (normalized.startsWith("test.skip")) return "test.skip";
  if (normalized.startsWith("describe.skip")) return "describe.skip";
  if (normalized.startsWith("it.skip")) return "it.skip";
  return "unknown";
}

function hasSkipFilename(rel) {
  const base = path.basename(rel);
  return base.includes(".skip.") || base.endsWith(".skip.ts") || base.endsWith(".skip.tsx");
}

function classifySkip(kind, snippet, reason) {
  const text = `${snippet}\n${reason ?? ""}`;
  const classes = [];
  if (kind === "file-name.skip") classes.push("file-name.skip");
  if (kind === "test.fixme") classes.push("fixme");
  if (/process\.env|Set [A-Z0-9_]+|credentials required|secret|env/i.test(text)) classes.push("environment-skip");
  if (/browserName|project\.name|webkit|firefox|chromium|browser/i.test(text)) classes.push("browser-skip");
  if (/\bCI\b|GITHUB_ACTIONS|pull_request|workflow/i.test(text)) classes.push("ci-only-skip");
  if (/skip\s*\(\s*true\b/u.test(snippet) || kind === "file-name.skip") classes.push("unconditional-skip");
  if (/skip\s*\(\s*![^)]+/u.test(snippet) || classes.includes("environment-skip")) classes.push("conditional-skip");
  return classes.length ? [...new Set(classes)].sort((a, b) => a.localeCompare(b)) : ["conditional-skip"];
}

function metadataFor(raw, index, defaultMeta) {
  const before = raw.slice(Math.max(0, index - 240), index + 80);
  const meta = before.match(META_RE);
  return {
    owner: meta?.[1] ?? defaultMeta?.owner ?? null,
    expiry: meta?.[2] ?? defaultMeta?.expiry ?? null,
    reason: meta?.[3]?.trim() ?? defaultMeta?.reason ?? null,
    usedFileDefaultMeta: !meta && Boolean(defaultMeta),
  };
}

function validateRow(record, problems) {
  if (!record.owner || !record.expiry || !record.reason) {
    problems.push({ ...record, issue: "missing_skip_meta" });
  } else if (!String(record.owner).startsWith("@")) {
    problems.push({ ...record, issue: "invalid_skip_owner" });
  } else if (!String(record.reason).trim()) {
    problems.push({ ...record, issue: "invalid_skip_meta" });
  } else if (record.expired) {
    problems.push({ ...record, issue: "expired_skip_meta" });
  }
}

function collectFileRows(root, file, raw) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const defaultMeta = parseDefaultMeta(raw);
  const masked = maskStringsAndComments(raw);
  const rows = [];

  if (hasSkipFilename(rel)) {
    const meta = metadataFor(raw, 0, defaultMeta);
    rows.push({
      file: rel,
      line: 1,
      index: 0,
      kind: "file-name.skip",
      owner: meta.owner,
      expiry: meta.expiry,
      reason: meta.reason,
      expired: meta.expiry ? isExpired(meta.expiry) : true,
      usedFileDefaultMeta: meta.usedFileDefaultMeta,
      classifications: classifySkip("file-name.skip", raw.slice(0, 240), meta.reason),
    });
  }

  CALL_RE.lastIndex = 0;
  let match;
  while ((match = CALL_RE.exec(masked))) {
    const kind = detectorKind(match[0]);
    const snippet = raw.slice(match.index, match.index + 360);
    const meta = metadataFor(raw, match.index, defaultMeta);
    rows.push({
      file: rel,
      line: lineForIndex(raw, match.index),
      index: match.index,
      kind,
      owner: meta.owner,
      expiry: meta.expiry,
      reason: meta.reason,
      expired: meta.expiry ? isExpired(meta.expiry) : true,
      usedFileDefaultMeta: meta.usedFileDefaultMeta,
      classifications: classifySkip(kind, snippet, meta.reason),
    });
  }

  SKIP_REFERENCE_RE.lastIndex = 0;
  while ((match = SKIP_REFERENCE_RE.exec(masked))) {
    const snippet = raw.slice(match.index, match.index + 360);
    const meta = metadataFor(raw, match.index, defaultMeta);
    rows.push({
      file: rel,
      line: lineForIndex(raw, match.index),
      index: match.index,
      kind: "test.describe.skip",
      owner: meta.owner,
      expiry: meta.expiry,
      reason: meta.reason,
      expired: meta.expiry ? isExpired(meta.expiry) : true,
      usedFileDefaultMeta: meta.usedFileDefaultMeta,
      classifications: classifySkip("test.describe.skip", snippet, meta.reason),
    });
  }

  return rows;
}

export function buildTestSkipGovernanceReport(root = ROOT, options = {}) {
  const targets = options.targets ?? TARGETS;
  const strict = Boolean(options.strict);
  const problems = [];
  const rows = [];

  for (const relTarget of targets) {
    const absTarget = path.join(root, relTarget);
    let files = [];
    try {
      files = walk(absTarget);
    } catch {
      continue;
    }

    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      for (const row of collectFileRows(root, file, raw)) {
        rows.push(row);
        validateRow(row, problems);
      }
    }
  }

  const byKind = {};
  const byClassification = {};
  for (const row of rows) {
    byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
    for (const classification of row.classifications) {
      byClassification[classification] = (byClassification[classification] ?? 0) + 1;
    }
  }

  return {
    skipCount: rows.length,
    problemCount: problems.length,
    defaultMetaAppliedCount: rows.filter((row) => row.usedFileDefaultMeta).length,
    detectors: SKIP_DETECTORS,
    byKind: Object.fromEntries(Object.entries(byKind).sort((a, b) => a[0].localeCompare(b[0]))),
    byClassification: Object.fromEntries(Object.entries(byClassification).sort((a, b) => a[0].localeCompare(b[0]))),
    problems: problems.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    rows: rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.kind.localeCompare(b.kind)),
    mode: strict ? "strict" : REPORT_ONLY ? "report" : "warn",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = buildTestSkipGovernanceReport(ROOT, { strict: STRICT });
  console.log(stableStringify(report));

  if (STRICT && report.problems.length > 0) {
    process.exitCode = 1;
  }
}
