#!/usr/bin/env node
/**
 * HTTP smoke to public P0 routes (synthetic / Tier 18 + 68 plan hook).
 * Usage: node scripts/synthetic-p0-smoke.mjs
 * Set SYNTHETIC_BASE_URL=http://127.0.0.1:3000
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const base = (process.env.SYNTHETIC_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const projectRoot = dirname(fileURLToPath(new URL("..", import.meta.url)));

const paths = ["/", "/login", "/terms", "/privacy", "/accessibility", "/security", "/cookies"];

async function readPublicRoutes() {
  try {
    const raw = await readFile(join(projectRoot, "e2e", "generated", "public-routes.ts"), "utf8");
    const m = raw.matchAll(/"visitPath":\s*"([^"]+)"/g);
    return [...m].map((x) => x[1]);
  } catch {
    return [];
  }
}

let exit = 0;
const extra = (await readPublicRoutes()).filter((p) => p && p !== "/");
const unique = [...new Set([...paths, ...extra])].sort((a, b) => a.localeCompare(b));

for (const path of unique) {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const r = await fetch(url, { redirect: "follow" });
    if (r.status >= 500) {
      console.error(`FAIL ${url} -> ${r.status}`);
      exit = 1;
    } else {
      console.log(`OK   ${url} -> ${r.status}`);
    }
  } catch (e) {
    console.error(`ERR  ${url}`, e?.message || e);
    exit = 1;
  }
}

process.exit(exit);
