import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeTestFixtureSecrets } from "./check-test-fixture-secrets.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeTestFixtureSecrets scans docs, artifacts, and workflows", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-fixture-secrets-"));
  const stripeLike = `sk_live_${"abcdefghijklmnopqrstuvwxyz0123456789"}`;
  const githubLike = `github_pat_${"A".repeat(82)}`;
  const slackLike = `xoxb-${"1234567890-1234567890-abcdefghij"}`;
  write(root, "docs/security.md", `bad=${stripeLike}\n`);
  write(root, "artifacts/security-report.json", JSON.stringify({ token: githubLike }));
  write(root, ".github/workflows/ci.yml", `env:\n  SLACK_TOKEN: ${slackLike}\n`);

  const report = analyzeTestFixtureSecrets(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((i) => i.issue === "stripe_live_key_in_test_fixture" && i.file === "docs/security.md"));
  assert(report.issues.some((i) => i.issue === "github_pat_in_test_fixture" && i.file === "artifacts/security-report.json"));
  assert(report.issues.some((i) => i.issue === "slack_token_in_test_fixture" && i.file === ".github/workflows/ci.yml"));
});

test("analyzeTestFixtureSecrets honors explicit placeholder allow markers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-fixture-secrets-allow-"));
  const openAiLike = `sk-proj-${"abcdefghijklmnopqrstuvwxyz"}${"ABCDEFGHIJKLMNOPQRSTUVWXYZ"}${"0123456789"}`;
  write(root, "src/lib/example.test.ts", `const key = "${openAiLike}"; // security:test-fixture-secret-placeholder\n`);

  const report = analyzeTestFixtureSecrets(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
});
