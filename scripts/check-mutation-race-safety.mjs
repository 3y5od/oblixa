#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const TARGET_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const DUPLICATE_GUARD_RE =
  /\b(enforceIdempotency|executeV10IdempotentMutation|executeV10AuditedMutation|getV10IdempotencyKeyFromRequest)\b|duplicate|dedupe|onConflict|23505|already_processed|processed_event|event\.id/i;
const JOB_LOCK_RE = /\b(withCronRoute|withV6CronRoute|runCronRoute)\s*\(|\b(lock|claim|lease)\b|SKIP LOCKED|for update/i;
const TERMINAL_STATE_RE =
  /\.eq\s*\(\s*["']status["']|\.in\s*\(\s*["']status["']|\bstatus\s*(?:===|!==|==|!=)|\b(?:terminal|closed|completed|cancelled|canceled|expired|approved|rejected|resolved|reverted)\b/i;
const OPTIMISTIC_WRITE_RE =
  /\b(expectedVersion|expected_version|current_version|stale_version|if_match|If-Match)\b|\.eq\s*\(\s*["'](?:updated_at|version)["']/i;
const AUDIT_BEFORE_WRITE_RE = /\b(recordApiMutationAuditEvent|recordSecurityAuditEvent)\b/g;
const SAFE_PRE_IDEMPOTENCY_SECURITY_AUDIT_RE =
  /outcome:\s*["']forbidden["']|action:\s*["'][^"']*(?:[_.](?:blocked|denied)|_(?:blocked|denied))[^"']*["']/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadRouteMatrix(root) {
  const matrixPath = path.join(root, "artifacts", "security-route-matrix.json");
  if (!fs.existsSync(matrixPath)) return { rows: [], issues: [{ issue: "missing_route_matrix", path: matrixPath }] };
  const parsed = readJson(matrixPath);
  return { rows: Array.isArray(parsed) ? parsed : parsed.rows ?? parsed.routes ?? [], issues: [] };
}

function handlerBlockFromSource(source, method) {
  const escapedMethod = method.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startRe = new RegExp(`export\\s+async\\s+function\\s+${escapedMethod}\\s*\\(`);
  const match = startRe.exec(source);
  if (!match) return source;
  const nextRe = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/g;
  nextRe.lastIndex = match.index + match[0].length;
  const next = nextRe.exec(source);
  return source.slice(match.index, next?.index ?? source.length);
}

function keyFor(row) {
  return `${row.method ?? "UNKNOWN"} ${row.path ?? row.route_file ?? "unknown"}`;
}

function detectSignals(source) {
  const signals = [];
  if (DUPLICATE_GUARD_RE.test(source)) signals.push("duplicate_guard");
  if (JOB_LOCK_RE.test(source)) signals.push("job_lock_or_claim");
  if (TERMINAL_STATE_RE.test(source)) signals.push("terminal_state_guard");
  if (OPTIMISTIC_WRITE_RE.test(source)) signals.push("optimistic_write_guard");
  return signals;
}

function hasUnsafeAuditBeforeIdempotency(source, idempotencyIndex) {
  AUDIT_BEFORE_WRITE_RE.lastIndex = 0;
  for (let match = AUDIT_BEFORE_WRITE_RE.exec(source); match; match = AUDIT_BEFORE_WRITE_RE.exec(source)) {
    if (match.index >= idempotencyIndex) return false;
    if (match[1] === "recordApiMutationAuditEvent") return true;

    const auditCallSource = source.slice(match.index, Math.min(idempotencyIndex, match.index + 800));
    if (!SAFE_PRE_IDEMPOTENCY_SECURITY_AUDIT_RE.test(auditCallSource)) return true;
  }
  return false;
}

function expectedSignalForPolicy(policy) {
  if (policy === "idempotency_or_duplicate_guard") return ["duplicate_guard"];
  if (policy === "job_lock_or_claim") return ["job_lock_or_claim", "duplicate_guard"];
  if (policy === "terminal_state_guard") {
    return ["terminal_state_guard", "optimistic_write_guard", "duplicate_guard"];
  }
  return [];
}

function hasExpectedSignal(signals, policy) {
  const expected = expectedSignalForPolicy(policy);
  if (expected.length === 0) return true;
  return expected.some((signal) => signals.includes(signal));
}

export function analyzeMutationRaceSafety(root = ROOT) {
  const { rows, issues } = loadRouteMatrix(root);
  const signalCounts = {};
  const policyCounts = {};
  let checkedRowCount = 0;

  for (const row of rows) {
    const method = String(row.method ?? "").toUpperCase();
    const routeFile = row.route_file;
    const policy = row.idempotency_or_job_lock_policy ?? "missing";
    if (policy) policyCounts[policy] = (policyCounts[policy] ?? 0) + 1;
    if (!TARGET_METHODS.has(method)) continue;

    const isCronRoute = String(row.path ?? "").includes("/api/cron/");
    const requiresRaceSafety = MUTATING_METHODS.has(method) || isCronRoute;
    if (!requiresRaceSafety) continue;
    checkedRowCount += 1;

    if (policy === "side_effect_policy_required" || policy === "cron_job_lock_required") {
      issues.push({ issue: policy, route: keyFor(row), routeFile });
      continue;
    }
    if (MUTATING_METHODS.has(method) && policy === "not_applicable") {
      issues.push({ issue: "mutating_route_missing_race_safety_policy", route: keyFor(row), routeFile });
      continue;
    }

    if (!routeFile) {
      issues.push({ issue: "missing_route_file_reference", route: keyFor(row) });
      continue;
    }
    const abs = path.join(root, routeFile);
    if (!fs.existsSync(abs)) {
      issues.push({ issue: "route_file_missing", route: keyFor(row), routeFile });
      continue;
    }

    const handlerSource = handlerBlockFromSource(fs.readFileSync(abs, "utf8"), method);
    const signals = detectSignals(handlerSource);
    for (const signal of signals) signalCounts[signal] = (signalCounts[signal] ?? 0) + 1;

    if (!hasExpectedSignal(signals, policy)) {
      issues.push({
        issue: "race_safety_signal_missing",
        route: keyFor(row),
        routeFile,
        policy,
        expectedAnyOf: expectedSignalForPolicy(policy),
        detectedSignals: signals,
      });
    }

    const idempotencyIndex = handlerSource.indexOf("enforceIdempotency");
    if (idempotencyIndex >= 0) {
      if (hasUnsafeAuditBeforeIdempotency(handlerSource, idempotencyIndex)) {
        issues.push({
          issue: "audit_before_idempotency_guard",
          route: keyFor(row),
          routeFile,
        });
      }
    }
  }

  return {
    checkId: "mutation-race-safety",
    ok: issues.length === 0,
    routeMatrixRowCount: rows.length,
    checkedRowCount,
    issueCount: issues.length,
    policyCounts,
    signalCounts,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeMutationRaceSafety();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
