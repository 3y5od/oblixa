#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const DEFAULT_MANIFEST_REL = "e2e-quarantine.json";
const STRICT = process.argv.includes("--strict");

const REQUIRED_FIELDS = ["id", "path", "reason", "owner", "expiry", "issue", "replacementCoverage", "reenableCommand"];
const ISSUE_PATTERN = /^(?:GH-\d+|https:\/\/[^\s]+)$/i;
const ID_PATTERN = /^qnt-[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJson(abs) {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function packageScripts(root) {
  const pkgPath = path.join(root, "package.json");
  return fs.existsSync(pkgPath) ? readJson(pkgPath).scripts ?? {} : {};
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function validExpiry(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = Date.parse(`${value}T23:59:59.999Z`);
  return !Number.isNaN(parsed) && parsed >= Date.now();
}

function reenableCommandScript(command) {
  const match = String(command ?? "").trim().match(/^npm run ([^\s]+)(?:\s|$)/u);
  return match?.[1] ?? null;
}

export function analyzeE2eQuarantine(root = ROOT, options = {}) {
  const manifestRel = options.manifestRel ?? DEFAULT_MANIFEST_REL;
  const manifestPath = path.join(root, manifestRel);
  const strict = Boolean(options.strict);
  if (!fs.existsSync(manifestPath)) {
    return {
      ok: true,
      mode: "no_manifest",
      manifest: manifestRel,
      quarantined: 0,
      issueCount: 0,
      issues: [],
      requiredFields: REQUIRED_FIELDS,
    };
  }

  const data = readJson(manifestPath);
  const scripts = packageScripts(root);
  const rows = Array.isArray(data.files) ? data.files : [];
  const issues = [];
  const seenIds = new Set();

  if (!Array.isArray(data.files)) {
    issues.push(issue("e2e_quarantine_files_not_array", { manifest: manifestRel }));
  }

  for (const [index, row] of rows.entries()) {
    const rowId = row?.id ?? `row-${index}`;
    for (const field of REQUIRED_FIELDS) {
      if (row?.[field] === undefined || row?.[field] === null || row?.[field] === "") {
        issues.push(issue("e2e_quarantine_missing_required_field", { row: rowId, field }));
      }
    }

    if (typeof row?.id === "string") {
      if (!ID_PATTERN.test(row.id)) issues.push(issue("e2e_quarantine_invalid_id", { row: rowId, id: row.id }));
      if (seenIds.has(row.id)) issues.push(issue("e2e_quarantine_duplicate_id", { row: rowId, id: row.id }));
      seenIds.add(row.id);
    }

    if (typeof row?.owner !== "string" || !row.owner.startsWith("@")) {
      issues.push(issue("e2e_quarantine_invalid_owner", { row: rowId, owner: row?.owner ?? null }));
    }

    if (typeof row?.path === "string") {
      if (!fs.existsSync(path.join(root, row.path))) {
        issues.push(issue("e2e_quarantine_missing_test_path", { row: rowId, path: row.path }));
      }
    }

    if (typeof row?.reason !== "string" || row.reason.trim().length < 12) {
      issues.push(issue("e2e_quarantine_reason_too_short", { row: rowId }));
    }

    if (!validExpiry(row?.expiry)) {
      issues.push(issue("e2e_quarantine_invalid_or_expired_expiry", { row: rowId, expiry: row?.expiry ?? null }));
    }

    if (typeof row?.issue !== "string" || !ISSUE_PATTERN.test(row.issue)) {
      issues.push(issue("e2e_quarantine_issue_not_linked", { row: rowId, issue: row?.issue ?? null }));
    }

    const replacementCoverage = row?.replacementCoverage;
    const hasReplacementCoverage =
      typeof replacementCoverage === "string"
        ? replacementCoverage.trim().length > 0
        : Array.isArray(replacementCoverage) && replacementCoverage.some((entry) => String(entry).trim().length > 0);
    if (!hasReplacementCoverage) {
      issues.push(issue("e2e_quarantine_missing_replacement_coverage", { row: rowId }));
    }

    const script = reenableCommandScript(row?.reenableCommand);
    if (!script) {
      issues.push(issue("e2e_quarantine_invalid_reenable_command", { row: rowId, reenableCommand: row?.reenableCommand ?? null }));
    } else if (!scripts[script]) {
      issues.push(issue("e2e_quarantine_reenable_script_missing", { row: rowId, script }));
    }
  }

  const report = {
    ok: issues.length === 0 || !strict,
    mode: strict ? "strict" : "report",
    manifest: manifestRel,
    quarantined: rows.length,
    requiredFields: REQUIRED_FIELDS,
    rows: rows.map((row) => ({
      id: row.id ?? null,
      path: row.path ?? null,
      owner: row.owner ?? null,
      expiry: row.expiry ?? null,
      issue: row.issue ?? null,
      reenableCommand: row.reenableCommand ?? null,
    })),
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeE2eQuarantine(ROOT, { strict: STRICT });
  console.log(stableStringify(report));
  if (!report.ok) process.exitCode = 1;
}
