#!/usr/bin/env node
/**
 * QA universe sweep — orchestrates maximal CI parity locally/CI.
 * Set QA_UNIVERSE_FULL=1 for the full chain (long). Default runs a fast subset.
 * Writes artifacts/qa-universe-run.json for triage / closure evidence.
 */
import fs from "node:fs";
import path from "node:path";
import { runNpmScript } from "./lib/process.mjs";

const root = process.cwd();
const artifactDir = path.join(root, "artifacts");
const artifactPath = path.join(artifactDir, "qa-universe-run.json");

const full = process.env.QA_UNIVERSE_FULL === "1" || process.env.QA_UNIVERSE_FULL === "true";

const fast = [
  "report:qa-coverage-tier",
  "qa:sweep:max:p4",
  "pipeline:ci-parity",
  "check:command-reference-integrity",
];

const universe = [
  ...fast,
  "qa:sweep:ultimate:nightly",
  "qa:sweep:ultimate:release",
  "qa:sweep:ultimate:postmerge",
  "qa:sweep:code:maximal",
  "pipeline:verify",
  "merge:junit",
];

const steps = full ? universe : fast;

const started = Date.now();
const stepResults = [];
let failed = null;
for (const script of steps) {
  const t0 = Date.now();
  const r = await runNpmScript(script);
  stepResults.push({ script, ok: r.ok, code: r.code, durationMs: Date.now() - t0 });
  if (!r.ok) {
    failed = { script, code: r.code };
    break;
  }
}

const payload = {
  pipeline: "qa-sweep-universe",
  full,
  steps,
  failed,
  stepResults,
  finishedAtUtc: new Date().toISOString(),
  durationMs: Date.now() - started,
};
fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(artifactPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ ...payload, artifact: path.relative(root, artifactPath) }, null, 2));
process.exit(failed ? failed.code ?? 1 : 0);
