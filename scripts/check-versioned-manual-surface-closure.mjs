#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildCompatibilityRemovalQueue } from "./check-compatibility-removal-queue.mjs";
import { buildVersionedContentSurfaceCoverage } from "./check-versioned-content-surface-coverage.mjs";
import { buildVersionedRemainingSurfaceCoverage } from "./check-versioned-remaining-surface-coverage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-manual-surface-closure.json";

export const MANUAL_SURFACE_FAMILIES = [
  {
    id: "public_token_callback_contracts",
    label: "Public token, signed-link, invite, callback, OAuth state, and external-action token contracts",
    categoryIds: ["public_token_signed_link_external_action_contracts"],
    queueNames: ["contentContractAliases", "apiRoutes"],
  },
  {
    id: "stream_realtime_contracts",
    label: "SSE, stream route, realtime channel, WebSocket, broadcast, presence, cursor, and heartbeat contracts",
    categoryIds: ["stream_realtime_topic_contracts"],
    queueNames: ["contentContractAliases", "telemetryEventNames", "apiRoutes"],
  },
  {
    id: "cron_route_contracts",
    label: "Versioned cron URLs, neutral aliases, schedule wrappers, and production scheduler evidence",
    categoryIds: ["route_deeplink_redirect_contracts"],
    subSurfaceClasses: ["cron_route_contract"],
    queueNames: ["cronRoutes", "contentContractAliases"],
    retainedLegacySurface: true,
  },
  {
    id: "telemetry_event_contracts",
    label: "Telemetry persisted names, neutral aliases, bridge mappings, dashboards, and audit fixtures",
    categoryIds: ["audit_security_evidence_governance_ids", "stream_realtime_topic_contracts"],
    subSurfaceClasses: ["telemetry_event_name"],
    queueNames: ["telemetryEventNames", "contentContractAliases"],
    retainedLegacySurface: true,
  },
  {
    id: "observability_metric_contracts",
    label: "Metrics, SLO keys, traces, alerts, dashboard keys, and report-time compatibility mappings",
    categoryIds: ["api_payload_metric_dom_selector_contracts", "audit_security_evidence_governance_ids"],
    queueNames: ["contentContractAliases", "telemetryEventNames"],
  },
  {
    id: "audit_evidence_contracts",
    label: "Audit actions, evidence keys, compliance IDs, governance reports, and immutable historical evidence",
    categoryIds: ["audit_security_evidence_governance_ids"],
    queueNames: ["contentContractAliases", "telemetryEventNames"],
  },
  {
    id: "diagnostic_header_contracts",
    label: "Diagnostic IDs, problem codes, response headers, log event keys, and compatibility mappings",
    categoryIds: ["diagnostic_response_problem_codes"],
    queueNames: ["contentContractAliases"],
  },
  {
    id: "browser_security_policy_contracts",
    label: "CSP, Trusted Types, reporting endpoints, browser isolation, standards references, and report keys",
    categoryIds: ["browser_security_policy_versions", "proxy_middleware_browser_policy_contracts"],
    queueNames: ["contentContractAliases"],
    allowlistedStandardsSurface: true,
  },
  {
    id: "operational_literal_contracts",
    label: "Cache, rate-limit, lock, hash, durable operational, and model-version literals",
    categoryIds: ["operational_cache_rate_limit_lock_model_keys"],
    queueNames: ["contentContractAliases", "environmentKeys"],
  },
  {
    id: "async_queue_contracts",
    label: "Queue names, workers, payload schemas, retry outcomes, leases, visibility, and poison-message contracts",
    categoryIds: ["async_queue_worker_job_contracts"],
    queueNames: ["contentContractAliases"],
  },
  {
    id: "browser_client_state_contracts",
    label: "Browser storage, cookies, service-worker caches, cross-tab channels, postMessage, and URL-state keys",
    categoryIds: ["browser_persisted_storage_contracts"],
    queueNames: ["contentContractAliases"],
  },
  {
    id: "storage_export_contracts",
    label: "Storage paths, artifact keys, export/download names, CSV headers, PDF metadata, and signed links",
    categoryIds: ["storage_object_artifact_paths", "outbound_notification_export_email_contracts"],
    queueNames: ["contentContractAliases"],
  },
  {
    id: "sql_security_contracts",
    label: "SQL objects, RLS helpers, policies, grants, triggers, realtime publications, and migration staging",
    categoryIds: ["domain_workflow_policy_state_contracts"],
    queueNames: ["contentContractAliases", "sqlObjects"],
    retainedLegacySurface: true,
  },
  {
    id: "seed_fixture_contracts",
    label: "Supabase seed rows, local reset fixtures, seed-only names, source-owned config, and scanner IDs",
    categoryIds: ["seed_fixture_config_scanner_ids"],
    queueNames: ["contentContractAliases"],
  },
  {
    id: "docs_external_pwa_contracts",
    label: "Documentation command references, external contract files, public metadata, PWA, well-known, and public asset contracts",
    categoryIds: ["public_metadata_pwa_install_contracts", "route_deeplink_redirect_contracts"],
    queueNames: ["contentContractAliases", "apiRoutes", "cronRoutes"],
    retainedLegacySurface: true,
  },
  {
    id: "local_fixture_content_contracts",
    label: "Local variables, comments, test descriptions, fixtures, snapshots, skip metadata, style tokens, and localization keys",
    categoryIds: [
      "static_text_fixtures_snapshots",
      "design_token_theme_contracts",
      "localization_copy_catalog_contracts",
      "api_payload_metric_dom_selector_contracts",
    ],
    queueNames: ["contentContractAliases"],
  },
];

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sortedObjectFromCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function rowsById(rows) {
  return new Map((rows ?? []).map((row) => [row.id, row]));
}

