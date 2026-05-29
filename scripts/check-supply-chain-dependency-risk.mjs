#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeInstallScriptRisk } from "./check-install-script-risk.mjs";
import { analyzeLicenseSbom } from "./check-license-sbom.mjs";
import { analyzeLockfileIntegrityDrift } from "./check-lockfile-integrity-drift.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/supply-chain-dependency-risk.json";
const CI_REL = ".github/workflows/ci.yml";

const NATIVE_WASM_SIGNAL_RE =
  /(?:^|[/@-])(?:native|wasm|wasi|oxide|sharp|fsevents|unrs|node-gyp|prebuild|esbuild|rollup|swc|lightningcss|sentry\/cli|tailwindcss\/oxide)(?:$|[/@-])/iu;

function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel) {
  const text = read(root, rel);
  if (!text) throw new Error(`Missing JSON file: ${rel}`);
  return JSON.parse(text);
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function packageNameFromLockPath(packagePath, meta) {
  if (typeof meta?.name === "string" && meta.name) return meta.name;
  const marker = "node_modules/";
  const index = packagePath.lastIndexOf(marker);
  const tail = index >= 0 ? packagePath.slice(index + marker.length) : packagePath;
  const parts = tail.split("/");
  return parts[0]?.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

function lockPackages(lockfile) {
  return Object.entries(lockfile.packages ?? {})
    .filter(([packagePath]) => packagePath !== "")
    .map(([packagePath, meta]) => ({
      path: packagePath,
      name: packageNameFromLockPath(packagePath, meta),
      version: String(meta?.version ?? ""),
      resolved: String(meta?.resolved ?? ""),
      integrity: String(meta?.integrity ?? ""),
      hasInstallScript: Boolean(meta?.hasInstallScript),
      optional: Boolean(meta?.optional),
      dev: Boolean(meta?.dev),
      bin: meta?.bin ?? null,
      optionalDependencies: meta?.optionalDependencies ?? null,
    }))
    .filter((row) => row.name && row.version)
    .sort((a, b) => `${a.name}@${a.version}:${a.path}`.localeCompare(`${b.name}@${b.version}:${b.path}`));
}

function normalizeName(name) {
  const base = String(name ?? "").split("/").pop() ?? "";
  return base.toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function levenshtein(a, b) {
  const aa = [...a];
  const bb = [...b];
  const dp = Array.from({ length: aa.length + 1 }, () => Array(bb.length + 1).fill(0));
  for (let i = 0; i <= aa.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= bb.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= aa.length; i += 1) {
    for (let j = 1; j <= bb.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (aa[i - 1] === bb[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[aa.length][bb.length];
}

function normalizeReport(checkId, report) {
  return {
    checkId,
    ok: Boolean(report.ok ?? report.issueCount === 0),
    issueCount: Number(report.issueCount ?? report.issues?.length ?? 0),
  };
}

function deniedPackageIssues(packages, denylist) {
  const issues = [];
  for (const row of packages) {
    for (const denied of denylist) {
      if (row.name !== denied.name) continue;
      const blockedVersions = Array.isArray(denied.blockedVersions) ? denied.blockedVersions : null;
      if (blockedVersions && !blockedVersions.includes(row.version)) continue;
      issues.push(issue("denylisted_dependency_present", { name: row.name, version: row.version, path: row.path, reason: denied.reason }));
    }
  }
  return issues;
}

function typosquatIssues(packages, config) {
  const issues = [];
  const protectedNames = (config.protectedNames ?? []).map((name) => ({ raw: name, normalized: normalizeName(name) })).filter((row) => row.normalized.length >= 3);
  const allowed = new Set(config.allowedSimilarNames ?? []);
  for (const row of packages) {
    if (allowed.has(row.name)) continue;
    const normalized = normalizeName(row.name);
    if (normalized.length < 3) continue;
    for (const protectedName of protectedNames) {
      if (normalized === protectedName.normalized) continue;
      const distance = levenshtein(normalized, protectedName.normalized);
      if (distance <= 1) {
        issues.push(issue("possible_typosquat_dependency", {
          name: row.name,
          version: row.version,
          protectedName: protectedName.raw,
          distance,
          path: row.path,
        }));
      }
    }
  }
  return issues;
}

function nativeWasmRows(packages) {
  return packages
    .filter((row) => {
      const text = [
        row.path,
        row.name,
        row.resolved,
        JSON.stringify(row.bin ?? {}),
        JSON.stringify(row.optionalDependencies ?? {}),
      ].join(" ");
      return NATIVE_WASM_SIGNAL_RE.test(text) || row.hasInstallScript;
    })
    .map((row) => ({
      path: row.path,
      name: row.name,
      version: row.version,
      hasInstallScript: row.hasInstallScript,
      optional: row.optional,
      dev: row.dev,
    }));
}

function nativeWasmIssues(rows, inventoryPolicy) {
  const issues = [];
  const families = (inventoryPolicy.allowedFamilies ?? []).map((family) => ({ ...family, regex: new RegExp(family.pattern, "u") }));
  const today = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(String(inventoryPolicy.expiresOn ?? "")) || inventoryPolicy.expiresOn < today) {
    issues.push(issue("native_wasm_inventory_expired_or_invalid", { expiresOn: inventoryPolicy.expiresOn }));
  }
  for (const family of families) {
    for (const field of ["pattern", "owner", "reason"]) {
      if (typeof family[field] !== "string" || family[field].trim().length === 0) {
        issues.push(issue("native_wasm_family_missing_metadata", { field, pattern: family.pattern }));
      }
    }
  }
  for (const row of rows) {
    const matches = families.filter((family) => family.regex.test(row.name));
    if (matches.length === 0) {
      issues.push(issue("native_wasm_dependency_unowned", { name: row.name, version: row.version, path: row.path }));
    }
  }
  return issues;
}

function dependencyConfusionIssues(packages, pkg, policy) {
  const issues = [];
  const allowedRegistryPrefix = String(policy.allowedRegistryPrefix ?? "");
  if (!allowedRegistryPrefix) issues.push(issue("dependency_confusion_missing_registry_prefix"));

  for (const row of packages) {
    if (row.resolved && allowedRegistryPrefix && !row.resolved.startsWith(allowedRegistryPrefix)) {
      issues.push(issue("dependency_resolution_outside_allowed_registry", { name: row.name, version: row.version, resolved: row.resolved }));
    }
  }

  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}), ...(pkg.optionalDependencies ?? {}) };
  for (const [name, spec] of Object.entries(allDeps)) {
    if (policy.forbidUnpinnedGitDependencies && /^(?:git\+|github:|git:|https:\/\/github\.com)/u.test(String(spec))) {
      issues.push(issue("unpinned_git_dependency_forbidden", { name, spec }));
    }
    if (policy.forbidFileDependenciesOutsideWorkspace && /^\.\.?\//u.test(String(spec))) {
      issues.push(issue("relative_file_dependency_requires_review", { name, spec }));
    }
  }

  return issues;
}

function thresholdIssues(config, ci) {
  const issues = [];
  if (config.thresholds?.npmAuditFailOnSeverity !== "high") {
    issues.push(issue("invalid_npm_audit_threshold", { actual: config.thresholds?.npmAuditFailOnSeverity }));
  }
  if (config.thresholds?.osvFailOnSeverity !== "high") {
    issues.push(issue("invalid_osv_threshold", { actual: config.thresholds?.osvFailOnSeverity }));
  }
  if (config.thresholds?.dependencyReviewFailOnSeverity !== "high") {
    issues.push(issue("invalid_dependency_review_threshold", { actual: config.thresholds?.dependencyReviewFailOnSeverity }));
  }
  for (const snippet of ["npm audit --audit-level=high", "osv-scanner-action", "fail-on-severity: high"]) {
    if (!ci.includes(snippet)) issues.push(issue("missing_ci_dependency_threshold_signal", { snippet }));
  }
  return issues;
}

export function analyzeSupplyChainDependencyRisk(root = ROOT) {
  const issues = [];
  const config = readJson(root, CONFIG_REL);
  const pkg = readJson(root, "package.json");
  const lockfile = readJson(root, "package-lock.json");
  const ci = read(root, CI_REL);
  const dependencyReviewWorkflow = read(root, ".github/workflows/dependency-review.yml");
  const packages = lockPackages(lockfile);
  const nativeWasmInventory = nativeWasmRows(packages);

  if (config.schemaVersion !== 1 || config.source !== "code-owned-supply-chain-dependency-risk-policy") {
    issues.push(issue("invalid_dependency_risk_config_metadata"));
  }
  if ((config.knownMaliciousDenylist ?? []).length < 5) {
    issues.push(issue("dependency_denylist_too_small"));
  }
  if ((config.nativeWasmInventory?.allowedFamilies ?? []).length < 8) {
    issues.push(issue("native_wasm_family_inventory_too_small"));
  }

  issues.push(...thresholdIssues(config, `${ci}\n${dependencyReviewWorkflow}`));
  issues.push(...deniedPackageIssues(packages, config.knownMaliciousDenylist ?? []));
  issues.push(...typosquatIssues(packages, config.typosquatRisk ?? {}));
  issues.push(...dependencyConfusionIssues(packages, pkg, config.dependencyConfusion ?? {}));
  issues.push(...nativeWasmIssues(nativeWasmInventory, config.nativeWasmInventory ?? {}));

  const delegatedReports = [
    normalizeReport("install-script-risk", analyzeInstallScriptRisk(root)),
    normalizeReport("license-sbom", analyzeLicenseSbom(root)),
    normalizeReport("lockfile-integrity-drift", analyzeLockfileIntegrityDrift(root)),
  ].sort((a, b) => a.checkId.localeCompare(b.checkId));

  for (const report of delegatedReports) {
    if (!report.ok) issues.push(issue("dependency_risk_delegated_check_failed", { checkId: report.checkId, issueCount: report.issueCount }));
  }

  return {
    checkId: "supply-chain-dependency-risk",
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-supply-chain-dependency-risk-policy",
    packageCount: packages.length,
    denylistEntryCount: config.knownMaliciousDenylist?.length ?? 0,
    protectedNameCount: config.typosquatRisk?.protectedNames?.length ?? 0,
    nativeWasmInventoryCount: nativeWasmInventory.length,
    nativeWasmInventory,
    delegatedReports,
    thresholds: config.thresholds ?? {},
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSupplyChainDependencyRisk();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
