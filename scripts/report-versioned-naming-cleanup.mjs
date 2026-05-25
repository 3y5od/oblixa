#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { governanceForVersionedNamingPath, suggestedNeutralNameForVersionedPath } from "./check-versioned-naming.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BASELINE = path.join(__dirname, "versioned-naming-baseline.json");
const DEFAULT_LIMIT = 20;

const COMPATIBILITY_SENSITIVE_SURFACES = new Set([
  "api_routes",
  "database_migrations",
  "database_seed_and_tests",
  "external_contracts",
]);
const GENERATED_PATH_PREFIXES = [
  ".next/",
  "artifacts/",
  "blob-report/",
  "coverage/",
  "node_modules/",
  "playwright-report/",
  "test-results/",
];
const EXCLUDED_REFERENCE_DIRS = new Set([
  ".git",
  ".next",
  ".augment",
  ".claude",
  ".cursor",
  ".temp",
  ".windsurf",
  "artifacts",
  "blob-report",
  "coverage",
  "logs",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".csv",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".sql",
  ".svg",
  ".toml",
  ".ts",
  ".tsv",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const TEXT_BASENAMES = new Set([
  ".editorconfig",
  ".gitignore",
  ".gitleaksignore",
  ".gitleaks.toml",
  ".npmrc",
  ".nvmrc",
  ".semgrepignore",
  "Dockerfile",
]);
const MAX_REFERENCE_SAMPLES = 5;

function sortEntriesDesc(entries) {
  return entries.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

function addCounts(target, tokens = {}) {
  for (const [token, count] of Object.entries(tokens)) {
    target[token] = (target[token] ?? 0) + count;
  }
}

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function relPath(root, abs) {
  return toPosix(path.relative(root, abs));
}

function excerptForLine(line) {
  const trimmed = line.trim();
  if (trimmed.length <= 180) return trimmed;
  return `${trimmed.slice(0, 177)}...`;
}

function isEnvFile(name) {
  return name === ".env" || name.startsWith(".env.");
}

function shouldScanReferenceFile(abs) {
  const name = path.basename(abs);
  if (isEnvFile(name)) return false;
  const extension = path.extname(name);
  return TEXT_EXTENSIONS.has(extension) || TEXT_BASENAMES.has(name);
}

function walkReferenceFiles(root, dir = root, acc = []) {
  if (!root || !fs.existsSync(dir)) return acc;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_REFERENCE_DIRS.has(entry.name)) continue;
      walkReferenceFiles(root, path.join(dir, entry.name), acc);
      continue;
    }
    if (!entry.isFile()) continue;

    const abs = path.join(dir, entry.name);
    if (shouldScanReferenceFile(abs)) acc.push(abs);
  }

  return acc;
}

function readReferenceFiles(root, excludedPaths = new Set()) {
  if (!root) return [];
  return walkReferenceFiles(root)
    .map((abs) => ({
      path: relPath(root, abs),
      text: fs.readFileSync(abs, "utf8"),
    }))
    .filter((file) => !excludedPaths.has(file.path));
}

export function classifyVersionedNamingSurface(relPath) {
  if (relPath.startsWith("supabase/migrations/")) return "database_migrations";
  if (relPath.startsWith("supabase/")) return "database_seed_and_tests";
  if (relPath.startsWith("src/app/api/")) return "api_routes";
  if (relPath.startsWith("src/app/")) return "app_routes";
  if (relPath.startsWith("src/actions/")) return "server_actions";
  if (relPath.startsWith("src/components/")) return "components";
  if (relPath.startsWith("src/lib/")) return "app_libraries";
  if (relPath.startsWith("e2e/")) return "e2e_tests";
  if (relPath.startsWith("scripts/")) return "tooling";
  if (relPath.startsWith(".github/")) return "ci_workflows";
  if (relPath.startsWith("docs/") || relPath === "README.md") return "documentation";
  if (
    relPath.startsWith("config/") ||
    relPath.startsWith("public/") ||
    relPath.startsWith("semgrep/") ||
    relPath === "openapi.yaml" ||
    relPath.endsWith(".config.ts") ||
    relPath.endsWith(".config.mjs")
  ) {
    return "external_contracts";
  }
  return "other";
}

function compactFile(row) {
  const governance = row.governance ?? governanceForVersionedNamingPath(row.path);
  return {
    path: row.path,
    surfaceClass: governance.surface ?? classifyVersionedNamingSurface(row.path),
    surface: governance.surface ?? classifyVersionedNamingSurface(row.path),
    owner: governance.owner,
    reason: governance.reason,
    removalStrategy: governance.removalStrategy,
    manualOnly: Boolean(governance.manualOnly),
    validationCommand: "npm run check:versioned-naming",
    suggestedNeutralName: row.suggestedNeutralName ?? suggestedNeutralNameForVersionedPath(row.path),
    total: row.total,
    tokens: row.tokens,
    sources: row.sources,
  };
}

