#!/usr/bin/env node
const strict = process.env.DOMAIN_STRICT === "1" || process.env.DOMAIN_STRICT === "true";
const apex = process.env.PUBLIC_APEX_DOMAIN;
if (!strict) {
  console.log(JSON.stringify({ ok: true, mode: "skipped" }, null, 2));
  process.exit(0);
}
if (!apex) {
  console.error(JSON.stringify({ ok: false, error: "missing_PUBLIC_APEX_DOMAIN" }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, mode: "stub_strict", apex }, null, 2));
process.exit(0);
