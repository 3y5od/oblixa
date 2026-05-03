#!/usr/bin/env node
// Ensures every API route.ts has colocated route.test.ts or scripts/api-route-test-allowlist.txt.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createResult, finishWithResult } from "./lib/result.mjs";
import { nowMs } from "./lib/timing.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiRoot = path.join(root, "src", "app", "api");
const allowlistPath = path.join(__dirname, "api-route-test-allowlist.txt");
const reportOnly = process.argv.includes("--report");
const startMs = nowMs();

function walkRoutes(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkRoutes(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

function loadAllowlist(srcRoot) {
  if (!fs.existsSync(allowlistPath)) return { routes: new Set(), metadataIssues: [] };
  const raw = fs.readFileSync(allowlistPath, "utf8");
  const routes = new Set();
  const metadataIssues = [];
  let currentMeta = null;
  const metaRe =
    /^#\s*meta:\s*owner=([^\s]+)\s+expiry=(\d{4}-\d{2}-\d{2})\s+reason=(.+?)\s+bundleProofTest=([^\s]+)$/;
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
        currentMeta = {
          owner: m[1],
          expiry: m[2],
          reason: m[3].trim(),
          bundleProofTest: m[4],
        };
        const proofFsPath = path.join(srcRoot, m[4]);
        if (!fs.existsSync(proofFsPath)) {
          metadataIssues.push({
            line: idx + 1,
            issue: "bundle_proof_missing",
            bundleProofTest: m[4],
          });
        }
        if (isExpired(currentMeta.expiry)) {
          metadataIssues.push({
            line: idx + 1,
            issue: "expired_allowlist_meta",
            meta: currentMeta,
          });
        }
      }
      continue;
    }
    if (!currentMeta) {
      metadataIssues.push({
        line: idx + 1,
        issue: "missing_allowlist_meta",
        route: t.replace(/\\/g, "/"),
      });
    }
    routes.add(t.replace(/\\/g, "/"));
  }
  return { routes, metadataIssues };
}

function toApiRelative(abs) {
  return path.relative(apiRoot, abs).replace(/\\/g, "/");
}

const routes = walkRoutes(apiRoot).sort();
const srcRoot = path.join(root, "src");
const allowlist = loadAllowlist(srcRoot);
const violations = [];
const staleAllowlistEntries = [];
let colocatedCount = 0;
let allowlistedCount = 0;

for (const abs of routes) {
  const rel = toApiRelative(abs);
  const dir = path.dirname(abs);
  const colocated = path.join(dir, "route.test.ts");
  if (fs.existsSync(colocated)) {
    colocatedCount += 1;
    continue;
  }
  if (allowlist.routes.has(rel)) {
    allowlistedCount += 1;
    continue;
  }
  violations.push(rel);
}

for (const rel of allowlist.routes) {
  const abs = path.join(apiRoot, rel);
  const colocated = path.join(path.dirname(abs), "route.test.ts");
  if (fs.existsSync(colocated)) {
    staleAllowlistEntries.push(rel);
  }
}

const meta = {
  totalRoutes: routes.length,
  colocatedCount,
  allowlistedCount,
  uncoveredCount: violations.length,
  uncoveredRoutes: violations,
  staleAllowlistCount: staleAllowlistEntries.length,
  staleAllowlistEntries,
  allowlistMetadataIssueCount: allowlist.metadataIssues.length,
  allowlistMetadataIssues: allowlist.metadataIssues,
};

if (reportOnly) {
  finishWithResult(
    createResult({
      checkId: "api-route-tests",
      ok: true,
      strict: false,
      errors: [],
      meta,
      startMs,
    })
  );
}

const errors = [];
if (violations.length > 0) {
  errors.push("uncovered API routes found");
}

if (allowlist.metadataIssues.length > 0) {
  errors.push("allowlist metadata issues found");
}

if (staleAllowlistEntries.length > 0) {
  errors.push("allowlist contains stale entries that already have route.test.ts");
}

finishWithResult(
  createResult({
    checkId: "api-route-tests",
    ok: errors.length === 0,
    strict: true,
    errors,
    meta,
    startMs,
  })
);
