#!/usr/bin/env node
/**
 * Runs k6 against k6/smoke.js when k6 is installed; otherwise stub (exit 0).
 * K6_REQUIRED=1 — exit 1 if k6 binary missing.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const script = path.join(root, "k6", "smoke.js");
const required = process.env.K6_REQUIRED === "1" || process.env.K6_REQUIRED === "true";

function whichK6() {
  const r = spawnSync("which", ["k6"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  return (r.stdout || "").trim() || null;
}

const k6 = whichK6();
if (!k6) {
  const out = {
    ok: true,
    mode: "k6_missing_stub",
    hint: "Install k6 for real load tests. Set K6_REQUIRED=1 in CI to fail when k6 is absent.",
  };
  console.log(JSON.stringify(out, null, 2));
  if (required) process.exit(1);
  process.exit(0);
}

if (!fs.existsSync(script)) {
  console.error(JSON.stringify({ ok: false, error: "missing_script", script }, null, 2));
  process.exit(1);
}

const r = spawnSync(k6, ["run", script], {
  stdio: "inherit",
  env: { ...process.env },
  cwd: root,
});
process.exit(r.status ?? 1);
