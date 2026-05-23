#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const BODY_POLICY_SAFE = new Set([
  "bounded_or_form_body",
  "no_body_rejected",
  "signature_bound_raw_body",
]);

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, acc);
    else if (entry.name === "route.ts") acc.push(abs);
  }
  return acc;
}

function methodsFromSource(source) {
  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].filter((method) => {
    const functionExport = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`);
    const constExport = new RegExp(`export\\s+const\\s+${method}\\s*=`);
    return functionExport.test(source) || constExport.test(source);
  });
  return methods.length ? methods : [];
}

function routeFromApiFile(root, abs) {
  const rel = path.relative(path.join(root, "src", "app", "api"), path.dirname(abs)).replace(/\\/g, "/");
  return `/api/${rel}`.replace(/\/route$/, "").replace(/\/$/, "");
}

function bodyPolicyFromSource(source, route) {
  if (
    /\breadJsonBodyLimited\b|\breadJsonBodyLimitedWithRaw\b|\bparseJsonBodyWithLimit\b|\breadRequestBodyLimited\b|\breadTextBodyLimited\b/.test(
      source
    )
  ) {
    return "bounded_or_form_body";
  }
  if (/\bgetImportCsvPayload\s*\(\s*request\b/.test(source)) return "bounded_or_form_body";
  if (/\brejectUnexpectedBody\b/.test(source)) return "no_body_rejected";
  if (/\bformData\s*\(/.test(source)) return "bounded_or_form_body";
  if (/stripe-signature|verifyWebhook|constructEvent/i.test(source) || route.includes("/webhook")) {
    return "signature_bound_raw_body";
  }
  return "body_limit_required";
}

function loadRouteUniverseRows(root, issues) {
  const rel = "artifacts/route-universe.json";
  if (!exists(root, rel)) {
    issues.push({ issue: "missing_route_universe", rel });
    return [];
  }
  try {
    const payload = JSON.parse(read(root, rel));
    const rows = payload?.routes ?? payload?.universe?.routes;
    if (!Array.isArray(rows)) {
      issues.push({ issue: "invalid_route_universe_shape", rel });
      return [];
    }
    return rows;
  } catch (error) {
    issues.push({ issue: "invalid_route_universe_json", rel, message: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

export function analyzeJsonBodyLimitedAdoption(root = ROOT) {
  const issues = [];
  const helperRel = "src/lib/security/read-json-body-limited.ts";
  if (!exists(root, helperRel)) {
    issues.push({ issue: "missing_body_limit_helper", rel: helperRel });
    return {
      checkId: "json-body-limited-adoption",
      ok: false,
      apiRoutesUsingReadJsonBodyLimited: 0,
      mutatingRouteCount: 0,
      safeMutatingBodyRouteCount: 0,
      issueCount: issues.length,
      issues,
    };
  }

  const apiRoot = path.join(root, "src", "app", "api");
  const routeFiles = walk(apiRoot);
  let apiRoutesUsingReadJsonBodyLimited = 0;
  let mutatingRouteCount = 0;
  let safeMutatingBodyRouteCount = 0;

  for (const abs of routeFiles) {
    const source = fs.readFileSync(abs, "utf8");
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    const route = routeFromApiFile(root, abs);
    if (/\breadJsonBodyLimited\b|\breadJsonBodyLimitedWithRaw\b|\bparseJsonBodyWithLimit\b/.test(source)) {
      apiRoutesUsingReadJsonBodyLimited += 1;
    }
    const mutatingMethods = methodsFromSource(source).filter((method) => MUTATING_METHODS.has(method));
    if (mutatingMethods.length === 0) continue;
    mutatingRouteCount += 1;
    const bodyPolicy = bodyPolicyFromSource(source, route);
    if (BODY_POLICY_SAFE.has(bodyPolicy)) safeMutatingBodyRouteCount += 1;
    else {
      issues.push({
        issue: "mutating_route_missing_bounded_body_guard",
        rel,
        route,
        methods: mutatingMethods,
        bodyPolicy,
      });
    }
    if (/\brequest\.(?:json|text|formData)\s*\(/.test(source)) {
      issues.push({ issue: "mutating_route_uses_raw_body_reader", rel, route });
    }
  }

  const routeUniverseRows = loadRouteUniverseRows(root, issues);
  for (const row of routeUniverseRows.filter((row) => row.kind === "api_route")) {
    const methods = Array.isArray(row.methods) ? row.methods : [];
    if (!methods.some((method) => MUTATING_METHODS.has(method))) continue;
    if (!BODY_POLICY_SAFE.has(row.bodyPolicy)) {
      issues.push({
        issue: "route_universe_unsafe_body_policy",
        route: row.route,
        sourcePath: row.sourcePath,
        bodyPolicy: row.bodyPolicy,
      });
    }
  }

  return {
    checkId: "json-body-limited-adoption",
    ok: issues.length === 0,
    apiRoutesUsingReadJsonBodyLimited,
    mutatingRouteCount,
    safeMutatingBodyRouteCount,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeJsonBodyLimitedAdoption();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
