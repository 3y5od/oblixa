#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const CONFIG_REL = "config/security-external-obligations.json";
const CLOSURE_REL = "config/maximal-security-closure-register.json";
const EVIDENCE_REL = "artifacts/security-external-obligations-evidence.json";
const STRICT_ENV_KEYS = ["OBLIXA_RELEASE_SECURITY_STRICT", "SECURITY_RELEASE_STRICT"];
const REVIEW_CYCLES = new Set(["annual", "quarterly", "ad-hoc"]);
const EVIDENCE_STATUSES = new Set(["reviewed", "accepted-risk", "manual-boundary"]);

function readJson(root, rel, fallback = null) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? JSON.parse(fs.readFileSync(abs, "utf8")) : fallback;
}

function isStrictEnv(env) {
  return STRICT_ENV_KEYS.some((key) => env[key] === "1" || env[key] === "true");
}

function dateOnlyMs(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(ms) ? ms : null;
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function evidenceRefExists(root, ref) {
  if (typeof ref !== "string" || !ref.trim()) return false;
  if (/^(?:https:\/\/|external:\/\/)/u.test(ref)) return true;
  return fs.existsSync(path.join(root, ref));
}

function validateObligations(config, closure, issues) {
  const rows = Array.isArray(config?.obligations) ? config.obligations : [];
  if (config?.version !== 2) issues.push(issue("external_obligations_version_mismatch"));
  if (!Array.isArray(config?.obligations)) issues.push(issue("external_obligations_missing_array"));

  const seen = new Set();
  for (const row of rows) {
    if (!/^ext-[a-z0-9-]+$/u.test(row?.id ?? "")) {
      issues.push(issue("external_obligation_invalid_id", { id: row?.id ?? null }));
    }
    if (seen.has(row.id)) issues.push(issue("external_obligation_duplicate_id", { id: row.id }));
    seen.add(row.id);
    if (typeof row.owner !== "string" || !row.owner.trim()) {
      issues.push(issue("external_obligation_missing_owner", { id: row.id ?? null }));
    }
    if (!REVIEW_CYCLES.has(row.reviewCycle)) {
      issues.push(issue("external_obligation_invalid_review_cycle", { id: row.id ?? null, reviewCycle: row.reviewCycle ?? null }));
    }
    const closureRow = closure?.phases?.[row.id] ?? closure?.[row.id];
    if (!closureRow || closureRow.path !== CONFIG_REL) {
      issues.push(issue("external_obligation_missing_closure_register_row", { id: row.id }));
    }
  }
  return rows;
}

function validateStrictEvidence(root, obligations, evidence, issues, nowMs) {
  if (!evidence) {
    issues.push(issue("external_obligations_evidence_missing", { path: EVIDENCE_REL }));
    return;
  }
  if (evidence.schemaVersion !== 1 || evidence.generatedFrom !== CONFIG_REL) {
    issues.push(issue("external_obligations_evidence_metadata_mismatch", { path: EVIDENCE_REL }));
  }
  const rows = Array.isArray(evidence.obligations) ? evidence.obligations : [];
  if (!Array.isArray(evidence.obligations)) {
    issues.push(issue("external_obligations_evidence_rows_missing", { path: EVIDENCE_REL }));
  }
  const evidenceById = new Map(rows.map((row) => [row.id, row]));
  for (const obligation of obligations) {
    const row = evidenceById.get(obligation.id);
    if (!row) {
      issues.push(issue("external_obligation_evidence_row_missing", { id: obligation.id }));
      continue;
    }
    if (!EVIDENCE_STATUSES.has(row.status)) {
      issues.push(issue("external_obligation_evidence_invalid_status", { id: obligation.id, status: row.status ?? null }));
    }
    if (typeof row.reviewer !== "string" || !row.reviewer.trim()) {
      issues.push(issue("external_obligation_evidence_missing_reviewer", { id: obligation.id }));
    }
    if (dateOnlyMs(row.reviewedAt) === null) {
      issues.push(issue("external_obligation_evidence_invalid_reviewed_at", { id: obligation.id, reviewedAt: row.reviewedAt ?? null }));
    }
    const expiresAtMs = dateOnlyMs(row.expiresAt);
    if (expiresAtMs === null || expiresAtMs <= nowMs) {
      issues.push(issue("external_obligation_evidence_invalid_expiry", { id: obligation.id, expiresAt: row.expiresAt ?? null }));
    }
    if (!evidenceRefExists(root, row.evidenceRef)) {
      issues.push(issue("external_obligation_evidence_ref_missing", { id: obligation.id, evidenceRef: row.evidenceRef ?? null }));
    }
  }
}

export function analyzeSecurityExternalObligations(options = {}) {
  const root = options.root ?? ROOT;
  const env = options.env ?? process.env;
  const strict = options.strict ?? isStrictEnv(env);
  const nowMs = options.nowMs ?? Date.now();
  const issues = [];
  const config = readJson(root, CONFIG_REL, null);
  const closure = readJson(root, CLOSURE_REL, {});
  const evidence = readJson(root, EVIDENCE_REL, null);

  if (!config) {
    issues.push(issue("external_obligations_config_missing", { path: CONFIG_REL }));
  }
  const obligations = validateObligations(config, closure, issues);
  if (strict) validateStrictEvidence(root, obligations, evidence, issues, nowMs);

  return {
    checkId: "security-external-obligations",
    ok: issues.length === 0,
    mode: strict ? "strict_release" : "advisory",
    configPath: CONFIG_REL,
    evidencePath: EVIDENCE_REL,
    obligationCount: obligations.length,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSecurityExternalObligations({ strict: process.argv.includes("--strict") ? true : undefined });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
