#!/usr/bin/env node
/**
 * Validates config/qa-external-waiver-registry.json against the unified operational waiver schema.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REGISTRY_REL = "config/qa-external-waiver-registry.json";
const CONFIG_REL = "config/operational-waivers-ratchets.json";
const OBJECTIVES_REL = "config/operational-hardening-objectives.json";

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function dateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(time) ? null : time;
}

function todayUtcDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(startDate, endDate) {
  const start = dateOnly(startDate);
  const end = dateOnly(endDate);
  if (start === null || end === null) return null;
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

function issue(reason, fields = {}) {
  return { reason, ...fields };
}

function main() {
  const registry = readJson(REGISTRY_REL);
  const config = readJson(CONFIG_REL);
  const scripts = readJson("package.json").scripts ?? {};
  const objectives = readJson(OBJECTIVES_REL).objectives ?? [];
  const objectiveIds = new Set(objectives.map((row) => row.id));
  const requiredFields = config.requiredWaiverFields ?? [];
  const allowedRiskLevels = new Set(config.allowedRiskLevels ?? []);
  const allowedBlockerClasses = new Set(config.allowedBlockerClasses ?? []);
  const waivers = Array.isArray(registry.waivers) ? registry.waivers : [];
  const ids = new Set();
  const scopes = new Set();
  const bad = [];
  const issuePattern = /^(GH-\d+|https:\/\/)/i;

  if (registry.version !== 1) {
    bad.push(issue("invalid_registry_version", { version: registry.version }));
  }
  if (!Array.isArray(registry.waivers)) {
    bad.push(issue("waivers_not_array"));
  }

  for (const w of waivers) {
    for (const field of requiredFields) {
      if (w[field] === undefined || w[field] === null || String(w[field]).trim() === "") {
        bad.push(issue("missing_required_field", { id: w.id ?? "(missing)", field }));
      }
    }
    if (ids.has(w.id)) bad.push(issue("duplicate_id", { id: w.id }));
    ids.add(w.id);
    if (scopes.has(w.scope)) bad.push(issue("duplicate_scope", { id: w.id, scope: w.scope }));
    scopes.add(w.scope);
    if (w.issue && !issuePattern.test(String(w.issue))) bad.push(issue("invalid_issue", { id: w.id, issue: w.issue }));
    if (!allowedRiskLevels.has(w.risk)) bad.push(issue("invalid_risk", { id: w.id, risk: w.risk }));
    if (!allowedBlockerClasses.has(w.blockerClass)) {
      bad.push(issue("invalid_blocker_class", { id: w.id, blockerClass: w.blockerClass }));
    }
    if (w.expiry !== w.expires) {
      bad.push(issue("expiry_alias_mismatch", { id: w.id, expiry: w.expiry, expires: w.expires }));
    }
    if (dateOnly(w.expiry) === null) {
      bad.push(issue("invalid_expiry", { id: w.id, expiry: w.expiry }));
    } else if (daysBetween(todayUtcDateOnly(), w.expiry) < 0) {
      bad.push(issue("expired", { id: w.id, expiry: w.expiry }));
    }
    if (dateOnly(w.lastReviewedDate) === null) {
      bad.push(issue("invalid_last_reviewed_date", { id: w.id, lastReviewedDate: w.lastReviewedDate }));
    }
    if (!scripts[w.validationCommand]) {
      bad.push(issue("unknown_validation_command", { id: w.id, validationCommand: w.validationCommand }));
    }
    if (!objectiveIds.has(w.replacementObjective)) {
      bad.push(issue("unknown_replacement_objective", { id: w.id, replacementObjective: w.replacementObjective }));
    }
    const usagePaths = [
      w.policy_path,
      w.workflow_path,
      ...(Array.isArray(w.usagePaths) ? w.usagePaths : []),
    ].filter(Boolean);
    if (usagePaths.length === 0) {
      bad.push(issue("unused_no_usage_path", { id: w.id }));
    }
    for (const usagePath of usagePaths) {
      if (!fs.existsSync(path.join(ROOT, usagePath))) {
        bad.push(issue("usage_path_missing", { id: w.id, usagePath }));
      }
    }
  }

  if (bad.length) {
    console.error(JSON.stringify({ ok: false, bad }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, waivers: waivers.length }, null, 2));
}

main();
