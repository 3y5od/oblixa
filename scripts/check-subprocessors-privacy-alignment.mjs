#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SUBPROCESSORS_REL = "artifacts/subprocessors.json";
const PRIVACY_INVENTORY_REL = "src/lib/security/privacy-inventory.ts";

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function readJson(root, rel) {
  return JSON.parse(read(root, rel));
}

function extractPrivacyDataClasses(source) {
  return new Set([...source.matchAll(/dataClass:\s*"([^"]+)"/gu)].map((match) => match[1]));
}

function extractPrivacyProviders(source) {
  return new Set([...source.matchAll(/provider:\s*"([^"]+)"/gu)].map((match) => match[1].toLowerCase()));
}

export function analyzeSubprocessorsPrivacyAlignment(root = ROOT) {
  const subprocessors = readJson(root, SUBPROCESSORS_REL);
  const privacySource = read(root, PRIVACY_INVENTORY_REL);
  const dataClasses = extractPrivacyDataClasses(privacySource);
  const providers = extractPrivacyProviders(privacySource);
  const rows = subprocessors.subprocessors || subprocessors.vendors || [];
  const issues = [];

  for (const row of rows) {
    const id = row.id ?? row.name ?? "(missing)";
    if (!Array.isArray(row.privacyInventoryRefs) || row.privacyInventoryRefs.length === 0) {
      issues.push({ issue: "subprocessor_missing_privacy_inventory_refs", id });
      continue;
    }
    for (const ref of row.privacyInventoryRefs) {
      if (!dataClasses.has(ref)) {
        issues.push({ issue: "subprocessor_privacy_inventory_ref_missing", id, ref });
      }
    }
    const providerName = String(row.id ?? row.name ?? "").toLowerCase();
    const providerSpecific = providers.has(providerName);
    if (providerSpecific && !row.privacyInventoryRefs.some((ref) => String(ref).includes(providerName))) {
      issues.push({ issue: "subprocessor_provider_ref_not_provider_specific", id, providerName });
    }
  }

  return {
    checkId: "subprocessors-privacy-alignment",
    ok: issues.length === 0,
    subprocessorCount: rows.length,
    privacyDataClassCount: dataClasses.size,
    providerClassCount: providers.size,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSubprocessorsPrivacyAlignment();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
