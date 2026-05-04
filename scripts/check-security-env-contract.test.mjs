import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeSecurityEnvContract, parseEnvExampleKeys } from "./check-security-env-contract.mjs";

test("parseEnvExampleKeys reads commented and uncommented env entries", () => {
  const keys = parseEnvExampleKeys("FOO=1\n# BAR=2\n  # BAZ=3\n");
  assert.deepEqual([...keys], ["FOO", "BAR", "BAZ"]);
});

test("analyzeSecurityEnvContract reports missing env keys and workflow references", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-security-env-"));
  fs.mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(root, ".env.example"), "OPENAI_API_KEY=\n# CRON_SECRET=\n");
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { "check:env-example-parity": "node x" } }));
  fs.writeFileSync(path.join(root, ".github", "workflows", "ci.yml"), "npm run check:env-example-parity\n");
  fs.writeFileSync(path.join(root, ".github", "workflows", "qa-code-maximal.yml"), "synthetic_slo\n");
  fs.writeFileSync(path.join(root, ".github", "workflows", "qa-max-nightly.yml"), "API runtime smoke (Epic 3 nightly tier)\n");
  fs.writeFileSync(path.join(root, ".github", "workflows", "slo-monitor.yml"), "HC_SLO_MONITOR_PING\n");

  const report = analyzeSecurityEnvContract(root);

  assert.equal(report.issueCount > 0, true);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_env_example_key" && issue.key === "HC_SLO_MONITOR_PING"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_package_script" && issue.script === "check:synthetic-slo-env"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_ci_reference" && issue.cmd === "npm run check:security-env-contract"), true);
});