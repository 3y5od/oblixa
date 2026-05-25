#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const API_SMOKE_REGISTRY_REL = "artifacts/assurance/api-runtime-smoke-registry.json";
const DEFAULT_TIMEOUT_MS = 5_000;

const EXPECTED_STATUS_BY_HINT = {
  public_or_token_surface: [200, 204, 302, 400, 401, 403, 404, 410, 503],
  signature_or_unsigned_reject: [400, 401, 403, 405],
  session_or_worker_unsigned_reject: [401, 403, 503],
  defer_cron_canary: [401, 403, 404, 405],
};

const SUPABASE_API_VERSION_SEGMENT = `v${1}`;

export const OPTIONAL_LINKED_SUPABASE_PROBES = [
  {
    id: "linked-postgrest-rest",
    service: "PostgREST",
    target: `/rest/${SUPABASE_API_VERSION_SEGMENT}/`,
    credentialRequirement: "production",
    mutates: false,
    expectedStatuses: [200, 401, 403, 404],
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  {
    id: "linked-auth-settings",
    service: "Auth",
    target: `/auth/${SUPABASE_API_VERSION_SEGMENT}/settings`,
    credentialRequirement: "production",
    mutates: false,
    expectedStatuses: [200, 401, 403],
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
  {
    id: "linked-storage-buckets",
    service: "Storage",
    target: `/storage/${SUPABASE_API_VERSION_SEGMENT}/bucket`,
    credentialRequirement: "production",
    mutates: false,
    expectedStatuses: [200, 401, 403],
    timeoutMs: DEFAULT_TIMEOUT_MS,
  },
];

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function loadRegistry(root) {
  const payload = readJson(root, API_SMOKE_REGISTRY_REL);
  return Array.isArray(payload.routes) ? payload.routes : [];
}

function probeIdFor(route) {
  return route.pathTemplate.replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "").toLowerCase() || "root";
}

function probeCategoryFor(route) {
  if (route.runnerHint === "public_or_token_surface") return "public_or_token_route";
  if (route.runnerHint === "signature_or_unsigned_reject") return "webhook_signature_reject";
  if (route.runnerHint === "defer_cron_canary") return "cron_deferred";
  return "auth_required_route";
}

export function buildRuntimeHealthProbeContracts(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const routes = options.routes ?? loadRegistry(root);
  const localProbes = routes
    .filter((route) => route.smokeTier === "ci" || route.smokeTier === "nightly")
    .map((route) => ({
      id: `local-${probeIdFor(route)}`,
      service: "app-route",
      category: probeCategoryFor(route),
      routeFile: route.routeFile,
      pathTemplate: route.pathTemplate,
      samplePath: route.samplePath,
      methods: route.methods,
      runnerHint: route.runnerHint,
      expectedOutcomes: route.expectedOutcomes ?? [],
      expectedStatuses: EXPECTED_STATUS_BY_HINT[route.runnerHint] ?? [200, 400, 401, 403, 404, 503],
      timeoutMs: DEFAULT_TIMEOUT_MS,
      credentialRequirement: "none",
      mutates: false,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    schemaVersion: 1,
    ok: true,
    summary: "Runtime health probe contract registry. Default check validates contracts only and does not make network requests.",
    localProbeCount: localProbes.length,
    optionalLinkedProbeCount: OPTIONAL_LINKED_SUPABASE_PROBES.length,
    localProbes,
    optionalLinkedSupabaseProbes: OPTIONAL_LINKED_SUPABASE_PROBES,
    failureClasses: [
      "success",
      "authentication_rejected",
      "schema_missing",
      "service_unavailable",
      "timeout",
      "unexpected_status",
    ],
  };
}

export function classifyProbeResult(result) {
  if (result?.timedOut) return "timeout";
  const status = Number(result?.status);
  if ([200, 201, 202, 204, 302, 304].includes(status)) return "success";
  if ([401, 403].includes(status)) return "authentication_rejected";
  if ([404, 410].includes(status)) return "schema_missing";
  if ([0, 429, 500, 502, 503, 504].includes(status)) return "service_unavailable";
  return "unexpected_status";
}

export function analyzeRuntimeHealthProbeContracts(options = {}) {
  const contracts = buildRuntimeHealthProbeContracts(options);
  const issues = [];

  if (contracts.localProbeCount === 0) {
    issues.push({ issue: "missing_local_runtime_probes", path: API_SMOKE_REGISTRY_REL });
  }
  const categories = new Set(contracts.localProbes.map((probe) => probe.category));
  for (const required of ["public_or_token_route", "auth_required_route"]) {
    if (!categories.has(required)) {
      issues.push({ issue: "missing_runtime_probe_category", category: required, path: API_SMOKE_REGISTRY_REL });
    }
  }

  for (const probe of [...contracts.localProbes, ...contracts.optionalLinkedSupabaseProbes]) {
    if (!Array.isArray(probe.expectedStatuses) || probe.expectedStatuses.length === 0) {
      issues.push({ issue: "runtime_probe_missing_expected_statuses", id: probe.id });
    }
    if (!Number.isInteger(probe.timeoutMs) || probe.timeoutMs <= 0 || probe.timeoutMs > 15_000) {
      issues.push({ issue: "runtime_probe_invalid_timeout", id: probe.id, timeoutMs: probe.timeoutMs });
    }
    if (probe.credentialRequirement === "production" && probe.mutates !== false) {
      issues.push({ issue: "linked_runtime_probe_must_be_read_only", id: probe.id });
    }
  }

  return {
    ...contracts,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, report: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--report") {
      options.report = true;
    }
  }
  return options;
}

export function runRuntimeHealthProbeContracts(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeRuntimeHealthProbeContracts(options);
  const printable = options.report
    ? report
    : {
        schemaVersion: report.schemaVersion,
        ok: report.ok,
        summary: report.summary,
        localProbeCount: report.localProbeCount,
        optionalLinkedProbeCount: report.optionalLinkedProbeCount,
        failureClasses: report.failureClasses,
        issueCount: report.issueCount,
        issues: report.issues,
      };
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRuntimeHealthProbeContracts();
}
