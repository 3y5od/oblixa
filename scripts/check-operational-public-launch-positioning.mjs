#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeMarketingIdentity } from "./audit-marketing-identity.mjs";
import { analyzeNextPublicSurface } from "./check-next-public-surface.mjs";
import { analyzePublicSeoSurface } from "./check-public-seo-surface.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-public-launch-positioning.json";
const ARTIFACT_REL = "artifacts/operational-public-launch-positioning.json";
const WRITE = process.argv.includes("--write");

const REQUIRED_LAUNCH_BOUNDARIES = new Set([
  "core-contract-tracking",
  "signed-agreements-only",
  "not-full-clm",
  "no-legal-advice",
  "no-grc-positioning",
  "no-autonomous-agent",
  "no-enterprise-assurance",
  "human-reviewed-ai",
  "early-access-assurance-workflows",
  "exportable-data",
]);

const REQUIRED_PRIVATE_SURFACE_RULES = new Set([
  "robots-private-disallow",
  "app-robots-preview-disallow",
  "sitemap-public-inventory",
  "proxy-public-policy",
  "generated-public-route-inventory",
  "public-nav-private-ban",
  "command-palette-private-results",
]);

const REQUIRED_CONVERSION_FLOWS = new Set([
  "contact-form",
  "contact-api",
  "contact-api-abuse-tests",
  "pricing-page",
  "signup-form",
  "password-recovery",
  "billing-checkout-handoff",
  "billing-portal-handoff",
  "dpa-security-contact",
]);

const REQUIRED_ASSET_METADATA = new Set([
  "canonical-url",
  "sitemap",
  "robots-private-disallow",
  "json-ld-safe-serialization",
  "opengraph-image",
  "twitter-image",
  "app-icon",
  "apple-icon",
  "public-logo",
  "metadata-route-inventory",
  "broken-link-smoke",
  "private-anchor-ban",
]);

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  if (!rel) return "";
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readBytes(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs) : null;
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

function packageScripts(root) {
  return readJson(root, "package.json", { scripts: {} })?.scripts ?? {};
}

function commandText(script) {
  return `npm run ${script}`;
}

function validationCommandExists(scripts, command) {
  if (typeof command !== "string" || !command.trim()) return false;
  if (scripts[command]) return true;
  if (command.startsWith("npm run ")) return Boolean(scripts[command.slice("npm run ".length)]);
  return false;
}

function validateCommands(root, config, scripts, issues) {
  const ci = read(root, ".github/workflows/ci.yml");
  const rows = [];

  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(scripts[script]);
      const ciPresent = ci.includes(commandText(script));
      if (!packageScriptPresent) {
        issues.push(issue("operational_public_launch_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_public_launch_missing_ci_command", { objective: objective.id, script }));
      }
      rows.push({
        objective: objective.id,
        script,
        ciRequired: Boolean(row.ciRequired),
        packageScriptPresent,
        ciPresent,
        covers: [...(row.covers ?? [])].sort((a, b) => a.localeCompare(b)),
      });
    }

    for (const rel of objective.artifacts ?? []) {
      if (rel !== ARTIFACT_REL && !fs.existsSync(path.join(root, rel))) {
        issues.push(issue("operational_public_launch_missing_objective_artifact", { objective: objective.id, path: rel }));
      }
    }
  }

  return rows.sort((a, b) => `${a.objective}:${a.script}`.localeCompare(`${b.objective}:${b.script}`));
}

