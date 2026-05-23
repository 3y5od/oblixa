#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const LICENSE_RE = /^[A-Za-z0-9-.+() ]+$/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function componentLicense(component) {
  const first = component?.licenses?.[0];
  return first?.license?.id || first?.expression || null;
}

export function analyzeLicenseSbom(root = process.cwd()) {
  const allowPath = path.join(root, "artifacts", "license-allowlist.json");
  const sbomPath = path.join(root, "cyclonedx-sbom.json");
  const issues = [];

  if (!fs.existsSync(allowPath)) issues.push({ issue: "missing_license_allowlist", path: "artifacts/license-allowlist.json" });
  if (!fs.existsSync(sbomPath)) issues.push({ issue: "missing_sbom_file", path: "cyclonedx-sbom.json" });
  if (issues.length) return { checkId: "license-sbom", ok: false, issueCount: issues.length, issues };

  const allow = readJson(allowPath);
  const sbom = readJson(sbomPath);
  const families = Array.isArray(allow.families) ? allow.families : [];
  const allowed = new Set(families);
  const components = Array.isArray(sbom.components) ? sbom.components : [];

  if (families.length === 0) issues.push({ issue: "empty_license_allowlist" });
  for (const family of families) {
    if (typeof family !== "string" || !family.trim()) issues.push({ issue: "invalid_license_allowlist_entry", family });
    if (typeof family === "string" && !LICENSE_RE.test(family)) {
      issues.push({ issue: "unexpected_license_expression_shape", family });
    }
  }

  for (const component of components) {
    const license = componentLicense(component);
    if (!license) {
      continue;
    }
    if (!allowed.has(license)) {
      issues.push({ issue: "non_allowlisted_license", component: `${component.name}@${component.version}`, license });
    }
  }

  return {
    checkId: "license-sbom",
    ok: issues.length === 0,
    componentCount: components.length,
    allowedLicenseCount: families.length,
    issueCount: issues.length,
    issues: issues.slice(0, 80),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeLicenseSbom();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    for (const issue of report.issues.slice(0, 20)) {
      console.error(JSON.stringify(issue));
    }
  }
  process.exit(report.ok ? 0 : 1);
}
