#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const REQUIRED_BANNED_EXTENSIONS = [
  ".7z",
  ".app",
  ".bat",
  ".cab",
  ".cmd",
  ".deb",
  ".dll",
  ".dmg",
  ".exe",
  ".jar",
  ".js",
  ".lnk",
  ".mjs",
  ".ps1",
  ".rar",
  ".rpm",
  ".scr",
  ".sh",
  ".vbs",
  ".zip",
];

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

export function analyzeUploadBanlist(root = ROOT) {
  const issues = [];
  const rel = "config/upload-format-banlist.json";
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    return { checkId: "upload-banlist", ok: false, issueCount: 1, issues: [{ issue: "missing_file", rel }] };
  }

  const parsed = JSON.parse(read(root, rel));
  const extensions = Array.isArray(parsed.extensions) ? parsed.extensions : [];
  if (extensions.length === 0) {
    issues.push({ issue: "missing_extensions_array", rel });
  }

  const normalized = extensions.map((extension) => String(extension).toLowerCase());
  for (const extension of normalized) {
    if (!/^\.[a-z0-9]+$/.test(extension)) {
      issues.push({ issue: "invalid_extension", extension });
    }
  }
  for (const extension of REQUIRED_BANNED_EXTENSIONS) {
    if (!normalized.includes(extension)) {
      issues.push({ issue: "missing_required_extension", extension });
    }
  }
  if (new Set(normalized).size !== normalized.length) {
    issues.push({ issue: "duplicate_extension" });
  }
  if (normalized.join("\n") !== [...normalized].sort().join("\n")) {
    issues.push({ issue: "extensions_not_sorted" });
  }

  return { checkId: "upload-banlist", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeUploadBanlist();
  if (!report.ok) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(`OK: upload banlist (${JSON.parse(read(ROOT, "config/upload-format-banlist.json")).extensions.length} extension(s)).`);
}
