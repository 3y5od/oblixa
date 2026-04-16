#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const checks = [
  { id: "api_route_auth_contract", cmd: "npm", args: ["run", "check:api-route-auth-contract"] },
  { id: "api_route_tests", cmd: "npm", args: ["run", "check:api-route-tests"] },
  { id: "rate_limit_coverage", cmd: "npm", args: ["run", "check:api-route-rate-limit-coverage"] },
  { id: "cron_auth", cmd: "npm", args: ["run", "check:cron-route-auth"] },
  { id: "server_lib_admin", cmd: "npm", args: ["run", "check:server-lib-admin"] },
  { id: "workflow_security", cmd: "npm", args: ["run", "check:github-workflows-security"] },
  { id: "tracked_secrets", cmd: "npm", args: ["run", "check:tracked-secrets-hygiene"] },
  { id: "incident_readiness", cmd: "npm", args: ["run", "check:incident-readiness:strict"] },
  { id: "artifact_integrity", cmd: "npm", args: ["run", "check:artifact-integrity"] },
];

const rows = [];
for (const check of checks) {
  const startedAt = Date.now();
  const res = spawnSync(check.cmd, check.args, {
    encoding: "utf8",
    stdio: "pipe",
    env: process.env,
  });
  const elapsedMs = Date.now() - startedAt;
  rows.push({
    id: check.id,
    command: `${check.cmd} ${check.args.join(" ")}`,
    ok: (res.status ?? 1) === 0,
    status: res.status ?? 1,
    elapsedMs,
    stdoutTail: (res.stdout || "").trim().slice(-500),
    stderrTail: (res.stderr || "").trim().slice(-500),
  });
}

const passCount = rows.filter((r) => r.ok).length;
const failCount = rows.length - passCount;
const score = Number(((passCount / rows.length) * 100).toFixed(1));

const payload = {
  generatedAt: new Date().toISOString(),
  schemaVersion: "1.0.0",
  score,
  status: failCount === 0 ? "pass" : "fail",
  passCount,
  failCount,
  checks: rows,
};

console.log(JSON.stringify(payload, null, 2));
if (failCount > 0) process.exit(1);
