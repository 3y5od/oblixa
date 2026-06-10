#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const SCAN_ROOTS = ["src"];
const TEXT_EXT_RE = /\.(?:jsx|tsx|html)$/iu;
const EXCLUDED_DIRS = new Set([".git", ".next", "coverage", "node_modules", "playwright-report", "test-results"]);

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function walk(root, rel, acc = []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return acc;
  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    if (TEXT_EXT_RE.test(rel)) acc.push(toPosix(rel));
    return acc;
  }
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) walk(root, path.join(rel, entry.name), acc);
      continue;
    }
    if (entry.isFile()) {
      const childRel = path.join(rel, entry.name);
      if (TEXT_EXT_RE.test(childRel)) acc.push(toPosix(childRel));
    }
  }
  return acc;
}

function candidateFiles(root) {
  return [...new Set(SCAN_ROOTS.flatMap((rel) => walk(root, rel)))].sort((a, b) => a.localeCompare(b));
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split(/\r?\n/u).length;
}

function attrValue(tag, attrName) {
  const quoted = new RegExp(`\\b${attrName}\\s*=\\s*(["'])(.*?)\\1`, "isu").exec(tag);
  if (quoted) return quoted[2];
  const expression = new RegExp(`\\b${attrName}\\s*=\\s*\\{([\\s\\S]*?)\\}`, "iu").exec(tag);
  return expression ? `{${expression[1].trim()}}` : null;
}

function hasAttr(tag, attrName) {
  return new RegExp(`\\b${attrName}\\s*=`, "iu").test(tag);
}

function isExternalScriptSrc(src) {
  return /^https?:\/\//iu.test(src);
}

function isDynamicScriptSrc(src) {
  return /^\{[\s\S]*\}$/u.test(src);
}

function scanFile(root, rel) {
  const text = fs.readFileSync(path.join(root, rel), "utf8");
  const issues = [];
  for (const match of text.matchAll(/<(?:Script|script)\b[\s\S]*?>/giu)) {
    const tag = match[0];
    const src = attrValue(tag, "src");
    if (!src) continue;
    const line = lineForOffset(text, match.index ?? 0);
    if (isDynamicScriptSrc(src)) {
      issues.push({ issue: "dynamic_script_src_requires_review", path: rel, line });
      continue;
    }
    if (!isExternalScriptSrc(src)) continue;
    if (!hasAttr(tag, "integrity")) {
      issues.push({ issue: "external_script_missing_integrity", path: rel, line, src });
    }
    if (!hasAttr(tag, "crossOrigin") && !hasAttr(tag, "crossorigin")) {
      issues.push({ issue: "external_script_missing_crossorigin", path: rel, line, src });
    }
  }
  return issues;
}

export function analyzeThirdPartyScriptIntegrity(root = DEFAULT_ROOT) {
  const files = candidateFiles(root);
  const issues = files.flatMap((rel) => scanFile(root, rel));
  return {
    checkId: "third-party-script-integrity",
    ok: issues.length === 0,
    filesChecked: files.length,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeThirdPartyScriptIntegrity();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
