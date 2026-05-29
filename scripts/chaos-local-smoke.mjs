#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const on = process.env.RUN_CHAOS === "1";
const sourcePath = path.join(root, "src/lib/performance/operational-performance-contracts.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const requiredFaults = [
  "supabase-latency",
  "stripe-failure",
  "resend-failure",
  "openai-timeout",
  "upstash-outage",
  "webhook-duplicate",
  "cron-overlap",
  "db-conflict",
];
const missing = requiredFaults.filter((fault) => !source.includes(`id: "${fault}"`));
const report = {
  ok: missing.length === 0,
  chaos: on ? "would_run_compose" : "fixture_validation_only",
  source: "src/lib/performance/operational-performance-contracts.ts",
  faultCount: requiredFaults.length,
  missing,
  sanitizedObservabilityMarkers: ["requiredTags", "forbiddenFields", "sanitized: true"].every((marker) =>
    source.includes(marker)
  ),
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok && report.sanitizedObservabilityMarkers ? 0 : 1);
