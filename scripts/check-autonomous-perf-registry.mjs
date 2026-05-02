#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUTONOMOUS_PERF_EXT_KEYS } from "./lib/autonomous-perf-ext-keys.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const artifactsDir = path.join(root, "artifacts");

function main() {
  const handoffPath = path.join(artifactsDir, "autonomous-perf-external-handoff.keys.json");
  const groupsPath = path.join(artifactsDir, "autonomous-perf-ext-key-groups.json");
  const handoff = JSON.parse(fs.readFileSync(handoffPath, "utf8"));
  const grouped = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
  const expected = [...AUTONOMOUS_PERF_EXT_KEYS].sort();
  const handoffKeys = Object.keys(handoff.keys ?? {}).sort();
  const groupKeys = Object.keys(grouped.groups ?? {}).sort();
  if (handoffKeys.join("\n") !== expected.join("\n")) {
    console.error("Handoff keys mismatch canonical list.");
    process.exit(1);
  }
  if (groupKeys.join("\n") !== expected.join("\n")) {
    console.error("ext-key-groups keys mismatch canonical list.");
    process.exit(1);
  }
  for (const k of expected) {
    if (!grouped.groups[k]) {
      console.error(`Missing taxonomy group for ${k}`);
      process.exit(1);
    }
  }
  console.log(`OK autonomous perf registry (${expected.length} EXT keys).`);
}

main();
