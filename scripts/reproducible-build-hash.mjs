#!/usr/bin/env node
/**
 * Double `next build` with fixed SOURCE_DATE_EPOCH — compare `.next/trace` or build manifest fingerprint.
 * Nightly / local: REPRODUCIBLE_BUILD_STRICT=1 fails on mismatch.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const strict = process.env.REPRODUCIBLE_BUILD_STRICT === "1" || process.env.REPRODUCIBLE_BUILD_STRICT === "true";
if (!strict) {
  console.log(JSON.stringify({ ok: true, mode: "skipped_set_REPRODUCIBLE_BUILD_STRICT" }, null, 2));
  process.exit(0);
}

const epoch = process.env.SOURCE_DATE_EPOCH || String(Math.floor(Date.now() / 1000));
const env = { ...process.env, SOURCE_DATE_EPOCH: epoch };

function fingerprint() {
  const trace = path.join(process.cwd(), ".next", "trace");
  if (!fs.existsSync(trace)) return null;
  const h = createHash("sha256");
  h.update(fs.readFileSync(trace));
  return h.digest("hex");
}

function build() {
  const r = spawnSync("npm", ["run", "build"], { stdio: "inherit", shell: true, env });
  return r.status ?? 1;
}

if (build() !== 0) process.exit(1);
const a = fingerprint();
if (!a) {
  console.error(JSON.stringify({ ok: false, error: "missing_next_trace_after_build" }, null, 2));
  process.exit(1);
}

fs.rmSync(path.join(process.cwd(), ".next"), { recursive: true, force: true });
if (build() !== 0) process.exit(1);
const b = fingerprint();
const ok = a === b;
console.log(JSON.stringify({ ok, checkId: "reproducible-build-hash", a, b, epoch }, null, 2));
process.exit(ok ? 0 : 1);
