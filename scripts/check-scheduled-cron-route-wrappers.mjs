#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createResult, finishWithResult } from "./lib/result.mjs";
import { nowMs } from "./lib/timing.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiRoot = path.join(root, "src", "app", "api");
const vercelJsonPath = path.join(root, "vercel.json");
const allowlistPath = path.join(__dirname, "scheduled-cron-route-wrapper-allowlist.txt");
const reportOnly = process.argv.includes("--report");
const startMs = nowMs();

const WRAPPER_HELPERS = ["withCronRoute", "withV6CronRoute", "runCronRoute"];

function scheduledRouteFiles() {
  const vercel = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8"));
  const crons = Array.isArray(vercel.crons) ? vercel.crons : [];
  return [...new Set(
    crons
      .map((entry) => (typeof entry?.path === "string" ? entry.path : ""))
      .filter((route) => route.startsWith("/api/"))
      .map((route) => ({
        route,
        abs: path.join(root, "src", "app", route.replace(/^\//, ""), "route.ts"),
      }))
  )];
}

function hasHelperImport(text, helper) {
  return new RegExp(`\\b${helper}\\b`).test(text) && /from\s+["'][^"']+["']/.test(text);
}

function hasHelperCall(text, helper) {
  return new RegExp(`\\b${helper}\\s*\\(`).test(text);
}

function toApiRelative(abs) {
  return path.relative(apiRoot, abs).replace(/\\/g, "/");
}

function loadAllowlist() {
  if (!fs.existsSync(allowlistPath)) return { routes: new Set(), metadataIssues: [] };
  const raw = fs.readFileSync(allowlistPath, "utf8");
  const routes = new Set();
  const metadataIssues = [];
  let currentMeta = null;
  const metaRe = /^#\s*meta:\s*owner=([^\s]+)\s+expiry=(\d{4}-\d{2}-\d{2})\s+reason=(.+)$/;
  const isExpired = (dateStr) => {
    const parsed = Date.parse(dateStr);
    return Number.isNaN(parsed) || parsed < Date.now();
  };

  for (const [idx, line] of raw.split("\n").entries()) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("#")) {
      const m = t.match(metaRe);
      if (m) {
        currentMeta = { owner: m[1], expiry: m[2], reason: m[3].trim() };
        if (isExpired(currentMeta.expiry)) {
          metadataIssues.push({ line: idx + 1, issue: "expired_allowlist_meta", meta: currentMeta });
        }
      }
      continue;
    }
    if (!currentMeta) {
      metadataIssues.push({ line: idx + 1, issue: "missing_allowlist_meta", route: t.replace(/\\/g, "/") });
    }
    routes.add(t.replace(/\\/g, "/"));
  }

  return { routes, metadataIssues };
}

const routes = scheduledRouteFiles().sort((a, b) => a.route.localeCompare(b.route));
const allowlist = loadAllowlist();
const missingRoutes = [];
const violations = [];
const staleAllowlistEntries = [];
let wrappedCount = 0;

for (const { abs } of routes) {
  if (!fs.existsSync(abs)) {
    missingRoutes.push(toApiRelative(abs));
    continue;
  }
  const text = fs.readFileSync(abs, "utf8");
  const usesSharedWrapper = WRAPPER_HELPERS.some(
    (helper) => hasHelperImport(text, helper) && hasHelperCall(text, helper)
  );
  if (usesSharedWrapper) wrappedCount += 1;
  else if (!allowlist.routes.has(toApiRelative(abs))) violations.push(toApiRelative(abs));
}

for (const rel of allowlist.routes) {
  const abs = path.join(apiRoot, rel);
  if (!fs.existsSync(abs)) continue;
  const text = fs.readFileSync(abs, "utf8");
  const usesSharedWrapper = WRAPPER_HELPERS.some(
    (helper) => hasHelperImport(text, helper) && hasHelperCall(text, helper)
  );
  if (usesSharedWrapper) staleAllowlistEntries.push(rel);
}

const meta = {
  totalScheduledRoutes: routes.length,
  wrappedCount,
  allowlistedCount: allowlist.routes.size,
  violationCount: violations.length,
  violations,
  missingRouteCount: missingRoutes.length,
  missingRoutes,
  staleAllowlistCount: staleAllowlistEntries.length,
  staleAllowlistEntries,
  allowlistMetadataIssueCount: allowlist.metadataIssues.length,
  allowlistMetadataIssues: allowlist.metadataIssues,
  acceptedWrappers: WRAPPER_HELPERS,
};

if (reportOnly) {
  finishWithResult(
    createResult({
      checkId: "scheduled-cron-route-wrappers",
      ok: true,
      strict: false,
      errors: [],
      meta,
      startMs,
    })
  );
}

const errors = [];
if (missingRoutes.length > 0) errors.push("scheduled route.ts file(s) missing from src/app");
if (violations.length > 0) errors.push("scheduled route.ts file(s) bypass shared cron wrappers");
if (allowlist.metadataIssues.length > 0) errors.push("wrapper allowlist metadata issues found");
if (staleAllowlistEntries.length > 0) errors.push("wrapper allowlist contains stale entries that now use shared wrappers");

finishWithResult(
  createResult({
    checkId: "scheduled-cron-route-wrappers",
    ok: errors.length === 0,
    strict: true,
    errors,
    meta,
    startMs,
  })
);