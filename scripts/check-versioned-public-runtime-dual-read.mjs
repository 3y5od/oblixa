#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { analyzeCompatibilityRemovalQueue } from "./check-compatibility-removal-queue.mjs";
import { analyzeVersionedPublicContractPreservation } from "./check-versioned-public-contract-preservation.mjs";
import { analyzeVersionedRouteAliases } from "./check-versioned-route-aliases.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-public-runtime-dual-read.json";

const STATUS_VOCABULARY = new Set([
  "dual_read_present",
  "alias_ready",
  "queue_covered",
  "requires_external_or_production_cutover",
  "coverage_gap",
]);

const PUBLIC_GROUP_MANUAL_FOLLOW_UP = {
  openapi_schema_public_contracts:
    "Keep legacy schema names resolvable until generated clients, replay fixtures, and external consumers have cut over.",
  public_metadata_assets:
    "Keep legacy public metadata and asset names until crawler, cache, and installed-app compatibility evidence exists.",
  pwa_well_known_install:
    "Keep legacy PWA and well-known identifiers until installed-app, app-link, and cache behavior has cut over.",
  routes_deeplinks_redirects:
    "Keep legacy routes and deep links accepted until bookmarks, generated links, notifications, and support tooling have cut over.",
};

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJson(root, rel, fallback = null) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return fallback;
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function sourceIssueSummaries(sources) {
  return [
    ["versioned_public_contract_preservation", sources.publicContractPreservation],
    ["versioned_route_aliases", sources.routeAliases],
    ["compatibility_removal_queue", sources.compatibilityRemovalQueue],
  ].flatMap(([source, report]) => {
    const issueCount = Number(report?.issueCount ?? report?.issues?.length ?? 0);
    if (issueCount === 0) return [];
    return [
      {
        issue: "versioned_public_runtime_dual_read_source_issues",
        source,
        issueCount,
        sampleIssues: (report?.issues ?? []).slice(0, 5),
      },
    ];
  });
}

function queueCount(sources, queueName) {
  const queues = sources.compatibilityRemovalQueue?.current?.queues ?? sources.compatibilityRemovalQueue?.queues ?? {};
  return Array.isArray(queues[queueName]) ? queues[queueName].length : 0;
}

function routeFamily(sources, surface, id, validationCommand, manualFollowUp) {
  const aliases = (sources.routeAliases?.aliases ?? []).filter((row) => row.surface === surface);
  const missingLegacyRows = aliases.filter((row) => !row.legacyPath || !row.neutralPath || !row.legacyRouteFile || !row.neutralRouteFile);
  const issueCount = missingLegacyRows.length;
  const queueName = surface === "cron_route" ? "cronRoutes" : "apiRoutes";
  const queueEntryCount = queueCount(sources, queueName);
  const missingQueueCoverageCount = Math.max(0, aliases.length - queueEntryCount);
  return {
    id,
    owner: "platform-api",
    reason: "Neutral route aliases keep old public paths callable while code and documentation prefer neutral routes.",
    readinessStatus: issueCount === 0 && aliases.length > 0 ? "dual_read_present" : "coverage_gap",
    validationCommand,
    manualFollowUp,
    legacyAliasCount: aliases.length,
    neutralAliasCount: aliases.length,
    queueEntryCount,
    missingQueueCoverageCount,
    uncoveredManualCount: 0,
    remainingSafeActionCount: 0,
    missingMetadataCount: issueCount,
    missingValidationCommandCount: 0,
    aliases: aliases.map((row) => ({
      legacyPath: row.legacyPath,
      neutralPath: row.neutralPath,
      legacyRouteFile: row.legacyRouteFile,
      neutralRouteFile: row.neutralRouteFile,
      owner: row.owner,
      reason: row.reason,
    })),
  };
}

