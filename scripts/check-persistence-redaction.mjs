#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

const REQUIRED_SITES = [
  {
    rel: "src/lib/security/persistence-redaction.ts",
    markers: ["redactForPersistence", "redactPersistenceString", "isHighRiskPersistenceKey"],
  },
  {
    rel: "src/lib/v10-server-contracts.ts",
    markers: ["redactPersistenceString"],
  },
  {
    rel: "src/lib/product-telemetry.ts",
    markers: ["redactPersistenceString"],
  },
  {
    rel: "src/lib/v6/external-collaboration.ts",
    markers: ["redactForPersistence(payload)", "payload_json: redactForPersistence(payload)"],
  },
  {
    rel: "src/lib/import-jobs.ts",
    markers: ["minimizeImportRawPayload", "raw_payload_minimized", "ttl_expires_at"],
  },
  {
    rel: "src/lib/security/persistence-redaction.test.ts",
    markers: ["raw tokens, cookies, headers, and document text", "strips sensitive query params"],
  },
];

const FORBIDDEN_RAW_PATTERNS = [
  {
    rel: "src/lib/v6/external-collaboration.ts",
    re: /payload_json:\s*payload\b/,
    issue: "external_action_event_raw_payload_persisted",
  },
  {
    rel: "src/lib/v10-server-contracts.ts",
    re: /safe_metadata:\s*input\.safeMetadata\b/,
    issue: "v10_audit_raw_metadata_persisted",
  },
  {
    rel: "src/lib/product-telemetry.ts",
    re: /details:\s*input\.details\b/,
    issue: "product_telemetry_raw_details_persisted",
  },
];

function read(rel, root = ROOT) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
}

export function analyzePersistenceRedaction(root = ROOT) {
  const issues = [];
  for (const site of REQUIRED_SITES) {
    const source = read(site.rel, root);
    if (source == null) {
      issues.push({ issue: "missing_required_redaction_site", rel: site.rel });
      continue;
    }
    for (const marker of site.markers) {
      if (!source.includes(marker)) {
        issues.push({ issue: "missing_redaction_marker", rel: site.rel, marker });
      }
    }
  }
  for (const pattern of FORBIDDEN_RAW_PATTERNS) {
    const source = read(pattern.rel, root);
    if (source && pattern.re.test(source)) {
      issues.push({ issue: pattern.issue, rel: pattern.rel });
    }
  }
  return {
    checkId: "persistence-redaction",
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzePersistenceRedaction();
  console.log(JSON.stringify(report, null, 2));
  if (report.issueCount > 0) process.exit(1);
}
