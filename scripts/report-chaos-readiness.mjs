#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const targets = [
  { file: "scripts/comprehensive-pass.mjs", markers: ["safeFetch", "warn(", "FAIL"] },
  { file: "scripts/cron-canary.mjs", markers: ["fetch", "status", "error"] },
  { file: "scripts/release-checklist.mjs", markers: ["spawn", "waitForServer", "shutdown"] },
];

const rows = [];
for (const t of targets) {
  const src = readFileSync(path.join(ROOT, t.file), "utf8");
  const missing = t.markers.filter((m) => !src.includes(m));
  rows.push({ file: t.file, markerCount: t.markers.length, missingCount: missing.length, missing });
}

const failed = rows.filter((r) => r.missingCount > 0);
console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      mode: "bounded",
      targetCount: rows.length,
      failedCount: failed.length,
      rows,
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
