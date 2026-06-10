#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REVIEWABLE_EXT_RE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/iu;
const TEST_PATH_RE = /(?:^|\/)(?:__tests__|.*\.(?:test|spec)\.[cm]?[jt]sx?)$/iu;
const SKIP_DIRS = new Set([".git", ".next", "coverage", "node_modules", "playwright-report", "test-results"]);
const BEACON_WRAPPER_REL = "src/lib/http/client-json.ts";
const APPROVED_KEEPALIVE_ENDPOINTS = new Set(["/api/product-telemetry/page-load"]);

function toPosix(value) {
  return String(value ?? "").replace(/\\/gu, "/");
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function walk(root, rel = "src", acc = []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return acc;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const nextRel = toPosix(path.join(rel, entry.name));
    if (entry.isDirectory()) {
      walk(root, nextRel, acc);
    } else if (REVIEWABLE_EXT_RE.test(entry.name) && !TEST_PATH_RE.test(nextRel)) {
      acc.push(nextRel);
    }
  }
  return acc;
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split(/\r?\n/u).length;
}

function collectMatches(text, re) {
  const matches = [];
  re.lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) matches.push({ match, line: lineForOffset(text, match.index) });
  return matches;
}

function analyzeFile(root, rel) {
  const text = fs.readFileSync(path.join(root, rel), "utf8");
  const issues = [];

  for (const { line } of collectMatches(text, /\bServer-Timing\b|["']server-timing["']/giu)) {
    issues.push(issue("server_timing_header_surface", { path: rel, line }));
  }

  if (rel !== BEACON_WRAPPER_REL) {
    for (const { line } of collectMatches(text, /\bnavigator\.sendBeacon\s*\(/gu)) {
      issues.push(issue("direct_send_beacon_outside_wrapper", { path: rel, line, wrapper: BEACON_WRAPPER_REL }));
    }
    for (const { line } of collectMatches(text, /\bkeepalive\s*:\s*true\b/gu)) {
      issues.push(issue("direct_fetch_keepalive_outside_wrapper", { path: rel, line, wrapper: BEACON_WRAPPER_REL }));
    }
  }

  if (rel !== BEACON_WRAPPER_REL) {
    for (const { match, line } of collectMatches(text, /\bsendJsonKeepalive\s*\(\s*([^,\n)]+)/gu)) {
      const rawEndpoint = match[1]?.trim() ?? "";
      const literal = /^["']([^"']+)["']$/u.exec(rawEndpoint)?.[1] ?? null;
      if (!literal) {
        issues.push(issue("dynamic_keepalive_endpoint_requires_review", { path: rel, line }));
        continue;
      }
      if (!APPROVED_KEEPALIVE_ENDPOINTS.has(literal)) {
        issues.push(issue("unapproved_keepalive_endpoint", {
          path: rel,
          line,
          endpoint: literal,
          approvedEndpoints: [...APPROVED_KEEPALIVE_ENDPOINTS].sort(),
        }));
      }
    }
  }

  return issues;
}

export function analyzeBeaconTimingLeakage(root = ROOT) {
  const files = walk(root).sort((a, b) => a.localeCompare(b));
  const issues = files.flatMap((rel) => analyzeFile(root, rel));
  return {
    checkId: "beacon-timing-leakage",
    ok: issues.length === 0,
    beaconWrapper: BEACON_WRAPPER_REL,
    approvedKeepaliveEndpoints: [...APPROVED_KEEPALIVE_ENDPOINTS].sort(),
    scannedFileCount: files.length,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeBeaconTimingLeakage();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
