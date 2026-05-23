import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeRequiredSecurityCheckset, SECURITY_PIPELINE_REQUIRED } from "./check-required-security-checkset.mjs";

test("analyzeRequiredSecurityCheckset reports missing ci-verify-extras and ci-parity wiring", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-required-security-"));
  fs.mkdirSync(path.join(root, "scripts", "pipelines"), { recursive: true });
  fs.mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      scripts: {
        "check:api-route-auth-contract": "node x",
        "check:api-route-admin-org-scope": "node x",
      },
    })
  );
  fs.writeFileSync(path.join(root, "scripts", "pipelines", "pipeline-verify.mjs"), '["check:api-route-auth-contract"]\n');
  fs.writeFileSync(path.join(root, "scripts", "pipelines", "pipeline-security-comprehensive.mjs"), '["check:api-route-auth-contract"]\n');
  fs.writeFileSync(path.join(root, "scripts", "pipelines", "pipeline-ci-parity.mjs"), '["check:github-workflows-security"]\n');
  fs.writeFileSync(path.join(root, ".github", "workflows", "ci.yml"), "npm run check:api-route-auth-contract\n");

  const report = analyzeRequiredSecurityCheckset(root);

  assert.equal(report.issueCount > 0, true);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_package_script" && issue.script === "check:ci-verify-extras"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_package_script" && issue.script === "check:allowlist-metadata"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_package_script" && issue.script === "check:checks-integrity-meta"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_package_script" && issue.script === "pipeline:ci-parity"), true);
  assert.equal(
    report.issues.some((issue) => issue.issue === "missing_package_script" && issue.script === "check:scheduled-cron-route-wrappers"),
    true
  );
  assert.equal(SECURITY_PIPELINE_REQUIRED.includes("check:scheduled-cron-route-wrappers"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_ci_reference" && issue.cmd === "npm run check:ci-verify-extras"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_ci_reference" && issue.cmd === "npm run check:allowlist-metadata"), true);
  assert.equal(
    report.issues.some((issue) => issue.issue === "missing_ci_reference" && issue.cmd === "npm run check:scheduled-cron-route-wrappers"),
    true
  );
  assert.equal(report.issues.some((issue) => issue.issue === "missing_ci_reference" && issue.cmd === "npm run check:test-skip-governance"), true);
});
