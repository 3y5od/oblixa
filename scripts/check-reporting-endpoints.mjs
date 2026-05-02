#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const strict = process.env.REPORTING_HEADERS_STRICT === "1" || process.env.REPORTING_HEADERS_STRICT === "true";
const root = process.cwd();
const p = path.join(root, "next.config.ts");
if (!fs.existsSync(p)) {
  console.log(JSON.stringify({ ok: true, mode: "no_next_config" }, null, 2));
  process.exit(0);
}
const text = fs.readFileSync(p, "utf8");
const hasReportTo = /Report-To|report-to/i.test(text);
const hasNel = /NEL|nel/i.test(text);
const stubPath = path.join(root, "artifacts", "reporting-endpoints-stub.json");
let stubOk = false;
let stubError = null;
try {
  const stub = JSON.parse(fs.readFileSync(stubPath, "utf8"));
  stubOk =
    Array.isArray(stub.reportingEndpoints) &&
    stub.reportingEndpoints.length > 0 &&
    stub.nel &&
    typeof stub.nel.report_to === "string" &&
    typeof stub.nel.max_age === "number";
} catch (e) {
  stubError = String(e);
}
const ok = !strict || hasReportTo || hasNel || stubOk;
console.log(JSON.stringify({ ok, strict, hasReportTo, hasNel, stubOk, stubError }, null, 2));
process.exit(ok ? 0 : 1);