function rankByToken(files) {
  const tokenCounts = {};
  for (const file of files) addCounts(tokenCounts, file.tokens);
  return sortEntriesDesc(
    Object.entries(tokenCounts).map(([name, total]) => ({
      name,
      total,
    }))
  );
}

function rankBySurface(files) {
  const bySurface = new Map();

  for (const file of files) {
    const surface = classifyVersionedNamingSurface(file.path);
    const row = bySurface.get(surface) ?? {
      name: surface,
      total: 0,
      files: 0,
      tokens: {},
      pathHits: 0,
      contentHits: 0,
      compatibilitySensitive: COMPATIBILITY_SENSITIVE_SURFACES.has(surface),
    };
    row.total += file.total;
    row.files += 1;
    row.pathHits += file.sources?.path ?? 0;
    row.contentHits += file.sources?.content ?? 0;
    addCounts(row.tokens, file.tokens);
    bySurface.set(surface, row);
  }

  return sortEntriesDesc(Array.from(bySurface.values())).map((row) => ({
    ...row,
    tokens: Object.fromEntries(sortEntriesDesc(Object.entries(row.tokens).map(([name, total]) => ({ name, total }))).map(({ name, total }) => [name, total])),
  }));
}

function onlyPathHits(file) {
  return (file.sources?.path ?? 0) > 0 && (file.sources?.content ?? 0) === 0;
}

function isGeneratedPath(relPath) {
  return GENERATED_PATH_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function isPublicUrlPath(relPath) {
  return relPath.startsWith("public/") || relPath.startsWith("src/app/");
}

function isTelemetryPath(relPath) {
  return /(^|\/)(analytics|event|events|telemetry)(\/|[-_.])/u.test(relPath);
}

function isProviderConfigPath(relPath) {
  const basename = path.basename(relPath);
  return (
    relPath.startsWith("config/") ||
    relPath.startsWith(".github/") ||
    relPath.includes("/provider") ||
    relPath.includes("/providers/") ||
    relPath.includes("/stripe") ||
    relPath.includes("/webhook") ||
    basename.endsWith(".config.js") ||
    basename.endsWith(".config.mjs") ||
    basename.endsWith(".config.ts")
  );
}

function safeRenameStaticExclusion(file) {
  if (!onlyPathHits(file)) return "not_path_only";
  if (isGeneratedPath(file.path)) return "generated_artifact";
  if (COMPATIBILITY_SENSITIVE_SURFACES.has(file.surface)) return "compatibility_sensitive_surface";
  if (isPublicUrlPath(file.path)) return "public_url_or_route_surface";
  if (isTelemetryPath(file.path)) return "telemetry_surface";
  if (isProviderConfigPath(file.path)) return "provider_config_surface";
  if (file.surface === "documentation") return "documentation_surface";
  return null;
}

function referenceNeedles(relPath) {
  const basename = path.basename(relPath);
  const parsed = path.parse(relPath);
  const withoutExtension = toPosix(path.join(parsed.dir, parsed.name));
  const basenameWithoutExtension = parsed.name;
  return Array.from(new Set([relPath, basename, withoutExtension, basenameWithoutExtension].filter(Boolean)));
}

function findFixedStringReferences({ referenceFiles, candidatePath }) {
  const needles = referenceNeedles(candidatePath);
  const references = [];

  for (const file of referenceFiles) {
    if (file.path === candidatePath) continue;

    const lines = file.text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const needle = needles.find((candidateNeedle) => line.includes(candidateNeedle));
      if (!needle) continue;

      references.push({
        path: file.path,
        line: index + 1,
        needle,
        excerpt: excerptForLine(line),
      });

      if (references.length >= MAX_REFERENCE_SAMPLES) return references;
    }
  }

  return references;
}

