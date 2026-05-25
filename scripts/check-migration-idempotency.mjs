#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const MIGRATIONS_REL = "supabase/migrations";
const DEFAULT_EXCEPTIONS_REL = "scripts/migration-idempotency-exceptions.json";
const DEFAULT_OWNER = "platform-hardening";
const DEFAULT_REVIEWED_DATE = "2026-05-23";

function toPosix(value) {
  return String(value ?? "").replace(/\\/g, "/");
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function listMigrationFiles(root) {
  const dir = path.join(root, MIGRATIONS_REL);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

function normalizeSnippet(value) {
  return String(value)
    .replace(/--.*$/gmu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function statementAt(lines, startIndex) {
  const parts = [];
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 12); index += 1) {
    parts.push(lines[index]);
    if (lines[index].includes(";")) break;
  }
  return parts.join("\n");
}

function findingId({ path: rel, line, issue, statement }) {
  return sha256Text(`${rel}:${line}:${issue}:${normalizeSnippet(statement)}`).slice(0, 20);
}

function pushFinding(findings, fields) {
  findings.push({
    id: findingId(fields),
    ...fields,
    statement: normalizeSnippet(fields.statement).slice(0, 220),
  });
}

export function scanMigrationIdempotency(root = DEFAULT_ROOT) {
  const findings = [];
  for (const file of listMigrationFiles(root)) {
    const rel = `${MIGRATIONS_REL}/${file}`;
    const sql = fs.readFileSync(path.join(root, rel), "utf8");
    const lines = sql.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const statement = statementAt(lines, index);
      const normalized = normalizeSnippet(statement);
      const context = normalizeSnippet(lines.slice(Math.max(0, index - 5), index + 1).join("\n"));
      if (!normalized) continue;

      if (/\bcreate\s+(?:unlogged\s+)?table\s+(?!if\s+not\s+exists\b)/iu.test(line)) {
        pushFinding(findings, {
          issue: "unguarded_create_table",
          path: rel,
          line: index + 1,
          severity: "medium",
          statement,
          recommendation: "Use create table if not exists where replay-safe.",
        });
      }
      if (/\bcreate\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?!if\s+not\s+exists\b)/iu.test(line)) {
        pushFinding(findings, {
          issue: "unguarded_create_index",
          path: rel,
          line: index + 1,
          severity: "medium",
          statement,
          recommendation: "Use create index if not exists where replay-safe.",
        });
      }
      if (/\balter\s+table\b[\s\S]*?\badd\s+column\s+(?!if\s+not\s+exists\b)/iu.test(normalized)) {
        pushFinding(findings, {
          issue: "unguarded_add_column",
          path: rel,
          line: index + 1,
          severity: "medium",
          statement,
          recommendation: "Use alter table add column if not exists where replay-safe.",
        });
      }
      if (/\balter\s+table\b[\s\S]*?\badd\s+constraint\b/iu.test(normalized) && !/\bdo\s+\$\$/iu.test(context)) {
        pushFinding(findings, {
          issue: "unguarded_add_constraint",
          path: rel,
          line: index + 1,
          severity: "medium",
          statement,
          recommendation: "Guard constraint creation with a catalog check when native if-not-exists syntax is unavailable.",
        });
      }
      if (/\b(?:drop\s+table|truncate\s+table|disable\s+row\s+level\s+security)\b/iu.test(normalized) || /\bdrop\s+column\b/iu.test(normalized)) {
        pushFinding(findings, {
          issue: "destructive_schema_change",
          path: rel,
          line: index + 1,
          severity: "high",
          statement,
          recommendation: "Keep destructive changes explicitly reviewed and paired with rollback/readiness notes.",
        });
      }
    }
  }
  return findings.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.issue.localeCompare(b.issue));
}

function loadExceptions(root, exceptionsRel) {
  const abs = path.join(root, exceptionsRel);
  if (!fs.existsSync(abs)) {
    return { schemaVersion: 1, exceptions: [] };
  }
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

export function buildMigrationIdempotencyExceptions(root = DEFAULT_ROOT) {
  const findings = scanMigrationIdempotency(root);
  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-migration-idempotency.mjs --write-exceptions",
    policy: "Existing migration replay risks are visible as reviewed exceptions; new unregistered risky DDL fails check:migration-idempotency.",
    sourceDirectory: MIGRATIONS_REL,
    findingCount: findings.length,
    exceptions: findings.map((finding) => ({
      id: finding.id,
      path: finding.path,
      line: finding.line,
      issue: finding.issue,
      severity: finding.severity,
      owner: DEFAULT_OWNER,
      reason: "Existing migration history predates the idempotency guard; review before editing or replaying this migration.",
      reviewedDate: DEFAULT_REVIEWED_DATE,
      statementFingerprint: sha256Text(finding.statement),
      recommendation: finding.recommendation,
    })),
  };
}