function publicGroupFamilies(sources) {
  return (sources.publicContractPreservation?.groups ?? []).map((group) => {
    const gapCount =
      Number(group.uncoveredManualCount ?? 0) +
      Number(group.missingMetadataCount ?? 0) +
      Number(group.remainingSafeActionCount ?? 0) +
      Number(group.missingValidationCommandCount ?? 0);
    return {
      id: group.id,
      owner: group.id === "routes_deeplinks_redirects" ? "platform-api" : "frontend-platform",
      reason: "Public-facing versioned names are classified and retained until old and neutral contracts have compatibility evidence.",
      readinessStatus: gapCount === 0 ? "queue_covered" : "coverage_gap",
      validationCommand: "npm run check:versioned-public-contract-preservation",
      manualFollowUp:
        PUBLIC_GROUP_MANUAL_FOLLOW_UP[group.id] ??
        "Keep legacy public contracts until old and neutral names are validated and downstream consumers cut over.",
      subSurfaceClasses: group.subSurfaceClasses ?? [],
      categoryIds: group.categoryIds ?? [],
      contractCount: Number(group.contractCount ?? 0),
      manualOnlyContractCount: Number(group.manualOnlyContractCount ?? 0),
      queueEntryCount: Number(group.queueEntryCount ?? 0),
      allowlistEntryCount: Number(group.allowlistEntryCount ?? 0),
      uncoveredManualCount: Number(group.uncoveredManualCount ?? 0),
      remainingSafeActionCount: Number(group.remainingSafeActionCount ?? 0),
      missingMetadataCount: Number(group.missingMetadataCount ?? 0),
      missingValidationCommandCount: Number(group.missingValidationCommandCount ?? 0),
    };
  });
}

function validateFamily(row) {
  const issues = [];
  for (const key of ["owner", "reason", "readinessStatus", "validationCommand", "manualFollowUp"]) {
    if (typeof row[key] !== "string" || row[key].trim() === "") {
      issues.push({ issue: "versioned_public_runtime_dual_read_missing_metadata", family: row.id, key });
    }
  }
  if (!STATUS_VOCABULARY.has(row.readinessStatus)) {
    issues.push({ issue: "versioned_public_runtime_dual_read_unknown_status", family: row.id, readinessStatus: row.readinessStatus });
  }
  if (row.readinessStatus === "coverage_gap") {
    issues.push({ issue: "versioned_public_runtime_dual_read_coverage_gap", family: row.id });
  }
  if (Number(row.uncoveredManualCount ?? 0) > 0) {
    issues.push({ issue: "versioned_public_runtime_dual_read_uncovered_manual_rows", family: row.id, count: row.uncoveredManualCount });
  }
  if (Number(row.remainingSafeActionCount ?? 0) > 0) {
    issues.push({ issue: "versioned_public_runtime_dual_read_pending_safe_actions", family: row.id, count: row.remainingSafeActionCount });
  }
  if (Number(row.missingMetadataCount ?? 0) > 0) {
    issues.push({ issue: "versioned_public_runtime_dual_read_missing_row_metadata", family: row.id, count: row.missingMetadataCount });
  }
  if (Number(row.missingValidationCommandCount ?? 0) > 0) {
    issues.push({ issue: "versioned_public_runtime_dual_read_missing_validation_commands", family: row.id, count: row.missingValidationCommandCount });
  }
  if (Number(row.missingQueueCoverageCount ?? 0) > 0) {
    issues.push({ issue: "versioned_public_runtime_dual_read_missing_queue_coverage", family: row.id, count: row.missingQueueCoverageCount });
  }
  if (
    ["dual_read_present", "alias_ready", "queue_covered"].includes(row.readinessStatus) &&
    Number(row.uncoveredManualCount ?? 0) +
      Number(row.remainingSafeActionCount ?? 0) +
      Number(row.missingMetadataCount ?? 0) +
      Number(row.missingValidationCommandCount ?? 0) +
      Number(row.missingQueueCoverageCount ?? 0) >
      0
  ) {
    issues.push({ issue: "versioned_public_runtime_dual_read_completed_with_uncovered_rows", family: row.id });
  }
  return issues;
}

function defaultSources(root) {
  return {
    publicContractPreservation: analyzeVersionedPublicContractPreservation({ root }),
    routeAliases: analyzeVersionedRouteAliases({ root }),
    compatibilityRemovalQueue: analyzeCompatibilityRemovalQueue({ root }),
  };
}

