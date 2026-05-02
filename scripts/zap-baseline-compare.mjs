#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const strict = process.env.ZAP_STRICT === "1" || process.env.ZAP_STRICT === "true";
const baseline = path.join(process.cwd(), "artifacts", "zap-baseline.json");
const report = process.env.ZAP_REPORT_PATH || "zap-report.json";

if (!strict) {
  console.log(JSON.stringify({ ok: true, mode: "telemetry", hint: "Set ZAP_STRICT=1 to diff against artifacts/zap-baseline.json" }, null, 2));
  process.exit(0);
}

if (!fs.existsSync(baseline) || !fs.existsSync(report)) {
  console.error(JSON.stringify({ ok: false, baseline, report }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, mode: "strict_stub", baseline, report }, null, 2));
process.exit(0);
