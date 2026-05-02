#!/usr/bin/env node
const on = process.env.DNSSEC_PRIVACY_STRICT === "1";
if (!on) {
  console.log(JSON.stringify({ ok: true, mode: "skipped" }, null, 2));
  process.exit(0);
}
console.log(JSON.stringify({ ok: true, mode: "stub", hint: "Wire DoH probes when DNSSEC_PRIVACY_STRICT=1" }, null, 2));
process.exit(0);
