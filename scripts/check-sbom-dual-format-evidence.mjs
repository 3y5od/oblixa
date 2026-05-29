#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const CYCLONEDX_REL = "cyclonedx-sbom.json";
const SPDX_REL = path.join("artifacts", "spdx-sbom.json");
const EVIDENCE_REL = path.join("artifacts", "sbom-dual-format-evidence.json");
const LOCK_REL = "package-lock.json";
const WRITE = process.argv.includes("--write");
const STABLE_SPDX_CREATED = "1970-01-01T00:00:00Z";

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256File(root, rel) {
  return sha256Bytes(fs.readFileSync(path.join(root, rel)));
}

function lockPackages(lockfile) {
  return Object.entries(lockfile.packages ?? {})
    .filter(([packagePath]) => packagePath !== "")
    .map(([packagePath, meta]) => {
      const tail = packagePath.slice(packagePath.lastIndexOf("node_modules/") + "node_modules/".length);
      const parts = tail.split("/");
      const fallbackName = parts[0]?.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
      return {
        path: packagePath,
        name: String(meta?.name || fallbackName || packagePath),
        version: String(meta?.version || "NOASSERTION"),
        license: typeof meta?.license === "string" && meta.license.trim() ? meta.license.trim() : "NOASSERTION",
        resolved: typeof meta?.resolved === "string" && meta.resolved.trim() ? meta.resolved.trim() : "NOASSERTION",
        integrity: typeof meta?.integrity === "string" && meta.integrity.trim() ? meta.integrity.trim() : null,
        optional: Boolean(meta?.optional),
        dev: Boolean(meta?.dev),
      };
    })
    .sort((a, b) => `${a.name}@${a.version}:${a.path}`.localeCompare(`${b.name}@${b.version}:${b.path}`));
}

function spdxIdForPackage(pkg, index) {
  const safeName = `${pkg.name}-${pkg.version}-${index}`
    .replace(/^@/u, "")
    .replace(/[^A-Za-z0-9.-]/gu, "-")
    .replace(/-+/gu, "-")
    .slice(0, 140);
  return `SPDXRef-Package-${safeName}`;
}

export function buildSpdxFromPackageLock(root = ROOT) {
  const lockfile = readJson(root, LOCK_REL);
  const packages = lockPackages(lockfile);
  const lockHash = sha256File(root, LOCK_REL);
  const documentName = `${lockfile.name ?? "oblixa"}-npm-package-lock`;
  const spdxPackages = packages.map((pkg, index) => ({
    name: pkg.name,
    SPDXID: spdxIdForPackage(pkg, index),
    versionInfo: pkg.version,
    downloadLocation: pkg.resolved,
    filesAnalyzed: false,
    licenseConcluded: "NOASSERTION",
    licenseDeclared: pkg.license,
    copyrightText: "NOASSERTION",
    externalRefs: [
      {
        referenceCategory: "PACKAGE-MANAGER",
        referenceType: "purl",
        referenceLocator: `pkg:npm/${encodeURIComponent(pkg.name)}@${encodeURIComponent(pkg.version)}`,
      },
    ],
    annotations: [
      {
        annotationDate: STABLE_SPDX_CREATED,
        annotationType: "OTHER",
        annotator: "Tool: scripts/check-sbom-dual-format-evidence.mjs",
        comment: `package-lock path=${pkg.path}; optional=${pkg.optional}; dev=${pkg.dev}; integrity=${pkg.integrity ? "sha512" : "missing"}`,
      },
    ],
  }));

  return {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: documentName,
    documentNamespace: `https://oblixa.local/sbom/${encodeURIComponent(documentName)}/${lockHash.slice(0, 32)}`,
    creationInfo: {
      created: STABLE_SPDX_CREATED,
      creators: ["Tool: scripts/check-sbom-dual-format-evidence.mjs"],
    },
    packages: spdxPackages,
    relationships: spdxPackages.map((pkg) => ({
      spdxElementId: "SPDXRef-DOCUMENT",
      relationshipType: "DESCRIBES",
      relatedSpdxElement: pkg.SPDXID,
    })),
  };
}

