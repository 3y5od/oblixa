#!/usr/bin/env node
/**
 * Ensures all scheduled route.ts files declared in vercel.json both import and invoke a
 * shared cron authorization helper (authorizeCronRequest, ensureCronAuthorized,
 * requireV5CronAuth, or requireV6CronAuth).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const vercelJsonPath = path.join(root, "vercel.json");

const AUTH_HELPERS = [
  "authorizeCronRequest",
  "ensureCronAuthorized",
  "requireV5CronAuth",
  "requireV6CronAuth",
];

function hasHelperImport(text, helper) {
  return new RegExp(`\\b${helper}\\b`).test(text) && /from\s+["'][^"']+["']/.test(text);
}

function hasHelperCall(text, helper) {
  return new RegExp(`\\b${helper}\\s*\\(`).test(text);
}

function scheduledRouteFiles() {
  const vercel = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8"));
  const crons = Array.isArray(vercel.crons) ? vercel.crons : [];
  const out = [];
  for (const entry of crons) {
    const route = typeof entry?.path === "string" ? entry.path : "";
    if (!route.startsWith("/api/")) continue;
    const abs = path.join(root, "src", "app", route.replace(/^\//, ""), "route.ts");
    out.push(abs);
  }
  return [...new Set(out)].sort();
}

const routes = scheduledRouteFiles();
const violations = [];

for (const abs of routes) {
  if (!fs.existsSync(abs)) {
    violations.push(path.relative(path.join(root, "src", "app", "api"), abs).replace(/\\/g, "/"));
    continue;
  }
  const text = fs.readFileSync(abs, "utf8");
  const hasImportAndCall = AUTH_HELPERS.some(
    (helper) => hasHelperImport(text, helper) && hasHelperCall(text, helper)
  );
  if (!hasImportAndCall) {
    violations.push(path.relative(path.join(root, "src", "app", "api"), abs).replace(/\\/g, "/"));
  }
}

if (violations.length > 0) {
  console.error("Scheduled route.ts file(s) missing shared cron auth helper import+call:\n");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log(`OK: ${routes.length} scheduled route(s) reference shared cron auth.`);
