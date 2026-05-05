/**
 * Epic 3 — Shared builder for api-runtime-smoke-registry.json
 */
import fs from "node:fs";
import path from "node:path";
import {
  defaultExpectedOutcomesForRunnerHint,
  verificationHintForRunnerHint,
} from "./route-runtime-semantics.mjs";

const DEPENDENCY_INVENTORY_PATH = ["artifacts", "assurance", "route-provider-dependencies.json"];

const SEGMENT_PLACEHOLDERS = {
  id: "00000000-0000-0000-0000-000000000001",
  token: "smoke-token",
  key: "smoke-key",
  jobId: "00000000-0000-0000-0000-000000000002",
  action: "smoke-action",
};

function listRouteFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) listRouteFiles(full, acc);
    else if (name === "route.ts") acc.push(full);
  }
  return acc;
}

function fileToPathTemplate(appRoot, file) {
  const rel = path.relative(appRoot, path.dirname(file)).replace(/\\/g, "/");
  const segments = rel ? rel.split("/") : [];
  return `/${segments.join("/")}`.replace(/\/+$/, "") || "/";
}

function templateToSamplePath(pathTemplate) {
  const parts = pathTemplate.split("/").filter(Boolean);
  const out = [];
  for (const p of parts) {
    const m = /^\[([^\]]+)]$/.exec(p);
    if (!m) {
      out.push(p);
      continue;
    }
    const key = m[1];
    const slug = SEGMENT_PLACEHOLDERS[key] ?? `smoke-${key}`;
    out.push(slug);
  }
  return `/${out.join("/")}`;
}

function detectMethods(src) {
  const methods = [];
  for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
    if (new RegExp(`export\\s+async\\s+function\\s+${m}\\b`).test(src)) methods.push(m);
  }
  return methods.length ? methods : ["GET"];
}

function classify(pathTemplate) {
  if (pathTemplate.includes("/api/cron/")) {
    return { runnerHint: "defer_cron_canary", smokeTier: "none" };
  }
  if (
    pathTemplate.startsWith("/api/stripe/webhook") ||
    pathTemplate.includes("/webhooks/")
  ) {
    return { runnerHint: "signature_or_unsigned_reject", smokeTier: "ci" };
  }
  if (
    pathTemplate === "/auth/callback" ||
    pathTemplate.startsWith("/api/health") ||
    pathTemplate.startsWith("/api/reports/track/") ||
    pathTemplate.startsWith("/api/external-actions/[token]/") ||
    pathTemplate.startsWith("/api/export/calendar/feed/")
  ) {
    return { runnerHint: "public_or_token_surface", smokeTier: "ci" };
  }
  return { runnerHint: "session_or_worker_unsigned_reject", smokeTier: "nightly" };
}

function buildRow(root, appRoot, file) {
  const pathTemplate = fileToPathTemplate(appRoot, file);
  const samplePath = templateToSamplePath(pathTemplate);
  const src = fs.readFileSync(file, "utf8");
  const methods = detectMethods(src);
  const { runnerHint, smokeTier } = classify(pathTemplate);
  return {
    routeFile: path.relative(root, file).replace(/\\/g, "/"),
    pathTemplate,
    samplePath,
    methods,
    runnerHint,
    verificationHint: verificationHintForRunnerHint(runnerHint),
    expectedOutcomes: defaultExpectedOutcomesForRunnerHint(runnerHint, methods),
    smokeTier,
  };
}

function loadDependencyInventory(root) {
  const abs = path.join(root, ...DEPENDENCY_INVENTORY_PATH);
  if (!fs.existsSync(abs)) {
    return new Map();
  }
  const payload = JSON.parse(fs.readFileSync(abs, "utf8"));
  const rows = Array.isArray(payload.routes) ? payload.routes : [];
  return new Map(rows.map((row) => [row.pathTemplate, row]));
}

/** @param {string} root — repo root */
export function buildApiRuntimeSmokeRegistryPayload(root) {
  const appRoot = path.join(root, "src", "app");
  const apiRoot = path.join(appRoot, "api");
  const files = [
    ...listRouteFiles(apiRoot),
    path.join(appRoot, "auth", "callback", "route.ts"),
  ].filter((file) => fs.existsSync(file)).sort((a, b) => a.localeCompare(b));
  const dependencyInventory = loadDependencyInventory(root);
  const routes = files.map((f) => {
    const row = buildRow(root, appRoot, f);
    const dependency = dependencyInventory.get(row.pathTemplate);
    return dependency ? { ...row, ...dependency } : row;
  });
  return {
    version: 1,
    program: "maximal-assurance-epic3",
    generatedAt: new Date().toISOString(),
    routeCount: routes.length,
    routes,
  };
}
