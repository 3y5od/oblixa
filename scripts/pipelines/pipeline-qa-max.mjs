#!/usr/bin/env node
/**
 * QA max sweep orchestrator (plan: phase0-orchestration).
 * QA_SWEEP_TIER=P0|P1|P2|P3|P4 controls depth (default P1).
 */
import { QA_TIER_STEPS } from "../lib/qa-tier-steps.mjs";
import { runSequential } from "../lib/scheduler.mjs";

const tier = (process.env.QA_SWEEP_TIER || "P1").toUpperCase();

const steps = QA_TIER_STEPS[tier] ?? QA_TIER_STEPS.P1;

process.env.QA_COVERAGE_TIER = tier;
const results = await runSequential(steps);
const failed = results.find((r) => !r.ok && r.required);
console.log(JSON.stringify({ pipeline: "qa-max", tier, results }, null, 2));
process.exit(failed ? failed.code : 0);
