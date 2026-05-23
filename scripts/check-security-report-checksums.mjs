#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const SECURITY_REPORT_CHECKSUM_ARTIFACTS = [
  "artifacts/security-route-matrix.json",
  "artifacts/security-proxy-matrix.json",
  "artifacts/security-control-coverage-matrix.rows.json",
  "artifacts/assurance/dashboard.json",
  "artifacts/assurance/scripts-to-epic-map.json",
  "artifacts/assurance/catalog-script-index.json",
  "artifacts/route-universe.json",
  "artifacts/route-functionality-matrix.json",
  "artifacts/route-runtime-contract.json",
  "artifacts/route-provider-matrix.json",
  "artifacts/route-db-dependencies.json",
  "artifacts/page-route-state-matrix.json",
  "artifacts/route-external-contracts.json",
  "artifacts/dependency-review-policy.json",
  "artifacts/license-allowlist.json",
  "artifacts/supply-chain-install-script-allowlist.json",
  "artifacts/sbom-diff-report.json",
  "artifacts/reproducible-build-report.json",
];

const MANIFEST_PATH = "artifacts/security-report-checksums.json";
const VOLATILE_KEYS = new Set(["generated", "generatedAt", "generated_at"]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (VOLATILE_KEYS.has(key)) continue;
      out[key] = stableValue(value[key]);
    }
    return out;
  }
  return value;
}

function stableJsonBytes(root, rel) {
  const abs = path.join(root, rel);
  const parsed = JSON.parse(fs.readFileSync(abs, "utf8"));
  return JSON.stringify(stableValue(parsed), null, 2) + "\n";
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function buildSecurityReportChecksumManifest(root = process.cwd()) {
  const artifacts = [];
  for (const rel of SECURITY_REPORT_CHECKSUM_ARTIFACTS) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      artifacts.push({ path: rel, missing: true });
      continue;
    }
    const stableBytes = stableJsonBytes(root, rel);
    artifacts.push({
      path: rel,
      stableSha256: sha256Hex(stableBytes),
      stableBytes: Buffer.byteLength(stableBytes),
    });
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    volatileKeysIgnored: [...VOLATILE_KEYS].sort(),
    artifacts,
  };
}

export function analyzeSecurityReportChecksums(root = process.cwd()) {
  const manifestPath = path.join(root, MANIFEST_PATH);
  const issues = [];
  if (!fs.existsSync(manifestPath)) {
    return {
      ok: false,
      issueCount: 1,
      issues: [{ issue: "missing_security_report_checksum_manifest", path: MANIFEST_PATH }],
    };
  }

  let committed;
  try {
    committed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    return {
      ok: false,
      issueCount: 1,
      issues: [{ issue: "invalid_security_report_checksum_manifest", path: MANIFEST_PATH, message: error.message }],
    };
  }

  const fresh = buildSecurityReportChecksumManifest(root);
  const committedByPath = new Map((committed.artifacts ?? []).map((entry) => [entry.path, entry]));
  for (const expected of fresh.artifacts) {
    if (expected.missing) {
      issues.push({ issue: "missing_security_report_artifact", path: expected.path });
      continue;
    }
    const current = committedByPath.get(expected.path);
    if (!current) {
      issues.push({ issue: "missing_security_report_checksum_entry", path: expected.path });
      continue;
    }
    if (current.stableSha256 !== expected.stableSha256) {
      issues.push({
        issue: "security_report_checksum_drift",
        path: expected.path,
        expected: current.stableSha256,
        actual: expected.stableSha256,
      });
    }
    if (current.stableBytes !== expected.stableBytes) {
      issues.push({
        issue: "security_report_size_drift",
        path: expected.path,
        expected: current.stableBytes,
        actual: expected.stableBytes,
      });
    }
  }

  for (const entry of committed.artifacts ?? []) {
    if (!SECURITY_REPORT_CHECKSUM_ARTIFACTS.includes(entry.path)) {
      issues.push({ issue: "unknown_security_report_checksum_entry", path: entry.path });
    }
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    artifactCount: fresh.artifacts.length,
  };
}

function main() {
  if (process.argv.includes("--write")) {
    const manifest = buildSecurityReportChecksumManifest();
    fs.mkdirSync(path.dirname(path.join(process.cwd(), MANIFEST_PATH)), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), MANIFEST_PATH), JSON.stringify(manifest, null, 2) + "\n");
    console.log(`Wrote ${MANIFEST_PATH} (${manifest.artifacts.length} artifacts)`);
    return;
  }
  const report = analyzeSecurityReportChecksums();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
