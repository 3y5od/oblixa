#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildVersionedContentSurfaceCoverage } from "./check-versioned-content-surface-coverage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-remaining-surface-coverage.json";
const COMPATIBILITY_REMOVAL_QUEUE_REL = "artifacts/compatibility/removal-queue.json";
const VERSION_REFERENCE_ALLOWLIST_REL = "scripts/version-reference-allowlist.json";

const COMPLETION_CATEGORIES = [
  {
    id: "supply_chain_evidence_ids",
    label:
      "SBOM aliases, provenance subjects, attestation predicates, release artifact provenance keys, license allowlist IDs, and supply-chain waiver IDs",
    subSurfaceClasses: ["supply_chain_evidence_id", "artifact_schema_version"],
    queueNames: ["contentContractAliases"],
    allowlistSurfaces: ["schema_metadata", "runtime_dependency"],
    completionClaimed: true,
  },
  {
    id: "auth_capability_entitlement_keys",
    label: "Authorization role helpers, capability keys, feature-family keys, entitlement boundaries, workspace modes, and plan gates",
    subSurfaceClasses: ["feature_flag_key", "source_schema_or_action_contract"],
    queueNames: ["contentContractAliases"],
    completionClaimed: true,
  },
  {
    id: "billing_provider_contract_keys",
    label: "Billing provider catalog keys, price lookup keys, checkout metadata, subscription mappings, and invoice metadata",
    subSurfaceClasses: [
      "provider_or_protocol_version",
      "provider_signature_version",
      "provider_oauth_protocol_version",
      "webhook_or_provider_callback",
    ],
    queueNames: ["contentContractAliases"],
    allowlistSurfaces: ["provider_signature", "provider_endpoint", "provider_protocol"],
    completionClaimed: true,
  },
  {
    id: "deployment_runtime_config",
    label: "Deployment/runtime config resources, release labels, source-map labels, container resources, and build artifacts",
    subSurfaceClasses: [
      "ci_contract",
      "ci_job_matrix_or_artifact",
      "environment_key",
      "operational_env_key",
      "public_env_key",
      "test_runtime_env_key",
      "artifact_schema_version",
    ],
    queueNames: ["contentContractAliases", "environmentKeys"],
    allowlistSurfaces: ["runtime_dependency", "schema_metadata"],
    completionClaimed: true,
  },
  {
    id: "public_token_signed_link_external_action_contracts",
    label: "Public token prefixes, signed-link scopes, invite/callback states, OAuth state keys, and external-action token contracts",
    subSurfaceClasses: ["api_route_contract", "source_schema_or_action_contract", "operational_storage_or_queue_key"],
    queueNames: ["contentContractAliases", "apiRoutes"],
    completionClaimed: true,
  },
  {
    id: "route_deeplink_redirect_contracts",
    label: "Frontend route segments, navigation hrefs, redirects, rewrites, deep links, route-state keys, and hash anchors",
    subSurfaceClasses: ["page_route_or_deep_link_contract", "api_route_contract", "cron_route_contract"],
    queueNames: ["contentContractAliases", "apiRoutes", "cronRoutes"],
    completionClaimed: true,
  },
  {
    id: "proxy_middleware_browser_policy_contracts",
    label: "Proxy matchers, middleware policy keys, safe redirects, auth headers, correlation headers, and browser policy keys",
    subSurfaceClasses: ["page_route_or_deep_link_contract", "source_schema_or_action_contract", "standards_compliance_reference"],
    queueNames: ["contentContractAliases"],
    allowlistSurfaces: ["browser_or_web_standard", "security_standard"],
    completionClaimed: true,
  },
  {
    id: "provider_integration_connector_ids",
    label: "Third-party connector IDs, provider account mappings, sync cursors, external record mappings, and connector field aliases",
    subSurfaceClasses: [
      "provider_oauth_protocol_version",
      "provider_or_protocol_version",
      "provider_signature_version",
      "webhook_or_provider_callback",
      "provider_model_or_eval_version",
    ],
    queueNames: ["contentContractAliases", "webhookRoutes"],
    allowlistSurfaces: ["provider_endpoint", "provider_model_or_eval", "provider_protocol", "provider_signature"],
    completionClaimed: true,
  },
  {
    id: "audit_security_evidence_governance_ids",
    label: "Audit action enums, security event types, evidence keys, compliance evidence IDs, and governance evidence artifacts",
    subSurfaceClasses: ["audit_evidence_or_diagnostic_key", "telemetry_event_name", "standards_compliance_reference"],
    queueNames: ["contentContractAliases", "telemetryEventNames"],
    allowlistSurfaces: ["legal_regulatory_standard", "security_standard"],
    completionClaimed: true,
  },
  {
    id: "diagnostic_response_problem_codes",
    label: "Internal diagnostic IDs, response headers, and problem-code strings",
    subSurfaceClasses: ["audit_evidence_or_diagnostic_key", "source_schema_or_action_contract"],
    queueNames: ["contentContractAliases"],
    completionClaimed: true,
  },
  {
    id: "browser_security_policy_versions",
    label: "Browser policy directives, Trusted Types policies, reporting endpoint groups, CSP report fields, and isolation rollout keys",
    subSurfaceClasses: ["standards_compliance_reference", "feature_flag_key"],
    queueNames: ["contentContractAliases"],
    allowlistSurfaces: ["browser_or_web_standard", "security_standard"],
    completionClaimed: true,
  },
  {
    id: "operational_cache_rate_limit_lock_model_keys",
    label: "Operational keys, cache keys, rate-limit keys, lock keys, hash anchors, and model-version strings",
    subSurfaceClasses: [
      "operational_storage_or_queue_key",
      "operational_env_key",
      "provider_model_or_eval_version",
      "feature_flag_key",
    ],
    queueNames: ["contentContractAliases", "environmentKeys"],
    allowlistSurfaces: ["provider_model_or_eval"],
    completionClaimed: true,
  },
  {
    id: "async_queue_worker_job_contracts",
    label: "Async queue names, worker classes, job payload schemas, retry outcomes, dead-letter keys, leases, and poison-message classes",
    subSurfaceClasses: ["operational_storage_or_queue_key", "source_schema_or_action_contract"],
    queueNames: ["contentContractAliases"],
    completionClaimed: true,
  },
  {
    id: "browser_persisted_storage_contracts",
    label: "Browser storage keys, cookie names, service-worker cache names, cross-tab channels, postMessage events, and URL state keys",
    subSurfaceClasses: ["operational_storage_or_queue_key", "page_route_or_deep_link_contract", "source_schema_or_action_contract"],
    queueNames: ["contentContractAliases"],
    completionClaimed: true,
  },
  {
    id: "storage_object_artifact_paths",
    label: "Storage bucket names, object-path prefixes, artifact storage paths, artifact kinds, and artifact keys",
    subSurfaceClasses: ["operational_storage_or_queue_key", "artifact_schema_version"],
    queueNames: ["contentContractAliases"],
    allowlistSurfaces: ["schema_metadata"],
    completionClaimed: true,
  },
  {
    id: "api_payload_metric_dom_selector_contracts",
    label: "API payload fields, response envelopes, persisted JSON keys, metrics, SLO keys, DOM attributes, and test selectors",
    subSurfaceClasses: [
      "source_schema_or_action_contract",
      "openapi_or_json_schema_contract",
      "dom_data_attribute",
      "dom_or_test_selector",
      "test_selector",
      "audit_evidence_or_diagnostic_key",
    ],
    queueNames: ["contentContractAliases"],
    completionClaimed: true,
  },
  {
    id: "stream_realtime_topic_contracts",
    label: "SSE event names, stream route IDs, realtime channels, WebSocket topics, broadcast topics, presence keys, and heartbeat/error codes",
    subSurfaceClasses: ["source_schema_or_action_contract", "telemetry_event_name", "api_route_contract"],
    queueNames: ["contentContractAliases", "telemetryEventNames", "apiRoutes"],
    completionClaimed: true,
  },
  {
    id: "server_action_form_contracts",
    label: "Server action exports, form action IDs, FormData fields, hidden inputs, submitter values, action-state keys, and validation keys",
    subSurfaceClasses: ["source_schema_or_action_contract"],
    queueNames: ["contentContractAliases"],
    completionClaimed: true,
  },
  {
    id: "openapi_json_schema_generated_client_contracts",
    label: "OpenAPI components, JSON Schema IDs/refs, schema registry keys, generated client types, SDK helpers, and Zod contracts",
    subSurfaceClasses: ["openapi_or_json_schema_contract", "source_schema_or_action_contract", "artifact_schema_version"],
    queueNames: ["contentContractAliases"],
    allowlistSurfaces: ["schema_metadata"],
    completionClaimed: true,
  },
  {
    id: "inbound_import_parser_contracts",
    label: "Import template IDs, parser field aliases, upload metadata keys, import job statuses, row error codes, dedupe keys, and mapping presets",
    subSurfaceClasses: ["source_schema_or_action_contract", "operational_storage_or_queue_key"],
    queueNames: ["contentContractAliases"],
    completionClaimed: true,
  },
  {
    id: "domain_workflow_policy_state_contracts",
    label: "Domain workflow states, transition IDs, rule-engine keys, policy DSL schemas, playbook markers, and state-machine registries",
    subSurfaceClasses: ["source_schema_or_action_contract", "local_source_literal", "sql_or_persisted_key"],
    queueNames: ["contentContractAliases", "sqlObjects"],
    allowlistSurfaces: ["customer_domain_data"],
    completionClaimed: true,
  },
  {
    id: "design_token_theme_contracts",
    label: "Design tokens, CSS custom properties, theme keys, semantic color tokens, and style-system registries",
    subSurfaceClasses: ["style_token_or_selector"],
    queueNames: ["contentContractAliases"],
    allowlistSurfaces: ["browser_or_web_standard"],
    completionClaimed: true,
  },
  {
    id: "command_palette_search_registry_contracts",
    label: "Command palette item keys, search index model keys, ranking terms, autocomplete tokens, recent-item keys, and discovery registries",
    subSurfaceClasses: ["local_source_literal", "source_schema_or_action_contract"],
    queueNames: ["contentContractAliases"],
    completionClaimed: true,
  },
  {
    id: "seed_fixture_config_scanner_ids",
    label: "Supabase seed rows, local reset fixtures, QA registries, source-owned allowlists, static-analysis rule IDs, and scanner packs",
    subSurfaceClasses: ["seed_fixture_key", "source_owned_config_or_scanner_id", "tooling_or_local_fixture"],
    queueNames: ["contentContractAliases"],
    completionClaimed: true,
  },
  {
    id: "notification_export_email_contracts",
    label: "Notification templates, integration message IDs, Slack block/action IDs, export filenames, CSV/PDF metadata, and email routing keys",
    subSurfaceClasses: ["notification_or_export_contract", "provider_signature_version", "provider_or_protocol_version"],
    queueNames: ["contentContractAliases"],
    allowlistSurfaces: ["provider_signature", "provider_protocol"],
    completionClaimed: true,
  },
  {
    id: "ai_prompt_model_eval_contracts",
    label: "AI prompts, model-facing instructions, structured-output schemas, tool-call schemas, eval fixtures, and model-bound extraction contracts",
    subSurfaceClasses: ["ai_fixture_or_prompt_contract", "provider_model_or_eval_version", "source_schema_or_action_contract"],
    queueNames: ["contentContractAliases"],
    allowlistSurfaces: ["provider_model_or_eval"],
    completionClaimed: true,
  },
  {
    id: "public_metadata_pwa_install_contracts",
    label: "Public SEO/social metadata, app-install metadata, public asset URLs, sitemap/robots/canonical output, PWA manifests, and well-known contracts",
    subSurfaceClasses: ["public_metadata_or_asset", "pwa_or_well_known_contract", "page_route_or_deep_link_contract"],
    queueNames: ["contentContractAliases"],
    allowlistSurfaces: ["browser_or_web_standard"],
    completionClaimed: true,
  },
  {
    id: "localization_copy_catalog_contracts",
    label: "Locale segments, translation keys, copy/spec-string registry keys, pseudo-locale fixtures, and localized metadata keys",
    subSurfaceClasses: ["localization_or_copy_key", "local_copy_or_historical_document"],
    queueNames: ["contentContractAliases"],
    allowlistSurfaces: ["customer_domain_data"],
    completionClaimed: true,
  },
  {
    id: "package_script_alias_readiness",
    label: "Versioned package-script aliases and readiness blockers",
    subSurfaceClasses: ["package_script_key", "package_script_or_metadata"],
    queueNames: ["packageScriptAliases", "contentContractAliases"],
    completionClaimed: false,
    retainedLegacySurface: true,
  },
];

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJson(root, rel, fallback = null) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return fallback;
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function sortedObjectFromCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function queueRowsByName(queueArtifact, queueName) {
  const rows = queueArtifact?.queues?.[queueName];
  return Array.isArray(rows) ? rows : [];
}

