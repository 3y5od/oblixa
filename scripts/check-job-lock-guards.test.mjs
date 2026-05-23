import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeJobLockGuards } from "./check-job-lock-guards.mjs";

function writeScheduledRoute(root, routePath, source) {
  const routeFile = path.join(root, "src", "app", routePath.replace(/^\//, ""), "route.ts");
  fs.mkdirSync(path.dirname(routeFile), { recursive: true });
  fs.writeFileSync(routeFile, source);
}

function writeSharedCronLockFixtures(root) {
  const runnerFile = path.join(root, "src", "lib", "cron", "route-runner.ts");
  const lockFile = path.join(root, "src", "lib", "cron", "single-flight-lock.ts");
  fs.mkdirSync(path.dirname(runnerFile), { recursive: true });
  fs.writeFileSync(
    runnerFile,
    `import { acquireCronSingleFlightLock, releaseCronSingleFlightLock } from "@/lib/cron/single-flight-lock";
export type CronRouteRunnerOptions = { singleFlightKey?: string; singleFlightTtlMs?: number };
export async function runCronRoute(request, options) {
  const lock = await acquireCronSingleFlightLock({ key: options.singleFlightKey ?? "demo", ttlMs: options.singleFlightTtlMs });
  if (!lock.acquired) return Response.json({ diagnostic_id: "cron_job_already_running" }, { status: 409 });
  try { return Response.json({ ok: true }); }
  finally { await releaseCronSingleFlightLock(lock.lock); }
}
export function withCronRoute(options) { return (request) => runCronRoute(request, options); }
`
  );
  fs.writeFileSync(
    lockFile,
    `import { Redis } from "@upstash/redis";
const memoryLocks = new Map();
export async function acquireCronSingleFlightLock({ key, token, ttlMs }) {
  const redis = Redis.fromEnv();
  await redis.set(key, token, { nx: true, px: ttlMs });
}
export async function releaseCronSingleFlightLock(lock) {
  const redis = Redis.fromEnv();
  await redis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", [lock.key], [lock.token]);
}
`
  );
}

test("analyzeJobLockGuards accepts shared cron wrappers as auth and limiter coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-job-lock-"));
  fs.mkdirSync(path.join(root, "src", "app"), { recursive: true });
  fs.writeFileSync(path.join(root, "vercel.json"), JSON.stringify({ crons: [{ path: "/api/cron/demo" }] }));
  writeSharedCronLockFixtures(root);
  writeScheduledRoute(
    root,
    "/api/cron/demo",
    `import { withCronRoute } from "@/lib/cron/route-runner";\nexport const GET = withCronRoute({ route: "/api/cron/demo", rateLimitKey: "cron:demo", handler: async () => ({ body: { ok: true } }) });\n`
  );

  const report = analyzeJobLockGuards(root);

  assert.deepEqual(report, { issueCount: 0, issues: [] });
});

test("analyzeJobLockGuards reports missing guards when no shared guard is present", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-job-lock-"));
  fs.mkdirSync(path.join(root, "src", "app"), { recursive: true });
  fs.writeFileSync(path.join(root, "vercel.json"), JSON.stringify({ crons: [{ path: "/api/cron/missing" }] }));
  writeSharedCronLockFixtures(root);
  writeScheduledRoute(root, "/api/cron/missing", `export async function GET() { return Response.json({ ok: true }); }\n`);

  const report = analyzeJobLockGuards(root);

  assert.equal(report.issueCount, 3);
  assert.deepEqual(report.issues, [
    { file: "src/app/api/cron/missing/route.ts", issue: "scheduled_route_missing_rate_limit_guard" },
    { file: "src/app/api/cron/missing/route.ts", issue: "scheduled_route_missing_cron_auth_guard" },
    { file: "src/app/api/cron/missing/route.ts", issue: "scheduled_route_missing_single_flight_guard" },
  ]);
});

test("analyzeJobLockGuards reports missing shared single-flight enforcement", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-job-lock-"));
  fs.mkdirSync(path.join(root, "src", "app"), { recursive: true });
  fs.writeFileSync(path.join(root, "vercel.json"), JSON.stringify({ crons: [{ path: "/api/cron/demo" }] }));
  writeScheduledRoute(
    root,
    "/api/cron/demo",
    `import { withCronRoute } from "@/lib/cron/route-runner";\nexport const GET = withCronRoute({ route: "/api/cron/demo", rateLimitKey: "cron:demo", handler: async () => ({ body: { ok: true } }) });\n`
  );

  const report = analyzeJobLockGuards(root);

  assert(report.issues.some((issue) => issue.issue === "shared_cron_runner_missing"));
  assert(report.issues.some((issue) => issue.issue === "cron_single_flight_helper_missing"));
});
