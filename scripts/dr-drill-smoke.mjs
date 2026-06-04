#!/usr/bin/env node
import path from "node:path";
import { spawnSyncCrossPlatform } from "./lib/cross-platform-spawn.mjs";

const strict = process.env.DR_DRILL_STRICT === "1" || process.env.DR_DRILL_STRICT === "true";
const url = process.env.DR_VENDOR_STATUS_URL;
if (!strict) {
  console.log(JSON.stringify({ ok: true, mode: "skipped" }, null, 2));
  process.exit(0);
}
if (process.env.DR_DRILL_INCLUDE_RPO === "1" || process.env.DR_DRILL_INCLUDE_RPO === "true") {
  const r = spawnSyncCrossPlatform("npm", ["run", "report:rpo-rto-status"], {
    cwd: path.resolve(process.cwd()),
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error(JSON.stringify({ ok: false, error: "report_rpo_rto_status_failed" }, null, 2));
    process.exit(1);
  }
}
if (!url) {
  console.error(JSON.stringify({ ok: false, error: "missing_DR_VENDOR_STATUS_URL" }, null, 2));
  process.exit(1);
}
const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
console.log(JSON.stringify({ ok: res.ok, status: res.status }, null, 2));
process.exit(res.ok ? 0 : 1);