export function buildVersionedPublicRuntimeDualRead(root = DEFAULT_ROOT, options = {}) {
  const sources = options.sources ?? defaultSources(root);
  const families = [
    routeFamily(
      sources,
      "api_route",
      "api_route_runtime_aliases",
      "npm run check:versioned-route-aliases",
      "Keep legacy API paths callable until clients, generated docs, and support tooling use neutral paths.",
    ),
    routeFamily(
      sources,
      "cron_route",
      "cron_route_runtime_aliases",
      "npm run check:versioned-route-aliases",
      "Keep legacy cron paths callable until production scheduler cutover is explicitly approved.",
    ),
    ...publicGroupFamilies(sources),
  ].sort((a, b) => a.id.localeCompare(b.id));

  const statusCounts = {};
  for (const family of families) {
    statusCounts[family.readinessStatus] = (statusCounts[family.readinessStatus] ?? 0) + 1;
  }
  const issues = [...sourceIssueSummaries(sources), ...families.flatMap(validateFamily)];

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-public-runtime-dual-read.mjs --write",
    policy:
      "Classify public route, deep-link, PWA, metadata, and OpenAPI version-name surfaces from route aliases, public-contract preservation, and compatibility queues. Checklist docs are not configuration.",
    sourceArtifacts: {
      compatibilityRemovalQueue: "artifacts/compatibility/removal-queue.json",
      routeInventory: "artifacts/routes/compatibility-route-inventory.json",
      versionedContentSurfaceCoverage: "artifacts/compatibility/versioned-content-surface-coverage.json",
      versionedRemainingSurfaceCoverage: "artifacts/compatibility/versioned-remaining-surface-coverage.json",
    },
    totals: {
      familyCount: families.length,
      statusCounts: Object.fromEntries(Object.entries(statusCounts).sort(([a], [b]) => a.localeCompare(b))),
      dualReadPresentCount: statusCounts.dual_read_present ?? 0,
      queueCoveredCount: statusCounts.queue_covered ?? 0,
      requiresExternalOrProductionCutoverCount: statusCounts.requires_external_or_production_cutover ?? 0,
      uncoveredManualCount: families.reduce((sum, row) => sum + Number(row.uncoveredManualCount ?? 0), 0),
      remainingSafeActionCount: families.reduce((sum, row) => sum + Number(row.remainingSafeActionCount ?? 0), 0),
      missingMetadataCount: families.reduce((sum, row) => sum + Number(row.missingMetadataCount ?? 0), 0),
      missingValidationCommandCount: families.reduce((sum, row) => sum + Number(row.missingValidationCommandCount ?? 0), 0),
      missingQueueCoverageCount: families.reduce((sum, row) => sum + Number(row.missingQueueCoverageCount ?? 0), 0),
      issueCount: issues.length,
    },
    families,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeVersionedPublicRuntimeDualRead(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedPublicRuntimeDualRead(root, options);
  const issues = [...current.issues];
  const artifact = readJson(root, artifactRel, null);
  if (!artifact) {
    issues.push({ issue: "versioned_public_runtime_dual_read_missing_artifact", path: artifactRel });
  } else if (stableStringify(artifact) !== stableStringify(current)) {
    issues.push({
      issue: "versioned_public_runtime_dual_read_drift",
      path: artifactRel,
      hint: "Run npm run write:versioned-public-runtime-dual-read",
    });
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    familyCount: current.totals.familyCount,
    statusCounts: current.totals.statusCounts,
    dualReadPresentCount: current.totals.dualReadPresentCount,
    queueCoveredCount: current.totals.queueCoveredCount,
    remainingSafeActionCount: current.totals.remainingSafeActionCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, artifactRel: DEFAULT_ARTIFACT_REL, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--artifact") {
      options.artifactRel = argv[index + 1] ?? DEFAULT_ARTIFACT_REL;
      index += 1;
    } else if (arg.startsWith("--artifact=")) {
      options.artifactRel = arg.slice("--artifact=".length);
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runVersionedPublicRuntimeDualRead(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = buildVersionedPublicRuntimeDualRead(options.root, options);
    writeJson(options.root, options.artifactRel, artifact);
    console.log(
      JSON.stringify(
        {
          ok: artifact.issueCount === 0,
          wrote: options.artifactRel,
          familyCount: artifact.totals.familyCount,
          dualReadPresentCount: artifact.totals.dualReadPresentCount,
          queueCoveredCount: artifact.totals.queueCoveredCount,
          issueCount: artifact.issueCount,
        },
        null,
        2,
      ),
    );
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }
  const report = analyzeVersionedPublicRuntimeDualRead(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedPublicRuntimeDualRead();
}
