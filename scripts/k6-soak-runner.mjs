#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const script = path.join(root, "k6", "soak-spike-stub.js");
const enabled = process.env.RUN_K6_SOAK === "1" || process.env.RUN_K6_SOAK === "true";

if (!enabled) {
  console.log(JSON.stringify({ ok: true, mode: "skipped_set_RUN_K6_SOAK" }, null, 2));
  process.exit(0);
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
