#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { TextDecoder } from "node:util";
import { pathToFileURL } from "node:url";

import {
  analyzeGeneratedArtifactHygiene,
  DETERMINISTIC_GENERATED_ARTIFACT_PATHS,
  GENERATED_ARTIFACT_HYGIENE_PATHS,
  GENERATED_ARTIFACT_WRITE_COMMANDS,
} from "./check-generated-artifact-hygiene.mjs";
import { analyzeBinaryMetadataStripping } from "./check-binary-metadata-stripping.mjs";
import { analyzeExecutableMasqueradeGuards } from "./check-executable-masquerade-guards.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-repository-artifact-hygiene.json";
const ARTIFACT_REL = "artifacts/operational-repository-artifact-hygiene.json";
const WRITE = process.argv.includes("--write");

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

function toPosix(value) {
  return value.replace(/\\/gu, "/");
}

function gitList(root, args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" })
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map(toPosix)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function walk(root, rel, out = []) {
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
  for (const scanRoot of config.sourceHygiene?.scanRoots ?? []) {
    walk(root, scanRoot, files);
  }
  return files
    .filter((rel) => !excluded.some((prefix) => rel === prefix || rel.startsWith(prefix)))
    .sort((a, b) => a.localeCompare(b));
}

function allCandidateFiles(root, config, options = {}) {
  if (Array.isArray(options.files)) return options.files.map(toPosix).sort((a, b) => a.localeCompare(b));
  const tracked = gitList(root, ["ls-files"]);
  const untracked = gitList(root, ["ls-files", "--others", "--exclude-standard"]);
  const files = tracked.length > 0 || untracked.length > 0 ? [...tracked, ...untracked] : fallbackFiles(root, config);
  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
}

function untrackedFiles(root, options = {}) {
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

function matchesAny(rel, patterns = []) {
  return patterns.some((pattern) => pathMatchesPattern(rel, pattern));
}

function gitignoreLines(root, options = {}) {
  const text = options.gitignoreText ?? read(root, ".gitignore");
  return new Set(
    text
      .split(/\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
  );
}

export function analyzeTransientArtifacts(root, config, issues = [], options = {}) {
  const lines = gitignoreLines(root, options);
  const rows = [];
  for (const row of config.transientArtifacts ?? []) {
    const ignored = lines.has(row.gitignorePattern);
    const result = {
      path: row.path,
      ownerArea: row.ownerArea,
      cleanupPolicy: row.cleanupPolicy,
      gitignorePattern: row.gitignorePattern,
      ignored,
    };
    rows.push(result);
    if (!ignored) {
      issues.push(issue("transient_artifact_missing_gitignore_entry", { path: row.path, gitignorePattern: row.gitignorePattern }));
    }
    for (const field of ["path", "gitignorePattern", "ownerArea", "cleanupPolicy"]) {
      if (typeof row[field] !== "string" || row[field].trim() === "") {
        issues.push(issue("transient_artifact_missing_metadata", { path: row.path ?? null, field }));
      }
    }
  }
  return {
    transientArtifactCount: rows.length,
    ignoredCount: rows.filter((row) => row.ignored).length,
    missingIgnoreCount: rows.filter((row) => !row.ignored).length,
    rows,
  };
}

function ownerForGeneratedPath(rel, ownershipPrefixes) {
  return ownershipPrefixes.find((row) => rel === row.prefix || rel.startsWith(row.prefix)) ?? null;
}

export function analyzeGeneratedArtifactOwnership(root, issues = [], options = {}) {
  const packagePipeline = readJson(root, "config/operational-package-pipelines.json", { generatedArtifactOwnership: [] });
  const ownershipPrefixes = packagePipeline.generatedArtifactOwnerRules ?? packagePipeline.generatedArtifactOwnership ?? [];
  const artifactPaths = options.artifactPaths ?? GENERATED_ARTIFACT_HYGIENE_PATHS;
  const deterministic = new Set(options.deterministicArtifactPaths ?? DETERMINISTIC_GENERATED_ARTIFACT_PATHS);
  const writeCommands = options.writeCommands ?? GENERATED_ARTIFACT_WRITE_COMMANDS;
  const rows = artifactPaths.map((artifactPath) => {
    const owner = ownerForGeneratedPath(artifactPath, ownershipPrefixes);
    const row = {
      path: artifactPath,
      ownerArea: owner?.ownerArea ?? null,
      cleanupPolicy: owner?.cleanupPolicy ?? null,
      deterministic: deterministic.has(artifactPath),
      writeCommand: writeCommands[artifactPath] ?? null,
    };
    if (!owner) issues.push(issue("generated_artifact_missing_owner_prefix", { path: artifactPath }));
    if (row.deterministic && !row.writeCommand) {
      issues.push(issue("generated_artifact_missing_write_command", { path: artifactPath }));
    }
    return row;
  });
  return {
    generatedArtifactCount: rows.length,
    deterministicArtifactCount: rows.filter((row) => row.deterministic).length,
    ownedArtifactCount: rows.filter((row) => row.ownerArea).length,
    missingOwnerCount: rows.filter((row) => !row.ownerArea).length,
    rows,
  };
}

function hasMagic(buffer, bytes) {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function binaryMagic(buffer) {
  return BINARY_MAGIC.find((row) => hasMagic(buffer, row.bytes))?.type ?? null;
}

function isLikelyBinary(buffer) {
  if (buffer.length === 0) return false;
  if (binaryMagic(buffer)) return true;
  return buffer.subarray(0, Math.min(buffer.length, 8192)).includes(0);
}

function textExtensionSet(config) {
  return new Set(config.sourceHygiene?.textExtensions ?? []);
}

function isTextPath(rel, config) {
  return textExtensionSet(config).has(path.extname(rel).toLowerCase());
}

function skipPath(rel, config) {
  return (config.sourceHygiene?.excludePathPrefixes ?? []).some((prefix) => rel === prefix || rel.startsWith(prefix));
}

function largeFileAllowance(rel, bytes, allowlist = []) {
  return allowlist.find((row) => {
    const matches = row.path ? rel === row.path : pathMatchesPattern(rel, row.pathPattern ?? "");
    return matches && bytes <= Number(row.maxBytes ?? 0);
  });
}

export function analyzeFileSafety(root, config, issues = [], options = {}) {
  const files = allCandidateFiles(root, config, options);
  const untracked = new Set(untrackedFiles(root, options));
  const binaryAllow = config.binaryFilePolicy?.allowedPathPatterns ?? [];
  const archiveAllow = config.binaryFilePolicy?.allowedArchivePathPatterns ?? [];
  const archiveExts = new Set(config.binaryFilePolicy?.archiveExtensions ?? []);
  const largePolicy = config.largeFilePolicy ?? {};
  const rows = [];

  for (const rel of files) {
    if (skipPath(rel, config)) continue;
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
    const stat = fs.statSync(abs);
    const prefix = fs.readFileSync(abs).subarray(0, Math.min(stat.size, 8192));
    const binary = isLikelyBinary(prefix);
    const magic = binaryMagic(prefix);
    const text = isTextPath(rel, config) && !binary;
    const maxBytes = untracked.has(rel)
      ? Number(largePolicy.maxUntrackedBytes ?? 1000000)
      : binary
        ? Number(largePolicy.maxTrackedBinaryBytes ?? 2000000)
        : Number(largePolicy.maxTrackedTextBytes ?? 6000000);
    const allowance = largeFileAllowance(rel, stat.size, largePolicy.allowlist ?? []);
    if (stat.size > maxBytes && !allowance) {
      issues.push(issue("repository_file_exceeds_size_policy", { path: rel, bytes: stat.size, maxBytes, untracked: untracked.has(rel) }));
    }
    if (binary && !matchesAny(rel, binaryAllow)) {
      issues.push(issue("repository_unexpected_binary_file", { path: rel, bytes: stat.size, magic }));
    }
    if (archiveExts.has(path.extname(rel).toLowerCase()) && !matchesAny(rel, archiveAllow)) {
      issues.push(issue("repository_archive_file_requires_registration", { path: rel, bytes: stat.size }));
    }
    rows.push({ path: rel, bytes: stat.size, binary, magic, text, untracked: untracked.has(rel), largeFileAllowance: allowance?.reason ?? null });
  }

  const executableReport = options.skipDelegates ? { ok: true, issueCount: 0, issues: [] } : analyzeExecutableMasqueradeGuards(root);
  for (const delegatedIssue of executableReport.issues ?? []) {
    issues.push(issue("delegated_executable_masquerade_issue", delegatedIssue));
  }
  const binaryMetadataReport = options.skipDelegates ? { ok: true, issueCount: 0, issues: [] } : analyzeBinaryMetadataStripping(root);
  for (const delegatedIssue of binaryMetadataReport.issues ?? []) {
    issues.push(issue("delegated_binary_metadata_issue", delegatedIssue));
  }

  return {
    scannedFileCount: rows.length,
    largeFileCount: rows.filter((row) => row.bytes > Number(largePolicy.maxTrackedBinaryBytes ?? 2000000)).length,
    binaryFileCount: rows.filter((row) => row.binary).length,
    unexpectedBinaryCount: rows.filter((row) => row.binary && !matchesAny(row.path, binaryAllow)).length,
    archiveFileCount: rows.filter((row) => archiveExts.has(path.extname(row.path).toLowerCase())).length,
    executableMasquerade: {
      ok: executableReport.ok,
      issueCount: executableReport.issueCount ?? 0,
      scannedFileCount: executableReport.scannedFileCount ?? null,
    },
    binaryMetadataStripping: {
      ok: binaryMetadataReport.ok,
      issueCount: binaryMetadataReport.issueCount ?? 0,
    },
    rows: rows
      .filter((row) => row.binary || row.bytes > Number(largePolicy.maxTrackedBinaryBytes ?? 2000000))
      .sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path))
      .slice(0, 100),
  };
}

function decodeUtf8(buffer) {
  return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
}

function lineForIndex(text, index) {
  return text.slice(0, index).split("\n").length;
}

function firstMatch(text, pattern) {
  const match = pattern.exec(text);
  if (!match) return null;
  return { index: match.index, value: match[0] };
}

export function analyzeSourceHygiene(root, config, issues = [], options = {}) {
  const files = allCandidateFiles(root, config, options).filter((rel) => isTextPath(rel, config) && !skipPath(rel, config));
  const asciiPrefixes = config.sourceHygiene?.asciiRequiredPathPrefixes ?? [];
  const finalNewlineExemptions = config.sourceHygiene?.finalNewlineExemptions ?? [];
  const rows = [];

  for (const rel of files) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
    const buffer = fs.readFileSync(abs);
    let text = "";
    try {
      text = decodeUtf8(buffer);
    } catch {
      issues.push(issue("source_file_invalid_utf8", { path: rel }));
      rows.push({ path: rel, invalidUtf8: true });
      continue;
    }
    const crlf = text.includes("\r\n");
    const missingFinalNewline = buffer.length > 0 && !text.endsWith("\n") && !matchesAny(rel, finalNewlineExemptions);
    const control = firstMatch(text, /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u);
    const trojan = firstMatch(text, /[\u202A-\u202E\u2066-\u2069]/u);
    const asciiRequired = asciiPrefixes.some((prefix) => rel.startsWith(prefix));
    const finalNewlinePrefixes = config.sourceHygiene?.finalNewlineEnforcedPathPrefixes;
    const finalNewlineEnforced =
      !Array.isArray(finalNewlinePrefixes) ||
      finalNewlinePrefixes.length === 0 ||
      finalNewlinePrefixes.some((prefix) => rel.startsWith(prefix));
    const nonAscii = asciiRequired ? firstMatch(text, /[^\x00-\x7F]/u) : null;

    if (crlf) issues.push(issue("source_file_crlf_line_endings", { path: rel }));
    if (missingFinalNewline && finalNewlineEnforced) issues.push(issue("source_file_missing_final_newline", { path: rel }));
    if (control) issues.push(issue("source_file_control_character", { path: rel, line: lineForIndex(text, control.index) }));
    if (trojan) issues.push(issue("source_file_trojan_source_control", { path: rel, line: lineForIndex(text, trojan.index) }));
    if (nonAscii) issues.push(issue("source_file_non_ascii_forbidden_by_policy", { path: rel, line: lineForIndex(text, nonAscii.index) }));

    rows.push({
      path: rel,
      bytes: buffer.length,
      crlf,
      missingFinalNewline,
      controlCharacter: Boolean(control),
      trojanSourceControl: Boolean(trojan),
      asciiRequired,
      nonAsciiPolicyViolation: Boolean(nonAscii),
    });
  }

  return {
    scannedTextFileCount: rows.length,
    crlfCount: rows.filter((row) => row.crlf).length,
    missingFinalNewlineCount: rows.filter((row) => row.missingFinalNewline).length,
    controlCharacterCount: rows.filter((row) => row.controlCharacter).length,
    trojanSourceControlCount: rows.filter((row) => row.trojanSourceControl).length,
    asciiPolicyViolationCount: rows.filter((row) => row.nonAsciiPolicyViolation).length,
    issueRows: rows.filter(
      (row) =>
        row.crlf ||
        row.missingFinalNewline ||
        row.controlCharacter ||
        row.trojanSourceControl ||
        row.nonAsciiPolicyViolation
    ),
  };
}

function registeredOperationalScript(packageScripts, rel) {
  if (rel.endsWith(".test.mjs")) {
    const testScript = path.basename(rel, ".test.mjs").replace(/^check-/, "test:");
    return Boolean(packageScripts[testScript]);
  }
  const base = path.basename(rel, ".mjs").replace(/^check-/, "check:");
  return Boolean(packageScripts[base]);
}

export function analyzeWorkspaceCleanliness(root, config, issues = [], options = {}) {
  const untracked = untrackedFiles(root, options);
  const requiredPatterns = config.workspaceCleanliness?.requiredUntrackedPatterns ?? [];
  const packageScripts = readJson(root, "package.json", { scripts: {} }).scripts ?? {};
  const artifactPaths = new Set(options.artifactPaths ?? GENERATED_ARTIFACT_HYGIENE_PATHS);
  const writeCommands = options.writeCommands ?? GENERATED_ARTIFACT_WRITE_COMMANDS;
  const requiredRows = [];

  for (const rel of untracked) {
    if (!matchesAny(rel, requiredPatterns)) continue;
    let registered = true;
    let registry = "package.json";
    if (rel.startsWith("artifacts/")) {
      registered = artifactPaths.has(rel) && typeof writeCommands[rel] === "string";
      registry = "generated-artifact-hygiene";
    } else if (rel.startsWith("scripts/check-operational-")) {
      registered = registeredOperationalScript(packageScripts, rel);
      registry = "package.json";
    }
    requiredRows.push({ path: rel, registry, registered });
    if (!registered) issues.push(issue("untracked_required_operational_file_missing_registry", { path: rel, registry }));
  }

  const localOnlyPatterns = config.workspaceCleanliness?.localOnlyReferencePatterns ?? [];
  const referenceFiles = (config.workspaceCleanliness?.referenceScanRoots ?? []).flatMap((scanRoot) => walk(root, scanRoot));
  const localOnlyReferences = [];
  for (const rel of referenceFiles) {
    if (skipPath(rel, config) || !isTextPath(rel, config)) continue;
    const text = read(root, rel);
    for (const pattern of localOnlyPatterns) {
      if (text.includes(pattern)) {
        const row = { path: rel, pattern };
        localOnlyReferences.push(row);
        issues.push(issue("local_only_debug_path_referenced_by_repo_script", row));
      }
    }
  }

  for (const script of config.requiredPackageScripts ?? []) {
    if (!packageScripts[script]) issues.push(issue("repository_hygiene_missing_package_script", { script }));
  }
  const ci = read(root, ".github/workflows/ci.yml");
  for (const command of config.requiredCiCommands ?? []) {
    if (!ci.includes(command)) issues.push(issue("repository_hygiene_missing_ci_command", { command }));
  }

  return {
    untrackedFileCount: untracked.length,
    requiredUntrackedFileCount: requiredRows.length,
    unregisteredRequiredUntrackedFileCount: requiredRows.filter((row) => !row.registered).length,
    requiredRows,
    localOnlyReferenceCount: localOnlyReferences.length,
    localOnlyReferences,
  };
}

function summarizeDelegated(report) {
  return {
    ok: report.ok,
    issueCount: report.issueCount ?? report.issues?.length ?? 0,
  };
}

export function buildOperationalRepositoryArtifactHygieneReport(root = ROOT, options = {}) {
  const config = options.config ?? readJson(root, CONFIG_REL, {});
  const issues = [];
  const artifactPaths =
    options.allowMissingSelfArtifact && !fs.existsSync(path.join(root, ARTIFACT_REL))
      ? (options.artifactPaths ?? GENERATED_ARTIFACT_HYGIENE_PATHS).filter((rel) => rel !== ARTIFACT_REL)
      : options.artifactPaths ?? GENERATED_ARTIFACT_HYGIENE_PATHS;
  const generatedArtifactReport = analyzeGeneratedArtifactHygiene(root, {
    artifactPaths,
    deterministicArtifactPaths: options.deterministicArtifactPaths ?? DETERMINISTIC_GENERATED_ARTIFACT_PATHS,
    writeCommands: options.writeCommands ?? GENERATED_ARTIFACT_WRITE_COMMANDS,
  });
  for (const delegatedIssue of generatedArtifactReport.issues ?? []) {
    issues.push(issue("delegated_generated_artifact_hygiene_issue", delegatedIssue));
  }

  const transientClassification = analyzeTransientArtifacts(root, config, issues, options);
  const generatedArtifactOwnership = analyzeGeneratedArtifactOwnership(root, issues, {
    artifactPaths,
    deterministicArtifactPaths: options.deterministicArtifactPaths,
    writeCommands: options.writeCommands,
  });
  const fileSafety = analyzeFileSafety(root, config, issues, options);
  const sourceHygiene = analyzeSourceHygiene(root, config, issues, options);
  const workspaceCleanliness = analyzeWorkspaceCleanliness(root, config, issues, {
    ...options,
    artifactPaths,
  });

  const report = {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-repository-artifact-hygiene",
    generatedBy: "scripts/check-operational-repository-artifact-hygiene.mjs --write",
    generatedFrom: CONFIG_REL,
    objectives: (config.objectives ?? []).map((row) => ({
      id: row.id,
      ownerArea: row.ownerArea,
      markerCount: row.markers?.length ?? 0,
    })),
    transientClassification,
    generatedArtifactOwnership,
    fileSafety,
    sourceHygiene,
    workspaceCleanliness,
    delegatedChecks: {
      generatedArtifactHygiene: summarizeDelegated(generatedArtifactReport),
      executableMasquerade: fileSafety.executableMasquerade,
      binaryMetadataStripping: fileSafety.binaryMetadataStripping,
    },
    issueCount: issues.length,
    issues,
  };
  return report;
}

function main() {
  const report = buildOperationalRepositoryArtifactHygieneReport(ROOT, { allowMissingSelfArtifact: WRITE });
  if (WRITE) {
    writeJson(ROOT, ARTIFACT_REL, report);
  } else {
    const expected = stableStringify(report);
    const actual = read(ROOT, ARTIFACT_REL);
    if (actual && actual !== expected) {
      report.ok = false;
      report.issues.push(issue("operational_repository_artifact_hygiene_drift", { path: ARTIFACT_REL, writeCommand: "npm run write:operational-repository-artifact-hygiene" }));
      report.issueCount = report.issues.length;
    }
  }
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
