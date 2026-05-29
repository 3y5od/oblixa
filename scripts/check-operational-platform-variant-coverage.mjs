#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeVersionedExportDownloadContracts } from "./check-versioned-export-download-contracts.mjs";
import { uiSurfaceManifest } from "../src/lib/qa/ui-surface-manifest.source.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-platform-variant-coverage.json";
const ARTIFACT_REL = "artifacts/operational-platform-variant-coverage.json";
const WRITE = process.argv.includes("--write");

const REQUIRED_BROWSER_DIMENSIONS = new Set([
  "chromium",
  "firefox",
  "webkit",
  "reduced-motion",
  "color-scheme",
  "timezone",
  "locale",
  "device-scale-factor",
  "mobile-viewport",
  "tablet-viewport",
  "desktop-viewport",
]);

const REQUIRED_WEBVIEW_PLATFORMS = new Set(["ios-wkwebview", "android-webview"]);
const REQUIRED_WEBVIEW_CONSTRAINTS = new Set(["storage", "cookies", "redirects", "downloads", "file_uploads"]);

const REQUIRED_INPUT_VARIANTS = new Set([
  "keyboard",
  "pointer",
  "touch",
  "screen-reader-semantics",
  "ime-input",
  "paste",
  "drag-drop",
  "high-contrast",
  "platform-permissions",
]);

const REQUIRED_DOWNLOAD_CLASSES = new Set([
  "csv",
  "pdf",
  "generated-reports",
  "signed-links",
  "browser-download-names",
  "content-type",
  "content-disposition",
]);

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  if (!rel) return "";
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel, fallback = null) {
  const text = read(root, rel);
  return text ? JSON.parse(text) : fallback;
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function commandText(script) {
  return `npm run ${script}`;
}

function collectPackageScripts(root) {
  return readJson(root, "package.json", { scripts: {} })?.scripts ?? {};
}

function collectPipelineText(root) {
  return [
    ".github/workflows/qa-max-nightly.yml",
    "config/qa-tier-manifest.json",
    "scripts/pipelines/pipeline-qa-code-maximal.mjs",
    "scripts/pipelines/pipeline-verify.mjs",
    "scripts/pipelines/pipeline-ci-build-e2e-local.mjs",
  ]
    .map((rel) => read(root, rel))
    .join("\n");
}

function validationCommandExists(packageScripts, command) {
  if (typeof command !== "string" || !command.trim()) return false;
  if (packageScripts[command]) return true;
  if (command.startsWith("npm run ")) return Boolean(packageScripts[command.slice("npm run ".length)]);
  return false;
}

function activeWaiverIds(root) {
  const registry = readJson(root, "config/qa-external-waiver-registry.json", { waivers: [] });
  const rows = Array.isArray(registry?.waivers) ? registry.waivers : [];
  return new Map(rows.map((row) => [row.id, row]));
}

function validateCommands(root, config, packageScripts, issues) {
  const ci = read(root, ".github/workflows/ci.yml");
  const pipelineText = collectPipelineText(root);
  const rows = [];

  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(packageScripts[script]);
      const ciPresent = ci.includes(commandText(script));
      const qaPipelinePresent = pipelineText.includes(`"${script}"`) || pipelineText.includes(commandText(script));
      if (!packageScriptPresent) {
        issues.push(issue("operational_platform_variant_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_platform_variant_missing_ci_command", { objective: objective.id, script }));
      }
      if (row.qaPipelineRequired && !qaPipelinePresent) {
        issues.push(issue("operational_platform_variant_missing_qa_pipeline_step", { objective: objective.id, script }));
      }
      rows.push({
        objective: objective.id,
        script,
        ciRequired: Boolean(row.ciRequired),
        packageScriptPresent,
        ciPresent,
        qaPipelineRequired: Boolean(row.qaPipelineRequired),
        qaPipelinePresent: row.qaPipelineRequired ? qaPipelinePresent : null,
        covers: [...(row.covers ?? [])].sort((a, b) => a.localeCompare(b)),
      });
    }

    for (const rel of objective.artifacts ?? []) {
      if (rel !== ARTIFACT_REL && !fs.existsSync(path.join(root, rel))) {
        issues.push(issue("operational_platform_variant_missing_objective_artifact", { objective: objective.id, path: rel }));
      }
    }
  }

  return rows.sort((a, b) => `${a.objective}:${a.script}`.localeCompare(`${b.objective}:${b.script}`));
}

