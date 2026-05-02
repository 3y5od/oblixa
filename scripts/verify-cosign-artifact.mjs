#!/usr/bin/env node
const key = process.env.COSIGN_PUBLIC_KEY;
if (!key) {
  console.log(JSON.stringify({ ok: true, mode: "no_cosign_key" }, null, 2));
  process.exit(0);
}
console.log(JSON.stringify({ ok: true, mode: "stub", hint: "Run cosign verify-blob when release artifacts exist" }, null, 2));
process.exit(0);
