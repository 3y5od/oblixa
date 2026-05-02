#!/usr/bin/env node
/**
 * CLA/DCO policy: pass if CONTRIBUTING.md mentions DCO/CLA/sign-off OR strict env unset.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const strict = process.env.CLA_DCO_POLICY_STRICT === "1";
const candidates = ["CONTRIBUTING.md", ".github/PULL_REQUEST_TEMPLATE.md", ".github/pull_request_template.md"].map((r) =>
  path.join(root, r)
);
let hit = false;
for (const p of candidates) {
  if (fs.existsSync(p)) {
    const t = fs.readFileSync(p, "utf8");
    if (/sign-off|DCO|CLA|Developer Certificate/i.test(t)) hit = true;
  }
}
const ok = !strict || hit;
console.log(JSON.stringify({ checkId: "cla-dco-signed-commits-policy", strict, hit }, null, 2));
process.exit(ok ? 0 : 1);
