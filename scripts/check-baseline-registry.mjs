#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_REGISTRY_REL = "scripts/baseline-registry.json";
const DISCOVERY_ROOTS = ["scripts", "artifacts"];
const BASELINE_EXTENSIONS = new Set([".json", ".sha256", ".txt"]);
const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  "blob-report",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const REQUIRED_STRING_FIELDS = [
  "path",
  "owner",
  "purpose",
  "checkCommand",
  "refreshCommand",
  "sourceScanner",
  "sourceScannerSha256",
  "reviewTrigger",
];
const HASH_RE = /^[a-f0-9]{64}$/u;

export function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function relPath(root, abs) {
  return toPosix(path.relative(root, abs));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function readJsonFile(abs) {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function sha256File(abs) {
  return crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

function walkFiles(root, dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walkFiles(root, path.join(dir, entry.name), acc);
      continue;
    }
    if (!entry.isFile()) continue;
    acc.push(relPath(root, path.join(dir, entry.name)));
  }

  return acc;
}

function hasBaselineMarker(rel) {
  const parts = toPosix(rel).toLowerCase().split("/");
  return parts.includes("baseline") || parts.at(-1)?.includes("baseline");
}

function isBaselineArtifact(rel, registryRel = DEFAULT_REGISTRY_REL) {
  if (rel === registryRel) return false;
  if (!hasBaselineMarker(rel)) return false;
  return BASELINE_EXTENSIONS.has(path.extname(rel));
}

export function discoverBaselineFiles(root = DEFAULT_ROOT, registryRel = DEFAULT_REGISTRY_REL) {
  const files = [];
  for (const discoveryRoot of DISCOVERY_ROOTS) {
    walkFiles(root, path.join(root, discoveryRoot), files);
  }
  return files
    .filter((rel) => isBaselineArtifact(rel, registryRel))
    .sort((a, b) => a.localeCompare(b));
}

export function loadBaselineRegistry(root = DEFAULT_ROOT, registryRel = DEFAULT_REGISTRY_REL) {
  const registryPath = path.join(root, registryRel);
  return {
    registryPath,
    registry: readJsonFile(registryPath),
  };
}

function addIssue(issues, issue) {
  issues.push(issue);
}

function temporaryPathNeedles(temporaryPath) {
  const normalized = temporaryPath.replace(/\\/g, "/").replace(/^\.\//u, "");
  if (normalized === "none") return [];
  return Array.from(
    new Set([
      normalized,
      normalized.replace(/\/\*\*$/u, ""),
      normalized.replace(/\/\*$/u, ""),
    ].filter(Boolean)),
  );
}

function analyzeEntry({ entry, index, root, discoveredSet, seenPaths, issues }) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    addIssue(issues, {
      code: "invalid_registry_entry",
      index,
      message: "Registry entry must be an object.",
    });
    return;
  }

  const rel = toPosix(entry.path ?? "");
  for (const field of REQUIRED_STRING_FIELDS) {
    if (!isNonEmptyString(entry[field])) {
      addIssue(issues, {
        code: "missing_required_field",
        path: rel || null,
        field,
        message: `Registry entry is missing required field ${field}.`,
      });
    }
  }

  if (!isNonEmptyString(entry.path)) return;
  if (path.isAbsolute(entry.path) || rel.startsWith("../")) {
    addIssue(issues, {
      code: "invalid_baseline_path",
      path: rel,
      message: "Baseline path must be repository-relative.",
    });
  }

  if (seenPaths.has(rel)) {
    addIssue(issues, {
      code: "duplicate_baseline_registration",
      path: rel,
      message: "Baseline path is registered more than once.",
    });
  }
  seenPaths.add(rel);

  const baselinePath = path.join(root, rel);
  if (!fs.existsSync(baselinePath)) {
    addIssue(issues, {
      code: "stale_registry_entry",
      path: rel,
      message: "Registered baseline path does not exist.",
    });
  } else if (!discoveredSet.has(rel)) {
    addIssue(issues, {
      code: "registered_non_baseline",
      path: rel,
      message: "Registered path exists but is not discovered as a baseline artifact.",
    });
  }

  if (!Array.isArray(entry.temporaryPaths) || entry.temporaryPaths.length === 0) {
    addIssue(issues, {
      code: "missing_temporary_paths",
      path: rel,
      field: "temporaryPaths",
      message: "Registry entry must list temporary paths or the sentinel none.",
    });
  } else {
    for (const temporaryPath of entry.temporaryPaths) {
      if (!isNonEmptyString(temporaryPath)) {
        addIssue(issues, {
          code: "invalid_temporary_path",
          path: rel,
          field: "temporaryPaths",
          message: "Temporary path entries must be non-empty strings.",
        });
        continue;
      }
      const refreshCommand = String(entry.refreshCommand ?? "");
      for (const needle of temporaryPathNeedles(temporaryPath)) {
        if (refreshCommand.includes(needle)) {
          addIssue(issues, {
            code: "temporary_path_in_refresh_command",
            path: rel,
            field: "refreshCommand",
            temporaryPath,
            message: "Refresh command must not name generated temporary artifacts.",
          });
        }
      }
    }
  }

  if (!isNonEmptyString(entry.sourceScanner)) return;
  const sourceScannerRel = toPosix(entry.sourceScanner);
  if (path.isAbsolute(entry.sourceScanner) || sourceScannerRel.startsWith("../")) {
    addIssue(issues, {
      code: "invalid_source_scanner_path",
      path: rel,
      field: "sourceScanner",
      message: "Source scanner path must be repository-relative.",
    });
    return;
  }

  const sourceScannerPath = path.join(root, sourceScannerRel);
  if (!fs.existsSync(sourceScannerPath)) {
    addIssue(issues, {
      code: "missing_source_scanner",
      path: rel,
      field: "sourceScanner",
      sourceScanner: sourceScannerRel,
      message: "Source scanner path does not exist.",
    });
    return;
  }

  if (!HASH_RE.test(String(entry.sourceScannerSha256 ?? ""))) {
    addIssue(issues, {
      code: "invalid_source_scanner_hash",
      path: rel,
      field: "sourceScannerSha256",
      message: "Source scanner hash must be a lowercase SHA-256 hex digest.",
    });
    return;
  }

  const currentHash = sha256File(sourceScannerPath);
  if (currentHash !== entry.sourceScannerSha256) {
    addIssue(issues, {
      code: "source_scanner_changed",
      path: rel,
      field: "sourceScannerSha256",
      sourceScanner: sourceScannerRel,
      expected: entry.sourceScannerSha256,
      actual: currentHash,
      message:
        "Source scanner changed; review the baseline and update sourceScannerSha256 after the owning check is refreshed or confirmed.",
    });
  }
}