export function buildSafeRenameCandidateReport(files, options = {}) {
  const root = options.root ?? null;
  const baselinePath = root && options.baselinePath
    ? toPosix(path.relative(root, options.baselinePath))
    : "scripts/versioned-naming-baseline.json";
  const excludedReferencePaths = new Set([
    baselinePath,
    "scripts/baseline-registry.json",
    "scripts/versioned-naming-removal-queue.json",
    "artifacts/compatibility/versioned-naming-safe-rename-manifest.json",
  ]);
  const referenceFiles = root ? readReferenceFiles(root, excludedReferencePaths) : [];
  const pathOnlyFiles = files
    .filter(onlyPathHits)
    .map(compactFile)
    .sort((a, b) => a.total - b.total || a.path.localeCompare(b.path));
  const safeRenameCandidates = [];
  const safeRenameExclusions = [];

  for (const file of pathOnlyFiles) {
    const staticReason = safeRenameStaticExclusion(file);
    if (staticReason) {
      safeRenameExclusions.push({
        path: file.path,
        surface: file.surface,
        reason: staticReason,
      });
      continue;
    }

    if (!root) {
      safeRenameExclusions.push({
        path: file.path,
        surface: file.surface,
        reason: "reference_scan_unavailable",
      });
      continue;
    }

    if (!fs.existsSync(path.join(root, file.path))) {
      safeRenameExclusions.push({
        path: file.path,
        surface: file.surface,
        reason: "missing_from_worktree",
      });
      continue;
    }

    const references = findFixedStringReferences({
      referenceFiles,
      candidatePath: file.path,
    });
    if (references.length > 0) {
      safeRenameExclusions.push({
        path: file.path,
        surface: file.surface,
        reason: "referenced_by_fixed_string",
        referenceCount: references.length,
        references,
      });
      continue;
    }

    safeRenameCandidates.push({
      ...file,
      referenceCount: 0,
      referenceNeedles: referenceNeedles(file.path),
    });
  }

  return {
    safeRenameCandidates,
    safeRenameExclusions,
  };
}

function lowRiskCandidate(file) {
  const surface = classifyVersionedNamingSurface(file.path);
  return (
    file.total <= 3 &&
    !COMPATIBILITY_SENSITIVE_SURFACES.has(surface) &&
    !file.path.startsWith("src/app/") &&
    !file.path.startsWith("src/actions/")
  );
}

export function buildVersionedNamingCleanupReport(baseline, { limit = DEFAULT_LIMIT, root = null, baselinePath = DEFAULT_BASELINE } = {}) {
  const files = Array.isArray(baseline.files) ? baseline.files : [];
  const topFiles = files.map(compactFile).sort((a, b) => b.total - a.total || a.path.localeCompare(b.path));
  const bySurface = rankBySurface(files);
  const byToken = rankByToken(files);
  const pathOnlyFiles = files.filter(onlyPathHits).map(compactFile).sort((a, b) => b.total - a.total || a.path.localeCompare(b.path));
  const lowRiskFiles = files.filter(lowRiskCandidate).map(compactFile).sort((a, b) => a.total - b.total || a.path.localeCompare(b.path));
  const compatibilitySensitiveFiles = files
    .map(compactFile)
    .filter((file) => COMPATIBILITY_SENSITIVE_SURFACES.has(file.surface))
    .sort((a, b) => b.total - a.total || a.path.localeCompare(b.path));
  const safeRenameReport = buildSafeRenameCandidateReport(files, {
    root,
    baselinePath,
  });

  return {
    baseline: {
      schemaVersion: baseline.schemaVersion ?? null,
      totalHits: baseline.totalHits ?? files.reduce((sum, file) => sum + (file.total ?? 0), 0),
      fileCount: baseline.fileCount ?? files.length,
    },
    bySurface,
    byToken,
    topFiles: topFiles.slice(0, limit),
    cleanupCandidates: {
      lowRiskFiles: lowRiskFiles.slice(0, limit),
      pathOnlyFiles: pathOnlyFiles.slice(0, limit),
      compatibilitySensitiveFiles: compatibilitySensitiveFiles.slice(0, limit),
    },
    safeRenameCandidates: safeRenameReport.safeRenameCandidates.slice(0, limit),
    safeRenameExclusions: safeRenameReport.safeRenameExclusions.slice(0, limit),
    recommendedOrder: [
      "Remove low-count test, tooling, and documentation labels first.",
      "Rename path-only files next, updating imports in the same change.",
      "Add neutral aliases for tooling and CI before removing legacy commands.",
      "Handle API routes, telemetry names, and database objects only with compatibility migrations.",
    ],
  };
}

function parseArgs(argv) {
  const options = {
    baselinePath: DEFAULT_BASELINE,
    limit: DEFAULT_LIMIT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--baseline") {
      options.baselinePath = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith("--baseline=")) {
      options.baselinePath = path.resolve(arg.slice("--baseline=".length));
    } else if (arg === "--root") {
      options.root = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--limit") {
      options.limit = Number(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith("--limit=")) {
      options.limit = Number(arg.slice("--limit=".length));
    }
  }

  if (!Number.isInteger(options.limit) || options.limit < 1) {
    options.limit = DEFAULT_LIMIT;
  }

  return options;
}

export function runVersionedNamingCleanupReport(options = {}) {
  const baselinePath = options.baselinePath ?? DEFAULT_BASELINE;
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const root = options.root ?? path.join(path.dirname(baselinePath), "..");
  return buildVersionedNamingCleanupReport(baseline, {
    limit: options.limit ?? DEFAULT_LIMIT,
    root,
    baselinePath,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = runVersionedNamingCleanupReport(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
}
