#!/usr/bin/env node
/**
 * Regenerates autonomous perf JSON artifacts from scripts/lib/autonomous-perf-ext-keys.mjs.
 * Run after editing the canonical EXT key list: node scripts/generate-autonomous-perf-artifacts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUTONOMOUS_PERF_EXT_KEYS } from "./lib/autonomous-perf-ext-keys.mjs";
import { taxonomyGroupForExtKey } from "./lib/autonomous-perf-taxonomy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const artifactsDir = path.join(root, "artifacts");

function main() {
  const sorted = [...AUTONOMOUS_PERF_EXT_KEYS].sort();
  if (sorted.join("\n") !== AUTONOMOUS_PERF_EXT_KEYS.join("\n")) {
    console.error("AUTONOMOUS_PERF_EXT_KEYS must be pre-sorted lexicographically.");
    process.exit(1);
  }

  const groups = {};
  for (const k of AUTONOMOUS_PERF_EXT_KEYS) {
    groups[k] = taxonomyGroupForExtKey(k);
  }

  const keys = {};
  for (const k of AUTONOMOUS_PERF_EXT_KEYS) {
    keys[k] = {
      status: "requires_external",
      owner: null,
      lastReviewedCommit: null,
    };
  }

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(
    path.join(artifactsDir, "autonomous-perf-ext-key-groups.json"),
    `${JSON.stringify({ schemaVersion: 1, groups }, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(artifactsDir, "autonomous-perf-external-handoff.keys.json"),
    `${JSON.stringify({ schemaVersion: 1, keys }, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `Wrote autonomous-perf-ext-key-groups.json + autonomous-perf-external-handoff.keys.json (${AUTONOMOUS_PERF_EXT_KEYS.length} keys).`,
  );
}

main();
