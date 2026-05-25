#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_BASELINE = path.join(__dirname, "versioned-naming-baseline.json");

const EXCLUDED_DIRS = new Set([
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
const EXCLUDED_FILES = new Set([
  "cyclonedx-sbom.json",
  "migration-idempotency-exceptions.json",
  "package-lock.json",
  "tsconfig.tsbuildinfo",
  "version-reference-allowlist.json",
  "versioned-naming-baseline.json",
  "versioned-naming-removal-queue.json",
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

const VERSION_CORE_RE = /(^|[^A-Za-z0-9])([Vv][0-9]+)(?!\.[0-9])/gu;
const PATH_VERSION_CORE_RE = /(^|[./_-])([Vv][0-9]+)(?!\.[0-9])/gu;
const MAX_SAMPLE_HITS = 50;
const GENERATED_ALIAS_BLOCK_START = "// Version-name compatibility aliases. Prefer neutral exports in new code.";
const GENERATED_ALIAS_BLOCK_END = "// End version-name compatibility aliases.";

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function relPath(root, abs) {
  return toPosix(path.relative(root, abs));
}

function isEnvFile(name) {
  return name === ".env" || name.startsWith(".env.");
}

function shouldScanFile(abs) {
  const name = path.basename(abs);
  if (isEnvFile(name) || EXCLUDED_FILES.has(name)) return false;
  const extension = path.extname(name);
  return TEXT_EXTENSIONS.has(extension) || TEXT_BASENAMES.has(name);
}

function walkFiles(root, dir = root, acc = []) {
  if (!fs.existsSync(dir)) return acc;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walkFiles(root, path.join(dir, entry.name), acc);
      continue;
    }
    if (!entry.isFile()) continue;

    const abs = path.join(dir, entry.name);
    if (shouldScanFile(abs)) acc.push(abs);
  }

  return acc;
}

function excerptForLine(line) {
  const trimmed = line.trim();
  if (trimmed.length <= 180) return trimmed;
  return `${trimmed.slice(0, 177)}...`;
}

function pushPathHits({ hits, rel }) {
  PATH_VERSION_CORE_RE.lastIndex = 0;
  let match;
  while ((match = PATH_VERSION_CORE_RE.exec(rel)) !== null) {
    const token = match[2];
    hits.push({
      path: rel,
      source: "path",
      line: null,
      token,
      canonicalToken: token.toLowerCase(),
      excerpt: rel,
    });
  }
}

function pushContentHits({ hits, rel, text }) {
  const lines = text.split(/\r?\n/u);
  let inGeneratedAliasBlock = false;
  for (let index = 0; index < lines.length; index += 1) {
    const lineText = lines[index];
    if (lineText.includes(GENERATED_ALIAS_BLOCK_START)) {
      inGeneratedAliasBlock = true;
      continue;
    }
    if (inGeneratedAliasBlock) {
      if (lineText.includes(GENERATED_ALIAS_BLOCK_END)) inGeneratedAliasBlock = false;
      continue;
    }
    VERSION_CORE_RE.lastIndex = 0;
    let match;
    while ((match = VERSION_CORE_RE.exec(lineText)) !== null) {
      const token = match[2];
      hits.push({
        path: rel,
        source: "content",
        line: index + 1,
        token,
        canonicalToken: token.toLowerCase(),
        excerpt: excerptForLine(lineText),
      });
    }
  }
}

export function findVersionedNamingHits({ rel, text }) {
  const hits = [];
  pushPathHits({ hits, rel });
  pushContentHits({ hits, rel, text });
  return hits;
}

export function scanVersionedNaming(root = DEFAULT_ROOT) {
  const files = walkFiles(root).sort((a, b) => relPath(root, a).localeCompare(relPath(root, b)));
  const hits = [];

  for (const abs of files) {
    const rel = relPath(root, abs);
    const text = fs.readFileSync(abs, "utf8");
    hits.push(...findVersionedNamingHits({ rel, text }));
  }

  return {
    root,
    filesScanned: files.length,
    hits,
  };
}

function summarizeHits(hits) {
  const byFile = new Map();
  for (const hit of hits) {
    const row = byFile.get(hit.path) ?? {
      path: hit.path,
      total: 0,
      tokens: {},
      sources: {},
    };
    row.total += 1;
    row.tokens[hit.canonicalToken] = (row.tokens[hit.canonicalToken] ?? 0) + 1;
    row.sources[hit.source] = (row.sources[hit.source] ?? 0) + 1;
    byFile.set(hit.path, row);
  }

  return Array.from(byFile.values())
    .map((row) => ({
      ...row,
      tokens: Object.fromEntries(Object.entries(row.tokens).sort(([a], [b]) => a.localeCompare(b))),
      sources: Object.fromEntries(Object.entries(row.sources).sort(([a], [b]) => a.localeCompare(b))),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
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

const SURFACE_GOVERNANCE = {
  api_routes: {
    owner: "platform-api",
    reason: "Public API, cron, webhook, or provider-facing route names need compatibility aliases before removal.",
    removalStrategy: "add_neutral_alias_then_cutover_after_manual_evidence",
    manualOnly: true,
  },
  app_libraries: {
    owner: "platform-hardening",
    reason: "Internal library naming debt can be removed by reviewed local renames, symbol aliases, or standards allowlists.",
    removalStrategy: "local_rename_or_symbol_alias",
    manualOnly: false,
  },
  app_routes: {
    owner: "frontend-platform",
    reason: "Frontend route and deep-link names can be bookmarked, indexed, or embedded in notifications.",
    removalStrategy: "add_redirect_alias_then_cutover_after_manual_evidence",
    manualOnly: true,
  },
  ci_workflows: {
    owner: "release-engineering",
    reason: "CI workflow and matrix names are source-owned but may be referenced by branch protection or release evidence.",
    removalStrategy: "rename_with_alias_or_policy_update",
    manualOnly: false,
  },
  components: {
    owner: "frontend-platform",
    reason: "Component and UI test naming debt is source-owned unless referenced by public selectors or generated evidence.",
    removalStrategy: "local_rename_with_reference_update",
    manualOnly: false,
  },
  database_migrations: {
    owner: "database-platform",
    reason: "Historical migration files are production ledger evidence and SQL objects need forward compatibility migrations.",
    removalStrategy: "forward_migration_or_historical_exception",
    manualOnly: true,
  },
  database_seed_and_tests: {
    owner: "database-platform",
    reason: "Seed and local reset values must stay aligned with the current database compatibility surface.",
    removalStrategy: "rename_after_sql_alias_or_local_fixture_update",
    manualOnly: true,
  },
  documentation: {
    owner: "docs-platform",
    reason: "Documentation and planning artifacts can describe reviewed version debt without creating runtime dependencies.",
    removalStrategy: "documentation_cleanup_or_reviewed_planning_exception",
    manualOnly: false,
  },
  e2e_tests: {
    owner: "qa-platform",
    reason: "End-to-end test names and tags are source-owned unless consumed by CI filters or external evidence.",
    removalStrategy: "local_rename_with_ci_reference_update",
    manualOnly: false,
  },
  external_contracts: {
    owner: "platform-security",
    reason: "External contract, provider, public asset, or generated config names may be consumed outside the repository.",
    removalStrategy: "add_alias_or_allowlist_then_cutover_after_manual_evidence",
    manualOnly: true,
  },
  other: {
    owner: "platform-hardening",
    reason: "Unclassified versioned naming debt needs owner review before removal.",
    removalStrategy: "classify_then_rename_or_queue",
    manualOnly: false,
  },
  server_actions: {
    owner: "platform-api",
    reason: "Server action names and form contracts are source-owned but can be browser-submitted during a compatibility window.",
    removalStrategy: "add_action_alias_then_cutover_after_tests",
    manualOnly: false,
  },
  tooling: {
    owner: "platform-hardening",
    reason: "Tooling names are source-owned but package script aliases and generated references must stay compatible.",
    removalStrategy: "rename_with_package_script_alias",
    manualOnly: false,
  },
};

export function governanceForVersionedNamingPath(relPath) {
  const surface = classifyVersionedNamingSurface(relPath);
  if (relPath === "src/lib/v6/telemetry.ts") {
    return {
      surface,
      reviewedOn: "2026-05-23",
      owner: "platform-telemetry",
      reason: "Legacy telemetry import shim remains as a compatibility re-export until all consumers and queues are ready for removal.",
      removalStrategy: "keep_compatibility_reexport_until_manual_cutover",
      manualOnly: true,
    };
  }
  return {
    surface,
    reviewedOn: "2026-05-23",
    ...(SURFACE_GOVERNANCE[surface] ?? SURFACE_GOVERNANCE.other),
  };
}

const NEUTRAL_TOKEN_REPLACEMENTS = [
  { pattern: /(^|\/)v[0-9]+(?=\/)/giu, replacement: "$1" },
  { pattern: /(^|\/)v[0-9]+[-_]/giu, replacement: "$1" },
  { pattern: /[-_.]v[0-9]+(?=\.)/giu, replacement: "." },
  { pattern: /[-_]v[0-9]+(?=[-_.])/giu, replacement: "" },
  { pattern: /(?<=[A-Za-z])V[0-9]+(?=[A-Z][A-Za-z0-9]*\b)/gu, replacement: "" },
  { pattern: /\bv[0-9]+[-_]/giu, replacement: "" },
  { pattern: /[-_]v[0-9]+\b/giu, replacement: "" },
];

function cleanNeutralPath(value) {
  return toPosix(value)
    .replace(/\/{2,}/gu, "/")
    .replace(/--+/gu, "-")
    .replace(/__+/gu, "_")
    .replace(/\.{2,}/gu, ".")
    .replace(/\.-/gu, ".")
    .replace(/-\./gu, ".")
    .replace(/\/-/gu, "/")
    .replace(/-\//gu, "/");
}

export function suggestedNeutralNameForVersionedPath(relPath) {
  const governance = governanceForVersionedNamingPath(relPath);
  let candidate = relPath;
  for (const { pattern, replacement } of NEUTRAL_TOKEN_REPLACEMENTS) {
    candidate = candidate.replace(pattern, replacement);
  }
  candidate = cleanNeutralPath(candidate);
  if (candidate === relPath) return null;
  return {
    value: candidate,
    type: governance.manualOnly ? "compatibility_alias_or_manual_cutover" : "local_rename_candidate",
    surface: governance.surface,
    manualOnly: Boolean(governance.manualOnly),
  };
}

export function buildVersionedNamingBaseline(scan) {
  const files = summarizeHits(scan.hits).map((row) => {
    const governance = governanceForVersionedNamingPath(row.path);
    return {
      ...row,
      surfaceClass: governance.surface,
      owner: governance.owner,
      reason: governance.reason,
      removalStrategy: governance.removalStrategy,
      manualOnly: Boolean(governance.manualOnly),
      validationCommand: "npm run check:versioned-naming",
      governance,
      suggestedNeutralName: suggestedNeutralNameForVersionedPath(row.path),
    };
  });
  return {
    schemaVersion: 2,
    policy: "Ratchet existing versioned naming debt down. New files, file-level count increases, or token count increases fail check:versioned-naming. Every baseline row carries governance metadata for owner, reason, removal strategy, manual-only status, surface classification, and deterministic neutral-name guidance when a repository-local neutral name can be suggested.",
    excludedDirs: Array.from(EXCLUDED_DIRS).sort(),
    excludedFiles: Array.from(EXCLUDED_FILES).sort(),
    filesScanned: scan.filesScanned,
    fileCount: files.length,
    totalHits: scan.hits.length,
    files,
  };
}

function baselineFileMap(baseline) {
  const map = new Map();
  for (const row of baseline.files ?? []) {
    map.set(row.path, row);
  }
  return map;
}

function sampleHitsForPath(hits, rel, limit = 6) {
  return hits
    .filter((hit) => hit.path === rel)
    .slice(0, limit)
    .map((hit) => ({
      source: hit.source,
      line: hit.line,
      token: hit.token,
      excerpt: hit.excerpt,
    }));
}

export function compareVersionedNamingBaseline({ baseline, scan }) {
  const currentFiles = summarizeHits(scan.hits);
  const baselineFiles = baselineFileMap(baseline);
  const violations = [];
  const reductions = [];

  for (const current of currentFiles) {
    const existing = baselineFiles.get(current.path);
    if (!existing) {
      violations.push({
        issue: "new_file_with_versioned_naming",
        path: current.path,
        current: current.total,
        baseline: 0,
        tokens: current.tokens,
        samples: sampleHitsForPath(scan.hits, current.path),
      });
      continue;
    }

    if (current.total > existing.total) {
      violations.push({
        issue: "versioned_naming_file_count_increased",
        path: current.path,
        current: current.total,
        baseline: existing.total,
        tokens: current.tokens,
        samples: sampleHitsForPath(scan.hits, current.path),
      });
    } else if (current.total < existing.total) {
      reductions.push({
        path: current.path,
        current: current.total,
        baseline: existing.total,
      });
    }

    for (const [token, count] of Object.entries(current.tokens)) {
      const baselineCount = existing.tokens?.[token] ?? 0;
      if (count > baselineCount) {
        violations.push({
          issue: "versioned_naming_token_count_increased",
          path: current.path,
          token,
          current: count,
          baseline: baselineCount,
          samples: sampleHitsForPath(scan.hits, current.path),
        });
      }
    }
  }

  for (const existing of baseline.files ?? []) {
    if (currentFiles.some((current) => current.path === existing.path)) continue;
    reductions.push({
      path: existing.path,
      current: 0,
      baseline: existing.total,
    });
  }

  const currentTotal = scan.hits.length;
  const baselineTotal = baseline.totalHits ?? 0;

  return {
    ok: violations.length === 0,
    baselineTotal,
    currentTotal,
    delta: currentTotal - baselineTotal,
    currentFileCount: currentFiles.length,
    baselineFileCount: baseline.fileCount ?? baseline.files?.length ?? 0,
    violationCount: violations.length,
    reductionCount: reductions.length,
    violations: violations.slice(0, MAX_SAMPLE_HITS),
    reductions: reductions.slice(0, MAX_SAMPLE_HITS),
  };
}

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    baselinePath: DEFAULT_BASELINE,
    report: false,
    writeBaseline: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--report") {
      options.report = true;
    } else if (arg === "--write-baseline") {
      options.writeBaseline = true;
    } else if (arg === "--root") {
      options.root = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--baseline") {
      options.baselinePath = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith("--baseline=")) {
      options.baselinePath = path.resolve(arg.slice("--baseline=".length));
    }
  }

  return options;
}

export function runVersionedNamingCheck(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const baselinePath = options.baselinePath ?? DEFAULT_BASELINE;
  const scan = scanVersionedNaming(root);
  const currentBaseline = buildVersionedNamingBaseline(scan);

  if (options.writeBaseline) {
    fs.writeFileSync(baselinePath, `${JSON.stringify(currentBaseline, null, 2)}\n`);
    return {
      ok: true,
      wroteBaseline: relPath(root, baselinePath),
      schemaVersion: currentBaseline.schemaVersion,
      filesScanned: currentBaseline.filesScanned,
      fileCount: currentBaseline.fileCount,
      totalHits: currentBaseline.totalHits,
    };
  }

  if (!fs.existsSync(baselinePath)) {
    return {
      ok: false,
      issue: "missing_versioned_naming_baseline",
      baselinePath: relPath(root, baselinePath),
      currentTotal: currentBaseline.totalHits,
      currentFileCount: currentBaseline.fileCount,
    };
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const comparison = compareVersionedNamingBaseline({ baseline, scan });
  return {
    ok: comparison.ok,
    filesScanned: scan.filesScanned,
    ...comparison,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  const report = runVersionedNamingCheck(options);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok || options.report ? 0 : 1);
}