export function validateMarkerRows(root, rows, requiredIds, issuePrefix, issues, packageScripts = collectPackageScripts(root)) {
  const seen = new Set();
  const out = [];

  for (const row of rows ?? []) {
    const text = read(root, row.path);
    const missing = [];
    if (seen.has(row.id)) {
      issues.push(issue(`${issuePrefix}_duplicate_id`, { id: row.id }));
    }
    seen.add(row.id);
    if (typeof row.owner !== "string" || !row.owner.startsWith("@")) {
      issues.push(issue(`${issuePrefix}_missing_owner`, { id: row.id, owner: row.owner ?? null }));
    }
    if (!validationCommandExists(packageScripts, row.validationCommand)) {
      issues.push(issue(`${issuePrefix}_missing_validation_command`, { id: row.id, validationCommand: row.validationCommand ?? null }));
    }
    if (!text) {
      missing.push(...(row.markers ?? []));
      issues.push(issue(`${issuePrefix}_missing_file`, { id: row.id, path: row.path }));
    } else {
      for (const marker of row.markers ?? []) {
        if (!text.includes(marker)) {
          missing.push(marker);
          issues.push(issue(`${issuePrefix}_missing_marker`, { id: row.id, path: row.path, marker }));
        }
      }
    }
    out.push({
      id: row.id,
      path: row.path,
      owner: row.owner ?? null,
      validationCommand: row.validationCommand ?? null,
      markerCount: row.markers?.length ?? 0,
      missingCount: missing.length,
      ok: missing.length === 0,
    });
  }

  for (const id of requiredIds) {
    if (!seen.has(id)) {
      issues.push(issue(`${issuePrefix}_missing_required_id`, { id }));
    }
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function parsePlaywrightProjectNames(configText) {
  return [...configText.matchAll(/\{\s*name:\s*"([^"]+)"/g)].map((match) => match[1]).sort((a, b) => a.localeCompare(b));
}

function analyzeBrowserMatrix(root, config, packageScripts, issues) {
  const matrix = readJson(root, config.browserMatrixPolicy?.projectInventory, { projects: [] });
  const playwrightConfig = read(root, config.browserMatrixPolicy?.playwrightConfig);
  const artifactProjects = new Set((matrix.projects ?? []).map((row) => row.name));
  const artifactEngines = new Set((matrix.projects ?? []).map((row) => row.engine));
  const configProjects = new Set(parsePlaywrightProjectNames(playwrightConfig));

  for (const project of config.browserMatrixPolicy?.requiredProjects ?? []) {
    if (!artifactProjects.has(project)) {
      issues.push(issue("operational_platform_variant_missing_browser_matrix_project", { project }));
    }
    if (!configProjects.has(project)) {
      issues.push(issue("operational_platform_variant_missing_playwright_project", { project }));
    }
  }

  for (const engine of config.browserMatrixPolicy?.requiredEngines ?? []) {
    if (!artifactEngines.has(engine)) {
      issues.push(issue("operational_platform_variant_missing_browser_engine", { engine }));
    }
  }

  const dimensions = validateMarkerRows(
    root,
    config.browserMatrixPolicy?.requiredDimensions ?? [],
    REQUIRED_BROWSER_DIMENSIONS,
    "operational_platform_variant_browser_dimension",
    issues,
    packageScripts
  );

  return {
    projectInventory: config.browserMatrixPolicy?.projectInventory ?? null,
    requiredProjectCount: config.browserMatrixPolicy?.requiredProjects?.length ?? 0,
    artifactProjectCount: artifactProjects.size,
    playwrightProjectCount: configProjects.size,
    artifactProjects: [...artifactProjects].sort((a, b) => a.localeCompare(b)),
    playwrightProjects: [...configProjects],
    requiredEngines: [...(config.browserMatrixPolicy?.requiredEngines ?? [])].sort((a, b) => a.localeCompare(b)),
    dimensions,
  };
}

export function summarizeRouteFamilyPolicies(routeManifest, policies, waiverRows, packageScripts, issues) {
  const familyStats = new Map();
  for (const row of routeManifest) {
    const stats = familyStats.get(row.routeFamily) ?? { family: row.routeFamily, routeCount: 0, multiBrowserRouteCount: 0 };
    stats.routeCount += 1;
    if (row.coverage?.includes("multi_browser")) stats.multiBrowserRouteCount += 1;
    familyStats.set(row.routeFamily, stats);
  }

  const policyByFamily = new Map((policies ?? []).map((row) => [row.family, row]));
  for (const family of familyStats.keys()) {
    if (!policyByFamily.has(family)) {
      issues.push(issue("operational_platform_variant_route_family_missing_policy", { family }));
    }
  }

  const rows = [];
  for (const stats of [...familyStats.values()].sort((a, b) => a.family.localeCompare(b.family))) {
    const policy = policyByFamily.get(stats.family);
    if (!policy) {
      rows.push({ ...stats, supportLevel: null, owner: null, validationCommand: null, waiverId: null, ok: false });
      continue;
    }
    if (typeof policy.owner !== "string" || !policy.owner.startsWith("@")) {
      issues.push(issue("operational_platform_variant_route_family_missing_owner", { family: stats.family }));
    }
    if (!validationCommandExists(packageScripts, policy.validationCommand)) {
      issues.push(issue("operational_platform_variant_route_family_missing_validation_command", {
        family: stats.family,
        validationCommand: policy.validationCommand ?? null,
      }));
    }
    if (stats.multiBrowserRouteCount === 0) {
      if (!policy.waiverId) {
        issues.push(issue("operational_platform_variant_route_family_no_multibrowser_or_waiver", { family: stats.family }));
      } else if (!waiverRows.has(policy.waiverId)) {
        issues.push(issue("operational_platform_variant_route_family_missing_waiver", {
          family: stats.family,
          waiverId: policy.waiverId,
        }));
      }
    }
    rows.push({
      ...stats,
      supportLevel: policy.supportLevel ?? null,
      owner: policy.owner ?? null,
      validationCommand: policy.validationCommand ?? null,
      waiverId: policy.waiverId ?? null,
      ok: stats.multiBrowserRouteCount > 0 || Boolean(policy.waiverId && waiverRows.has(policy.waiverId)),
    });
  }
  return rows;
}

function analyzeWebViewReadiness(root, config, packageScripts, waiverRows, issues) {
  const webview = config.webViewReadiness ?? {};
  const evidence = validateMarkerRows(
    root,
    webview.notSupportedEvidence ?? [],
    new Set(),
    "operational_platform_variant_webview_evidence",
    issues,
    packageScripts
  );

  const seen = new Set();
  const platforms = [];
  for (const row of webview.platforms ?? []) {
    seen.add(row.id);
    const workflowText = read(root, row.workflow);
    const missingConstraints = [...REQUIRED_WEBVIEW_CONSTRAINTS].filter((constraint) => !row.constraints?.includes(constraint));
    if (missingConstraints.length > 0) {
      issues.push(issue("operational_platform_variant_webview_missing_constraints", { id: row.id, missingConstraints }));
    }
    if (!["supported", "stubbed_optional", "explicitly_not_supported"].includes(row.supportStatus)) {
      issues.push(issue("operational_platform_variant_webview_invalid_support_status", { id: row.id, supportStatus: row.supportStatus ?? null }));
    }
    if (row.supportStatus !== "supported" && (!row.rationale || !row.waiverId)) {
      issues.push(issue("operational_platform_variant_webview_missing_boundary_metadata", { id: row.id }));
    }
    if (row.waiverId && !waiverRows.has(row.waiverId)) {
      issues.push(issue("operational_platform_variant_webview_missing_waiver", { id: row.id, waiverId: row.waiverId }));
    }
    const missingMarkers = [];
    if (!workflowText) {
      issues.push(issue("operational_platform_variant_webview_missing_workflow", { id: row.id, workflow: row.workflow }));
      missingMarkers.push(...(row.markers ?? []));
    } else {
      for (const marker of row.markers ?? []) {
        if (!workflowText.includes(marker)) {
          missingMarkers.push(marker);
          issues.push(issue("operational_platform_variant_webview_missing_marker", { id: row.id, workflow: row.workflow, marker }));
        }
      }
    }
    platforms.push({
      id: row.id,
      supportStatus: row.supportStatus,
      owner: row.owner ?? null,
      workflow: row.workflow,
      waiverId: row.waiverId ?? null,
      constraintCount: row.constraints?.length ?? 0,
      missingConstraintCount: missingConstraints.length,
      missingMarkerCount: missingMarkers.length,
      ok: missingConstraints.length === 0 && missingMarkers.length === 0,
    });
  }

  for (const id of REQUIRED_WEBVIEW_PLATFORMS) {
    if (!seen.has(id)) {
      issues.push(issue("operational_platform_variant_webview_missing_required_platform", { id }));
    }
  }

  return {
    supportPolicy: webview.supportPolicy ?? null,
    requiredConstraints: [...REQUIRED_WEBVIEW_CONSTRAINTS].sort((a, b) => a.localeCompare(b)),
    evidence,
    platforms: platforms.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function analyzeDelegatedReports(root, issues) {
  const exportDownloadContracts = analyzeVersionedExportDownloadContracts({ root });
  if (!exportDownloadContracts.ok) {
    issues.push(issue("operational_platform_variant_delegated_check_failed", {
      checkId: "versioned-export-download-contracts",
      issueCount: exportDownloadContracts.issueCount,
    }));
  }

  return [
    {
      checkId: "versioned-export-download-contracts",
      ok: exportDownloadContracts.ok,
      issueCount: exportDownloadContracts.issueCount,
      contractCount: exportDownloadContracts.contractCount,
      categoryCount: exportDownloadContracts.categoryCount,
    },
  ];
}

export function buildOperationalPlatformVariantCoverageReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL, {});
  const packageScripts = collectPackageScripts(root);
  const waiverRows = activeWaiverIds(root);
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-platform-variant-coverage") {
    issues.push(issue("operational_platform_variant_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, packageScripts, issues);
  const browserMatrix = analyzeBrowserMatrix(root, config, packageScripts, issues);
  const routeFamilyPolicies = summarizeRouteFamilyPolicies(
    uiSurfaceManifest,
    config.routeFamilyPolicies ?? [],
    waiverRows,
    packageScripts,
    issues
  );
  const webViewReadiness = analyzeWebViewReadiness(root, config, packageScripts, waiverRows, issues);
  const osInputVariantChecks = validateMarkerRows(
    root,
    config.osInputVariantChecks,
    REQUIRED_INPUT_VARIANTS,
    "operational_platform_variant_input",
    issues,
    packageScripts
  );
  const downloadFileOpenBehavior = validateMarkerRows(
    root,
    config.downloadFileOpenBehavior,
    REQUIRED_DOWNLOAD_CLASSES,
    "operational_platform_variant_download",
    issues,
    packageScripts
  );
  const delegatedChecks = analyzeDelegatedReports(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-platform-variant-coverage",
    generatedBy: "scripts/check-operational-platform-variant-coverage.mjs --write",
    generatedFrom: CONFIG_REL,
    commandCount: commands.length,
    routeFamilyPolicyCount: routeFamilyPolicies.length,
    browserDimensionCount: browserMatrix.dimensions.length,
    webViewPlatformCount: webViewReadiness.platforms.length,
    osInputVariantCount: osInputVariantChecks.length,
    downloadBehaviorCount: downloadFileOpenBehavior.length,
    delegatedCheckCount: delegatedChecks.length,
    commands,
    browserMatrix,
    routeFamilyPolicies,
    webViewReadiness,
    osInputVariantChecks,
    downloadFileOpenBehavior,
    delegatedChecks,
    manualBoundary: config.manualBoundary ?? null,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalPlatformVariantCoverage(root = ROOT) {
  const report = buildOperationalPlatformVariantCoverageReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_platform_variant_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_platform_variant_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-platform-variant-coverage",
    }));
  }

  return {
    ...report,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (WRITE) {
    const report = buildOperationalPlatformVariantCoverageReport();
    fs.mkdirSync(path.dirname(path.join(ROOT, ARTIFACT_REL)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, ARTIFACT_REL), stableStringify(report));
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  }

  const report = analyzeOperationalPlatformVariantCoverage();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
