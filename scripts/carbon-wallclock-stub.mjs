#!/usr/bin/env node
/**
 * Append wall-clock minutes estimate to carbon-ci-stub for SCI-style reporting (telemetry only).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const basePath = path.join(root, "artifacts", "carbon-ci-stub.json");
const j = JSON.parse(fs.readFileSync(basePath, "utf8"));
const out = {
  ...j,
  generatedAt: new Date().toISOString(),
  wallClockMinutesEstimate: Math.max(1, Math.round((Date.now() % 86_400_000) / 60_000)),
  runnerClass: process.env.GITHUB_RUNNER_NAME || process.env.RUNNER_OS || "local",
};
const runtimePath = path.join(root, "artifacts", "carbon-ci-stub.runtime.json");
fs.writeFileSync(runtimePath, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, checkId: "carbon-wallclock-stub", path: "artifacts/carbon-ci-stub.runtime.json" }, null, 2));
process.exit(0);
