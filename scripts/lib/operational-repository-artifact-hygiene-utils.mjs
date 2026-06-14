import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const BINARY_MAGIC = [
  { type: "png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { type: "gif", bytes: [0x47, 0x49, 0x46] },
  { type: "pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { type: "zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
  { type: "gzip", bytes: [0x1f, 0x8b] },
  { type: "elf", bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { type: "mz_pe", bytes: [0x4d, 0x5a] },
  { type: "wasm", bytes: [0x00, 0x61, 0x73, 0x6d] },
];

export function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

export function readJson(root, rel, fallback = null) {
  const text = read(root, rel);
  return text ? JSON.parse(text) : fallback;
}

export function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

export function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function toPosix(value) {
  return value.replace(/\\/gu, "/");
}

function gitList(root, args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map(toPosix)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function parseGitEolLine(line) {
  const tabIndex = line.indexOf("\t");
  if (tabIndex === -1) return null;
  const fields = line.slice(0, tabIndex).trim().split(/\s+/u);
  const rel = toPosix(line.slice(tabIndex + 1).trim());
  const indexEol = fields.find((field) => field.startsWith("i/"))?.slice(2) ?? "";
  const worktreeEol = fields.find((field) => field.startsWith("w/"))?.slice(2) ?? "";
  if (!rel) return null;
  return { path: rel, indexEol, worktreeEol };
}

export function gitEolMap(root, options = {}) {
  if (options.eolRows instanceof Map) return options.eolRows;
  if (Array.isArray(options.eolRows)) return new Map(options.eolRows.map((row) => [toPosix(row.path), row]));
  try {
    return new Map(
      execFileSync("git", ["ls-files", "--eol"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
        .split("\n")
        .map(parseGitEolLine)
        .filter(Boolean)
        .map((row) => [row.path, row])
    );
  } catch {
    return new Map();
  }
}

export function walk(root, rel, out = []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return out;
  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    out.push(toPosix(rel));
    return out;
  }
  if (!stat.isDirectory()) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const childRel = toPosix(path.join(rel, entry.name));
    if (entry.isDirectory()) walk(root, childRel, out);
    else if (entry.isFile()) out.push(childRel);
  }
  return out;
}

function fallbackFiles(root, config) {
  const excluded = config.sourceHygiene?.excludePathPrefixes ?? [];
  const files = [];
  for (const scanRoot of config.sourceHygiene?.scanRoots ?? []) walk(root, scanRoot, files);
  return files.filter((rel) => !excluded.some((prefix) => rel === prefix || rel.startsWith(prefix))).sort((a, b) => a.localeCompare(b));
}

export function allCandidateFiles(root, config, options = {}) {
  if (Array.isArray(options.files)) return options.files.map(toPosix).sort((a, b) => a.localeCompare(b));
  const tracked = gitList(root, ["ls-files"]);
  const untracked = gitList(root, ["ls-files", "--others", "--exclude-standard"]);
  const files = tracked.length > 0 || untracked.length > 0 ? [...tracked, ...untracked] : fallbackFiles(root, config);
  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
}

export function untrackedFiles(root, options = {}) {
  if (Array.isArray(options.untrackedFiles)) return options.untrackedFiles.map(toPosix).sort((a, b) => a.localeCompare(b));
  return gitList(root, ["ls-files", "--others", "--exclude-standard"]);
}

function regexFromPattern(pattern) {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/gu, "\\$&")
    .replace(/\*\*/gu, ".*")
    .replace(/\*/gu, "[^/]*");
  return new RegExp(`^${escaped}$`, "u");
}

function pathMatchesPattern(rel, pattern) {
  const normalized = toPosix(rel);
  if (pattern.endsWith("/**")) return normalized.startsWith(pattern.slice(0, -3));
  if (pattern.endsWith("/")) return normalized === pattern.slice(0, -1) || normalized.startsWith(pattern);
  if (pattern.includes("*")) return regexFromPattern(pattern).test(normalized);
  return normalized === pattern || normalized.startsWith(`${pattern}/`);
}

export function matchesAny(rel, patterns = []) {
  return patterns.some((pattern) => pathMatchesPattern(rel, pattern));
}

export function gitignoreLines(root, options = {}) {
  const text = options.gitignoreText ?? read(root, ".gitignore");
  return new Set(
    text
      .split(/\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
  );
}

export function ownerForGeneratedPath(rel, ownershipPrefixes) {
  return ownershipPrefixes.find((row) => rel === row.prefix || rel.startsWith(row.prefix)) ?? null;
}

function hasMagic(buffer, bytes) {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

export function binaryMagic(buffer) {
  return BINARY_MAGIC.find((row) => hasMagic(buffer, row.bytes))?.type ?? null;
}

export function isLikelyBinary(buffer) {
  if (buffer.length === 0) return false;
  if (binaryMagic(buffer)) return true;
  return buffer.subarray(0, Math.min(buffer.length, 8192)).includes(0);
}

function textExtensionSet(config) {
  return new Set(config.sourceHygiene?.textExtensions ?? []);
}

export function isTextPath(rel, config) {
  return textExtensionSet(config).has(path.extname(rel).toLowerCase());
}

export function skipPath(rel, config) {
  return (config.sourceHygiene?.excludePathPrefixes ?? []).some((prefix) => rel === prefix || rel.startsWith(prefix));
}

export function largeFileAllowance(rel, bytes, allowlist = []) {
  return allowlist.find((row) => {
    const matches = row.path ? rel === row.path : pathMatchesPattern(rel, row.pathPattern ?? "");
    return matches && bytes <= Number(row.maxBytes ?? 0);
  });
}

export function decodeUtf8(buffer) {
  return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
}

export function lineForIndex(text, index) {
  return text.slice(0, index).split("\n").length;
}

export function firstMatch(text, pattern) {
  const match = pattern.exec(text);
  if (!match) return null;
  return { index: match.index, value: match[0] };
}

export function registeredOperationalScript(packageScripts, rel) {
  if (rel.endsWith(".test.mjs")) {
    const testScript = path.basename(rel, ".test.mjs").replace(/^check-/, "test:");
    return Boolean(packageScripts[testScript]);
  }
  const base = path.basename(rel, ".mjs").replace(/^check-/, "check:");
  return Boolean(packageScripts[base]);
}

export function summarizeDelegated(report) {
  return {
    ok: report.ok,
    issueCount: report.issueCount ?? report.issues?.length ?? 0,
  };
}