export function validateMarkerRows(root, rows, requiredIds, issuePrefix, issues, scripts = packageScripts(root)) {
  const seen = new Set();
  const out = [];

  for (const row of rows ?? []) {
    const text = read(root, row.path);
    const missing = [];
    if (seen.has(row.id)) issues.push(issue(`${issuePrefix}_duplicate_id`, { id: row.id }));
    seen.add(row.id);
    if (typeof row.owner !== "string" || !row.owner.startsWith("@")) {
      issues.push(issue(`${issuePrefix}_missing_owner`, { id: row.id, owner: row.owner ?? null }));
    }
    if (!validationCommandExists(scripts, row.validationCommand)) {
      issues.push(issue(`${issuePrefix}_missing_validation_command`, {
        id: row.id,
        validationCommand: row.validationCommand ?? null,
      }));
    }
    if (!text && (row.markers?.length ?? 0) > 0) {
      missing.push(...row.markers);
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
    if (!seen.has(id)) issues.push(issue(`${issuePrefix}_missing_required_id`, { id }));
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function countConstStringArrayEntries(text, constName) {
  const start = text.indexOf(`export const ${constName} = [`);
  if (start < 0) return 0;
  const end = text.indexOf("] as const", start);
  if (end < 0) return 0;
  return [...text.slice(start, end).matchAll(/"([^"]+)"/g)].length;
}

function countObjectArrayIds(text, constName) {
  const start = text.indexOf(`export const ${constName}`);
  if (start < 0) return 0;
  const end = text.indexOf("] as const", start);
  if (end < 0) return 0;
  return [...text.slice(start, end).matchAll(/\bid:\s*"([^"]+)"/g)].length;
}

function analyzeRuntimeInventory(root, issues) {
  const text = read(root, "src/lib/marketing/operational-public-launch.ts");
  const launchBoundaryIdCount = countConstStringArrayEntries(text, "OPERATIONAL_PUBLIC_LAUNCH_BOUNDARY_IDS");
  const privateSurfaceIdCount = countConstStringArrayEntries(text, "OPERATIONAL_PRIVATE_SURFACE_IDS");
  const conversionFlowIdCount = countConstStringArrayEntries(text, "OPERATIONAL_CONVERSION_FLOW_IDS");
  const assetMetadataIdCount = countConstStringArrayEntries(text, "OPERATIONAL_MARKETING_ASSET_METADATA_IDS");
  const boundaryRegistryCount = countObjectArrayIds(text, "OPERATIONAL_PUBLIC_LAUNCH_BOUNDARIES");

  if (launchBoundaryIdCount < REQUIRED_LAUNCH_BOUNDARIES.size) {
    issues.push(issue("operational_public_launch_boundary_inventory_too_small", { launchBoundaryIdCount }));
  }
  if (privateSurfaceIdCount < 10) {
    issues.push(issue("operational_public_launch_private_surface_inventory_too_small", { privateSurfaceIdCount }));
  }
  if (conversionFlowIdCount < 8) {
    issues.push(issue("operational_public_launch_conversion_inventory_too_small", { conversionFlowIdCount }));
  }
  if (assetMetadataIdCount < REQUIRED_ASSET_METADATA.size) {
    issues.push(issue("operational_public_launch_asset_inventory_too_small", { assetMetadataIdCount }));
  }
  if (boundaryRegistryCount < REQUIRED_LAUNCH_BOUNDARIES.size) {
    issues.push(issue("operational_public_launch_boundary_registry_too_small", { boundaryRegistryCount }));
  }

  return {
    launchBoundaryIdCount,
    privateSurfaceIdCount,
    conversionFlowIdCount,
    assetMetadataIdCount,
    boundaryRegistryCount,
  };
}

function hasPngMagic(bytes) {
  return Boolean(
    bytes &&
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
  );
}

function analyzeAssetBudgets(root, config, issues) {
  const rows = [];
  for (const row of config.assetBudgets ?? []) {
    const bytes = readBytes(root, row.path);
    const exists = Boolean(bytes);
    const byteLength = bytes?.length ?? 0;
    const withinBudget = exists && byteLength <= row.maxBytes;
    const kindOk = !exists ? false : row.kind === "png" ? hasPngMagic(bytes) : /^[\x09\x0a\x0d\x20-\x7e]*$/u.test(bytes.toString("utf8"));
    if (!exists) issues.push(issue("operational_public_launch_asset_missing", { path: row.path }));
    if (exists && !withinBudget) {
      issues.push(issue("operational_public_launch_asset_budget_exceeded", {
        path: row.path,
        byteLength,
        maxBytes: row.maxBytes,
      }));
    }
    if (exists && !kindOk) {
      issues.push(issue("operational_public_launch_asset_kind_invalid", { path: row.path, kind: row.kind }));
    }
    rows.push({
      path: row.path,
      kind: row.kind,
      byteLength,
      maxBytes: row.maxBytes,
      exists,
      withinBudget,
      kindOk,
      ok: exists && withinBudget && kindOk,
    });
  }
  return rows;
}

function analyzeDelegatedChecks(root, issues) {
  const checks = [
    analyzeMarketingIdentity(root),
    analyzePublicSeoSurface(root),
    analyzeNextPublicSurface(root),
  ];

  for (const report of checks) {
    if (!report.ok) {
      issues.push(issue("operational_public_launch_delegated_check_failed", {
        checkId: report.checkId,
        issueCount: report.issueCount,
      }));
    }
  }

  return {
    rows: checks.map((report) => ({
      checkId: report.checkId,
      ok: report.ok,
      issueCount: report.issueCount,
    })),
  };
}

export function buildOperationalPublicLaunchPositioningReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL, {});
  const issues = [];
  const scripts = packageScripts(root);

  const commandCoverage = validateCommands(root, config, scripts, issues);
  const launchBoundaries = validateMarkerRows(
    root,
    config.launchBoundaries,
    REQUIRED_LAUNCH_BOUNDARIES,
    "operational_public_launch_boundary",
    issues,
    scripts
  );
  const privateSurfaceRules = validateMarkerRows(
    root,
    config.privateSurfaceRules,
    REQUIRED_PRIVATE_SURFACE_RULES,
    "operational_public_launch_private_surface",
    issues,
    scripts
  );
  const conversionFlows = validateMarkerRows(
    root,
    config.conversionFlows,
    REQUIRED_CONVERSION_FLOWS,
    "operational_public_launch_conversion",
    issues,
    scripts
  );
  const assetMetadata = validateMarkerRows(
    root,
    config.assetMetadata,
    REQUIRED_ASSET_METADATA,
    "operational_public_launch_asset_metadata",
    issues,
    scripts
  );
  const runtimeInventory = analyzeRuntimeInventory(root, issues);
  const assetBudgets = analyzeAssetBudgets(root, config, issues);
  const delegatedChecks = analyzeDelegatedChecks(root, issues);

  const report = {
    ok: issues.length === 0,
    schemaVersion: config.schemaVersion ?? 1,
    source: config.source ?? "code-owned-operational-public-launch-positioning",
    generatedFrom: CONFIG_REL,
    manualBoundary: config.manualBoundary ?? null,
    objectiveCount: config.objectives?.length ?? 0,
    commandCoverage,
    launchBoundaries,
    privateSurfaceRules,
    conversionFlows,
    assetMetadata,
    runtimeInventory,
    assetBudgets,
    delegatedChecks,
    issueCount: issues.length,
    issues,
  };

  return report;
}

function main() {
  const report = buildOperationalPublicLaunchPositioningReport(ROOT);
  if (WRITE) {
    writeJson(ROOT, ARTIFACT_REL, {
      ...report,
      generatedBy: "scripts/check-operational-public-launch-positioning.mjs --write",
    });
  } else {
    const existing = readJson(ROOT, ARTIFACT_REL, null);
    if (!existing) {
      report.ok = false;
      report.issues.push(issue("operational_public_launch_artifact_missing", { path: ARTIFACT_REL }));
      report.issueCount = report.issues.length;
    } else {
      const expected = stableStringify({
        ...report,
        generatedBy: "scripts/check-operational-public-launch-positioning.mjs --write",
      });
      const actual = stableStringify(existing);
      if (expected !== actual) {
        report.ok = false;
        report.issues.push(issue("operational_public_launch_artifact_drift", { path: ARTIFACT_REL }));
        report.issueCount = report.issues.length;
      }
    }
  }

  console.log(stableStringify(report));
  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
