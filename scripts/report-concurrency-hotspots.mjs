#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const API_ROOT = join(ROOT, "src", "app", "api");
const RISKY_METHOD_RE = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/g;
const IDEMPOTENCY_HINT_RE =
  /idempot|dedup|onConflict|upsert|retry|job_id|request_id|already\s+processed|duplicate|conflict|submit_ticket|\.eq\(["']status["']|submitted_at|processed_at/i;
const allowlistPath = join(ROOT, "scripts", "concurrency-hotspots-allowlist.txt");
const metaRe = /^#\s*meta:\s*owner=([^\s]+)\s+expiry=(\d{4}-\d{2}-\d{2})\s+reason=(.+)$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

function loadAllowlist() {
  if (!existsSync(allowlistPath)) {
    return { allowed: new Set(), metadataIssues: [], metaByRoute: new Map() };
  }
  const lines = readFileSync(allowlistPath, "utf8").split("\n");
  const allowed = new Set();
  const metaByRoute = new Map();
  const metadataIssues = [];
  let currentMeta = null;
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      const m = trimmed.match(metaRe);
      if (m) {
        currentMeta = { owner: m[1], expiry: m[2], reason: m[3].trim() };
        if (!currentMeta.owner.startsWith("@")) {
          metadataIssues.push({
            line: index + 1,
            issue: "owner_must_start_with_at",
            owner: currentMeta.owner,
          });
        }
      }
      continue;
    }
    if (!currentMeta) {
      metadataIssues.push({ line: index + 1, issue: "missing_meta_for_allowlist_route", route: trimmed });
      continue;
    }
    allowed.add(trimmed);
    metaByRoute.set(trimmed, currentMeta);
  }
  return { allowed, metadataIssues, metaByRoute };
}

const allowlist = loadAllowlist();
const rows = [];
for (const file of walk(API_ROOT)) {
  const src = readFileSync(file, "utf8");
  RISKY_METHOD_RE.lastIndex = 0;
  const methods = [];
  let m;
  while ((m = RISKY_METHOD_RE.exec(src))) methods.push(m[1]);
  if (methods.length === 0) continue;
  const route = file.replace(`${ROOT}/src/app`, "");
  const allowlisted = allowlist.allowed.has(route);
  rows.push({
    route,
    methods,
    hasIdempotencyHint: IDEMPOTENCY_HINT_RE.test(src),
    allowlisted,
    allowlistMeta: allowlist.metaByRoute.get(route) ?? null,
  });
}

const hotspots = rows.filter((r) => !r.hasIdempotencyHint && !r.allowlisted);
const staleAllowlistRoutes = [...allowlist.allowed].filter((route) => {
  const row = rows.find((candidate) => candidate.route === route);
  return !row || row.hasIdempotencyHint;
});
console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      mutationRouteCount: rows.length,
      hotspotCount: hotspots.length,
      allowlistedCount: rows.filter((r) => r.allowlisted).length,
      allowlistMetadataIssueCount: allowlist.metadataIssues.length,
      allowlistMetadataIssues: allowlist.metadataIssues,
      staleAllowlistCount: staleAllowlistRoutes.length,
      staleAllowlistRoutes,
      hotspots,
    },
    null,
    2
  )
);
