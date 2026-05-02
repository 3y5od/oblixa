#!/usr/bin/env node
/**
 * Emits which QA tier ran (P0–P5) for CI artifacts / provenance.
 * @see plan: Max QA — prio-coverage-ladder
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TIER = process.env.QA_COVERAGE_TIER || process.env.QA_SWEEP_TIER || "P0";
const VALID = new Set(["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"]);

const tier = VALID.has(String(TIER).toUpperCase()) ? String(TIER).toUpperCase() : "P0";

const payload = {
  generatedAt: new Date().toISOString(),
  tier,
  skipped: [],
  reasons: [],
  env: {
    CI: !!process.env.CI,
    QA_SWEEP_TIER: process.env.QA_SWEEP_TIER || null,
    STAGING_BASE_URL: process.env.STAGING_BASE_URL ? "[set]" : null,
    E2E_TEST_EMAIL: process.env.E2E_TEST_EMAIL ? "[set]" : null,
  },
};

const outDir = path.join(ROOT, "artifacts");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "qa-coverage-tier.json");
fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
process.exit(0);
