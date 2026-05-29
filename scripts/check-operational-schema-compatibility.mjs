#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parse } from "yaml";
import { analyzeCompatibilityRemovalQueue } from "./check-compatibility-removal-queue.mjs";
import { analyzeCompatibilityRouteInventory } from "./check-compatibility-route-inventory.mjs";
import { analyzeTelemetryEventInventory } from "./check-telemetry-event-inventory.mjs";
import { analyzeVersionedExportDownloadContracts } from "./check-versioned-export-download-contracts.mjs";
import { analyzeVersionedForwardMigrationReadiness } from "./check-versioned-forward-migration-readiness.mjs";
import { analyzeVersionedPackageScriptReadiness } from "./check-versioned-package-script-readiness.mjs";
import { analyzeVersionedPublicContractPreservation } from "./check-versioned-public-contract-preservation.mjs";
import { analyzeVersionedPublicRuntimeDualRead } from "./check-versioned-public-runtime-dual-read.mjs";
import { analyzeVersionedSourceConfigPreservation } from "./check-versioned-source-config-preservation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const CONFIG_REL = "config/operational-schema-compatibility.json";
const DEFAULT_ARTIFACT_REL = "artifacts/operational-schema-compatibility.json";

const REQUIRED_SURFACES = [
  "route-paths",
  "query-params",
  "request-bodies",
  "response-fields",
  "csv-headers",
  "pdf-fields",
  "email-template-variables",
  "telemetry-event-names",
  "sql-objects",
  "storage-paths",
  "webhook-event-fields",
  "env-keys",
  "package-scripts",
  "dom-test-selectors",
];

const REQUIRED_GUARDRAILS = [
  "destructive-field-removal",
  "enum-narrowing",
  "response-shape-narrowing",
  "sql-column-drop",
  "sql-policy-change",
  "persisted-event-name-change",
];

const REQUIRED_DUAL_READ_CASES = [
  "old-only-data",
  "new-only-data",
  "both-values-present",
  "conflicting-values",
  "null-values",
  "backfill-ready",
];

const REQUIRED_DEPRECATION_KINDS = [
  "api_field",
  "route",
  "package_script_alias",
  "telemetry_event",
  "env_alias",
  "sql_alias",
  "export_field",
];

const REQUIRED_OPENAPI_COMPARISONS = [
  "paths",
  "methods",
  "schemas",
  "examples",
  "auth-notes",
  "error-shapes",
  "deprecation-metadata",
];

