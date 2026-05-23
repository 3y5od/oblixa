#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const REQUIRED_LOCKFILE_VERSION = 3;
const EXPECTED_REGISTRY_PREFIX = "https://registry.npmjs.org/";
const BUNDLED_WITH_PARENT_PREFIXES = [
  "node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/",
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isBundledWithParent(packagePath) {
  return BUNDLED_WITH_PARENT_PREFIXES.some((prefix) => packagePath.startsWith(prefix));
}

function compareRootDependencySection(issues, section, packageJsonDeps = {}, lockfileDeps = {}) {
  for (const [name, version] of Object.entries(packageJsonDeps)) {
    if (!(name in lockfileDeps)) {
      issues.push({ issue: "missing_lockfile_entry", section, name });
      continue;
    }
    if (lockfileDeps[name] !== version) {
      issues.push({ issue: "version_mismatch", section, name, packageJson: version, lockfile: lockfileDeps[name] });
    }
  }
  for (const name of Object.keys(lockfileDeps)) {
    if (!(name in packageJsonDeps)) {
      issues.push({ issue: "stale_lockfile_root_dependency", section, name });
    }
  }
}

export function analyzeLockfileIntegrityDrift(root = process.cwd()) {
  const pkgPath = path.join(root, "package.json");
  const lockPath = path.join(root, "package-lock.json");
  const issues = [];

  if (!fs.existsSync(pkgPath)) issues.push({ issue: "missing_package_json" });
  if (!fs.existsSync(lockPath)) issues.push({ issue: "missing_package_lock" });
  if (issues.length) return { checkId: "lockfile-integrity-drift", ok: false, issueCount: issues.length, issues };

  const pkg = readJson(pkgPath);
  const lockfile = readJson(lockPath);
  const packages = lockfile.packages && typeof lockfile.packages === "object" ? lockfile.packages : null;
  const rootPkg = packages?.[""] ?? null;

  if (lockfile.lockfileVersion !== REQUIRED_LOCKFILE_VERSION) {
    issues.push({ issue: "unsupported_lockfile_version", expected: REQUIRED_LOCKFILE_VERSION, actual: lockfile.lockfileVersion });
  }
  if (lockfile.name !== pkg.name) {
    issues.push({ issue: "lockfile_name_mismatch", packageJson: pkg.name, lockfile: lockfile.name });
  }
  if (!packages) {
    issues.push({ issue: "missing_lockfile_packages" });
  }
  if (!rootPkg) {
    issues.push({ issue: "missing_lockfile_root_package" });
  } else {
    compareRootDependencySection(issues, "dependencies", pkg.dependencies ?? {}, rootPkg.dependencies ?? {});
    compareRootDependencySection(issues, "devDependencies", pkg.devDependencies ?? {}, rootPkg.devDependencies ?? {});
  }

  if (packages) {
    for (const [packagePath, meta] of Object.entries(packages)) {
      if (packagePath === "") continue;
      if (!meta || typeof meta !== "object") {
        issues.push({ issue: "invalid_lockfile_package_meta", packagePath });
        continue;
      }
      if (!meta.version) issues.push({ issue: "missing_lockfile_package_version", packagePath });
      if (meta.resolved && !String(meta.resolved).startsWith(EXPECTED_REGISTRY_PREFIX)) {
        issues.push({ issue: "non_npm_registry_resolution", packagePath, resolved: meta.resolved });
      }
      if (meta.integrity && !String(meta.integrity).startsWith("sha512-")) {
        issues.push({ issue: "weak_or_unexpected_integrity", packagePath });
      }
      if (!meta.resolved && !meta.link && !isBundledWithParent(packagePath)) {
        issues.push({ issue: "missing_lockfile_package_resolution", packagePath });
      }
      if (!meta.integrity && !meta.link && !isBundledWithParent(packagePath)) {
        issues.push({ issue: "missing_lockfile_package_integrity", packagePath });
      }
    }
  }

  return {
    checkId: "lockfile-integrity-drift",
    ok: issues.length === 0,
    packageCount: packages ? Object.keys(packages).length : 0,
    issueCount: issues.length,
    issues: issues.slice(0, 80),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeLockfileIntegrityDrift();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
