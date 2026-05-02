#!/usr/bin/env node
/**
 * Writes config/autonomous-perf-phase-closure.json from scripts/lib/autonomous-perf-phase-closure-lib.mjs.
 * Run after editing canonical phase ids or overrides.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPhaseClosurePayload } from "./lib/autonomous-perf-phase-closure-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const out = path.join(root, "config", "autonomous-perf-phase-closure.json");
const payload = buildPhaseClosurePayload();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(root, out)} (${Object.keys(payload.phases).length} phases).`);
