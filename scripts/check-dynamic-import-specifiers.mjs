#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SOURCE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const TEST_FILE_RE = /\.(test|spec|v9\.test|v10\.test)\.(ts|tsx|js|jsx|mjs|cjs)$/;

function walk(root, rel, out = []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return out;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "coverage", "dist"].includes(ent.name)) continue;
    const childRel = path.join(rel, ent.name).replace(/\\/g, "/");
    if (ent.isDirectory()) walk(root, childRel, out);
    else if (SOURCE_EXT_RE.test(ent.name) && !TEST_FILE_RE.test(ent.name) && !ent.name.endsWith("-test-helper.ts")) out.push(childRel);
  }
  return out;
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function maskStringLiterals(text) {
  let out = "";
  let quote = null;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      out += ch === "\n" ? "\n" : " ";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += " ";
      continue;
    }
    out += ch;
  }
  return out;
}

function maskStringLiteralContents(text) {
  let out = "";
  let quote = null;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) {
        escaped = false;
        out += " ";
      } else if (ch === "\\") {
        escaped = true;
        out += " ";
      } else if (ch === quote) {
        quote = null;
        out += ch;
      } else {
        out += ch === "\n" ? "\n" : " ";
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      continue;
    }
    out += ch;
  }
  return out;
}

function isLiteralSpecifier(spec) {
  if (spec.startsWith('"') || spec.startsWith("'")) return true;
  if (spec.startsWith("`")) return !spec.includes("${");
  return false;
}

function hasScriptElementCreation(text, masked) {
  const callRe = /\bdocument\s*\.\s*createElement\s*\(/gi;
  let match;
  while ((match = callRe.exec(masked)) !== null) {
    let i = callRe.lastIndex;
    while (/\s/.test(masked[i] ?? "")) i += 1;
    const quote = masked[i];
    if (quote !== '"' && quote !== "'") continue;
    let value = "";
    let escaped = false;
    for (let j = i + 1; j < text.length; j += 1) {
      const ch = text[j];
      if (escaped) {
        value += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) break;
      value += ch;
    }
    if (value.toLowerCase() === "script") return true;
  }
  return false;
}

function collectDynamicCodeIssues(file, text) {
  const issues = [];
  const code = maskStringLiterals(text);
  const codeWithStringDelimiters = maskStringLiteralContents(text);
  if (/\beval\s*\(/.test(code)) {
    issues.push({ issue: "eval_call", file });
  }
  if (/\bnew\s+Function\s*\(/.test(code)) {
    issues.push({ issue: "new_function_call", file });
  }
  if (/\b(?:setTimeout|setInterval)\s*\(\s*(["'`])/.test(codeWithStringDelimiters)) {
    issues.push({ issue: "string_timer_code", file });
  }
  if (hasScriptElementCreation(text, codeWithStringDelimiters)) {
    issues.push({ issue: "script_element_injection", file });
  }
  return issues;
}

export function analyzeDynamicImportSpecifiers(root = ROOT) {
  const issues = [];
  for (const rel of ["src", "scripts"]) {
    for (const file of walk(root, rel)) {
      const text = stripComments(fs.readFileSync(path.join(root, file), "utf8"));
      issues.push(...collectDynamicCodeIssues(file, text));
      for (const match of text.matchAll(/(?<![\w./-])import\s*\(\s*([^\s)]+)/g)) {
        const spec = match[1] ?? "";
        if (!isLiteralSpecifier(spec)) {
          issues.push({ issue: "non_literal_dynamic_import", file, specifier: spec.slice(0, 80) });
        }
      }
    }
  }
  return { checkId: "dynamic-import-specifiers", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeDynamicImportSpecifiers();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
