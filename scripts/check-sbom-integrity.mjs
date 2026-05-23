#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const REQUIRED_BOM_FORMAT = "CycloneDX";
const MIN_SPEC_VERSION = "1.5";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function directDependencyVersions(lockfile) {
  const out = new Map();
  const rootDeps = {
    ...(lockfile.packages?.[""]?.dependencies ?? {}),
    ...(lockfile.packages?.[""]?.devDependencies ?? {}),
  };
  for (const name of Object.keys(rootDeps)) {
    const meta = lockfile.packages?.[`node_modules/${name}`];
    if (meta?.version) out.set(name, meta.version);
  }
  return out;
}

function componentFullName(component) {
  return component?.group ? `${component.group}/${component.name}` : component?.name;
}

function versionGte(a, b) {
  const parse = (v) => String(v).split(".").map((part) => Number(part));
  const aa = parse(a);
  const bb = parse(b);
  for (let i = 0; i < Math.max(aa.length, bb.length); i += 1) {
    const av = aa[i] ?? 0;
    const bv = bb[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return true;
}

export function analyzeSbomIntegrity(root = process.cwd()) {
  const sbomPath = path.join(root, "cyclonedx-sbom.json");
  const lockPath = path.join(root, "package-lock.json");
  const issues = [];

  if (!fs.existsSync(sbomPath)) issues.push({ issue: "missing_sbom_file", path: "cyclonedx-sbom.json" });
  if (!fs.existsSync(lockPath)) issues.push({ issue: "missing_package_lock" });
  if (issues.length) return { checkId: "sbom-integrity", ok: false, issueCount: issues.length, issues };

  let sbom;
  let lockfile;
  try {
    sbom = readJson(sbomPath);
    lockfile = readJson(lockPath);
  } catch (error) {
    return {
      checkId: "sbom-integrity",
      ok: false,
      issueCount: 1,
      issues: [{ issue: "invalid_json", message: error instanceof Error ? error.message : String(error) }],
    };
  }

  const components = Array.isArray(sbom.components) ? sbom.components : [];
  const dependencies = Array.isArray(sbom.dependencies) ? sbom.dependencies : [];
  const bomRefs = new Set();
  const componentVersionsByName = new Map();

  if (sbom.bomFormat !== REQUIRED_BOM_FORMAT) issues.push({ issue: "invalid_bom_format", expected: REQUIRED_BOM_FORMAT, actual: sbom.bomFormat });
  if (!versionGte(sbom.specVersion, MIN_SPEC_VERSION)) issues.push({ issue: "old_cyclonedx_spec_version", min: MIN_SPEC_VERSION, actual: sbom.specVersion });
  if (!/^urn:uuid:[0-9a-f-]{36}$/i.test(String(sbom.serialNumber ?? ""))) issues.push({ issue: "missing_or_invalid_sbom_serial_number" });
  if (sbom.metadata?.component?.name !== lockfile.name) {
    issues.push({ issue: "sbom_project_name_mismatch", sbom: sbom.metadata?.component?.name, lockfile: lockfile.name });
  }
  if (components.length === 0) issues.push({ issue: "empty_sbom_components" });
  if (dependencies.length === 0) issues.push({ issue: "empty_sbom_dependency_graph" });

  for (const component of components) {
    const ref = component?.["bom-ref"];
    if (!ref) issues.push({ issue: "component_missing_bom_ref", name: component?.name });
    else if (bomRefs.has(ref)) issues.push({ issue: "duplicate_component_bom_ref", ref });
    else bomRefs.add(ref);

    if (!component?.name) issues.push({ issue: "component_missing_name", ref });
    if (!component?.version) issues.push({ issue: "component_missing_version", name: component?.name });
    if (!component?.purl || !String(component.purl).startsWith("pkg:npm/")) {
      issues.push({ issue: "component_missing_npm_purl", name: component?.name, version: component?.version });
    }
    const fullName = componentFullName(component);
    if (fullName && component?.version) {
      const versions = componentVersionsByName.get(fullName) ?? new Set();
      versions.add(component.version);
      componentVersionsByName.set(fullName, versions);
    }
  }

  for (const [name, version] of directDependencyVersions(lockfile)) {
    const versions = componentVersionsByName.get(name);
    if (!versions?.has(version)) {
      issues.push({ issue: "direct_dependency_missing_from_sbom", name, version });
    }
  }

  return {
    checkId: "sbom-integrity",
    ok: issues.length === 0,
    componentCount: components.length,
    dependencyGraphCount: dependencies.length,
    issueCount: issues.length,
    issues: issues.slice(0, 80),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSbomIntegrity();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
