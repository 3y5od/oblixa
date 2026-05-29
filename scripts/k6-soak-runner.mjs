#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const script = path.join(root, "k6", "soak-spike-stub.js");
const enabled = process.env.RUN_K6_SOAK === "1" || process.env.RUN_K6_SOAK === "true";
const baseUrl = process.env.STAGING_BASE_URL || "http://127.0.0.1:3000";
const productionOptIn = process.env.OBLIXA_ALLOW_PRODUCTION_LOAD === "1";

export function isSafeLoadTarget(rawUrl, allowProduction = productionOptIn) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  const productionHost = parsed.hostname === "oblixa.app" || parsed.hostname === "www.oblixa.app";
  return !productionHost || allowProduction;
}

if (!enabled) {
  console.log(JSON.stringify({ ok: true, mode: "skipped_set_RUN_K6_SOAK", baseUrl }, null, 2));
  process.exit(0);
}

if (!isSafeLoadTarget(baseUrl)) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: "production_load_opt_in_required",
        baseUrl,
        requiredEnv: "OBLIXA_ALLOW_PRODUCTION_LOAD=1",
      },
      null,
      2
    )
  );
  process.exit(1);
}

const r = spawnSync("which", ["k6"], { encoding: "utf8" });
if (r.status !== 0) {
  console.error(JSON.stringify({ ok: false, error: "k6_required_for_soak" }, null, 2));
  process.exit(1);
}
const k6 = (r.stdout || "").trim();
if (!fs.existsSync(script)) process.exit(1);
const run = spawnSync(k6, ["run", script], { stdio: "inherit", env: { ...process.env }, cwd: root });
process.exit(run.status ?? 1);
