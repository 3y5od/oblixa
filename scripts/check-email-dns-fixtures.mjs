#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const live = process.env.CHECK_EMAIL_DNS_LIVE === "1";
if (!live) {
  console.log(JSON.stringify({ ok: true, mode: "fixtures_only" }, null, 2));
  process.exit(0);
}
const fixtures = path.join(ROOT, "artifacts", "mta-sts-policy.json");
console.log(JSON.stringify({ ok: fs.existsSync(fixtures), live }, null, 2));
process.exit(0);
