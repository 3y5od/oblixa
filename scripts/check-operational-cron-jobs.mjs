#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeDuplicateExecutionPolicy } from "./check-duplicate-execution-policy.mjs";
import { analyzeJobLockGuards } from "./check-job-lock-guards.mjs";
import { CRON_ROUTE_EXPECTED_KEYS } from "./cron-route-expected-keys.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-cron-jobs.json";
const ARTIFACT_REL = "artifacts/operational-cron-jobs.json";
const CI_REL = ".github/workflows/ci.yml";
const WRITE = process.argv.includes("--write");
const WRAPPER_HELPERS = ["withCronRoute", "withV6CronRoute", "runCronRoute"];
const AUTH_HELPERS = [
  "authorizeCronRequest",
  "gateCronRequest",
  "ensureCronAuthorized",
  "requireCronAuthorized",
  "requireV5CronAuth",
  "requireV6CronAuth",
  ...WRAPPER_HELPERS,
];

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel) {
  const text = read(root, rel);
  if (!text) throw new Error(`Missing JSON file: ${rel}`);
  return JSON.parse(text);
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function commandText(script) {
  return `npm run ${script}`;
}

function hasHelperImport(text, helper) {
  return new RegExp(`\\b${helper}\\b`, "u").test(text) && /from\s+["'][^"']+["']/u.test(text);
}

function hasHelperCall(text, helper) {
  return new RegExp(`\\b${helper}\\s*\\(`, "u").test(text);
}

function routeToRel(pathname) {
  return `src/app/${pathname.replace(/^\//u, "")}/route.ts`;
}

function routeTestRel(pathname) {
  const base = `src/app/${pathname.replace(/^\//u, "")}`;
  const candidates = [`${base}/route.test.ts`, `${base}/route.test.tsx`];
  return candidates.find((rel) => fs.existsSync(path.join(ROOT, rel))) ?? null;
}

function parseMethods(source) {
  return [...source.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/gu)]
    .map((match) => match[1])
    .sort((a, b) => a.localeCompare(b));
}

