/**
 * Ensures vercel.json cron paths have matching route handlers and documented
 * JSON shapes (CRON_ROUTE_EXPECTED_KEYS). Prevents drift between deploy schedules,
 * canaries, and the codebase.
 *
 * V7 user-visible fan-out: crons that email/Slack or enqueue notifications must respect
 * workspace mode and notification tier inside the handler (see e.g. report-packs-generate,
 * send-summaries); extend the handler test matrix when adding schedules.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CRON_ROUTE_EXPECTED_KEYS } from "./cron-route-expected-keys.mjs";

const vercelPath = join(process.cwd(), "vercel.json");
const vercel = JSON.parse(readFileSync(vercelPath, "utf8"));
const crons = Array.isArray(vercel.crons) ? vercel.crons : [];

const expectedKeys = new Set(CRON_ROUTE_EXPECTED_KEYS.keys());
const seenPaths = new Set();
const errors = [];

function routeToRouteTs(route) {
  const rel = route.replace(/^\//, "");
  return join(process.cwd(), "src", "app", rel, "route.ts");
}

for (const entry of crons) {
  const path = entry?.path;
  if (!path || typeof path !== "string") {
    errors.push("cron entry missing string path");
    continue;
  }
  if (seenPaths.has(path)) {
    errors.push(`duplicate vercel cron path: ${path}`);
  }
  seenPaths.add(path);

  if (!expectedKeys.has(path)) {
    errors.push(
      `vercel.json cron path ${path} is not listed in scripts/cron-route-expected-keys.mjs (CRON_ROUTE_EXPECTED_KEYS)`
    );
  }

  const routeFile = routeToRouteTs(path);
  if (!existsSync(routeFile)) {
    errors.push(`missing App Router handler for ${path}: expected ${routeFile}`);
  }
}

if (errors.length > 0) {
  console.error("Vercel cron alignment check failed:");
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}

console.log(
  `Vercel cron alignment check passed (${crons.length} scheduled paths, ${expectedKeys.size} canary-documented routes).`
);
