import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

export function readJson(root, rel, fallback = undefined) {
  const text = read(root, rel);
  if (!text) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing JSON file: ${rel}`);
  }
  return JSON.parse(text);
}

export function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

export function uniqueSorted(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined).map(String))].sort((a, b) => a.localeCompare(b));
}

export function normalizeCommandRef(command) {
  return String(command ?? "").trim().replace(/^npm\s+run\s+/u, "");
}

export function commandExists(packageScripts, command) {
  const script = normalizeCommandRef(command);
  return Boolean(packageScripts[script]);
}

function normalizeRel(rel) {
  return String(rel ?? "").replace(/\\/gu, "/").replace(/^\.\/+/u, "").replace(/^\/+/u, "");
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
    } else if (char === "*") {
      out += "[^/]*";
    } else {
      out += escapeRegExp(char);
    }
  }
  return new RegExp(`^${out}$`, "u");
}

export function parseCodeowners(raw) {
  return String(raw ?? "")
    .split("\n")
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return null;
      const parts = trimmed.split(/\s+/u);
      return { line: index + 1, pattern: parts[0], owners: parts.slice(1).filter(Boolean) };
    })
    .filter(Boolean);
}

function codeownersPatternMatches(pattern, relPath) {
  const rel = normalizeRel(relPath);
  const rawPattern = String(pattern ?? "").trim();
  if (!rawPattern || rawPattern.startsWith("!")) return false;
  const rootAnchored = rawPattern.startsWith("/");
  const normalized = normalizeRel(rawPattern);
  if (normalized.endsWith("/")) return rel.startsWith(normalized);
  if (normalized.includes("*")) {
    if (globToRegExp(normalized).test(rel)) return true;
    return !rootAnchored && globToRegExp(`**/${normalized}`).test(rel);
  }
  if (!rootAnchored && !normalized.includes("/")) return rel === normalized || rel.endsWith(`/${normalized}`);
  return rel === normalized || rel.startsWith(`${normalized}/`);
}

export function findCodeownerCoverage(entries, relPath) {
  return entries.filter((entry) => codeownersPatternMatches(entry.pattern, relPath));
}

export function pathExists(root, relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function stableValue(value, volatileKeys) {
  if (Array.isArray(value)) return value.map((entry) => stableValue(entry, volatileKeys));
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (volatileKeys.has(key)) continue;
      out[key] = stableValue(value[key], volatileKeys);
    }
    return out;
  }
  return value;
}

export function stableReportChecksum(root, relPath, volatileKeys = new Set()) {
  const parsed = readJson(root, relPath);
  const stableBytes = stableStringify(stableValue(parsed, volatileKeys));
  return {
    stableSha256: crypto.createHash("sha256").update(stableBytes).digest("hex"),
    stableBytes: Buffer.byteLength(stableBytes),
  };
}
