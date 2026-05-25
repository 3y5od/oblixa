#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_REGISTRY_REL = "scripts/supabase-advisor-warning-registry.json";
const VALID_LEVELS = new Set(["error", "warn", "info"]);

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function readJson(file) {
  return JSON.parse(read(file));
}

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function normalizeLevel(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "warning") return "warn";
  if (raw === "fatal") return "error";
  return raw || "unknown";
}

function advisorNameFor(row) {
  return String(row?.advisorName ?? row?.name ?? row?.title ?? row?.check_name ?? row?.advisor ?? "unknown_advisor")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "") || "unknown_advisor";
}

function advisorEntityFor(row) {
  return row?.metadata?.name ?? row?.metadata?.entity ?? row?.metadata?.table ?? row?.metadata?.function ?? row?.detail ?? null;
}

export function parseSupabaseAdvisorPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.advisors)) return payload.advisors;
  if (Array.isArray(payload?.findings)) return payload.findings;
  if (payload && typeof payload === "object") return [payload];
  return [];
}

export function normalizeSupabaseAdvisorRows(payload) {
  return parseSupabaseAdvisorPayload(payload).map((row) => ({
    advisorName: advisorNameFor(row),
    level: normalizeLevel(row?.level ?? row?.severity),
    title: row?.title ?? row?.name ?? advisorNameFor(row),
    detail: row?.detail ?? row?.description ?? row?.message ?? null,
    entity: advisorEntityFor(row),
  }));
}

export function summarizeSupabaseAdvisorRows(payload) {
  const rows = normalizeSupabaseAdvisorRows(payload);
  const byName = {};
  const byLevel = {};
  const samples = {};

  for (const row of rows) {
    byName[row.advisorName] = (byName[row.advisorName] ?? 0) + 1;
    byLevel[row.level] = (byLevel[row.level] ?? 0) + 1;
    const bucket = samples[row.advisorName] ?? [];
    if (row.entity && !bucket.includes(row.entity) && bucket.length < 12) bucket.push(row.entity);
    samples[row.advisorName] = bucket;
  }

  return { total: rows.length, byLevel, byName, samples };
}

function loadRegistry(root, registryRel) {
  const abs = path.join(root, registryRel);
  if (!fs.existsSync(abs)) return null;
  return readJson(abs);
}

function validateRegistry(registry, registryRel) {
  const issues = [];
  if (!registry) {
    return [{ issue: "supabase_advisor_registry_missing", path: registryRel }];
  }
  if (registry.schemaVersion !== 1) {
    issues.push({ issue: "invalid_supabase_advisor_registry_schema", path: registryRel });
  }
  if (!Array.isArray(registry.reviewedWarnings)) {
    issues.push({ issue: "invalid_supabase_advisor_registry_entries", path: registryRel });
    return issues;
  }

  const seen = new Set();
  registry.reviewedWarnings.forEach((entry, index) => {
    const rowPath = `${registryRel}#reviewedWarnings[${index}]`;
    const advisorName = advisorNameFor(entry);
    const level = normalizeLevel(entry?.level);
    const key = `${level}:${advisorName}`;

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      issues.push({ issue: "invalid_supabase_advisor_registry_entry", path: rowPath });
      return;
    }
    if (advisorName === "unknown_advisor") {
      issues.push({ issue: "missing_supabase_advisor_name", path: rowPath });
    }
    if (level !== "warn") {
      issues.push({ issue: "invalid_supabase_advisor_registry_level", path: rowPath, level });
    }
    for (const field of ["owner", "reason", "reviewDate"]) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") {
        issues.push({ issue: "missing_supabase_advisor_registry_field", path: rowPath, field });
      }
    }
    if (typeof entry.reviewDate === "string" && !/^\d{4}-\d{2}-\d{2}$/u.test(entry.reviewDate)) {
      issues.push({ issue: "invalid_supabase_advisor_review_date", path: rowPath, reviewDate: entry.reviewDate });
    }
    if (seen.has(key)) {
      issues.push({ issue: "duplicate_supabase_advisor_registry_entry", path: rowPath, advisorName, level });
    }
    seen.add(key);
  });

  return issues;
}

function reviewedWarningSet(registry) {
  return new Set((registry?.reviewedWarnings ?? []).map((entry) => `${normalizeLevel(entry.level)}:${advisorNameFor(entry)}`));
}

export function analyzeSupabaseAdvisorRegistryFromRows({
  rows = [],
  registry,
  registryRel = DEFAULT_REGISTRY_REL,
  strictWarnings = false,
} = {}) {
  const issues = validateRegistry(registry, registryRel);
  const warnings = [];
  const reviewed = reviewedWarningSet(registry);
  const advisors = normalizeSupabaseAdvisorRows(rows);

  for (const advisor of advisors) {
    if (advisor.level === "error") {
      issues.push({
        issue: "supabase_advisor_error",
        advisorName: advisor.advisorName,
        title: advisor.title,
        entity: advisor.entity,
      });
      continue;
    }
    if (advisor.level === "warn" && !reviewed.has(`warn:${advisor.advisorName}`)) {
      const warning = {
        warning: "unregistered_supabase_advisor_warning",
        advisorName: advisor.advisorName,
        title: advisor.title,
        entity: advisor.entity,
      };
      warnings.push(warning);
      if (strictWarnings) issues.push({ issue: warning.warning, ...warning });
      continue;
    }
    if (!VALID_LEVELS.has(advisor.level)) {
      warnings.push({
        warning: "unknown_supabase_advisor_level",
        advisorName: advisor.advisorName,
        level: advisor.level,
        title: advisor.title,
      });
    }
  }

  return {
    ok: issues.length === 0,
    registryPath: registryRel,
    advisorCount: advisors.length,
    summary: summarizeSupabaseAdvisorRows(advisors),
    issueCount: issues.length,
    warningCount: warnings.length,
    issues,
    warnings,
  };
}

export function analyzeSupabaseAdvisorRegistry(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const registryRel = toPosix(options.registryRel ?? DEFAULT_REGISTRY_REL);
  const registry = loadRegistry(root, registryRel);
  const inputPath = options.inputPath ? path.resolve(root, options.inputPath) : null;
  const rows = inputPath ? parseSupabaseAdvisorPayload(readJson(inputPath)) : [];
  return analyzeSupabaseAdvisorRegistryFromRows({
    rows,
    registry,
    registryRel,
    strictWarnings: Boolean(options.strictWarnings),
  });
}

export function analyzeSupabaseAdvisorRows(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const registryRel = toPosix(options.registryRel ?? DEFAULT_REGISTRY_REL);
  return analyzeSupabaseAdvisorRegistryFromRows({
    rows: options.rows ?? [],
    registry: loadRegistry(root, registryRel),
    registryRel,
    strictWarnings: Boolean(options.strictWarnings),
  });
}

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    registryRel: DEFAULT_REGISTRY_REL,
    inputPath: null,
    strictWarnings: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--registry") {
      options.registryRel = toPosix(argv[index + 1] ?? DEFAULT_REGISTRY_REL);
      index += 1;
    } else if (arg.startsWith("--registry=")) {
      options.registryRel = toPosix(arg.slice("--registry=".length));
    } else if (arg === "--input") {
      options.inputPath = argv[index + 1] ?? null;
      index += 1;
    } else if (arg.startsWith("--input=")) {
      options.inputPath = arg.slice("--input=".length);
    } else if (arg === "--strict-warnings") {
      options.strictWarnings = true;
    }
  }

  return options;
}

export function runSupabaseAdvisorRegistryCheck(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeSupabaseAdvisorRegistry(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSupabaseAdvisorRegistryCheck();
}
