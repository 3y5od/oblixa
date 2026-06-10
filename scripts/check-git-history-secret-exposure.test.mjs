import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { analyzeGitHistorySecretExposure } from "./check-git-history-secret-exposure.mjs";

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function makeRepo() {
  const root = mkdtempSync(path.join(tmpdir(), "oblixa-history-secret-"));
  git(root, ["init"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test User"]);
  return root;
}

function commitFile(root, rel, content, message) {
  writeFileSync(path.join(root, rel), content);
  git(root, ["add", rel]);
  git(root, ["commit", "-m", message]);
}

test("passes clean git history", () => {
  const root = makeRepo();
  commitFile(root, "README.md", "No secrets here.\n", "clean");
  const report = analyzeGitHistorySecretExposure(root, { maxCommits: 10 });
  assert.equal(report.ok, true);
});

test("detects high-confidence tokens in git history", () => {
  const root = makeRepo();
  const token = `ghp_${"abcdefghijklmnopqrstuvwxyz"}${"ABCDEFGHIJKL"}`;
  commitFile(root, "leak.txt", `token=${token}\n`, "leak");
  const report = analyzeGitHistorySecretExposure(root, { maxCommits: 10 });
  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "github_token");
});

test("honors explicit allow markers for fixtures", () => {
  const root = makeRepo();
  commitFile(
    root,
    "fixture.txt",
    "token=ghp_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL # security:test-fixture-secret-placeholder\n",
    "fixture"
  );
  const report = analyzeGitHistorySecretExposure(root, { maxCommits: 10 });
  assert.equal(report.ok, true);
});

test("ignores disposable local postgres smoke credentials", () => {
  const root = makeRepo();
  commitFile(
    root,
    "ci.yml",
    "DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres\n",
    "local postgres smoke"
  );
  const report = analyzeGitHistorySecretExposure(root, { maxCommits: 10 });
  assert.equal(report.ok, true);
});
