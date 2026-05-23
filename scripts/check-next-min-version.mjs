#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const MIN_NEXT_VERSION = "16.2.6";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(version ?? "").trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function compareSemver(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) {
    throw new Error(`Invalid semver comparison: ${a} >= ${b}`);
  }
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] > right[key]) return 1;
    if (left[key] < right[key]) return -1;
  }
  return 0;
}

export function analyzeNextMinVersion(root = process.cwd(), minVersion = MIN_NEXT_VERSION) {
  const lockPath = path.join(root, "package-lock.json");
  const issues = [];
  if (!fs.existsSync(lockPath)) {
    return {
      checkId: "next-min-version",
      ok: false,
      minVersion,
      issueCount: 1,
      issues: [{ issue: "missing_package_lock" }],
    };
  }

  const lockfile = readJson(lockPath);
  const nextMeta = lockfile.packages?.["node_modules/next"];
  const installedVersion = nextMeta?.version;
  if (!installedVersion) {
    issues.push({ issue: "missing_next_lockfile_package" });
  } else if (compareSemver(installedVersion, minVersion) < 0) {
    issues.push({
      issue: "next_below_security_floor",
      installedVersion,
      minVersion,
    });
  }

  const rootNextSpec = lockfile.packages?.[""]?.dependencies?.next;
  if (typeof rootNextSpec !== "string") {
    issues.push({ issue: "missing_root_next_dependency" });
  }

  return {
    checkId: "next-min-version",
    ok: issues.length === 0,
    minVersion,
    installedVersion: installedVersion ?? null,
    rootNextSpec: rootNextSpec ?? null,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeNextMinVersion();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
