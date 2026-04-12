#!/usr/bin/env node
/**
 * Ensures env keys read by calibration-stale-env.ts appear in .env.example (commented or set).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envExample = path.join(root, ".env.example");
const staleEnvSrc = path.join(root, "src/lib/onboarding/calibration-stale-env.ts");

const REQUIRED = [
  "DISABLE_ONBOARDING_CALIBRATION_STALE_CRON",
  "ONBOARDING_CALIBRATION_STALE_CRON_DRY_RUN",
  "ONBOARDING_CALIBRATION_STALE_AFTER_DAYS",
  "ONBOARDING_CALIBRATION_PENDING_STALE_AFTER_DAYS",
  "ONBOARDING_CALIBRATION_STALE_MS_BETWEEN_ORGS",
];

function loadEnvExampleKeys() {
  const raw = fs.readFileSync(envExample, "utf8");
  const keys = new Set();
  for (const line of raw.split("\n")) {
    const t = line.trim();
    const m = /^([A-Z][A-Z0-9_]*)\s*=/.exec(t);
    if (m) keys.add(m[1]);
    const mComment = /^#\s*([A-Z][A-Z0-9_]*)\s*=/.exec(t);
    if (mComment) keys.add(mComment[1]);
    const mBare = /^#\s*([A-Z][A-Z0-9_]*)\s*$/.exec(t);
    if (mBare) keys.add(mBare[1]);
  }
  return keys;
}

function main() {
  const src = fs.readFileSync(staleEnvSrc, "utf8");
  for (const k of REQUIRED) {
    if (!src.includes(`process.env.${k}`)) {
      console.error(`FAIL calibration-stale-env.ts no longer references ${k}; update this script list.`);
      process.exit(1);
    }
  }
  const documented = loadEnvExampleKeys();
  const missing = REQUIRED.filter((k) => !documented.has(k));
  if (missing.length) {
    console.error("FAIL .env.example missing stale-cron keys:", missing.join(", "));
    process.exit(1);
  }
  console.log("PASS onboarding stale cron env keys documented in .env.example");
}

main();
