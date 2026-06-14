import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel, fallback = null) {
  const text = read(root, rel);
  return text ? JSON.parse(text) : fallback;
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function walk(root, rel, predicate, out = []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const childRel = path.join(rel, entry.name).replace(/\\/gu, "/");
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    if (entry.isDirectory()) walk(root, childRel, predicate, out);
    else if (entry.isFile() && predicate(childRel)) out.push(childRel);
  }
  return out;
}

function sourceFiles(root) {
  return walk(root, "src", (rel) => /\.(?:ts|tsx)$/u.test(rel)).sort((a, b) => a.localeCompare(b));
}

function packageScripts(root) {
  return readJson(root, "package.json", { scripts: {} })?.scripts ?? {};
}

function isTestPath(rel) {
  return rel.startsWith("src/test-utils/") || /\.test\.|\.spec\.|\/__tests__\//u.test(rel);
}

function hasClientDirective(text) {
  return /^\s*["']use client["'];?/u.test(text);
}

function sha256(root, rel) {
  return createHash("sha256").update(fs.readFileSync(path.join(root, rel))).digest("hex");
}

export {
  hasClientDirective,
  isTestPath,
  issue,
  packageScripts,
  read,
  readJson,
  sha256,
  sourceFiles,
  stableStringify,
  walk,
  writeJson,
};
