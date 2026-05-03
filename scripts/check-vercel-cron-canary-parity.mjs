#!/usr/bin/env node
/**
 * Fails when vercel.json scheduled paths drift from scripts/cron-route-expected-keys.mjs.
 * Ensures every Vercel cron has a canary/comprehensive-pass JSON contract entry and vice versa.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { CRON_ROUTE_EXPECTED_KEYS } from "./cron-route-expected-keys.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const vercelJsonPath = path.join(root, "vercel.json");

const vercel = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8"));
const vercelPaths = new Set(
  (Array.isArray(vercel.crons) ? vercel.crons : [])
    .map((c) => (typeof c?.path === "string" ? c.path.trim() : ""))
    .filter(Boolean)
);
const mapPaths = new Set(CRON_ROUTE_EXPECTED_KEYS.keys());

const onlyVercel = [...vercelPaths].filter((p) => !mapPaths.has(p)).sort();
const onlyMap = [...mapPaths].filter((p) => !vercelPaths.has(p)).sort();

if (onlyVercel.length > 0 || onlyMap.length > 0) {
  console.error("vercel.json crons and CRON_ROUTE_EXPECTED_KEYS are out of sync.\n");
  if (onlyVercel.length > 0) {
    console.error("Only in vercel.json (add to cron-route-expected-keys.mjs):");
    for (const p of onlyVercel) console.error(`  - ${p}`);
  }
  if (onlyMap.length > 0) {
    console.error("Only in cron-route-expected-keys.mjs (add cron to vercel.json or remove map entry):");
    for (const p of onlyMap) console.error(`  - ${p}`);
  }
  process.exit(1);
}

console.log(`OK: vercel.json (${vercelPaths.size}) cron paths match CRON_ROUTE_EXPECTED_KEYS (${mapPaths.size}).`);
