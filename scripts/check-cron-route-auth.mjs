#!/usr/bin/env node
/**
 * Ensures cron route.ts files under src/app/api/cron reference a shared cron
 * authorization helper (authorizeCronRequest, ensureCronAuthorized, requireV5CronAuth,
 * or requireV6CronAuth).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cronRoot = path.join(__dirname, "..", "src", "app", "api", "cron");

const AUTH_RE =
  /authorizeCronRequest|ensureCronAuthorized|requireV5CronAuth|requireV6CronAuth/;

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

const routes = walkRoutes(cronRoot).sort();
const violations = [];

for (const abs of routes) {
  const text = fs.readFileSync(abs, "utf8");
  if (!AUTH_RE.test(text)) {
    violations.push(path.relative(path.join(__dirname, "..", "src", "app", "api"), abs).replace(/\\/g, "/"));
  }
}

if (violations.length > 0) {
  console.error("Cron route.ts file(s) missing shared cron auth helper reference:\n");
  for (const v of violations) console.error(`  - cron/${v}`);
  process.exit(1);
}

console.log(`OK: ${routes.length} cron route(s) reference shared cron auth.`);
