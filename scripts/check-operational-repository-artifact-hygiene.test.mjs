import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  analyzeSourceHygiene,
  analyzeTransientArtifacts,
  analyzeWorkspaceCleanliness,
  buildOperationalRepositoryArtifactHygieneReport,
} from "./check-operational-repository-artifact-hygiene.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-repo-hygiene-"));
}

function write(root, rel, value, encoding = "utf8") {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, value, encoding);
}

const baseConfig = {
  transientArtifacts: [
    {
      path: "playwright-report/",
      gitignorePattern: "playwright-report/",
      ownerArea: "test-platform",
      cleanupPolicy: "ignored-playwright-report",
    },
  ],
  largeFilePolicy: {
    maxTrackedTextBytes: 1000,
    maxTrackedBinaryBytes: 1000,
    maxUntrackedBytes: 1000,
    allowlist: [],
  },
  binaryFilePolicy: {
    allowedPathPatterns: ["public/*.png"],
    archiveExtensions: [".zip"],
    allowedArchivePathPatterns: [],
  },
  sourceHygiene: {
    textExtensions: [".ts", ".json", ".mjs"],
    excludePathPrefixes: [],
    finalNewlineExemptions: [],
    asciiRequiredPathPrefixes: ["config/operational-"],
  },
  workspaceCleanliness: {
    requiredUntrackedPatterns: ["artifacts/operational-*.json", "scripts/check-operational-*.mjs"],
    localOnlyReferencePatterns: [`.${"claude"}/`],
    referenceScanRoots: ["package.json", "scripts"],
  },
  requiredPackageScripts: [],
  requiredCiCommands: [],
};

test("transient artifacts must be classified in gitignore", () => {
  const root = makeRoot();
  write(root, ".gitignore", "coverage/\n");
  const issues = [];

  const report = analyzeTransientArtifacts(root, baseConfig, issues);

  assert.equal(report.missingIgnoreCount, 1);
  assert.equal(issues[0].issue, "transient_artifact_missing_gitignore_entry");
});

test("source hygiene detects CRLF, missing newline, Trojan Source controls, and ASCII policy violations", () => {
  const root = makeRoot();
  write(root, "src/a.ts", "const a = 1;\r\n");
  write(root, "src/b.ts", "const b = 1;");
  write(root, "src/c.ts", "const c = \"safe\";\u202e\n");
  write(root, "config/operational-demo.json", `{"label":"non-ascii ... ${String.fromCharCode(233)}"}\n`);
  const issues = [];

  const report = analyzeSourceHygiene(root, baseConfig, issues, {
    files: ["src/a.ts", "src/b.ts", "src/c.ts", "config/operational-demo.json"],
  });

  assert.equal(report.crlfCount, 1);
  assert.equal(report.missingFinalNewlineCount, 1);
  assert.equal(report.trojanSourceControlCount, 1);
  assert.equal(report.asciiPolicyViolationCount, 1);
  assert.deepEqual(
    issues.map((row) => row.issue).sort(),
    [
      "source_file_crlf_line_endings",
      "source_file_missing_final_newline",
      "source_file_non_ascii_forbidden_by_policy",
      "source_file_trojan_source_control",
    ].sort()
  );
});

test("untracked operational artifacts must be registered in generated artifact hygiene", () => {
  const root = makeRoot();
  write(root, "package.json", JSON.stringify({ scripts: { "check:operational-demo": "node scripts/check-operational-demo.mjs" } }, null, 2));
  write(root, ".github/workflows/ci.yml", "");
  const issues = [];

  const report = analyzeWorkspaceCleanliness(root, baseConfig, issues, {
    untrackedFiles: ["artifacts/operational-demo.json", "scripts/check-operational-demo.mjs"],
    artifactPaths: [],
    writeCommands: {},
  });

  assert.equal(report.requiredUntrackedFileCount, 2);
  assert.equal(report.unregisteredRequiredUntrackedFileCount, 1);
  assert.equal(issues[0].issue, "untracked_required_operational_file_missing_registry");
  assert.equal(issues[0].path, "artifacts/operational-demo.json");
});

test("aggregate report delegates generated artifact hygiene and remains deterministic for fixtures", () => {
  const root = makeRoot();
  write(root, ".gitignore", "playwright-report/\n");
  write(root, "package.json", JSON.stringify({ scripts: {} }, null, 2) + "\n");
  write(root, ".github/workflows/ci.yml", "\n");
  write(root, "artifacts/operational-demo.json", JSON.stringify({ ok: true }, null, 2) + "\n");
  write(root, "config/operational-package-pipelines.json", JSON.stringify({
    generatedArtifactOwnership: [
      { prefix: "artifacts/operational-", ownerArea: "platform-hardening", cleanupPolicy: "regenerate-on-check-drift" },
    ],
  }, null, 2) + "\n");

  const report = buildOperationalRepositoryArtifactHygieneReport(root, {
    config: baseConfig,
    files: ["package.json", ".github/workflows/ci.yml", "artifacts/operational-demo.json"],
    untrackedFiles: [],
    artifactPaths: ["artifacts/operational-demo.json"],
    deterministicArtifactPaths: [],
    writeCommands: {},
    skipDelegates: true,
  });

  assert.equal(report.ok, true);
  assert.equal(report.delegatedChecks.generatedArtifactHygiene.ok, true);
  assert.equal(report.generatedArtifactOwnership.ownedArtifactCount, 1);
});