function subSurfaceRows(contentCoverage, family) {
  if (!family.subSurfaceClasses) return [];
  const bySubSurface = new Map((contentCoverage.bySubSurface ?? []).map((row) => [row.subSurfaceClass, row]));
  return family.subSurfaceClasses.map((subSurfaceClass) => bySubSurface.get(subSurfaceClass)).filter(Boolean);
}

function queueCounts(queueArtifact, family) {
  const counts = {};
  for (const queueName of family.queueNames ?? []) {
    counts[queueName] = Array.isArray(queueArtifact.queues?.[queueName]) ? queueArtifact.queues[queueName].length : 0;
  }
  return sortedObjectFromCounts(counts);
}

function summarizeFamily(family, remainingCoverage, contentCoverage, queueArtifact) {
  const categoriesById = rowsById(remainingCoverage.categories);
  const categories = (family.categoryIds ?? [])
    .map((id) => categoriesById.get(id))
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
  const directSubSurfaces = subSurfaceRows(contentCoverage, family);
  const rows = directSubSurfaces.length > 0 ? directSubSurfaces : categories;
  const uncoveredManualCount = rows.reduce((sum, row) => sum + (row.uncoveredManualCount ?? 0), 0);
  const remainingSafeActionCount = rows.reduce((sum, row) => sum + (row.remainingSafeActionCount ?? 0), 0);
  const missingMetadataCount = rows.reduce((sum, row) => sum + (row.missingMetadataCount ?? 0), 0);
  const missingValidationCommandCount = rows.reduce((sum, row) => sum + (row.missingValidationCommandCount ?? 0), 0);
  const queueStatusCounts = {};
  for (const row of categories) {
    for (const [status, count] of Object.entries(row.queueStatusCounts ?? {})) {
      queueStatusCounts[status] = (queueStatusCounts[status] ?? 0) + count;
    }
  }

  const coverageStatus =
    uncoveredManualCount === 0 &&
    remainingSafeActionCount === 0 &&
    missingMetadataCount === 0 &&
    missingValidationCommandCount === 0
      ? family.retainedLegacySurface
        ? "retained_legacy_covered"
        : "coverage_proven"
      : "coverage_gap";

  return {
    id: family.id,
    label: family.label,
    categoryIds: family.categoryIds ?? [],
    subSurfaceClasses: family.subSurfaceClasses ?? [],
    queueNames: family.queueNames ?? [],
    retainedLegacySurface: Boolean(family.retainedLegacySurface),
    allowlistedStandardsSurface: Boolean(family.allowlistedStandardsSurface),
    coverageStatus,
    categoryCount: categories.length,
    queueCounts: queueCounts(queueArtifact, family),
    queueStatusCounts: sortedObjectFromCounts(queueStatusCounts),
    uncoveredManualCount,
    remainingSafeActionCount,
    missingMetadataCount,
    missingValidationCommandCount,
    manualFollowUpRequired: Boolean(family.retainedLegacySurface),
    manualFollowUp: family.retainedLegacySurface
      ? "Keep retained legacy names available until production, dashboard, scheduler, SQL, or public-consumer cutover evidence exists."
      : "No production mutation is authorized by this closure artifact.",
  };
}

