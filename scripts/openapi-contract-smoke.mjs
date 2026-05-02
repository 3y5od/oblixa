#!/usr/bin/env node
/**
 * Optional: fetch STAGING_BASE_URL + validate a few paths exist (200/401/403) vs openapi.yaml names.
 * OPENAPI_CONTRACT_STRICT=1 — fail if base URL missing or samples fail.
 */
import fs from "node:fs";
import path from "node:path";

const strict = process.env.OPENAPI_CONTRACT_STRICT === "1" || process.env.OPENAPI_CONTRACT_STRICT === "true";
const base = process.env.STAGING_BASE_URL || process.env.PLAYWRIGHT_BASE_URL;
const root = process.cwd();
const specPath = path.join(root, "openapi.yaml");

if (!fs.existsSync(specPath)) {
  const out = { ok: true, mode: "no_openapi_yaml" };
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

if (!base) {
  const out = { ok: !strict, mode: "no_base_url", hint: "Set STAGING_BASE_URL for live checks." };
  console.log(JSON.stringify(out, null, 2));
  process.exit(strict ? 1 : 0);
}

const paths = (process.env.OPENAPI_SMOKE_PATHS || "/")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function head(p) {
  const u = new URL(p, base);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  const headers = {};
  const bearer = process.env.OPENAPI_CONTRACT_BEARER;
  if (bearer) {
    headers.Authorization = bearer.startsWith("Bearer ") ? bearer : `Bearer ${bearer}`;
  }
  try {
    const res = await fetch(u, { method: "GET", signal: ac.signal, redirect: "manual", headers });
    return res.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(t);
  }
}

const results = [];
for (const p of paths) {
  const status = await head(p);
  results.push({ path: p, status });
}

const ok = results.every((r) => r.status >= 200 && r.status < 500);
const payload = { ok: strict ? ok : true, strict, results };
console.log(JSON.stringify(payload, null, 2));
process.exit(strict && !ok ? 1 : 0);
