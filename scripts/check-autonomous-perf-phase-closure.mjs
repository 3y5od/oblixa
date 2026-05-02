#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUTONOMOUS_PERF_PHASE_IDS, buildPhaseClosurePayload } from "./lib/autonomous-perf-phase-closure-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const p = path.join(root, "config", "autonomous-perf-phase-closure.json");

function sortedKeys(obj) {
  return Object.keys(obj).sort();
}

function main() {
  const disk = JSON.parse(fs.readFileSync(p, "utf8"));
  if (disk.schemaVersion !== 1) {
    console.error("Invalid schemaVersion in autonomous-perf-phase-closure.json");
    process.exit(1);
  }
  const built = buildPhaseClosurePayload();
  const fromDisk = sortedKeys(disk.phases ?? {});
  const fromBuilt = sortedKeys(built.phases);
  const canonical = [...AUTONOMOUS_PERF_PHASE_IDS].sort();
  if (fromDisk.join("\n") !== canonical.join("\n")) {
    console.error("Phase keys in JSON do not match canonical AUTONOMOUS_PERF_PHASE_IDS.");
    process.exit(1);
  }
  if (fromBuilt.join("\n") !== canonical.join("\n")) {
    console.error("Built phase keys do not match canonical list.");
    process.exit(1);
  }
  for (const id of AUTONOMOUS_PERF_PHASE_IDS) {
    if (JSON.stringify(disk.phases[id]) !== JSON.stringify(built.phases[id])) {
      console.error(`Drift for ${id}: run npm run generate:autonomous-perf-phase-closure`);
      process.exit(1);
    }
    const row = disk.phases[id];
    if (!row || typeof row.lane !== "string") {
      console.error(`Missing lane for ${id}`);
      process.exit(1);
    }
    const okLane = ["in_repo", "na", "optional_tier"].includes(row.lane);
    if (!okLane) {
      console.error(`Invalid lane for ${id}: ${row.lane}`);
      process.exit(1);
    }
    if (!Array.isArray(row.refs) || !row.refs.length) {
      console.error(`refs must be non-empty array for ${id}`);
      process.exit(1);
    }
    if (row.lane === "na" && typeof row.absent_reason !== "string") {
      console.error(`na lane requires absent_reason for ${id}`);
      process.exit(1);
    }
    if (row.lane === "optional_tier" && typeof row.tier !== "string") {
      console.error(`optional_tier requires tier for ${id}`);
      process.exit(1);
    }
  }
  console.log(`OK autonomous perf phase closure (${AUTONOMOUS_PERF_PHASE_IDS.length} phases).`);
}

main();
