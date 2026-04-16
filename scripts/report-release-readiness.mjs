#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const checks = [
  { name: "preflight:release", command: ["npm", ["run", "preflight:release"]] },
  { name: "check:migrations", command: ["npm", ["run", "check:migrations"]] },
  { name: "check:api-route-tests", command: ["npm", ["run", "check:api-route-tests"]] },
  { name: "check:incident-readiness", command: ["npm", ["run", "check:incident-readiness"]] },
  {
    name: "check:concurrency-hotspots-ratchet",
    command: ["npm", ["run", "check:concurrency-hotspots-ratchet"]],
  },
];

const rows = [];
for (const check of checks) {
  const startedAt = Date.now();
  const [cmd, args] = check.command;
  const res = spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8", env: process.env });
  const elapsedMs = Date.now() - startedAt;
  rows.push({
    name: check.name,
    command: `${cmd} ${args.join(" ")}`,
    elapsedMs,
    status: res.status ?? 1,
    ok: (res.status ?? 1) === 0,
    stdout: (res.stdout || "").slice(0, 500),
    stderr: (res.stderr || "").slice(0, 500),
  });
}

const failedChecks = rows.filter((r) => !r.ok).map((r) => r.name);
const traceId = `release-${Date.now()}`;
const schemaVersion = "1.1.0";
const nextActions = failedChecks.length
  ? [
      "Re-run failing checks locally for full logs.",
      "Fix failing checks before running release checklist.",
      "Re-generate release readiness report and confirm all checks are green.",
    ]
  : ["Release preflight checks are healthy."];
const stopShip = failedChecks.length > 0;
const severity = stopShip ? "blocking" : "ok";

console.log(
  JSON.stringify(
    {
      schemaVersion,
      traceId,
      generatedAt: new Date().toISOString(),
      ok: rows.every((r) => r.ok),
      stopShip,
      severity,
      failedChecks,
      nextActions,
      checks: rows,
    },
    null,
    2
  )
);
