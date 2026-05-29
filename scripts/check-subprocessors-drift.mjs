#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const SUBPROCESSORS_REL = "artifacts/subprocessors.json";
const DIFF_ARTIFACT_REL = "artifacts/subprocessors-diff.json";
const BASELINE_REL = "scripts/subprocessors-baseline.sha256";
const CHECKSUM_PREFIX = "sha256-";

const REQUIRED_FIELDS = [
  "id",
  "name",
  "purpose",
  "dataClasses",
  "region",
  "owner",
  "changeDate",
  "checksum",
  "notificationSlaDays",
];

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function readText(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel, fallback = null) {
  const text = readText(root, rel);
  return text ? JSON.parse(text) : fallback;
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(root, rel) {
  return sha256Text(fs.readFileSync(path.join(root, rel)));
}

function canonicalSubprocessorPayload(row) {
  return stableJson({
    changeDate: row.changeDate,
    dataClasses: [...(row.dataClasses ?? [])].sort((a, b) => a.localeCompare(b)),
    id: row.id,
    lastNotifiedAt: row.lastNotifiedAt ?? null,
    name: row.name,
    nextReviewDue: row.nextReviewDue ?? null,
    noticeLeadTimeDays: row.noticeLeadTimeDays ?? null,
    notificationSlaDays: row.notificationSlaDays,
    owner: row.owner,
    privacyInventoryRefs: [...(row.privacyInventoryRefs ?? [])].sort((a, b) => a.localeCompare(b)),
    purpose: row.purpose,
    region: row.region,
    validationCommand: row.validationCommand ?? null,
  });
}

function subprocessorChecksum(row) {
  return `${CHECKSUM_PREFIX}${sha256Text(canonicalSubprocessorPayload(row))}`;
}

function readBaselineHash(root) {
  const raw = readText(root, BASELINE_REL).trim();
  return raw ? raw.split(/\s+/u)[0] : null;
}

function validateSubprocessors(root, packageScripts) {
  const issues = [];
  const data = readJson(root, SUBPROCESSORS_REL, null);
  if (!data) {
    return {
      schemaVersion: null,
      source: null,
      subprocessorCount: 0,
      rows: [],
      issues: [{ issue: "subprocessor_artifact_missing", artifact: SUBPROCESSORS_REL }],
    };
  }
  if (data.schemaVersion !== 1 || data.source !== "code-owned-subprocessor-register") {
    issues.push({ issue: "subprocessor_invalid_artifact_metadata" });
  }
  if (Number(data.notificationSlaDays ?? 0) < 30) {
    issues.push({ issue: "subprocessor_global_notification_sla_too_short" });
  }
  const rows = data.subprocessors || data.vendors || [];
  const ids = new Set();
  for (const row of rows) {
    const target = row.id || row.name || "(missing)";
    if (ids.has(row.id)) issues.push({ issue: "subprocessor_duplicate_id", id: row.id });
    if (row.id) ids.add(row.id);
    for (const field of REQUIRED_FIELDS) {
      const value = row[field];
      const missing =
        Array.isArray(value) ? value.length === 0 : typeof value === "string" ? value.trim().length === 0 : value == null;
      if (missing) issues.push({ issue: "subprocessor_required_field_missing", id: target, field });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(String(row.changeDate ?? ""))) {
      issues.push({ issue: "subprocessor_change_date_invalid", id: target, changeDate: row.changeDate ?? null });
    }
    if (Number(row.notificationSlaDays ?? 0) < 30) {
      issues.push({ issue: "subprocessor_notification_sla_too_short", id: target });
    }
    if (Number(row.noticeLeadTimeDays ?? 0) < 30) {
      issues.push({ issue: "subprocessor_notice_lead_time_too_short", id: target });
    }
    const expectedChecksum = subprocessorChecksum(row);
    if (row.checksum !== expectedChecksum) {
      issues.push({ issue: "subprocessor_checksum_mismatch", id: target, expectedChecksum, actualChecksum: row.checksum ?? null });
    }
    if (row.validationCommand && !packageScripts[row.validationCommand]) {
      issues.push({ issue: "subprocessor_validation_command_unknown", id: target, validationCommand: row.validationCommand });
    }
  }
  return {
    schemaVersion: data.schemaVersion ?? null,
    source: data.source ?? null,
    subprocessorCount: rows.length,
    rows: rows.map((row) => ({
      id: row.id ?? null,
      name: row.name ?? null,
      owner: row.owner ?? null,
      region: row.region ?? null,
      dataClasses: row.dataClasses ?? [],
      checksum: row.checksum ?? null,
    })),
    issues,
  };
}

export function analyzeSubprocessorsDrift(root = DEFAULT_ROOT, options = {}) {
  const strict = Boolean(options.strict);
  const packageScripts = readJson(root, "package.json", { scripts: {} })?.scripts ?? {};
  const integrity = validateSubprocessors(root, packageScripts);
  const currentHash = fs.existsSync(path.join(root, SUBPROCESSORS_REL)) ? sha256File(root, SUBPROCESSORS_REL) : null;
  const baselineHash = readBaselineHash(root);
  const baselinePresent = Boolean(baselineHash);
  const changed = Boolean(currentHash && baselineHash && currentHash !== baselineHash);
  const driftIssue = changed
    ? {
        issue: "subprocessor_artifact_hash_drift",
        artifact: SUBPROCESSORS_REL,
        baselineHash,
        currentHash,
        updateCommand: "shasum -a 256 artifacts/subprocessors.json > scripts/subprocessors-baseline.sha256",
      }
    : null;
  const issues = [...integrity.issues];
  if (strict && driftIssue) issues.push(driftIssue);
  if (!baselinePresent) issues.push({ issue: "subprocessor_baseline_missing", baseline: BASELINE_REL });

  return {
    schemaVersion: 1,
    source: "code-owned-subprocessor-drift",
    artifact: SUBPROCESSORS_REL,
    diffArtifact: DIFF_ARTIFACT_REL,
    baseline: BASELINE_REL,
    ok: issues.length === 0,
    baselineHash,
    currentHash,
    changed,
    integrity: {
      schemaVersion: integrity.schemaVersion,
      source: integrity.source,
      subprocessorCount: integrity.subprocessorCount,
      rows: integrity.rows,
    },
    drift: driftIssue ? [driftIssue] : [],
    issueCount: issues.length,
    issues,
  };
}

function main() {
  const strict = process.argv.includes("--strict");
  const write = process.argv.includes("--write");
  const report = analyzeSubprocessorsDrift(DEFAULT_ROOT, { strict });

  if (write) {
    writeJson(DEFAULT_ROOT, DIFF_ARTIFACT_REL, report);
  } else {
    const existing = readJson(DEFAULT_ROOT, DIFF_ARTIFACT_REL, null);
    if (!existing) {
      report.issues.push({ issue: "subprocessor_diff_artifact_missing", artifact: DIFF_ARTIFACT_REL });
      report.issueCount = report.issues.length;
      report.ok = false;
    } else if (stableStringify(existing) !== stableStringify(report)) {
      report.issues.push({
        issue: "subprocessor_diff_artifact_drift",
        artifact: DIFF_ARTIFACT_REL,
        writeCommand: "npm run write:subprocessors-drift",
      });
      report.issueCount = report.issues.length;
      report.ok = false;
    }
  }

  console.log(stableStringify(report));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
