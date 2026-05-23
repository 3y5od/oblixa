#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  ".windsurf",
  "coverage",
  "dist",
  "node_modules",
]);
const DANGEROUS_BINARY_EXTENSIONS = new Set([
  ".apk",
  ".bin",
  ".class",
  ".com",
  ".dll",
  ".dylib",
  ".elf",
  ".exe",
  ".ipa",
  ".jar",
  ".msi",
  ".node",
  ".scr",
  ".so",
  ".wasm",
]);
const REVIEWED_SCRIPT_EXTENSIONS = new Set([".sh", ".bash", ".zsh", ".ps1", ".bat", ".cmd", ".vbs"]);
const SCRIPT_SOURCE_EXTENSIONS = new Set([".js", ".cjs", ".mjs"]);
const ALLOWLIST = [
  {
    path: "scripts/github-actions/secret-gate.sh",
    rules: ["reviewed_script_extension", "shebang"],
    owner: "security",
    reason: "GitHub Actions helper shell script for local secret gate parity.",
    expires: "2027-12-31",
  },
  {
    path: "visual-export.js",
    rules: ["shebang"],
    owner: "frontend-platform",
    reason: "Node CLI helper used for visual export workflows.",
    expires: "2027-12-31",
  },
];

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function walk(root, dir = root, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory() && SKIP_DIRS.has(ent.name)) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(root, abs, out);
    } else if (ent.isFile()) {
      out.push(toPosix(path.relative(root, abs)));
    }
  }
  return out;
}

function readPrefix(root, rel, bytes = 16) {
  const fd = fs.openSync(path.join(root, rel), "r");
  try {
    const buffer = Buffer.alloc(bytes);
    const read = fs.readSync(fd, buffer, 0, bytes, 0);
    return buffer.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

function startsWithShebang(prefix) {
  return prefix.length >= 2 && prefix[0] === 0x23 && prefix[1] === 0x21;
}

function executableMagic(prefix) {
  if (prefix.length >= 2 && prefix[0] === 0x4d && prefix[1] === 0x5a) return "mz_pe";
  if (
    prefix.length >= 4 &&
    prefix[0] === 0x7f &&
    prefix[1] === 0x45 &&
    prefix[2] === 0x4c &&
    prefix[3] === 0x46
  ) {
    return "elf";
  }
  if (prefix.length >= 4) {
    const hex = prefix.subarray(0, 4).toString("hex");
    if (["feedface", "feedfacf", "cefaedfe", "cffaedfe", "cafebabe"].includes(hex)) {
      return "mach_o";
    }
  }
  if (prefix.length >= 8 && prefix.subarray(0, 8).toString("hex") === "0061736d01000000") {
    return "wasm";
  }
  return null;
}

function isExecutableMode(root, rel) {
  return (fs.statSync(path.join(root, rel)).mode & 0o111) !== 0;
}

function allowlistEntryFor(rel, rule, allowlist) {
  return allowlist.find((entry) => entry.path === rel && entry.rules.includes(rule)) ?? null;
}

function validateAllowlist(allowlist, issues) {
  const requiredTextFields = ["path", "owner", "reason", "expires"];
  const today = new Date().toISOString().slice(0, 10);
  for (const entry of allowlist) {
    for (const field of requiredTextFields) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") {
        issues.push({ issue: "invalid_allowlist_metadata", path: entry.path ?? null, field });
      }
    }
    if (!Array.isArray(entry.rules) || entry.rules.length === 0) {
      issues.push({ issue: "invalid_allowlist_metadata", path: entry.path ?? null, field: "rules" });
    }
    if (typeof entry.expires === "string" && entry.expires < today) {
      issues.push({ issue: "expired_allowlist_entry", path: entry.path, expires: entry.expires });
    }
  }
}

function isScriptSourcePath(rel) {
  const ext = path.extname(rel).toLowerCase();
  return rel.startsWith("scripts/") && SCRIPT_SOURCE_EXTENSIONS.has(ext);
}

export function analyzeExecutableMasqueradeGuards(root = ROOT, allowlist = ALLOWLIST) {
  const issues = [];
  validateAllowlist(allowlist, issues);

  for (const rel of walk(root).sort()) {
    const ext = path.extname(rel).toLowerCase();
    const prefix = readPrefix(root, rel, 16);
    const magic = executableMagic(prefix);
    const hasShebang = startsWithShebang(prefix);

    if (DANGEROUS_BINARY_EXTENSIONS.has(ext)) {
      issues.push({ issue: "dangerous_executable_extension", rel, ext });
    }
    if (magic) {
      issues.push({ issue: "executable_binary_signature", rel, magic });
    }
    if (REVIEWED_SCRIPT_EXTENSIONS.has(ext) && !allowlistEntryFor(rel, "reviewed_script_extension", allowlist)) {
      issues.push({ issue: "unreviewed_script_extension", rel, ext });
    }
    if (
      hasShebang &&
      !isScriptSourcePath(rel) &&
      !allowlistEntryFor(rel, "shebang", allowlist)
    ) {
      issues.push({ issue: "unexpected_shebang", rel });
    }
    if (
      isExecutableMode(root, rel) &&
      !isScriptSourcePath(rel) &&
      !allowlistEntryFor(rel, "executable_bit", allowlist)
    ) {
      issues.push({ issue: "unexpected_executable_bit", rel });
    }
  }

  return {
    checkId: "executable-masquerade-guards",
    ok: issues.length === 0,
    scannedFileCount: walk(root).length,
    allowlistCount: allowlist.length,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeExecutableMasqueradeGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