function validateSpdx(spdx, issues) {
  if (spdx.spdxVersion !== "SPDX-2.3") issues.push({ issue: "invalid_spdx_version", actual: spdx.spdxVersion });
  if (spdx.dataLicense !== "CC0-1.0") issues.push({ issue: "invalid_spdx_data_license", actual: spdx.dataLicense });
  if (spdx.SPDXID !== "SPDXRef-DOCUMENT") issues.push({ issue: "invalid_spdx_document_id" });
  if (!Array.isArray(spdx.packages) || spdx.packages.length === 0) issues.push({ issue: "empty_spdx_packages" });
  if (!Array.isArray(spdx.relationships) || spdx.relationships.length === 0) issues.push({ issue: "empty_spdx_relationships" });

  const ids = new Set();
  for (const pkg of spdx.packages ?? []) {
    if (!pkg.name) issues.push({ issue: "spdx_package_missing_name", id: pkg.SPDXID });
    if (!pkg.versionInfo) issues.push({ issue: "spdx_package_missing_version", name: pkg.name });
    if (!pkg.SPDXID || !String(pkg.SPDXID).startsWith("SPDXRef-Package-")) {
      issues.push({ issue: "spdx_package_invalid_id", name: pkg.name, id: pkg.SPDXID });
    } else if (ids.has(pkg.SPDXID)) {
      issues.push({ issue: "duplicate_spdx_package_id", id: pkg.SPDXID });
    } else {
      ids.add(pkg.SPDXID);
    }
    if (pkg.filesAnalyzed !== false) issues.push({ issue: "spdx_package_files_analyzed_must_be_false", name: pkg.name });
    if (!pkg.downloadLocation) issues.push({ issue: "spdx_package_missing_download_location", name: pkg.name });
    const purl = pkg.externalRefs?.find((entry) => entry?.referenceType === "purl")?.referenceLocator;
    if (typeof purl !== "string" || !purl.startsWith("pkg:npm/")) {
      issues.push({ issue: "spdx_package_missing_npm_purl", name: pkg.name });
    }
  }
}

