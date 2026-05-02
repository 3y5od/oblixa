#!/usr/bin/env node
const strict = process.env.READABILITY_STRICT === "1";
if (!strict) {
  console.log(JSON.stringify({ ok: true, mode: "skipped" }, null, 2));
  process.exit(0);
}
console.log(JSON.stringify({ ok: true, mode: "stub", hint: "Wire flesch-kincaid on legal HTML when READABILITY_STRICT=1" }, null, 2));
process.exit(0);
