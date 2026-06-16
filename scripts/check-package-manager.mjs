#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const PACKAGE_MANAGER_RE = /^npm@(\d+)\.(\d+)\.(\d+)$/u;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function parseNpmPackageManager(value) {
  const match = PACKAGE_MANAGER_RE.exec(String(value ?? "").trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function parseNodeMajor(value) {
  const match = /^>=\s*(\d+)\.\d+\.\d+$/u.exec(String(value ?? "").trim());
  return match ? Number(match[1]) : null;
}

export function analyzePackageManager(root = process.cwd()) {
  const packagePath = path.join(root, "package.json");
  const nvmrcPath = path.join(root, ".nvmrc");
  const issues = [];

  if (!fs.existsSync(packagePath)) {
    return {
      checkId: "package-manager",
      ok: false,
      issueCount: 1,
      issues: [{ issue: "missing_package_json" }],
    };
  }

  const pkg = readJson(packagePath);
  const parsedPackageManager = parseNpmPackageManager(pkg.packageManager);
  if (!parsedPackageManager) {
    issues.push({
      issue: "missing_or_invalid_package_manager",
      expected: "npm@<major>.<minor>.<patch>",
      actual: pkg.packageManager ?? null,
    });
  }

  const engineNodeMajor = parseNodeMajor(pkg.engines?.node);
  if (!engineNodeMajor) {
    issues.push({
      issue: "missing_or_invalid_node_engine_floor",
      expected: ">=<major>.<minor>.<patch>",
      actual: pkg.engines?.node ?? null,
    });
  }

  let nvmrcMajor = null;
  if (!fs.existsSync(nvmrcPath)) {
    issues.push({ issue: "missing_nvmrc" });
  } else {
    const nvmrc = fs.readFileSync(nvmrcPath, "utf8").trim();
    nvmrcMajor = /^\d+$/u.test(nvmrc) ? Number(nvmrc) : null;
    if (!nvmrcMajor) {
      issues.push({ issue: "invalid_nvmrc_node_major", actual: nvmrc });
    }
  }

  if (engineNodeMajor && nvmrcMajor && engineNodeMajor !== nvmrcMajor) {
    issues.push({
      issue: "node_engine_nvmrc_mismatch",
      engineNodeMajor,
      nvmrcMajor,
    });
  }

  return {
    checkId: "package-manager",
    ok: issues.length === 0,
    packageManager: pkg.packageManager ?? null,
    nodeEngine: pkg.engines?.node ?? null,
    nvmrcMajor,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzePackageManager();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
