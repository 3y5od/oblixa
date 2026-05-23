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

function parseKeyValueMeta(raw) {
  const matches = [...raw.matchAll(/\b([A-Za-z][A-Za-z0-9_-]*)=/gu)];
  const meta = {};
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const key = match[1];
    const valueStart = (match.index ?? 0) + match[0].length;
    const valueEnd =
      index + 1 < matches.length ? matches[index + 1].index ?? raw.length : raw.length;
    meta[key] = raw.slice(valueStart, valueEnd).trim();
  }
  return meta;
}

function loadAllowlist(srcRoot) {
  if (!fs.existsSync(allowlistPath)) return { routes: new Set(), metadataIssues: [] };
  const raw = fs.readFileSync(allowlistPath, "utf8");
  const routes = new Set();
  const metadataIssues = [];
  let currentMeta = null;
  const isExpired = (dateStr) => {
    const parsed = Date.parse(dateStr);
    return Number.isNaN(parsed) || parsed < Date.now();
  };

  for (const [idx, line] of raw.split("\n").entries()) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("#")) {
      const metaMatch = t.match(/^#\s*meta:\s*(?<body>.*)$/u);
      if (metaMatch?.groups?.body) {
        const meta = parseKeyValueMeta(metaMatch.groups.body);
        if (!meta.owner || !meta.expiry || !meta.reason || !meta.bundleProofTest) {
          metadataIssues.push({
            line: idx + 1,
            issue: "invalid_allowlist_meta",
            meta,
          });
          currentMeta = null;
          continue;
        }
        currentMeta = {
          owner: meta.owner,
          expiry: meta.expiry,
          reason: meta.reason.trim(),
          reviewedOn: meta.reviewedOn ?? meta.reviewDate ?? meta.lastReviewed ?? null,
          bundleProofTest: meta.bundleProofTest,
        };
        const proofFsPath = path.join(srcRoot, currentMeta.bundleProofTest);
        if (!fs.existsSync(proofFsPath)) {
          metadataIssues.push({
            line: idx + 1,
            issue: "bundle_proof_missing",
            bundleProofTest: currentMeta.bundleProofTest,
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