function queueRowsForCategory(queueArtifact, category) {
  const subSurfaces = new Set(category.subSurfaceClasses ?? []);
  const rows = [];
  for (const queueName of category.queueNames ?? []) {
    for (const row of queueRowsByName(queueArtifact, queueName)) {
      if (queueName !== "contentContractAliases" || subSurfaces.size === 0 || subSurfaces.has(row.subSurface)) {
        rows.push({ ...row, queueName });
      }
    }
  }
  return rows.sort(
    (a, b) =>
      String(a.queueName).localeCompare(String(b.queueName)) ||
      String(a.legacyName ?? "").localeCompare(String(b.legacyName ?? "")) ||
      String(a.sourcePath ?? "").localeCompare(String(b.sourcePath ?? "")),
  );
}

function allowlistRowsForCategory(allowlistArtifact, category) {
  const surfaces = new Set(category.allowlistSurfaces ?? []);
  if (surfaces.size === 0) return [];
  return (allowlistArtifact?.entries ?? [])
    .filter((entry) => surfaces.has(entry.surface))
    .map((entry) => ({
      id: entry.id,
      surface: entry.surface,
      owner: entry.owner,
      validationCommand: entry.validationCommand,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function emptySubSurfaceStats(subSurfaceClass) {
  return {
    subSurfaceClass,
    contractCount: 0,
    manualOnlyContractCount: 0,
    queueCoveredManualCount: 0,
    allowlistCoveredManualCount: 0,
    documentationOnlyManualCount: 0,
    uncoveredManualCount: 0,
    missingMetadataCount: 0,
    validationCommandCoveredCount: 0,
    remainingSafeActionCount: 0,
    owners: {},
  };
}

function summarizeCategory(category, contentSurfaceCoverage, queueArtifact, allowlistArtifact) {
  const subSurfaceRowsByClass = new Map(
    (contentSurfaceCoverage.bySubSurface ?? []).map((row) => [row.subSurfaceClass, row]),
  );
  const subSurfaceRows = (category.subSurfaceClasses ?? []).map((subSurfaceClass) =>
    subSurfaceRowsByClass.get(subSurfaceClass) ?? emptySubSurfaceStats(subSurfaceClass),
  );
  const queueRows = queueRowsForCategory(queueArtifact, category);
  const allowlistRows = allowlistRowsForCategory(allowlistArtifact, category);
  const ownerCounts = {};
  const statusCounts = {};
  let contractCount = 0;
  let manualOnlyContractCount = 0;
  let queueCoveredManualCount = 0;
  let allowlistCoveredManualCount = 0;
  let documentationOnlyManualCount = 0;
  let uncoveredManualCount = 0;
  let missingMetadataCount = 0;
  let validationCommandCoveredCount = 0;
  let remainingSafeActionCount = 0;

  for (const row of subSurfaceRows) {
    contractCount += row.contractCount ?? 0;
    manualOnlyContractCount += row.manualOnlyContractCount ?? 0;
    queueCoveredManualCount += row.queueCoveredManualCount ?? 0;
    allowlistCoveredManualCount += row.allowlistCoveredManualCount ?? 0;
    documentationOnlyManualCount += row.documentationOnlyManualCount ?? 0;
    uncoveredManualCount += row.uncoveredManualCount ?? 0;
    missingMetadataCount += row.missingMetadataCount ?? 0;
    validationCommandCoveredCount += row.validationCommandCoveredCount ?? 0;
    remainingSafeActionCount += row.remainingSafeActionCount ?? 0;
    for (const [owner, count] of Object.entries(row.owners ?? {})) {
      ownerCounts[owner] = (ownerCounts[owner] ?? 0) + count;
    }
  }

  for (const row of queueRows) {
    statusCounts[row.status ?? "missing"] = (statusCounts[row.status ?? "missing"] ?? 0) + 1;
  }

  const missingValidationCommandCount = Math.max(0, contractCount - validationCommandCoveredCount);
  const issueCount =
    missingMetadataCount +
    uncoveredManualCount +
    remainingSafeActionCount +
    missingValidationCommandCount;
  const coverageStatus = category.retainedLegacySurface
    ? "legacy_alias_retained"
    : issueCount === 0
      ? contractCount === 0
        ? "no_current_hits"
        : "coverage_proven"
      : "coverage_gap";

  return {
    id: category.id,
    label: category.label,
    completionClaimed: Boolean(category.completionClaimed),
    retainedLegacySurface: Boolean(category.retainedLegacySurface),
    coverageStatus,
    subSurfaceClasses: [...(category.subSurfaceClasses ?? [])].sort((a, b) => a.localeCompare(b)),
    contractCount,
    manualOnlyContractCount,
    queueCoveredManualCount,
    allowlistCoveredManualCount,
    documentationOnlyManualCount,
    uncoveredManualCount,
    missingMetadataCount,
    validationCommandCoveredCount,
    missingValidationCommandCount,
    remainingSafeActionCount,
    queueEntryCount: queueRows.length,
    queueStatusCounts: sortedObjectFromCounts(statusCounts),
    allowlistEntryCount: allowlistRows.length,
    allowlistEntries: allowlistRows,
    ownerCoverage: sortedObjectFromCounts(ownerCounts),
  };
}

function packageScriptReadinessDetails(queueArtifact) {
  return queueRowsByName(queueArtifact, "packageScriptAliases")
    .map((row) => ({
      legacyName: row.legacyName,
      neutralAlias: row.neutralAlias,
      status: row.status,
      readinessStatus: row.readinessStatus,
      readinessBlocker: row.readinessBlocker,
      externalReferenceCount: row.externalReferenceCount ?? 0,
      externalReferences: row.externalReferences ?? [],
      validationCommand: row.validationCommand,
    }))
    .sort((a, b) => String(a.legacyName).localeCompare(String(b.legacyName)));
}

function validateCategory(category) {
  const issues = [];
  if (category.completionClaimed && category.uncoveredManualCount > 0) {
    issues.push({
      issue: "versioned_remaining_surface_uncovered_manual_rows",
      category: category.id,
      count: category.uncoveredManualCount,
    });
  }
  if (category.completionClaimed && category.missingMetadataCount > 0) {
    issues.push({
      issue: "versioned_remaining_surface_missing_metadata",
      category: category.id,
      count: category.missingMetadataCount,
    });
  }
  if (category.completionClaimed && category.remainingSafeActionCount > 0) {
    issues.push({
      issue: "versioned_remaining_surface_has_pending_safe_actions",
      category: category.id,
      count: category.remainingSafeActionCount,
    });
  }
  if (category.completionClaimed && category.missingValidationCommandCount > 0) {
    issues.push({
      issue: "versioned_remaining_surface_missing_validation_commands",
      category: category.id,
      count: category.missingValidationCommandCount,
    });
  }
  return issues;
}

export function buildVersionedRemainingSurfaceCoverage(root = DEFAULT_ROOT, options = {}) {
  const queueRel = options.queueRel ?? COMPATIBILITY_REMOVAL_QUEUE_REL;
  const allowlistRel = options.allowlistRel ?? VERSION_REFERENCE_ALLOWLIST_REL;
  const queueArtifact = readJson(root, queueRel, { queues: {}, manualBoundaries: [] });
  const allowlistArtifact = readJson(root, allowlistRel, { entries: [] });
  const contentSurfaceCoverage = buildVersionedContentSurfaceCoverage(root, options);
  const categories = COMPLETION_CATEGORIES.map((category) =>
    summarizeCategory(category, contentSurfaceCoverage, queueArtifact, allowlistArtifact),
  ).sort((a, b) => a.id.localeCompare(b.id));
  const issues = [...(contentSurfaceCoverage.issues ?? [])];
  for (const category of categories) issues.push(...validateCategory(category));

  const totals = {
    categoryCount: categories.length,
    completedCoverageCategoryCount: categories.filter((row) => row.completionClaimed && row.coverageStatus !== "coverage_gap").length,
    retainedLegacyCategoryCount: categories.filter((row) => row.retainedLegacySurface).length,
    contractCount: categories.reduce((sum, row) => sum + row.contractCount, 0),
    manualOnlyContractCount: categories.reduce((sum, row) => sum + row.manualOnlyContractCount, 0),
    uncoveredManualCount: categories.reduce((sum, row) => sum + row.uncoveredManualCount, 0),
    remainingSafeActionCount: categories.reduce((sum, row) => sum + row.remainingSafeActionCount, 0),
    missingValidationCommandCount: categories.reduce((sum, row) => sum + row.missingValidationCommandCount, 0),
    queueEntryCount: categories.reduce((sum, row) => sum + row.queueEntryCount, 0),
    allowlistEntryCount: categories.reduce((sum, row) => sum + row.allowlistEntryCount, 0),
  };

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-remaining-surface-coverage.mjs --write",
    policy:
      "Prove remaining version-name checklist surfaces are covered by deterministic inventories, removal queues, legitimate-version allowlists, or explicit manual boundaries. Checklist docs are not configuration.",
    sourceArtifacts: {
      versionedContentSurfaceCoverage: "artifacts/compatibility/versioned-content-surface-coverage.json",
      versionedContentContracts: "artifacts/compatibility/versioned-content-contract-inventory.json",
      compatibilityRemovalQueue: queueRel,
      versionReferenceAllowlist: allowlistRel,
      localContentRewriteManifest: "artifacts/compatibility/versioned-local-content-rewrite-manifest.json",
    },
    manualBoundaryStatus: {
      boundaryCount: Array.isArray(queueArtifact.manualBoundaries) ? queueArtifact.manualBoundaries.length : 0,
      boundariesPresent: Array.isArray(queueArtifact.manualBoundaries) && queueArtifact.manualBoundaries.length > 0,
      boundaries: queueArtifact.manualBoundaries ?? [],
    },
    packageScriptReadiness: {
      ...contentSurfaceCoverage.packageScriptReadiness,
      blockedAliases: packageScriptReadinessDetails(queueArtifact),
    },
    totals,
    categories,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeVersionedRemainingSurfaceCoverage(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedRemainingSurfaceCoverage(root, options);
  const issues = [...current.issues];
  const artifactPath = path.join(root, artifactRel);
  if (!fs.existsSync(artifactPath)) {
    issues.push({ issue: "versioned_remaining_surface_coverage_missing", path: artifactRel });
  } else {
    const committed = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    if (stableStringify(committed) !== stableStringify({ ...current, issueCount: current.issues.length, issues: current.issues })) {
      issues.push({
        issue: "versioned_remaining_surface_coverage_drift",
        path: artifactRel,
        hint: "Run npm run write:versioned-remaining-surface-coverage",
      });
    }
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    categoryCount: current.totals.categoryCount,
    completedCoverageCategoryCount: current.totals.completedCoverageCategoryCount,
    retainedLegacyCategoryCount: current.totals.retainedLegacyCategoryCount,
    uncoveredManualCount: current.totals.uncoveredManualCount,
    remainingSafeActionCount: current.totals.remainingSafeActionCount,
    missingValidationCommandCount: current.totals.missingValidationCommandCount,
    packageScriptAliasCount: current.packageScriptReadiness.aliasCount,
    packageScriptReadyForRemovalCount: current.packageScriptReadiness.readyForRemovalCount,
    issueCount: issues.length,
    issues,
    current: { ...current, issueCount: current.issues.length, issues: current.issues },
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

function writeArtifact(root, artifactRel) {
  const artifact = buildVersionedRemainingSurfaceCoverage(root);
  const out = path.join(root, artifactRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stableStringify(artifact));
  return artifact;
}

export function runVersionedRemainingSurfaceCoverage(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = writeArtifact(options.root, options.artifactRel);
    console.log(
      JSON.stringify(
        {
          ok: artifact.issues.length === 0,
          wrote: options.artifactRel,
          categoryCount: artifact.totals.categoryCount,
          completedCoverageCategoryCount: artifact.totals.completedCoverageCategoryCount,
          retainedLegacyCategoryCount: artifact.totals.retainedLegacyCategoryCount,
          uncoveredManualCount: artifact.totals.uncoveredManualCount,
          remainingSafeActionCount: artifact.totals.remainingSafeActionCount,
          missingValidationCommandCount: artifact.totals.missingValidationCommandCount,
          packageScriptAliasCount: artifact.packageScriptReadiness.aliasCount,
          packageScriptReadyForRemovalCount: artifact.packageScriptReadiness.readyForRemovalCount,
          issueCount: artifact.issues.length,
          issues: artifact.issues,
        },
        null,
        2,
      ),
    );
    if (artifact.issues.length > 0) process.exitCode = 1;
    return artifact;
  }
  const report = analyzeVersionedRemainingSurfaceCoverage(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedRemainingSurfaceCoverage();
}