function exceptionKey(exception) {
  return String(exception?.id ?? "");
}

function validateException(exception, issues) {
  for (const field of ["id", "path", "issue", "severity", "owner", "reason", "reviewedDate", "statementFingerprint", "recommendation"]) {
    if (typeof exception?.[field] !== "string" || exception[field].trim() === "") {
      issues.push({ issue: "invalid_idempotency_exception_metadata", id: exception?.id ?? null, field });
    }
  }
  if (!/^[a-f0-9]{20}$/u.test(String(exception?.id ?? ""))) {
    issues.push({ issue: "invalid_idempotency_exception_id", id: exception?.id ?? null });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(String(exception?.reviewedDate ?? ""))) {
    issues.push({ issue: "invalid_idempotency_exception_reviewed_date", id: exception?.id ?? null });
  }
}

export function analyzeMigrationIdempotency(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const exceptionsRel = toPosix(options.exceptionsRel ?? DEFAULT_EXCEPTIONS_REL);
  const findings = scanMigrationIdempotency(root);
  const issues = [];
  let exceptionsPayload;
  try {
    exceptionsPayload = loadExceptions(root, exceptionsRel);
  } catch (error) {
    return {
      ok: false,
      exceptionsPath: exceptionsRel,
      findingCount: findings.length,
      issueCount: 1,
      issues: [{ issue: "idempotency_exceptions_unreadable", path: exceptionsRel, message: error.message }],
      warnings: [],
      findings,
    };
  }

  const exceptions = Array.isArray(exceptionsPayload.exceptions) ? exceptionsPayload.exceptions : [];
  if (exceptionsPayload.schemaVersion !== 1) {
    issues.push({ issue: "invalid_idempotency_exception_schema_version", path: exceptionsRel });
  }
  for (const exception of exceptions) validateException(exception, issues);

  const exceptionById = new Map(exceptions.map((exception) => [exceptionKey(exception), exception]));
  for (const finding of findings) {
    const exception = exceptionById.get(finding.id);
    if (!exception) {
      issues.push({
        issue: "unreviewed_migration_idempotency_finding",
        path: finding.path,
        line: finding.line,
        finding: finding.issue,
        severity: finding.severity,
        recommendation: finding.recommendation,
      });
      continue;
    }
    if (exception.statementFingerprint !== sha256Text(finding.statement)) {
      issues.push({
        issue: "stale_migration_idempotency_exception_fingerprint",
        path: finding.path,
        line: finding.line,
        id: finding.id,
      });
    }
  }

  const currentIds = new Set(findings.map((finding) => finding.id));
  const warnings = exceptions
    .filter((exception) => exceptionKey(exception) && !currentIds.has(exceptionKey(exception)))
    .map((exception) => ({
      issue: "stale_migration_idempotency_exception",
      id: exception.id,
      path: exception.path,
      message: "Exception no longer matches a current finding; this is a ratchet-down candidate.",
    }));

  return {
    ok: issues.length === 0,
    exceptionsPath: exceptionsRel,
    findingCount: findings.length,
    reviewedExceptionCount: exceptions.length,
    unreviewedFindingCount: issues.filter((issue) => issue.issue === "unreviewed_migration_idempotency_finding").length,
    replayUnsafeMigrationCount: new Set(findings.map((finding) => finding.path)).size,
    issueCount: issues.length,
    issues,
    warningCount: warnings.length,
    warnings,
    findings,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, exceptionsRel: DEFAULT_EXCEPTIONS_REL, writeExceptions: false, report: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--exceptions") {
      options.exceptionsRel = toPosix(argv[index + 1] ?? DEFAULT_EXCEPTIONS_REL);
      index += 1;
    } else if (arg.startsWith("--exceptions=")) {
      options.exceptionsRel = toPosix(arg.slice("--exceptions=".length));
    } else if (arg === "--write-exceptions") {
      options.writeExceptions = true;
    } else if (arg === "--report") {
      options.report = true;
    }
  }
  return options;
}

export function runMigrationIdempotencyCheck(options = parseArgs(process.argv.slice(2))) {
  if (options.writeExceptions) {
    const payload = buildMigrationIdempotencyExceptions(options.root);
    const abs = path.join(options.root, options.exceptionsRel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, stableStringify(payload));
    console.log(JSON.stringify({ ok: true, wrote: options.exceptionsRel, findingCount: payload.findingCount }, null, 2));
    return payload;
  }

  const report = analyzeMigrationIdempotency(options);
  const printable = options.report ? report : { ...report, findings: undefined };
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrationIdempotencyCheck();
}