export function analyzeBaselineRegistry(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const registryRel = toPosix(options.registryRel ?? DEFAULT_REGISTRY_REL);
  const registryPath = path.join(root, registryRel);
  const issues = [];
  let registry = null;

  try {
    registry = readJsonFile(registryPath);
  } catch (error) {
    return {
      ok: false,
      root,
      registryPath: registryRel,
      discoveredBaselineCount: 0,
      registeredBaselineCount: 0,
      issueCount: 1,
      issues: [
        {
          code: "registry_unreadable",
          path: registryRel,
          message: `Unable to read registry JSON: ${error.message}`,
        },
      ],
    };
  }

  const discoveredBaselines = discoverBaselineFiles(root, registryRel);
  const discoveredSet = new Set(discoveredBaselines);

  if (registry?.schemaVersion !== 1) {
    addIssue(issues, {
      code: "invalid_schema_version",
      path: registryRel,
      message: "Baseline registry schemaVersion must be 1.",
    });
  }

  const baselines = Array.isArray(registry?.baselines) ? registry.baselines : [];
  if (!Array.isArray(registry?.baselines)) {
    addIssue(issues, {
      code: "invalid_baselines_list",
      path: registryRel,
      message: "Baseline registry must include a baselines array.",
    });
  }

  const seenPaths = new Set();
  for (let index = 0; index < baselines.length; index += 1) {
    analyzeEntry({
      entry: baselines[index],
      index,
      root,
      discoveredSet,
      seenPaths,
      issues,
    });
  }

  for (const rel of discoveredBaselines) {
    if (!seenPaths.has(rel)) {
      addIssue(issues, {
        code: "unregistered_baseline",
        path: rel,
        message: "Discovered baseline artifact is missing from scripts/baseline-registry.json.",
      });
    }
  }

  return {
    ok: issues.length === 0,
    root,
    registryPath: registryRel,
    discoveredBaselineCount: discoveredBaselines.length,
    registeredBaselineCount: baselines.length,
    issueCount: issues.length,
    issues: issues.sort((a, b) => {
      const pathCompare = String(a.path ?? "").localeCompare(String(b.path ?? ""));
      if (pathCompare !== 0) return pathCompare;
      return a.code.localeCompare(b.code);
    }),
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--registry") {
      options.registryRel = toPosix(argv[index + 1] ?? DEFAULT_REGISTRY_REL);
      index += 1;
    }
  }
  return options;
}

export function runBaselineRegistryCheck(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeBaselineRegistry(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBaselineRegistryCheck();
}
