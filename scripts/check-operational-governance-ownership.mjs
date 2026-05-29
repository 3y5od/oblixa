#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeChangeImpact, RISK_AREAS } from "./check-ci-change-impact.mjs";
import { analyzeCodeownersSecurityPaths } from "./check-codeowners-security-paths.mjs";
import {
  DETERMINISTIC_GENERATED_ARTIFACT_PATHS,
  GENERATED_ARTIFACT_HYGIENE_PATHS,
  GENERATED_ARTIFACT_WRITE_COMMANDS,
} from "./check-generated-artifact-hygiene.mjs";

const DEFAULT_ROOT = process.cwd();
const CONFIG_REL = "config/operational-governance-ownership.json";
const ARTIFACT_REL = "artifacts/operational-governance-ownership.json";
const WRITE = process.argv.includes("--write");

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel, fallback = undefined) {
  const text = read(root, rel);
  if (!text) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing JSON file: ${rel}`);
  }
  return JSON.parse(text);
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined).map(String))].sort((a, b) => a.localeCompare(b));
}

function normalizeCommandRef(command) {
  return String(command ?? "").trim().replace(/^npm\s+run\s+/u, "");
}

function commandExists(packageScripts, command) {
  const script = normalizeCommandRef(command);
  return Boolean(packageScripts[script]);
}

function normalizeRel(rel) {
  return String(rel ?? "").replace(/\\/gu, "/").replace(/^\.\/+/u, "").replace(/^\/+/u, "");
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");
}

function globToRegExp(glob) {
  let out = "";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    const next = glob[index + 1];
    if (char === "*" && next === "*") {
      out += ".*";
      index += 1;
    } else if (char === "*") {
      out += "[^/]*";
    } else {
      out += escapeRegExp(char);
    }
  }
  return new RegExp(`^${out}$`, "u");
}

function parseCodeowners(raw) {
  return String(raw ?? "")
    .split("\n")
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return null;
      const parts = trimmed.split(/\s+/u);
      return { line: index + 1, pattern: parts[0], owners: parts.slice(1).filter(Boolean) };
    })
    .filter(Boolean);
}

function codeownersPatternMatches(pattern, relPath) {
  const rel = normalizeRel(relPath);
  const rawPattern = String(pattern ?? "").trim();
  if (!rawPattern || rawPattern.startsWith("!")) return false;
  const rootAnchored = rawPattern.startsWith("/");
  const normalized = normalizeRel(rawPattern);
  if (normalized.endsWith("/")) return rel.startsWith(normalized);
  if (normalized.includes("*")) {
    if (globToRegExp(normalized).test(rel)) return true;
    return !rootAnchored && globToRegExp(`**/${normalized}`).test(rel);
  }
  if (!rootAnchored && !normalized.includes("/")) return rel === normalized || rel.endsWith(`/${normalized}`);
  return rel === normalized || rel.startsWith(`${normalized}/`);
}

function findCodeownerCoverage(entries, relPath) {
  return entries.filter((entry) => codeownersPatternMatches(entry.pattern, relPath));
}

function pathExists(root, relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function ownerAreaMaps(config) {
  const ownerAreas = config.ownerAreas ?? [];
  const byId = new Map(ownerAreas.map((row) => [row.id, row]));
  const canonicalByOperationalOwner = new Map();
  const canonicalByRouteOwner = new Map();
  for (const row of ownerAreas) {
    for (const ownerArea of row.coveredOwnerAreas ?? []) canonicalByOperationalOwner.set(ownerArea, row.id);
    for (const routeOwner of row.routeOwners ?? []) canonicalByRouteOwner.set(routeOwner, row.id);
  }
  return { byId, canonicalByOperationalOwner, canonicalByRouteOwner };
}

function validateConfigShape(config, packageScripts, issues) {
  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-governance-ownership") {
    issues.push(issue("operational_governance_invalid_config_identity"));
  }
  if (config.generatedArtifact !== ARTIFACT_REL) {
    issues.push(issue("operational_governance_unexpected_generated_artifact", { generatedArtifact: config.generatedArtifact ?? null }));
  }

  const ownerAreaIds = new Set((config.ownerAreas ?? []).map((row) => row.id));
  for (const required of config.requiredOwnerAreaIds ?? []) {
    if (!ownerAreaIds.has(required)) issues.push(issue("operational_governance_missing_required_owner_area", { ownerArea: required }));
  }

  const allCommands = [
    ...(config.requiredCommands ?? []),
    ...(config.ownerAreas ?? []).flatMap((row) => row.validationCommands ?? []),
    ...(config.routeFamilyOwners ?? []).map((row) => row.validationCommand),
    ...(config.providerOwners ?? []).map((row) => row.validationCommand),
    ...(config.reportChecksums?.reports ?? []).map((row) => row.generator),
  ].filter(Boolean);

  for (const command of uniqueSorted(allCommands)) {
    if (!commandExists(packageScripts, command)) {
      issues.push(issue("operational_governance_unknown_validation_command", { command: normalizeCommandRef(command) }));
    }
  }

  const categories = new Set((config.sensitivePathOwners ?? []).map((row) => row.category));
  for (const required of config.requiredSensitivePathCategories ?? []) {
    if (!categories.has(required)) {
      issues.push(issue("operational_governance_missing_sensitive_path_category", { category: required }));
    }
  }
}

function validateObjectiveOwners(root, config, ownerMaps, issues) {
  const objectiveConfig = readJson(root, "config/operational-hardening-objectives.json", { objectives: [] });
  const rows = (objectiveConfig.objectives ?? []).map((objective) => {
    const canonicalOwnerArea = ownerMaps.canonicalByOperationalOwner.get(objective.ownerArea) ?? null;
    if (!canonicalOwnerArea) {
      issues.push(issue("operational_governance_objective_missing_owner_mapping", { id: objective.id, ownerArea: objective.ownerArea ?? null }));
    }
    return {
      id: objective.id,
      section: objective.section,
      ownerArea: objective.ownerArea ?? null,
      canonicalOwnerArea,
      status: objective.status,
      validationCommand: objective.validationCommand,
    };
  });
  return {
    objectiveCount: rows.length,
    coveredObjectiveCount: rows.filter((row) => row.canonicalOwnerArea).length,
    ownerAreaCount: uniqueSorted(rows.map((row) => row.ownerArea)).length,
    rows,
  };
}

function validateRouteAndProviderOwners(root, config, ownerMaps, issues) {
  const routeUniverse = readJson(root, "artifacts/route-universe.json", { routes: [] });
  const routes = routeUniverse.routes ?? [];
  const routeFamilyOwners = new Map((config.routeFamilyOwners ?? []).map((row) => [row.family, row]));
  const providerOwners = new Map((config.providerOwners ?? []).map((row) => [row.provider, row]));

  const routeOwnerRows = uniqueSorted(routes.map((row) => row.owner)).map((routeOwner) => {
    const canonicalOwnerArea = ownerMaps.canonicalByRouteOwner.get(routeOwner) ?? null;
    if (!canonicalOwnerArea) issues.push(issue("operational_governance_route_owner_missing_mapping", { routeOwner }));
    return { routeOwner, canonicalOwnerArea };
  });

  const routeFamilyRows = uniqueSorted(routes.map((row) => row.class)).map((family) => {
    const owner = routeFamilyOwners.get(family) ?? null;
    if (!owner) issues.push(issue("operational_governance_route_family_missing_owner", { family }));
    if (owner && !ownerMaps.byId.has(owner.ownerArea)) {
      issues.push(issue("operational_governance_route_family_unknown_owner_area", { family, ownerArea: owner.ownerArea }));
    }
    return {
      family,
      ownerArea: owner?.ownerArea ?? null,
      validationCommand: owner?.validationCommand ?? null,
      routeCount: routes.filter((route) => route.class === family).length,
    };
  });

  const providerRows = uniqueSorted(routes.flatMap((row) => row.providers ?? [])).map((provider) => {
    const owner = providerOwners.get(provider) ?? null;
    if (!owner) issues.push(issue("operational_governance_provider_missing_owner", { provider }));
    if (owner && !ownerMaps.byId.has(owner.ownerArea)) {
      issues.push(issue("operational_governance_provider_unknown_owner_area", { provider, ownerArea: owner.ownerArea }));
    }
    return {
      provider,
      ownerArea: owner?.ownerArea ?? null,
      validationCommand: owner?.validationCommand ?? null,
      routeCount: routes.filter((route) => (route.providers ?? []).includes(provider)).length,
    };
  });

  return {
    routeCount: routes.length,
    routeOwnerCount: routeOwnerRows.length,
    routeFamilyCount: routeFamilyRows.length,
    providerCount: providerRows.length,
    routeOwners: routeOwnerRows,
    routeFamilies: routeFamilyRows,
    providers: providerRows,
  };
}

function ownerForGeneratedPath(rel, ownerRules) {
  return ownerRules.find((row) => rel === row.prefix || rel.startsWith(row.prefix)) ?? null;
}

function validateGeneratedArtifactOwners(root, config, ownerMaps, issues, options = {}) {
  const packagePipeline = readJson(root, "config/operational-package-pipelines.json", { generatedArtifactOwnerRules: [] });
  const ownerRules = packagePipeline.generatedArtifactOwnerRules ?? packagePipeline.generatedArtifactOwnership ?? [];
  const artifactPaths = uniqueSorted(options.generatedArtifactPaths ?? [...GENERATED_ARTIFACT_HYGIENE_PATHS, ...DETERMINISTIC_GENERATED_ARTIFACT_PATHS]);
  const deterministic = new Set(options.deterministicArtifactPaths ?? DETERMINISTIC_GENERATED_ARTIFACT_PATHS);
  const writeCommands = options.generatedArtifactWriteCommands ?? GENERATED_ARTIFACT_WRITE_COMMANDS;

  const rows = artifactPaths.map((artifactPath) => {
    const owner = ownerForGeneratedPath(artifactPath, ownerRules);
    const canonicalOwnerArea = owner ? ownerMaps.canonicalByOperationalOwner.get(owner.ownerArea) ?? null : null;
    const writeCommand = writeCommands[artifactPath] ?? null;
    if (!owner) issues.push(issue("operational_governance_generated_artifact_missing_owner", { path: artifactPath }));
    if (owner && !canonicalOwnerArea) {
      issues.push(issue("operational_governance_generated_artifact_unknown_owner_area", { path: artifactPath, ownerArea: owner.ownerArea }));
    }
    if (deterministic.has(artifactPath) && !writeCommand) {
      issues.push(issue("operational_governance_generated_artifact_missing_write_command", { path: artifactPath }));
    }
    return {
      path: artifactPath,
      deterministic: deterministic.has(artifactPath),
      writeCommand,
      ownerArea: owner?.ownerArea ?? null,
      canonicalOwnerArea,
      cleanupPolicy: owner?.cleanupPolicy ?? null,
    };
  });

  return {
    generatedArtifactCount: rows.length,
    deterministicArtifactCount: rows.filter((row) => row.deterministic).length,
    ownedArtifactCount: rows.filter((row) => row.ownerArea).length,
    canonicalOwnerMappedCount: rows.filter((row) => row.canonicalOwnerArea).length,
    rows,
  };
}

function analyzeCodeownersParity(root, config, ownerMaps, issues) {
  const raw = read(root, ".github/CODEOWNERS");
  const entries = parseCodeowners(raw);
  const delegated = analyzeCodeownersSecurityPaths(root);
  if (!delegated.ok) {
    issues.push(issue("operational_governance_codeowners_security_paths_failed", { issueCount: delegated.issueCount }));
  }

  const rows = (config.sensitivePathOwners ?? []).map((row) => {
    const ownerArea = ownerMaps.byId.get(row.ownerArea);
    const expectedOwners = ownerArea?.codeowners ?? [];
    const covering = findCodeownerCoverage(entries, row.path);
    const owners = uniqueSorted(covering.flatMap((entry) => entry.owners));
    const expectedOwnerCovered = expectedOwners.some((owner) => owners.includes(owner));
    const exists = pathExists(root, row.path);
    if (!exists) issues.push(issue("operational_governance_sensitive_path_missing", { path: row.path, category: row.category }));
    if (!ownerArea) issues.push(issue("operational_governance_sensitive_path_unknown_owner_area", { path: row.path, ownerArea: row.ownerArea }));
    if (covering.length === 0) issues.push(issue("operational_governance_sensitive_path_missing_codeowners", { path: row.path, category: row.category }));
    if (covering.length > 0 && !expectedOwnerCovered) {
      issues.push(issue("operational_governance_sensitive_path_owner_mismatch", { path: row.path, ownerArea: row.ownerArea, expectedOwners, owners }));
    }
    return {
      category: row.category,
      path: row.path,
      exists,
      ownerArea: row.ownerArea,
      expectedOwners,
      coveringPatterns: covering.map((entry) => entry.pattern),
      owners,
      expectedOwnerCovered,
      reason: row.reason,
    };
  });

  return {
    codeownersEntryCount: entries.length,
    sensitivePathCount: rows.length,
    coveredSensitivePathCount: rows.filter((row) => row.coveringPatterns.length > 0 && row.expectedOwnerCovered).length,
    delegatedSecurityPathCheck: {
      ok: delegated.ok,
      issueCount: delegated.issueCount,
      checkedPathCount: delegated.checkedPathCount ?? 0,
      allowlistFileCount: delegated.allowlistFileCount ?? 0,
    },
    rows,
  };
}

function analyzeChangeImpactRecommendations(config, issues) {
  const riskAreaIds = new Set(RISK_AREAS.map((row) => row.id));
  for (const area of config.changeImpact?.requiredRiskAreas ?? []) {
    if (!riskAreaIds.has(area)) issues.push(issue("operational_governance_change_impact_missing_risk_area", { area }));
  }

  const syntheticEntries = (config.changeImpact?.syntheticChanges ?? []).map((row) => ({ status: "M", path: row.path }));
  const synthetic = analyzeChangeImpact({ entries: syntheticEntries, strict: false });
  const changedByPath = new Map((synthetic.changed ?? []).map((row) => [row.path, row]));
  const rows = (config.changeImpact?.syntheticChanges ?? []).map((row) => {
    const changed = changedByPath.get(row.path);
    const actualRiskAreas = changed?.riskAreas ?? [];
    const actualChecks = changed?.requiredChecks ?? [];
    for (const expected of row.expectedRiskAreas ?? []) {
      if (!actualRiskAreas.includes(expected)) {
        issues.push(issue("operational_governance_change_impact_missing_expected_area", { path: row.path, expected }));
      }
    }
    for (const expected of row.expectedChecks ?? []) {
      if (!actualChecks.includes(expected)) {
        issues.push(issue("operational_governance_change_impact_missing_expected_check", { path: row.path, expected }));
      }
    }
    return {
      path: row.path,
      expectedRiskAreas: row.expectedRiskAreas ?? [],
      actualRiskAreas,
      expectedChecks: row.expectedChecks ?? [],
      actualChecks,
    };
  });

  const warningSample = analyzeChangeImpact({ entries: [{ status: "M", path: "unclassified/manual-review-required.asset" }], strict: false });
  if (!synthetic.prSummary?.markdown?.includes("Recommended validation:")) {
    issues.push(issue("operational_governance_change_impact_missing_pr_summary_recommendations"));
  }
  if (!Array.isArray(warningSample.prSummary?.missingEvidenceWarnings) || warningSample.prSummary.missingEvidenceWarnings.length === 0) {
    issues.push(issue("operational_governance_change_impact_missing_evidence_warnings"));
  }

  return {
    riskAreaCount: riskAreaIds.size,
    requiredRiskAreas: config.changeImpact?.requiredRiskAreas ?? [],
    syntheticChangeCount: rows.length,
    requiredCheckCount: synthetic.requiredChecks.length,
    prSummary: synthetic.prSummary,
    warningSample: warningSample.prSummary,
    rows,
  };
}

function stableValue(value, volatileKeys) {
  if (Array.isArray(value)) return value.map((entry) => stableValue(entry, volatileKeys));
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (volatileKeys.has(key)) continue;
      out[key] = stableValue(value[key], volatileKeys);
    }
    return out;
  }
  return value;
}

export function stableReportChecksum(root, relPath, volatileKeys = new Set()) {
  const parsed = readJson(root, relPath);
  const stableBytes = stableStringify(stableValue(parsed, volatileKeys));
  return {
    stableSha256: crypto.createHash("sha256").update(stableBytes).digest("hex"),
    stableBytes: Buffer.byteLength(stableBytes),
  };
}

function analyzeGovernanceReportChecksums(root, config, issues) {
  const checksumConfig = config.reportChecksums ?? {};
  const volatileKeys = new Set(checksumConfig.volatileKeysIgnored ?? []);
  const reports = checksumConfig.reports ?? [];
  const categories = new Set(reports.map((row) => row.category));
  for (const required of checksumConfig.requiredCategories ?? []) {
    if (!categories.has(required)) issues.push(issue("operational_governance_report_checksum_missing_category", { category: required }));
  }

  const rows = reports.map((row) => {
    if (!pathExists(root, row.path)) {
      issues.push(issue("operational_governance_report_checksum_missing_report", { id: row.id, path: row.path }));
      return { ...row, missing: true, stableSha256: null, stableBytes: null };
    }
    const checksum = stableReportChecksum(root, row.path, volatileKeys);
    return {
      id: row.id,
      category: row.category,
      path: row.path,
      generator: row.generator,
      ...checksum,
    };
  });

  return {
    reportCount: rows.length,
    categoryCount: categories.size,
    categories: uniqueSorted([...categories]),
    volatileKeysIgnored: uniqueSorted([...volatileKeys]),
    rows,
  };
}

export function buildOperationalGovernanceOwnershipReport(root = DEFAULT_ROOT, options = {}) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json", { scripts: {} }).scripts ?? {};
  const ownerMaps = ownerAreaMaps(config);
  const issues = [];

  validateConfigShape(config, packageScripts, issues);

  const ci = read(root, ".github/workflows/ci.yml");
  if (!ci.includes("npm run check:operational-governance-ownership")) {
    issues.push(issue("operational_governance_missing_ci_command", { command: "npm run check:operational-governance-ownership" }));
  }

  const ownerAreas = (config.ownerAreas ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    codeowners: row.codeowners ?? [],
    coveredOwnerAreas: row.coveredOwnerAreas ?? [],
    routeOwners: row.routeOwners ?? [],
    validationCommands: row.validationCommands ?? [],
  }));

  const objectiveOwnerCoverage = validateObjectiveOwners(root, config, ownerMaps, issues);
  const routeProviderOwnership = validateRouteAndProviderOwners(root, config, ownerMaps, issues);
  const generatedArtifactOwnership = validateGeneratedArtifactOwners(root, config, ownerMaps, issues, options);
  const codeownersParity = analyzeCodeownersParity(root, config, ownerMaps, issues);
  const changeImpactRecommendations = analyzeChangeImpactRecommendations(config, issues);
  const governanceReportChecksums = analyzeGovernanceReportChecksums(root, config, issues);

  const payload = {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: config.source,
    generatedFrom: CONFIG_REL,
    generatedArtifact: ARTIFACT_REL,
    ownerAreaCount: ownerAreas.length,
    requiredOwnerAreaCount: (config.requiredOwnerAreaIds ?? []).length,
    ownerAreas,
    objectiveOwnerCoverage,
    routeProviderOwnership,
    generatedArtifactOwnership,
    codeownersParity,
    changeImpactRecommendations,
    governanceReportChecksums,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };

  const artifactPath = path.join(root, ARTIFACT_REL);
  const expected = stableStringify(payload);
  if (WRITE || options.write) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, expected);
  } else if (!options.skipArtifactDrift) {
    if (!fs.existsSync(artifactPath)) {
      payload.ok = false;
      payload.issues.push(issue("operational_governance_artifact_missing", { artifact: ARTIFACT_REL, writeCommand: "npm run write:operational-governance-ownership" }));
      payload.issueCount = payload.issues.length;
    } else if (fs.readFileSync(artifactPath, "utf8") !== expected) {
      payload.ok = false;
      payload.issues.push(issue("operational_governance_artifact_drift", { artifact: ARTIFACT_REL, writeCommand: "npm run write:operational-governance-ownership" }));
      payload.issueCount = payload.issues.length;
    }
  }

  return payload;
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, write: WRITE };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? DEFAULT_ROOT);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runOperationalGovernanceOwnership(options = parseArgs(process.argv.slice(2))) {
  const report = buildOperationalGovernanceOwnershipReport(options.root, { write: options.write });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOperationalGovernanceOwnership();
}