export function buildSbomDualFormatEvidence(root = ROOT) {
  const issues = [];
  for (const rel of [LOCK_REL, CYCLONEDX_REL]) {
    if (!fs.existsSync(path.join(root, rel))) issues.push({ issue: "missing_sbom_input", path: rel });
  }
  if (issues.length) {
    return {
      ok: false,
      schemaVersion: 1,
      source: "code-owned-sbom-dual-format-evidence",
      issueCount: issues.length,
      issues,
    };
  }

  const lockfile = readJson(root, LOCK_REL);
  const cyclonedx = readJson(root, CYCLONEDX_REL);
  const spdx = buildSpdxFromPackageLock(root);
  validateSpdx(spdx, issues);

  const packages = lockPackages(lockfile);
  const cyclonedxComponents = Array.isArray(cyclonedx.components) ? cyclonedx.components : [];
  const cyclonedxDependencies = Array.isArray(cyclonedx.dependencies) ? cyclonedx.dependencies : [];
  if (cyclonedx.bomFormat !== "CycloneDX") issues.push({ issue: "invalid_cyclonedx_format", actual: cyclonedx.bomFormat });
  if (!String(cyclonedx.specVersion ?? "").startsWith("1.")) {
    issues.push({ issue: "invalid_cyclonedx_spec_version", actual: cyclonedx.specVersion });
  }
  if (cyclonedxComponents.length === 0) issues.push({ issue: "empty_cyclonedx_components" });
  if (cyclonedxDependencies.length === 0) issues.push({ issue: "empty_cyclonedx_dependency_graph" });
  if (spdx.packages.length !== packages.length) {
    issues.push({ issue: "spdx_lockfile_package_count_mismatch", spdx: spdx.packages.length, lockfile: packages.length });
  }
  if (cyclonedxComponents.length > packages.length) {
    issues.push({
      issue: "cyclonedx_component_count_exceeds_lockfile_count",
      cyclonedx: cyclonedxComponents.length,
      lockfile: packages.length,
    });
  }

  const spdxBytes = stableStringify(spdx);
  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-sbom-dual-format-evidence",
    generatedBy: "scripts/check-sbom-dual-format-evidence.mjs --write",
    formats: [
      {
        name: "CycloneDX",
        path: CYCLONEDX_REL,
        specVersion: String(cyclonedx.specVersion ?? ""),
        componentCount: cyclonedxComponents.length,
        dependencyGraphCount: cyclonedxDependencies.length,
        sha256: sha256File(root, CYCLONEDX_REL),
      },
      {
        name: "SPDX",
        path: SPDX_REL,
        specVersion: spdx.spdxVersion,
        packageCount: spdx.packages.length,
        relationshipCount: spdx.relationships.length,
        sha256: sha256Bytes(spdxBytes),
      },
      {
        name: "npm-package-lock",
        path: LOCK_REL,
        lockfileVersion: lockfile.lockfileVersion,
        packageCount: packages.length,
        rootDependencyCount: Object.keys(lockfile.packages?.[""]?.dependencies ?? {}).length,
        rootDevDependencyCount: Object.keys(lockfile.packages?.[""]?.devDependencies ?? {}).length,
        sha256: sha256File(root, LOCK_REL),
      },
    ],
    countComparison: {
      lockfilePackageCount: packages.length,
      cyclonedxComponentCount: cyclonedxComponents.length,
      cyclonedxDependencyGraphCount: cyclonedxDependencies.length,
      spdxPackageCount: spdx.packages.length,
      cyclonedxToLockfileDelta: packages.length - cyclonedxComponents.length,
      spdxToLockfileDelta: packages.length - spdx.packages.length,
    },
    driftPolicy: {
      dependencyChangesRequireUpdatedEvidence: true,
      evidenceArtifact: EVIDENCE_REL,
      spdxArtifact: SPDX_REL,
      checkCommand: "npm run check:sbom-dual-format-evidence",
      writeCommand: "npm run write:sbom-dual-format-evidence",
    },
    issueCount: issues.length,
    issues,
  };
}

export function analyzeSbomDualFormatEvidence(root = ROOT) {
  const report = buildSbomDualFormatEvidence(root);
  const issues = [...(report.issues ?? [])];
  const expectedSpdx = stableStringify(buildSpdxFromPackageLock(root));
  const expectedEvidence = stableStringify(report);
  const spdxPath = path.join(root, SPDX_REL);
  const evidencePath = path.join(root, EVIDENCE_REL);

  if (!fs.existsSync(spdxPath)) {
    issues.push({ issue: "missing_spdx_sbom_artifact", path: SPDX_REL });
  } else if (fs.readFileSync(spdxPath, "utf8") !== expectedSpdx) {
    issues.push({ issue: "spdx_sbom_artifact_drift", path: SPDX_REL, writeCommand: "npm run write:sbom-dual-format-evidence" });
  }
  if (!fs.existsSync(evidencePath)) {
    issues.push({ issue: "missing_dual_sbom_evidence_artifact", path: EVIDENCE_REL });
  } else if (fs.readFileSync(evidencePath, "utf8") !== expectedEvidence) {
    issues.push({ issue: "dual_sbom_evidence_artifact_drift", path: EVIDENCE_REL, writeCommand: "npm run write:sbom-dual-format-evidence" });
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
    const spdx = buildSpdxFromPackageLock();
    fs.mkdirSync(path.dirname(path.join(ROOT, SPDX_REL)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, SPDX_REL), stableStringify(spdx));
    const report = buildSbomDualFormatEvidence();
    fs.writeFileSync(path.join(ROOT, EVIDENCE_REL), stableStringify(report));
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  }
  const report = analyzeSbomDualFormatEvidence();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
