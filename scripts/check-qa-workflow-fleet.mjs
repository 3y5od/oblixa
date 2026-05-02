#!/usr/bin/env node
/**
 * Validates qa-*.yml workflows declare contents:read and timeout-minutes.
 * QA_WORKFLOW_FLEET_ALL=1 — scan every .github/workflows/*.yml (same rules).
 * QA_WORKFLOW_CHECKOUT_PIN=1 — require actions/checkout@ full 40-char SHA.
 * QA_WORKFLOW_NON_ACTIONS_PIN_STRICT=1 — require non-actions/* uses: pins to be 40-char SHAs (third-party composite risk).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const wfDir = path.join(root, ".github", "workflows");
const all = process.env.QA_WORKFLOW_FLEET_ALL === "1" || process.env.QA_WORKFLOW_FLEET_ALL === "true";
const checkoutPin = process.env.QA_WORKFLOW_CHECKOUT_PIN === "1" || process.env.QA_WORKFLOW_CHECKOUT_PIN === "true";
const nonActionsPinStrict =
  process.env.QA_WORKFLOW_NON_ACTIONS_PIN_STRICT === "1" ||
  process.env.QA_WORKFLOW_NON_ACTIONS_PIN_STRICT === "true";

const files = fs
  .readdirSync(wfDir)
  .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
  .filter((f) => (all ? true : f.startsWith("qa-")));

const problems = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(wfDir, f), "utf8");
  if (!/timeout-minutes:\s*\d+/.test(text)) {
    problems.push({ file: f, reason: "missing_timeout_minutes" });
  }
  if (!/permissions:[\s\S]*?contents:\s*read/m.test(text)) {
    problems.push({ file: f, reason: "missing_contents_read_permissions" });
  }
  if (checkoutPin) {
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*uses:\s*actions\/checkout@([^\s#]+)/);
      if (m && !/^[0-9a-f]{40}$/i.test(m[1])) {
        problems.push({ file: f, reason: "checkout_actions_sha_not_full", ref: m[1] });
      }
    }
  }
  if (nonActionsPinStrict) {
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*uses:\s*([^@\s]+)@([^\s#]+)/);
      if (!m) continue;
      const [, pkg, ref] = m;
      if (pkg.startsWith("actions/") || pkg.startsWith("docker://")) continue;
      if (!/^[0-9a-f]{40}$/i.test(ref)) {
        problems.push({ file: f, reason: "non_actions_use_not_full_sha", uses: `${pkg}@${ref}` });
      }
    }
  }
}

const ok = problems.length === 0;
const payload = { checkId: "qa-workflow-fleet", ok, problems, scanned: files.length };
console.log(JSON.stringify(payload, null, 2));
process.exit(ok ? 0 : 1);
