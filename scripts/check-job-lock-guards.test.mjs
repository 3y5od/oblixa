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

test("analyzeJobLockGuards accepts shared cron wrappers as auth and limiter coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-job-lock-"));
  fs.mkdirSync(path.join(root, "src", "app"), { recursive: true });
  fs.writeFileSync(path.join(root, "vercel.json"), JSON.stringify({ crons: [{ path: "/api/cron/demo" }] }));
  writeScheduledRoute(
    root,
    "/api/cron/demo",
    `import { withCronRoute } from "@/lib/cron/route-runner";\nexport const GET = withCronRoute({ route: "/api/cron/demo", rateLimitKey: "cron:demo", handler: async () => ({ body: { ok: true } }) });\n`
  );

  const report = analyzeJobLockGuards(root);

  assert.deepEqual(report, { issueCount: 0, issues: [] });
});

test("analyzeJobLockGuards reports missing rate limit and cron auth when no shared guard is present", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-job-lock-"));
  fs.mkdirSync(path.join(root, "src", "app"), { recursive: true });
  fs.writeFileSync(path.join(root, "vercel.json"), JSON.stringify({ crons: [{ path: "/api/cron/missing" }] }));
  writeScheduledRoute(root, "/api/cron/missing", `export async function GET() { return Response.json({ ok: true }); }\n`);

  const report = analyzeJobLockGuards(root);

  assert.equal(report.issueCount, 2);
  assert.deepEqual(report.issues, [
    { file: "src/app/api/cron/missing/route.ts", issue: "scheduled_route_missing_rate_limit_guard" },
    { file: "src/app/api/cron/missing/route.ts", issue: "scheduled_route_missing_cron_auth_guard" },
  ]);
});