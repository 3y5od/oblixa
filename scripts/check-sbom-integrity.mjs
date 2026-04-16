#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sbomPath = path.join(root, "cyclonedx-sbom.json");
const lockfile = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const issues = [];

if (!fs.existsSync(sbomPath)) {
  issues.push({ issue: "missing_sbom_file", path: "cyclonedx-sbom.json" });
} else {
  try {
    const sbom = JSON.parse(fs.readFileSync(sbomPath, "utf8"));
    const components = Array.isArray(sbom.components) ? sbom.components : [];
    if (components.length === 0) {
      issues.push({ issue: "empty_sbom_components" });
    }
    const projectName = sbom.metadata?.component?.name;
    if (projectName && projectName !== lockfile.name) {
      issues.push({
        issue: "sbom_project_name_mismatch",
        sbom: projectName,
        lockfile: lockfile.name,
      });
    }
  } catch (error) {
    issues.push({
      issue: "invalid_sbom_json",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