const PROTECTION_EVIDENCE = new Set(["alias", "dual-read", "dual-write", "migration", "queue"]);
const CUSTOMER_IMPACT_CLASSES = new Set(["customer-visible", "external-integrator", "internal", "none", "operator"]);
const HTTP_METHODS = new Set(["delete", "get", "head", "options", "patch", "post", "put"]);

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel, fallback = null) {
  const text = read(root, rel);
  if (!text) return fallback;
  return JSON.parse(text);
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function fileExists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function packageScripts(root) {
  return readJson(root, "package.json", { scripts: {} })?.scripts ?? {};
}

function requirePackageScript(scripts, command, issues, fields = {}) {
  if (typeof command !== "string" || command.trim() === "") {
    issues.push(issue("operational_schema_missing_validation_command", fields));
    return;
  }
  if (!scripts[command]) {
    issues.push(issue("operational_schema_unknown_validation_command", { ...fields, command }));
  }
}

function requireNonEmptyString(row, key, issues, fields = {}) {
  if (typeof row?.[key] !== "string" || row[key].trim() === "") {
    issues.push(issue("operational_schema_missing_required_field", { ...fields, key }));
  }
}

function validateConfig(root, config, scripts) {
  const issues = [];

  if (config?.schemaVersion !== 1 || config?.source !== "code-owned-operational-schema-compatibility") {
    issues.push(issue("operational_schema_invalid_config_metadata"));
  }
  if (config?.generatedArtifact !== DEFAULT_ARTIFACT_REL) {
    issues.push(issue("operational_schema_unexpected_generated_artifact", { generatedArtifact: config?.generatedArtifact ?? null }));
  }

  for (const rel of config?.sourceFiles ?? []) {
    if (!fileExists(root, rel)) issues.push(issue("operational_schema_missing_source_file", { path: rel }));
  }
  for (const rel of config?.sourceArtifacts ?? []) {
    if (!fileExists(root, rel)) issues.push(issue("operational_schema_missing_source_artifact", { path: rel }));
  }

  for (const command of config?.requiredValidationCommands ?? []) {
    requirePackageScript(scripts, command, issues, { source: "requiredValidationCommands" });
  }

  const surfaceIds = new Set((config?.contractSurfaces ?? []).map((row) => row.id));
  for (const id of REQUIRED_SURFACES) {
    if (!surfaceIds.has(id)) issues.push(issue("operational_schema_missing_contract_surface", { id }));
  }
  for (const row of config?.contractSurfaces ?? []) {
    for (const key of ["id", "ownerArea", "contractClass", "inventorySource", "validationCommand", "removalProtection"]) {
      requireNonEmptyString(row, key, issues, { surface: row.id ?? "(missing)" });
    }
    requirePackageScript(scripts, row.validationCommand, issues, { surface: row.id ?? "(missing)" });
    if (!Array.isArray(row.protectionEvidence) || row.protectionEvidence.length === 0) {
      issues.push(issue("operational_schema_surface_missing_protection_evidence", { surface: row.id ?? "(missing)" }));
    } else if (!row.protectionEvidence.some((entry) => PROTECTION_EVIDENCE.has(entry))) {
      issues.push(issue("operational_schema_surface_missing_accepted_protection", { surface: row.id ?? "(missing)" }));
    }
    if (row.inventorySource && !fileExists(root, row.inventorySource)) {
      issues.push(issue("operational_schema_surface_inventory_missing", { surface: row.id ?? "(missing)", path: row.inventorySource }));
    }
  }

  const guardrailIds = new Set((config?.additiveSchemaGuardrails ?? []).map((row) => row.id));
  for (const id of REQUIRED_GUARDRAILS) {
    if (!guardrailIds.has(id)) issues.push(issue("operational_schema_missing_additive_guardrail", { id }));
  }
  for (const row of config?.additiveSchemaGuardrails ?? []) {
    for (const key of ["id", "breakingChangeClass", "detection", "requiredEvidence", "validationCommand", "manualBoundaryClassification"]) {
      requireNonEmptyString(row, key, issues, { guardrail: row.id ?? "(missing)" });
    }
    requirePackageScript(scripts, row.validationCommand, issues, { guardrail: row.id ?? "(missing)" });
  }

  const dualReadCases = new Set(config?.dualReadTransitionCases ?? []);
  for (const id of REQUIRED_DUAL_READ_CASES) {
    if (!dualReadCases.has(id)) issues.push(issue("operational_schema_missing_dual_read_case", { id }));
  }

  const deprecationKinds = new Set((config?.deprecationContracts ?? []).map((row) => row.kind));
  for (const kind of REQUIRED_DEPRECATION_KINDS) {
    if (!deprecationKinds.has(kind)) issues.push(issue("operational_schema_missing_deprecation_kind", { kind }));
  }
  for (const row of config?.deprecationContracts ?? []) {
    for (const key of [
      "id",
      "kind",
      "deprecatedName",
      "replacement",
      "owner",
      "firstDeprecatedOn",
      "earliestRemovalBoundary",
      "validationCommand",
      "customerImpactClass",
    ]) {
      requireNonEmptyString(row, key, issues, { deprecation: row.id ?? "(missing)" });
    }
    requirePackageScript(scripts, row.validationCommand, issues, { deprecation: row.id ?? "(missing)" });
    if (!REQUIRED_DEPRECATION_KINDS.includes(row.kind)) {
      issues.push(issue("operational_schema_unknown_deprecation_kind", { deprecation: row.id ?? "(missing)", kind: row.kind ?? null }));
    }
    if (!CUSTOMER_IMPACT_CLASSES.has(row.customerImpactClass)) {
      issues.push(
        issue("operational_schema_unknown_customer_impact_class", {
          deprecation: row.id ?? "(missing)",
          customerImpactClass: row.customerImpactClass ?? null,
        }),
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(row.firstDeprecatedOn ?? "")) {
      issues.push(issue("operational_schema_invalid_first_deprecated_date", { deprecation: row.id ?? "(missing)" }));
    }
    if (Date.parse(row.earliestRemovalBoundary ?? "") <= Date.parse(row.firstDeprecatedOn ?? "")) {
      issues.push(issue("operational_schema_invalid_removal_boundary", { deprecation: row.id ?? "(missing)" }));
    }
  }

  const openApiComparisons = new Set(config?.openApiParity?.requiredComparisons ?? []);
  for (const id of REQUIRED_OPENAPI_COMPARISONS) {
    if (!openApiComparisons.has(id)) issues.push(issue("operational_schema_missing_openapi_comparison", { id }));
  }
  for (const command of config?.openApiParity?.validationCommands ?? []) {
    requirePackageScript(scripts, command, issues, { source: "openApiParity.validationCommands" });
  }
  if (config?.openApiParity?.specPath && !fileExists(root, config.openApiParity.specPath)) {
    issues.push(issue("operational_schema_openapi_spec_missing", { path: config.openApiParity.specPath }));
  }
  if (config?.openApiParity?.routeInventoryPath && !fileExists(root, config.openApiParity.routeInventoryPath)) {
    issues.push(issue("operational_schema_openapi_route_inventory_missing", { path: config.openApiParity.routeInventoryPath }));
  }

  return issues;
}

function routePathToOpenApiPath(routePath) {
  return String(routePath)
    .replace(/\[\[\.\.\.([^\]]+)\]\]/gu, "{$1}")
    .replace(/\[\.\.\.([^\]]+)\]/gu, "{$1}")
    .replace(/\[([^\]]+)\]/gu, "{$1}");
}

