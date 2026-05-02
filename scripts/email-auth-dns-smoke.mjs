#!/usr/bin/env node
const strict = process.env.EMAIL_DNS_STRICT === "1" || process.env.EMAIL_DNS_STRICT === "true";
const domain = process.env.EMAIL_DNS_DOMAIN;
if (!strict) {
  console.log(JSON.stringify({ ok: true, mode: "skipped" }, null, 2));
  process.exit(0);
}
if (!domain) {
  console.error(JSON.stringify({ ok: false, error: "missing_EMAIL_DNS_DOMAIN" }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, mode: "stub_strict", domain }, null, 2));
process.exit(0);