function parseRouteOption(source) {
  return source.match(/\broute\s*:\s*["'`]([^"'`]+)["'`]/u)?.[1] ?? null;
}

function parseMaxDurationSeconds(source) {
  const raw = source.match(/export\s+const\s+maxDuration\s*=\s*(\d+)/u)?.[1] ?? null;
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function wrapperHelperFor(source) {
  return WRAPPER_HELPERS.find((helper) => hasHelperImport(source, helper) && hasHelperCall(source, helper)) ?? null;
}

function authHelperFor(source) {
  return AUTH_HELPERS.find((helper) => hasHelperImport(source, helper) && hasHelperCall(source, helper)) ?? null;
}

function ownerAreaFor(pathname) {
  if (pathname.includes("/security/")) return "privacy-security";
  if (pathname.includes("/webhooks/") || pathname.includes("/integrations/") || pathname.includes("stripe")) {
    return "integrations";
  }
  if (pathname.includes("/notifications/") || pathname.includes("/reminders/")) return "notifications";
  if (pathname.includes("/reports/")) return "reporting";
  if (pathname.includes("/maintenance/")) return "platform-runtime";
  return "platform-runtime";
}

function retryPolicyFor(pathname, routeSource, testSource) {
  if (/retry|attempt|backoff/iu.test(`${pathname}\n${routeSource}\n${testSource}`)) return "retry-aware";
  return "single-scheduled-invocation";
}

function parseSchedule(schedule) {
  const parts = String(schedule ?? "").trim().split(/\s+/u);
  if (parts.length !== 5) return { ok: false, cadenceMinutes: null, scheduleClass: "invalid" };
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  if (dayOfMonth !== "*" || month !== "*" || dayOfWeek !== "*") {
    return { ok: true, cadenceMinutes: null, scheduleClass: "custom" };
  }
  const everyMinute = minute.match(/^\*\/(\d+)$/u);
  if (minute === "*" && hour === "*") return { ok: true, cadenceMinutes: 1, scheduleClass: "hourly" };
  if (everyMinute && hour === "*") {
    return { ok: true, cadenceMinutes: Number(everyMinute[1]), scheduleClass: "intra-hour" };
  }
  if (/^\d+$/u.test(minute) && hour === "*") {
    return { ok: true, cadenceMinutes: 60, scheduleClass: "hourly" };
  }
  if (/^\d+$/u.test(minute) && /^\d+$/u.test(hour)) {
    return { ok: true, cadenceMinutes: 1440, scheduleClass: "daily" };
  }
  return { ok: true, cadenceMinutes: null, scheduleClass: "custom" };
}

function validateCommands(root, config, packageScripts, ci, issues) {
  const rows = [];
  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(packageScripts[script]);
      const ciPresent = ci.includes(commandText(script));
      if (!packageScriptPresent) {
        issues.push(issue("operational_cron_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_cron_missing_ci_command", { objective: objective.id, script }));
      }
      rows.push({
        objective: objective.id,
        script,
        ciRequired: Boolean(row.ciRequired),
        packageScriptPresent,
        ciPresent,
        covers: [...(row.covers ?? [])].sort((a, b) => a.localeCompare(b)),
      });
    }
    for (const rel of objective.artifacts ?? []) {
      if (rel !== ARTIFACT_REL && !fs.existsSync(path.join(root, rel))) {
        issues.push(issue("operational_cron_missing_objective_artifact", { objective: objective.id, path: rel }));
      }
    }
  }
  return rows.sort((a, b) => `${a.objective}:${a.script}`.localeCompare(`${b.objective}:${b.script}`));
}

function validateMarkers(root, config, issues) {
  const rows = [];
  for (const markerFile of [...(config.sourceMarkers ?? []), ...(config.testMarkers ?? [])]) {
    const text = read(root, markerFile.path);
    const missing = [];
    if (!text) {
      issues.push(issue("operational_cron_missing_marker_file", { path: markerFile.path }));
      missing.push(...(markerFile.markers ?? []));
    } else {
      for (const marker of markerFile.markers ?? []) {
        if (!text.includes(marker)) {
          missing.push(marker);
          issues.push(issue("operational_cron_missing_marker", { path: markerFile.path, marker }));
        }
      }
    }
    rows.push({
      path: markerFile.path,
      markerCount: markerFile.markers?.length ?? 0,
      missingCount: missing.length,
      ok: missing.length === 0,
    });
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

function buildRegistry(root, config, issues) {
  const vercel = readJson(root, "vercel.json");
  const crons = Array.isArray(vercel.crons) ? vercel.crons : [];
  const seen = new Set();
  const maxAllowedDurationSeconds = config.maxAllowedDurationSeconds ?? 300;
  const registry = [];

  for (const entry of crons) {
    const pathname = typeof entry?.path === "string" ? entry.path.trim() : "";
    const schedule = typeof entry?.schedule === "string" ? entry.schedule.trim() : "";
    if (!pathname || !schedule) {
      issues.push(issue("operational_cron_invalid_vercel_entry", { path: pathname || null, schedule: schedule || null }));
      continue;
    }
    if (seen.has(pathname)) issues.push(issue("operational_cron_duplicate_vercel_path", { path: pathname }));
    seen.add(pathname);

    const routeRel = routeToRel(pathname);
    const testRel = routeTestRel(pathname);
    const routeSource = read(root, routeRel);
    const testSource = testRel ? read(root, testRel) : "";
    const expectedKeys = CRON_ROUTE_EXPECTED_KEYS.get(pathname) ?? null;
    const methods = parseMethods(routeSource);
    const routeOption = parseRouteOption(routeSource);
    const maxDurationSeconds = parseMaxDurationSeconds(routeSource);
    const wrapperHelper = wrapperHelperFor(routeSource);
    const authHelper = authHelperFor(routeSource);
    const parsedSchedule = parseSchedule(schedule);
    const maxRuntimeShare =
      parsedSchedule.cadenceMinutes && maxDurationSeconds
        ? Number((maxDurationSeconds / (parsedSchedule.cadenceMinutes * 60)).toFixed(4))
        : null;

    if (!routeSource) issues.push(issue("operational_cron_missing_route_file", { path: pathname, routeFile: routeRel }));
    if (!testRel) issues.push(issue("operational_cron_missing_route_test", { path: pathname }));
    if (!expectedKeys || expectedKeys.length === 0) {
      issues.push(issue("operational_cron_missing_expected_keys", { path: pathname }));
    }
    if (methods.length === 0) issues.push(issue("operational_cron_missing_method_export", { path: pathname, routeFile: routeRel }));
    if (!authHelper) issues.push(issue("operational_cron_missing_auth_helper", { path: pathname, routeFile: routeRel }));
    if (!wrapperHelper) issues.push(issue("operational_cron_missing_shared_wrapper", { path: pathname, routeFile: routeRel }));
    if (routeOption !== pathname) {
      issues.push(issue("operational_cron_route_option_mismatch", { path: pathname, routeFile: routeRel, routeOption }));
    }
    if (!maxDurationSeconds) {
      issues.push(issue("operational_cron_missing_max_duration", { path: pathname, routeFile: routeRel }));
    } else if (maxDurationSeconds > maxAllowedDurationSeconds) {
      issues.push(issue("operational_cron_max_duration_exceeds_policy", {
        path: pathname,
        maxDurationSeconds,
        maxAllowedDurationSeconds,
      }));
    }
    if (!parsedSchedule.ok) issues.push(issue("operational_cron_invalid_schedule", { path: pathname, schedule }));
    if (parsedSchedule.cadenceMinutes && maxDurationSeconds && maxDurationSeconds >= parsedSchedule.cadenceMinutes * 60) {
      issues.push(issue("operational_cron_duration_exceeds_cadence", {
        path: pathname,
        schedule,
        cadenceMinutes: parsedSchedule.cadenceMinutes,
        maxDurationSeconds,
      }));
    }

    registry.push({
      path: pathname,
      schedule,
      scheduleClass: parsedSchedule.scheduleClass,
      cadenceMinutes: parsedSchedule.cadenceMinutes,
      methods,
      routeFile: routeRel,
      testFile: testRel,
      ownerArea: ownerAreaFor(pathname),
      authScheme: authHelper ? "shared-cron-secret" : null,
      authHelper,
      wrapperHelper,
      maxDurationSeconds,
      expectedDurationMs: maxDurationSeconds ? maxDurationSeconds * 1000 : null,
      idempotencyPolicy: wrapperHelper ? "shared-runner-idempotency-key" : null,
      lockPolicy: wrapperHelper ? "shared-runner-single-flight" : null,
      retryPolicy: retryPolicyFor(pathname, routeSource, testSource),
      observabilityPolicy: wrapperHelper ? "shared-runner-envelope-and-healthcheck" : null,
      expectedResponseKeys: expectedKeys ?? [],
      standardTelemetryFields: config.standardTelemetryFields ?? [],
      slo: {
        maxDurationSeconds,
        cadenceMinutes: parsedSchedule.cadenceMinutes,
        maxRuntimeShare,
      },
    });
  }

  const vercelPaths = new Set(crons.map((entry) => entry.path).filter(Boolean));
  const expectedPaths = new Set(CRON_ROUTE_EXPECTED_KEYS.keys());
  for (const pathname of [...vercelPaths].filter((value) => !expectedPaths.has(value)).sort()) {
    issues.push(issue("operational_cron_expected_keys_missing_vercel_path", { path: pathname }));
  }
  for (const pathname of [...expectedPaths].filter((value) => !vercelPaths.has(value)).sort()) {
    issues.push(issue("operational_cron_expected_keys_orphan_path", { path: pathname }));
  }

  return registry.sort((a, b) => a.path.localeCompare(b.path));
}

function analyzeInlineIdempotency(root) {
  const issues = [];
  const idempotencySource = read(root, "src/lib/idempotency.ts");
  const runnerSource = read(root, "src/lib/cron/route-runner.ts");
  const required = [
    { path: "src/lib/idempotency.ts", source: idempotencySource, marker: "x-idempotency-key" },
    { path: "src/lib/idempotency.ts", source: idempotencySource, marker: "Duplicate request blocked by idempotency key" },
    { path: "src/lib/idempotency.ts", source: idempotencySource, marker: "Retry-After" },
    { path: "src/lib/cron/route-runner.ts", source: runnerSource, marker: "scope: `cron:${options.route}`" },
    { path: "src/lib/cron/route-runner.ts", source: runnerSource, marker: "actorKey: \"cron\"" },
    { path: "src/lib/cron/route-runner.ts", source: runnerSource, marker: "duplicate_request" },
  ];
  for (const row of required) {
    if (!row.source.includes(row.marker)) {
      issues.push(issue("operational_cron_idempotency_marker_missing", { path: row.path, marker: row.marker }));
    }
  }
  return {
    checkId: "idempotency-policy-inline",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function delegatedReports(root, issues) {
  const jobLocks = analyzeJobLockGuards(root);
  const duplicateExecution = analyzeDuplicateExecutionPolicy(root);
  const idempotency = analyzeInlineIdempotency(root);
  const reports = [
    {
      checkId: "job-lock-guards",
      ok: jobLocks.issueCount === 0,
      issueCount: jobLocks.issueCount,
    },
    {
      checkId: "duplicate-execution-policy",
      ok: duplicateExecution.ok,
      issueCount: duplicateExecution.issueCount,
    },
    {
      checkId: idempotency.checkId,
      ok: idempotency.ok,
      issueCount: idempotency.issueCount,
    },
  ];
  for (const report of reports) {
    if (!report.ok) {
      issues.push(issue("operational_cron_delegated_check_failed", {
        checkId: report.checkId,
        issueCount: report.issueCount,
      }));
    }
  }
  return reports.sort((a, b) => a.checkId.localeCompare(b.checkId));
}

export function buildOperationalCronJobsReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-cron-jobs") {
    issues.push(issue("operational_cron_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, packageScripts, ci, issues);
  const markerFiles = validateMarkers(root, config, issues);
  const registry = buildRegistry(root, config, issues);
  const checks = delegatedReports(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-cron-jobs",
    generatedBy: "scripts/check-operational-cron-jobs.mjs --write",
    generatedFrom: CONFIG_REL,
    ciWorkflow: CI_REL,
    scheduledRouteCount: registry.length,
    commandCount: commands.length,
    markerFileCount: markerFiles.length,
    delegatedCheckCount: checks.length,
    commands,
    markerFiles,
    registry,
    checks,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalCronJobs(root = ROOT) {
  const report = buildOperationalCronJobsReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_cron_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_cron_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-cron-jobs",
    }));
  }
  return {
    ...report,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export function runOperationalCronJobs(root = ROOT) {
  const report = buildOperationalCronJobsReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  if (WRITE) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, stableStringify(report));
    console.log(stableStringify({ ...report, wrote: ARTIFACT_REL }));
    if (!report.ok) process.exitCode = 1;
    return report;
  }
  const checked = analyzeOperationalCronJobs(root);
  console.log(stableStringify(checked));
  if (!checked.ok) process.exitCode = 1;
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOperationalCronJobs();
}