function openApiOperations(openapi) {
  const rows = [];
  for (const [pathName, methods] of Object.entries(openapi?.paths ?? {})) {
    if (!methods || typeof methods !== "object") continue;
    for (const [method, operation] of Object.entries(methods)) {
      if (!HTTP_METHODS.has(method)) continue;
      rows.push({ path: pathName, method, operation: operation ?? {} });
    }
  }
  return rows.sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`));
}

function analyzeOpenApiRuntimeParity(root, config) {
  const issues = [];
  const specPath = config.openApiParity?.specPath ?? "openapi.yaml";
  const inventoryPath = config.openApiParity?.routeInventoryPath ?? "artifacts/routes/compatibility-route-inventory.json";
  const openapiText = read(root, specPath);
  const routeInventory = readJson(root, inventoryPath, null);
  let openapi = null;

  if (!openapiText) {
    issues.push(issue("operational_schema_openapi_missing", { path: specPath }));
  } else {
    try {
      openapi = parse(openapiText);
    } catch (error) {
      issues.push(issue("operational_schema_openapi_parse_error", { path: specPath, message: error.message }));
    }
  }

  if (!routeInventory) {
    issues.push(issue("operational_schema_route_inventory_missing", { path: inventoryPath }));
  }

  const routes = Array.isArray(routeInventory?.routes) ? routeInventory.routes : [];
  const operations = openApiOperations(openapi);
  const operationKeys = new Set(operations.map((row) => `${row.path}:${row.method}`));
  const routePaths = new Set(routes.map((route) => routePathToOpenApiPath(route.path)));
  const routeKeys = new Set(
    routes.flatMap((route) =>
      (route.methods ?? []).map((method) => `${routePathToOpenApiPath(route.path)}:${String(method).toLowerCase()}`),
    ),
  );

  const missingOperations = [];
  for (const route of routes) {
    const openapiPath = routePathToOpenApiPath(route.path);
    for (const method of route.methods ?? []) {
      const key = `${openapiPath}:${String(method).toLowerCase()}`;
      if (!operationKeys.has(key)) {
        missingOperations.push({ path: openapiPath, method: String(method).toLowerCase(), routeFile: route.routeFile });
      }
    }
  }

  const extraOperations = operations
    .filter((row) => row.path.startsWith("/api/") && !routePaths.has(row.path) && !routeKeys.has(`${row.path}:${row.method}`))
    .map((row) => ({ path: row.path, method: row.method }));

  const operationMetadataIssues = [];
  for (const row of operations) {
    const responses = row.operation?.responses && typeof row.operation.responses === "object" ? row.operation.responses : {};
    const responseStatuses = Object.keys(responses);
    if (typeof row.operation?.operationId !== "string" || row.operation.operationId.trim() === "") {
      operationMetadataIssues.push({ issue: "missing_operation_id", path: row.path, method: row.method });
    }
    if (typeof row.operation?.summary !== "string" || row.operation.summary.trim() === "") {
      operationMetadataIssues.push({ issue: "missing_summary", path: row.path, method: row.method });
    }
    if (typeof row.operation?.description !== "string" || row.operation.description.trim() === "") {
      operationMetadataIssues.push({ issue: "missing_description", path: row.path, method: row.method });
    }
    if (!Array.isArray(row.operation?.security)) {
      operationMetadataIssues.push({ issue: "missing_auth_notes", path: row.path, method: row.method });
    }
    if (responseStatuses.length === 0) {
      operationMetadataIssues.push({ issue: "missing_responses", path: row.path, method: row.method });
    }
    if (!responseStatuses.some((status) => /^4/u.test(status)) || !responseStatuses.some((status) => /^5/u.test(status))) {
      operationMetadataIssues.push({ issue: "missing_error_shape_responses", path: row.path, method: row.method });
    }
  }

  for (const row of missingOperations.slice(0, 20)) {
    issues.push(issue("operational_schema_openapi_missing_runtime_operation", row));
  }
  for (const row of extraOperations.slice(0, 20)) {
    issues.push(issue("operational_schema_openapi_extra_operation", row));
  }
  for (const row of operationMetadataIssues.slice(0, 20)) {
    issues.push(issue("operational_schema_openapi_operation_metadata_gap", row));
  }

  return {
    specPath,
    routeInventoryPath: inventoryPath,
    routeCount: routes.length,
    operationCount: operations.length,
    missingOperationCount: missingOperations.length,
    extraOperationCount: extraOperations.length,
    operationMetadataIssueCount: operationMetadataIssues.length,
    schemaOperationCount: operations.filter((row) => JSON.stringify(row.operation).includes('"schema"')).length,
    exampleOperationCount: operations.filter((row) => JSON.stringify(row.operation).includes('"example"')).length,
    deprecatedOperationCount: operations.filter((row) => row.operation?.deprecated === true).length,
    issueCount: issues.length,
    issues,
  };
}

function normalizeReport(id, report, extra = {}) {
  const issueCount = Number(report?.issueCount ?? report?.issues?.length ?? 0);
  return {
    id,
    ok: Boolean(report?.ok),
    issueCount,
    ...extra,
  };
}

function sourceReports(root) {
  const compatibilityRouteInventory = analyzeCompatibilityRouteInventory({ root });
  const compatibilityRemovalQueue = analyzeCompatibilityRemovalQueue({ root });
  const telemetryEventInventory = analyzeTelemetryEventInventory({ root });
  const versionedPublicContractPreservation = analyzeVersionedPublicContractPreservation({ root });
  const versionedPublicRuntimeDualRead = analyzeVersionedPublicRuntimeDualRead({ root });
  const versionedForwardMigrationReadiness = analyzeVersionedForwardMigrationReadiness({ root });
  const versionedSourceConfigPreservation = analyzeVersionedSourceConfigPreservation({ root });
  const versionedExportDownloadContracts = analyzeVersionedExportDownloadContracts({ root });
  const versionedPackageScriptReadiness = analyzeVersionedPackageScriptReadiness({ root });

  return {
    compatibilityRouteInventory,
    compatibilityRemovalQueue,
    telemetryEventInventory,
    versionedPublicContractPreservation,
    versionedPublicRuntimeDualRead,
    versionedForwardMigrationReadiness,
    versionedSourceConfigPreservation,
    versionedExportDownloadContracts,
    versionedPackageScriptReadiness,
  };
}

function sourceReportIssues(reports) {
  return Object.entries(reports).flatMap(([source, report]) => {
    const issueCount = Number(report?.issueCount ?? report?.issues?.length ?? 0);
    if (report?.ok !== false && issueCount === 0) return [];
    return [
      issue("operational_schema_source_report_issues", {
        source,
        issueCount,
        sampleIssues: (report?.issues ?? []).slice(0, 5),
      }),
    ];
  });
}

export function buildOperationalSchemaCompatibility(root = DEFAULT_ROOT) {
  const config = readJson(root, CONFIG_REL, null);
  const scripts = packageScripts(root);
  const issues = [];

  if (!config) {
    issues.push(issue("operational_schema_config_missing", { path: CONFIG_REL }));
  } else {
    issues.push(...validateConfig(root, config, scripts));
  }

  const reports = sourceReports(root);
  const openApiParity = config ? analyzeOpenApiRuntimeParity(root, config) : { issueCount: 1, issues: [] };
  issues.push(...sourceReportIssues(reports), ...(openApiParity.issues ?? []));

  const sourceReportSummaries = [
    normalizeReport("compatibility-route-inventory", reports.compatibilityRouteInventory, {
      routeCount: reports.compatibilityRouteInventory.currentRouteCount ?? reports.compatibilityRouteInventory.routeCount ?? null,
    }),
    normalizeReport("compatibility-removal-queue", reports.compatibilityRemovalQueue, {
      queueCount: reports.compatibilityRemovalQueue.queueCount ?? Object.keys(reports.compatibilityRemovalQueue.queues ?? {}).length,
    }),
    normalizeReport("telemetry-event-inventory", reports.telemetryEventInventory, {
      eventCount: reports.telemetryEventInventory.current?.eventCount ?? reports.telemetryEventInventory.eventCount ?? null,
    }),
    normalizeReport("versioned-public-contract-preservation", reports.versionedPublicContractPreservation, {
      contractCount: reports.versionedPublicContractPreservation.contractCount ?? null,
    }),
    normalizeReport("versioned-public-runtime-dual-read", reports.versionedPublicRuntimeDualRead, {
      familyCount: reports.versionedPublicRuntimeDualRead.current?.totals?.familyCount ?? reports.versionedPublicRuntimeDualRead.familyCount ?? null,
    }),
    normalizeReport("versioned-forward-migration-readiness", reports.versionedForwardMigrationReadiness, {
      rowCount: reports.versionedForwardMigrationReadiness.current?.totals?.rowCount ?? reports.versionedForwardMigrationReadiness.rowCount ?? null,
    }),
    normalizeReport("versioned-source-config-preservation", reports.versionedSourceConfigPreservation, {
      contractCount: reports.versionedSourceConfigPreservation.contractCount ?? null,
    }),
    normalizeReport("versioned-export-download-contracts", reports.versionedExportDownloadContracts, {
      contractCount: reports.versionedExportDownloadContracts.contractCount ?? null,
    }),
    normalizeReport("versioned-package-script-readiness", reports.versionedPackageScriptReadiness, {
      aliasCount: reports.versionedPackageScriptReadiness.current?.aliasCount ?? reports.versionedPackageScriptReadiness.aliasCount ?? null,
    }),
  ];

  const artifact = {
    schemaVersion: 1,
    generatedBy: "scripts/check-operational-schema-compatibility.mjs --write",
    policy:
      "Aggregate compatibility-sensitive persisted contracts from code-owned route, OpenAPI, telemetry, SQL, export, package-script, and compatibility queue evidence. Checklist docs are not configuration.",
    configSource: CONFIG_REL,
    sourceFiles: config?.sourceFiles ?? [],
    requiredValidationCommands: config?.requiredValidationCommands ?? [],
    totals: {
      contractSurfaceCount: config?.contractSurfaces?.length ?? 0,
      additiveGuardrailCount: config?.additiveSchemaGuardrails?.length ?? 0,
      dualReadTransitionCaseCount: config?.dualReadTransitionCases?.length ?? 0,
      deprecationContractCount: config?.deprecationContracts?.length ?? 0,
      sourceReportCount: sourceReportSummaries.length,
      openApiOperationCount: openApiParity.operationCount ?? 0,
      issueCount: issues.length,
    },
    contractSurfaces: (config?.contractSurfaces ?? []).map((row) => ({
      id: row.id,
      ownerArea: row.ownerArea,
      contractClass: row.contractClass,
      inventorySource: row.inventorySource,
      validationCommand: row.validationCommand,
      protectionEvidence: row.protectionEvidence,
    })),
    additiveSchemaGuardrails: config?.additiveSchemaGuardrails ?? [],
    dualReadTransitionCases: config?.dualReadTransitionCases ?? [],
    deprecationContracts: config?.deprecationContracts ?? [],
    openApiParity: {
      ...openApiParity,
      issues: undefined,
      requiredComparisons: config?.openApiParity?.requiredComparisons ?? [],
      validationCommands: config?.openApiParity?.validationCommands ?? [],
    },
    sourceReports: sourceReportSummaries,
    issueCount: issues.length,
    issues,
  };

  delete artifact.openApiParity.issues;
  return artifact;
}

export function analyzeOperationalSchemaCompatibility(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildOperationalSchemaCompatibility(root);
  const issues = [...current.issues];
  const artifact = readJson(root, artifactRel, null);

  if (!artifact) {
    issues.push(issue("operational_schema_artifact_missing", { path: artifactRel }));
  } else if (stableStringify(artifact) !== stableStringify(current)) {
    issues.push(issue("operational_schema_artifact_drift", { path: artifactRel, hint: "Run npm run write:operational-schema-compatibility" }));
  }

  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    contractSurfaceCount: current.totals.contractSurfaceCount,
    additiveGuardrailCount: current.totals.additiveGuardrailCount,
    dualReadTransitionCaseCount: current.totals.dualReadTransitionCaseCount,
    deprecationContractCount: current.totals.deprecationContractCount,
    openApiOperationCount: current.totals.openApiOperationCount,
    issueCount: issues.length,
    issues,
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

export function runOperationalSchemaCompatibility(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = buildOperationalSchemaCompatibility(options.root);
    writeJson(options.root, options.artifactRel, artifact);
    console.log(
      JSON.stringify(
        {
          ok: artifact.issueCount === 0,
          wrote: options.artifactRel,
          contractSurfaceCount: artifact.totals.contractSurfaceCount,
          issueCount: artifact.issueCount,
        },
        null,
        2,
      ),
    );
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }

  const report = analyzeOperationalSchemaCompatibility(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOperationalSchemaCompatibility();
}
