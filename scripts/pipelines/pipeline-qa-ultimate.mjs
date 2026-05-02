#!/usr/bin/env node
/**
 * QA ultimate orchestrator — reads config/qa-tier-manifest.json, optional autodiscover merge,
 * env-gated steps, batch sharding. Writes artifacts/qa-ultimate-run.json
 */
import fs from "node:fs";
import path from "node:path";

import { discoverCheckScripts, filterCheckBatch, loadPackageJson } from "../lib/qa-discover-check-scripts.mjs";
import { runSequential } from "../lib/scheduler.mjs";

const ROOT = process.cwd();

function normalizeTier(raw) {
  const t = String(raw || "pr").toLowerCase();
  if (t === "pr_strict" || t === "pr-strict") return "pr_strict";
  if (t === "pr_maximal_dev" || t === "pr-maximal-dev") return "pr_maximal_dev";
  if (t === "nightly_fast" || t === "nightly-fast") return "nightly_fast";
  if (t === "nightly_deep" || t === "nightly-deep") return "nightly_deep";
  if (t === "release_ultimate" || t === "release-ultimate") return "release_ultimate";
  if (t === "checks_batch_strict" || t === "checks-batch-strict") return "checks_batch_strict";
  if (t === "checks_batch" || t === "checks-batch") return "checks_batch";
  if (t === "taxonomy_closure" || t === "taxonomy-closure") return "taxonomy_closure";
  if (t === "taxonomy_closure_strict" || t === "taxonomy-closure-strict") return "taxonomy_closure_strict";
  if (t === "taxonomy_bidirectional" || t === "taxonomy-bidirectional") return "taxonomy_bidirectional";
  return t;
}

function normalizeStep(row) {
  if (typeof row === "string") return { script: row, required: true, ifEnv: null };
  return {
    script: row.script,
    required: row.required !== false,
    ifEnv: row.ifEnv ?? null,
  };
}

function envTruthy(name) {
  if (!name) return false;
  const v = process.env[name];
  return v === "1" || v === "true" || v === "yes";
}

function dedupeSteps(steps) {
  const seen = new Set();
  const out = [];
  for (const s of steps) {
    const key = s.script;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object") throw new Error("manifest_missing");
  if (manifest.version !== 1) throw new Error("manifest_bad_version");
  if (!manifest.tiers || typeof manifest.tiers !== "object") throw new Error("manifest_missing_tiers");
}

const tierKey = normalizeTier(process.env.QA_ULTIMATE_TIER || "pr");
const manifestPath = path.join(ROOT, "config", "qa-tier-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
try {
  validateManifest(manifest);
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: String(e?.message || e) }, null, 2));
  process.exit(1);
}

const tierCfg = manifest.tiers?.[tierKey] || manifest.tiers?.pr;
if (!tierCfg) {
  console.error(JSON.stringify({ ok: false, error: "unknown_tier", tierKey }, null, 2));
  process.exit(1);
}

const pkg = loadPackageJson(ROOT);
const denylist = [...(manifest.autodiscover?.denylist || [])];

let combined = (tierCfg.steps || []).map(normalizeStep);
const mergeAuto = !!tierCfg.mergeAutodiscoverChecks;
if (mergeAuto) {
  let discovered = discoverCheckScripts(pkg, { denylist });
  const batchTotal = Number(
    process.env.QA_CHECK_BATCH_TOTAL || process.env.QA_CHECK_BATCH_SIZE || process.env.QA_CHECK_BATCH_COUNT || 0
  );
  const batchIndex = Number(process.env.QA_CHECK_BATCH_INDEX || 0);
  discovered = filterCheckBatch(discovered, { batchTotal, batchIndex });
  const already = new Set(combined.map((s) => s.script));
  for (const name of discovered) {
    if (already.has(name)) continue;
    combined.push({ script: name, required: true, ifEnv: null });
    already.add(name);
  }
}

combined = dedupeSteps(combined);

const ultimateStrict = process.env.QA_ULTIMATE_STRICT === "1" || process.env.QA_ULTIMATE_STRICT === "true";
const skippedIfEnv = [];
const runnable = [];
for (const step of combined) {
  if (step.ifEnv && !envTruthy(step.ifEnv)) {
    if (ultimateStrict && step.required) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            error: "missing_required_env",
            script: step.script,
            ifEnv: step.ifEnv,
          },
          null,
          2
        )
      );
      process.exit(1);
    }
    skippedIfEnv.push(step.script);
    continue;
  }
  runnable.push(step);
}

const results = await runSequential(runnable);
const failed = results.find((r) => !r.ok && r.required);

const summary = {
  ok: !failed,
  pipeline: "qa-ultimate",
  tier: tierKey,
  mergeAutodiscoverChecks: mergeAuto,
  ultimateStrict,
  batchTotal:
    process.env.QA_CHECK_BATCH_TOTAL ||
    process.env.QA_CHECK_BATCH_SIZE ||
    process.env.QA_CHECK_BATCH_COUNT ||
    null,
  batchIndex: process.env.QA_CHECK_BATCH_INDEX || null,
  skippedIfEnv,
  results,
};

const outDir = path.join(ROOT, "artifacts");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "qa-ultimate-run.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
process.exit(failed ? failed.code || 1 : 0);