export function buildVersionedManualSurfaceClosure(root = DEFAULT_ROOT, options = {}) {
  const remainingCoverage = options.remainingCoverage ?? buildVersionedRemainingSurfaceCoverage(root);
  const contentCoverage = options.contentCoverage ?? buildVersionedContentSurfaceCoverage(root);
  const queueArtifact = options.queueArtifact ?? buildCompatibilityRemovalQueue(root);
  const families = MANUAL_SURFACE_FAMILIES
    .map((family) => summarizeFamily(family, remainingCoverage, contentCoverage, queueArtifact))
    .sort((a, b) => a.id.localeCompare(b.id));
  const issues = [];
  for (const family of families) {
    if (family.categoryCount === 0) {
      issues.push({ issue: "versioned_manual_surface_closure_missing_category", family: family.id });
    }
    if (family.uncoveredManualCount > 0) {
      issues.push({ issue: "versioned_manual_surface_closure_uncovered_manual_rows", family: family.id, count: family.uncoveredManualCount });
    }
    if (family.remainingSafeActionCount > 0) {
      issues.push({ issue: "versioned_manual_surface_closure_safe_actions_remaining", family: family.id, count: family.remainingSafeActionCount });
    }
    if (family.missingMetadataCount > 0 || family.missingValidationCommandCount > 0) {
      issues.push({
        issue: "versioned_manual_surface_closure_missing_metadata",
        family: family.id,
        missingMetadataCount: family.missingMetadataCount,
        missingValidationCommandCount: family.missingValidationCommandCount,
      });
    }
  }

  return {
    schemaVersion: 1,
    generatedBy: "check:versioned-manual-surface-closure",
    familyCount: families.length,
    coverageProvenFamilyCount: families.filter((row) => row.coverageStatus === "coverage_proven").length,
    retainedLegacyFamilyCount: families.filter((row) => row.coverageStatus === "retained_legacy_covered").length,
    uncoveredManualCount: families.reduce((sum, row) => sum + row.uncoveredManualCount, 0),
    remainingSafeActionCount: families.reduce((sum, row) => sum + row.remainingSafeActionCount, 0),
    issueCount: issues.length,
    issues,
    families,
  };
}

export function analyzeVersionedManualSurfaceClosure(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedManualSurfaceClosure(root, options);
  const issues = [...current.issues];
  const artifactPath = path.join(root, artifactRel);
  const committed = fs.existsSync(artifactPath) ? JSON.parse(fs.readFileSync(artifactPath, "utf8")) : null;
  if (!committed) {
    issues.push({ issue: "versioned_manual_surface_closure_missing_artifact", path: artifactRel });
  } else if (stableStringify(committed) !== stableStringify(current)) {
    issues.push({
      issue: "versioned_manual_surface_closure_drift",
      path: artifactRel,
      hint: "Run npm run write:versioned-manual-surface-closure",
    });
  }

  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    familyCount: current.familyCount,
    coverageProvenFamilyCount: current.coverageProvenFamilyCount,
    retainedLegacyFamilyCount: current.retainedLegacyFamilyCount,
    uncoveredManualCount: current.uncoveredManualCount,
    remainingSafeActionCount: current.remainingSafeActionCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function writeArtifact(root, artifactRel) {
  const artifact = buildVersionedManualSurfaceClosure(root);
  const out = path.join(root, artifactRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stableStringify(artifact));
  return artifact;
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

export function runVersionedManualSurfaceClosure(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = writeArtifact(options.root, options.artifactRel);
    console.log(JSON.stringify({
      ok: true,
      wrote: options.artifactRel,
      familyCount: artifact.familyCount,
      coverageProvenFamilyCount: artifact.coverageProvenFamilyCount,
      retainedLegacyFamilyCount: artifact.retainedLegacyFamilyCount,
    }, null, 2));
    return artifact;
  }

  const report = analyzeVersionedManualSurfaceClosure(options);
  const { current: _current, ...summary } = report;
  console.log(JSON.stringify(summary, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedManualSurfaceClosure();
}
