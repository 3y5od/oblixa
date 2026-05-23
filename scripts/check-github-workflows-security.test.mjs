import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeCiArtifactSecretLeakage } from "./check-ci-artifact-secret-leakage.mjs";
import { analyzeGithubScheduledWorkflowsSecrets } from "./check-github-scheduled-workflows-secrets.mjs";
import { analyzeGithubWorkflowsSecurity } from "./check-github-workflows-security.mjs";

const PINNED_UPLOAD_ARTIFACT = "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02";
const PINNED_DOWNLOAD_ARTIFACT = "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093";
const PINNED_CHECKOUT = "actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeRegistry(root, workflows) {
  write(
    root,
    "artifacts/assurance/github-workflow-secret-gates.json",
    JSON.stringify(
      {
        version: 3,
        helperScript: "scripts/github-actions/secret-gate.sh",
        workflows,
      },
      null,
      2
    )
  );
}

function writeSecureFixture(root) {
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  pull_request:

permissions:
  contents: read

jobs:
  e2e:
    permissions:
      contents: read
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: ${PINNED_CHECKOUT}
        with:
          persist-credentials: false
      - name: Gate E2E
        id: gate_e2e
        env:
          REQUIRE_CI_E2E_AUTH: \${{ vars.REQUIRE_CI_E2E_AUTH }}
          E2E_TEST_EMAIL: \${{ secrets.E2E_TEST_EMAIL }}
        run: bash scripts/github-actions/secret-gate.sh "e2e" "REQUIRE_CI_E2E_AUTH" "E2E_TEST_EMAIL"
      - name: Authenticated smoke
        if: \${{ steps.gate_e2e.outputs.run == 'true' }}
        env:
          E2E_TEST_EMAIL: \${{ secrets.E2E_TEST_EMAIL }}
        run: npm test
      - uses: ${PINNED_UPLOAD_ARTIFACT}
        with:
          name: junit
          path: test-results/junit.xml
          retention-days: 7
          include-hidden-files: false
`
  );
  write(
    root,
    ".github/workflows/nightly.yml",
    `name: Nightly
on:
  schedule:
    - cron: "0 7 * * *"

permissions:
  contents: read

jobs:
  smoke:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Staging smoke
        env:
          STAGING_BASE_URL: \${{ secrets.STAGING_BASE_URL }}
        run: npm run smoke
`
  );
  writeRegistry(root, {
    "ci.yml": {
      gates: [
        {
          job: "e2e",
          requiredSecrets: ["E2E_TEST_EMAIL"],
          defaultBehavior: "skip",
          strictVariable: "REQUIRE_CI_E2E_AUTH",
        },
      ],
    },
    "nightly.yml": {
      kind: "standard",
      scheduledSecretUsage: [
        {
          job: "smoke",
          allowedEvents: ["schedule"],
          requiredSecrets: ["STAGING_BASE_URL"],
          reason: "Nightly staging smoke uses only the configured staging base URL.",
        },
      ],
    },
  });
}

test("Objective 42 workflow scanners accept gated PR secrets, explicit scheduled secrets, and safe artifacts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-ok-"));
  writeSecureFixture(root);

  const workflowReport = analyzeGithubWorkflowsSecurity(root);
  assert.equal(workflowReport.ok, true, JSON.stringify(workflowReport.issues, null, 2));

  const scheduledReport = analyzeGithubScheduledWorkflowsSecrets(root);
  assert.equal(scheduledReport.ok, true, JSON.stringify(scheduledReport.issues, null, 2));

  const artifactReport = analyzeCiArtifactSecretLeakage(root);
  assert.equal(artifactReport.ok, true, JSON.stringify(artifactReport.issues, null, 2));
});

test("analyzeGithubWorkflowsSecurity rejects pull-request secrets without a shared gate", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-pr-secret-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  unsafe:
    runs-on: ubuntu-latest
    steps:
      - name: Unsafe secret
        env:
          API_TOKEN: \${{ secrets.API_TOKEN }}
        run: npm test
`
  );

  const report = analyzeGithubWorkflowsSecurity(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "pull_request_secret_job_without_gate"));
  assert(report.issues.some((issue) => issue.issue === "pull_request_secret_step_without_gate"));
});

test("analyzeGithubWorkflowsSecurity rejects dangerous write permissions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-permissions-"));
  write(
    root,
    ".github/workflows/release.yml",
    `name: Release
on:
  workflow_dispatch:
permissions:
  contents: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - run: echo release
`
  );

  const report = analyzeGithubWorkflowsSecurity(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "dangerous_write_permission" && issue.permission === "contents"));
});

test("analyzeGithubWorkflowsSecurity rejects workflows without explicit top-level permissions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-missing-permissions-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  push:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`
  );

  const report = analyzeGithubWorkflowsSecurity(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_workflow_permissions"));
});

test("analyzeGithubWorkflowsSecurity rejects direct jobs without explicit timeout", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-missing-timeout-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  push:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`
  );

  const report = analyzeGithubWorkflowsSecurity(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_job_timeout_minutes" && issue.job === "test"));
});

test("analyzeGithubWorkflowsSecurity rejects dynamic or out-of-range job timeouts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-invalid-timeout-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  dynamic_timeout:
    runs-on: ubuntu-latest
    timeout-minutes: \${{ inputs.timeout_minutes }}
    steps:
      - run: npm test
  too_large:
    runs-on: ubuntu-latest
    timeout-minutes: 721
    steps:
      - run: npm test
`
  );

  const report = analyzeGithubWorkflowsSecurity(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "invalid_job_timeout_minutes" && issue.job === "dynamic_timeout"));
  assert(report.issues.some((issue) => issue.issue === "invalid_job_timeout_minutes" && issue.job === "too_large"));
});

test("analyzeGithubWorkflowsSecurity allows reusable workflow call jobs to inherit target workflow timeouts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-reusable-timeout-"));
  write(
    root,
    ".github/workflows/caller.yml",
    `name: Caller
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  reusable:
    uses: ./.github/workflows/reusable.yml
    with:
      tier: nightly
`
  );
  write(
    root,
    ".github/workflows/reusable.yml",
    `name: Reusable
on:
  workflow_call:
    inputs:
      tier:
        type: string
        required: true
permissions:
  contents: read
jobs:
  target:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - run: echo "$TIER"
        env:
          TIER: \${{ inputs.tier }}
`
  );

  const report = analyzeGithubWorkflowsSecurity(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
});

test("analyzeGithubWorkflowsSecurity rejects checkout without explicit credential persistence disablement", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-checkout-persist-default-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: ${PINNED_CHECKOUT}
      - run: npm test
`
  );

  const report = analyzeGithubWorkflowsSecurity(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "checkout_persist_credentials_not_disabled"));
});

test("analyzeGithubWorkflowsSecurity rejects checkout with credential persistence enabled", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-checkout-persist-true-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  push:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: ${PINNED_CHECKOUT}
        with:
          persist-credentials: true
      - run: npm test
`
  );

  const report = analyzeGithubWorkflowsSecurity(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "checkout_persist_credentials_not_disabled"));
});

test("analyzeGithubWorkflowsSecurity rejects single-line shell interpolation of pull request text", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-pr-title-shell-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Unsafe title interpolation
        run: echo "\${{ github.event.pull_request.title }}"
`
  );

  const report = analyzeGithubWorkflowsSecurity(root);
  assert.equal(report.ok, false);
  assert(
    report.issues.some(
      (issue) =>
        issue.issue === "untrusted_github_context_in_shell_run" &&
        issue.context === "github.event.pull_request.title"
    )
  );
});

test("analyzeGithubWorkflowsSecurity rejects multiline shell interpolation of pull request body", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-pr-body-shell-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Unsafe body interpolation
        run: |
          printf '%s\\n' "\${{ github.event.pull_request.body }}"
`
  );

  const report = analyzeGithubWorkflowsSecurity(root);
  assert.equal(report.ok, false);
  assert(
    report.issues.some(
      (issue) =>
        issue.issue === "untrusted_github_context_in_shell_run" &&
        issue.context === "github.event.pull_request.body"
    )
  );
});

test("analyzeGithubWorkflowsSecurity rejects untrusted GitHub context in shell step env", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-pr-env-shell-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Unsafe env interpolation
        env:
          PR_HEAD: \${{ github.head_ref }}
        run: ./scripts/check-pr.sh
`
  );

  const report = analyzeGithubWorkflowsSecurity(root);
  assert.equal(report.ok, false);
  assert(
    report.issues.some(
      (issue) =>
        issue.issue === "untrusted_github_context_in_shell_env" &&
        issue.env === "PR_HEAD" &&
        issue.context === "github.head_ref"
    )
  );
});

test("analyzeGithubWorkflowsSecurity rejects untrusted GitHub context in workflow env inherited by shell steps", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-workflow-env-shell-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  pull_request:
permissions:
  contents: read
env:
  PR_TITLE: \${{ github.event.pull_request.title }}
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Unsafe inherited env
        run: ./scripts/check-pr.sh
`
  );

  const report = analyzeGithubWorkflowsSecurity(root);
  assert.equal(report.ok, false);
  assert(
    report.issues.some(
      (issue) =>
        issue.issue === "untrusted_github_context_in_workflow_env" &&
        issue.env === "PR_TITLE" &&
        issue.context === "github.event.pull_request.title"
    )
  );
});

test("analyzeGithubWorkflowsSecurity rejects untrusted GitHub context in job env inherited by shell steps", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-job-env-shell-"));
  write(
    root,
    ".github/workflows/issue.yml",
    `name: Issue
on:
  issues:
permissions:
  contents: read
jobs:
  triage:
    runs-on: ubuntu-latest
    env:
      ISSUE_BODY: \${{ github.event.issue.body }}
    steps:
      - name: Unsafe inherited env
        run: ./scripts/triage.sh
`
  );

  const report = analyzeGithubWorkflowsSecurity(root);
  assert.equal(report.ok, false);
  assert(
    report.issues.some(
      (issue) =>
        issue.issue === "untrusted_github_context_in_job_env" &&
        issue.env === "ISSUE_BODY" &&
        issue.context === "github.event.issue.body"
    )
  );
});

test("analyzeGithubWorkflowsSecurity rejects issue comment interpolation in shell", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-comment-shell-"));
  write(
    root,
    ".github/workflows/comment.yml",
    `name: Comment
on:
  issue_comment:
permissions:
  contents: read
jobs:
  comment:
    runs-on: ubuntu-latest
    steps:
      - name: Unsafe comment interpolation
        run: printf '%s\\n' "\${{ github.event.comment.body }}"
`
  );

  const report = analyzeGithubWorkflowsSecurity(root);
  assert.equal(report.ok, false);
  assert(
    report.issues.some(
      (issue) =>
        issue.issue === "untrusted_github_context_in_shell_run" &&
        issue.context === "github.event.comment.body"
    )
  );
});

test("analyzeGithubWorkflowsSecurity rejects issue and review body interpolation in shell", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-issue-review-shell-"));
  write(
    root,
    ".github/workflows/issue.yml",
    `name: Issue
on:
  issues:
permissions:
  contents: read
jobs:
  issue:
    runs-on: ubuntu-latest
    steps:
      - name: Unsafe issue interpolation
        run: printf '%s\\n' "\${{ github.event.issue.title }}"
`
  );
  write(
    root,
    ".github/workflows/review.yml",
    `name: Review
on:
  pull_request_review:
permissions:
  contents: read
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - name: Unsafe review interpolation
        run: printf '%s\\n' "\${{ github.event.review.body }}"
`
  );

  const report = analyzeGithubWorkflowsSecurity(root);
  assert.equal(report.ok, false);
  assert(
    report.issues.some(
      (issue) =>
        issue.issue === "untrusted_github_context_in_shell_run" &&
        issue.context === "github.event.issue.title"
    )
  );
  assert(
    report.issues.some(
      (issue) =>
        issue.issue === "untrusted_github_context_in_shell_run" &&
        issue.context === "github.event.review.body"
    )
  );
});

test("analyzeCiArtifactSecretLeakage rejects secret-bearing artifact paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-artifact-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: ${PINNED_UPLOAD_ARTIFACT}
        with:
          name: env-file
          path: .env.local
          retention-days: 7
          include-hidden-files: false
`
  );

  const report = analyzeCiArtifactSecretLeakage(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "env_file_artifact_path"));
});

test("analyzeCiArtifactSecretLeakage rejects upload artifacts without explicit retention", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-artifact-retention-missing-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: ${PINNED_UPLOAD_ARTIFACT}
        with:
          name: junit
          path: test-results/junit.xml
          include-hidden-files: false
`
  );

  const report = analyzeCiArtifactSecretLeakage(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_artifact_retention_days"));
});

test("analyzeCiArtifactSecretLeakage rejects dynamic or overlong artifact retention", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-artifact-retention-invalid-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: ${PINNED_UPLOAD_ARTIFACT}
        with:
          name: dynamic
          path: test-results/dynamic.xml
          retention-days: \${{ inputs.retention_days }}
          include-hidden-files: false
      - uses: ${PINNED_UPLOAD_ARTIFACT}
        with:
          name: overlong
          path: test-results/overlong.xml
          retention-days: 30
          include-hidden-files: false
`
  );

  const report = analyzeCiArtifactSecretLeakage(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.filter((issue) => issue.issue === "invalid_artifact_retention_days").length, 2);
});

test("analyzeCiArtifactSecretLeakage rejects upload artifacts without explicit hidden-file exclusion", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-artifact-hidden-missing-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: ${PINNED_UPLOAD_ARTIFACT}
        with:
          name: junit
          path: test-results/junit.xml
          retention-days: 7
`
  );

  const report = analyzeCiArtifactSecretLeakage(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_artifact_hidden_file_exclusion"));
});

test("analyzeCiArtifactSecretLeakage rejects enabled or dynamic hidden-file artifact uploads", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-artifact-hidden-invalid-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: ${PINNED_UPLOAD_ARTIFACT}
        with:
          name: enabled
          path: test-results/enabled.xml
          retention-days: 7
          include-hidden-files: true
      - uses: ${PINNED_UPLOAD_ARTIFACT}
        with:
          name: dynamic
          path: test-results/dynamic.xml
          retention-days: 7
          include-hidden-files: \${{ inputs.include_hidden_files }}
`
  );

  const report = analyzeCiArtifactSecretLeakage(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.filter((issue) => issue.issue === "artifact_hidden_files_not_disabled").length, 2);
});

test("analyzeCiArtifactSecretLeakage accepts scoped artifact downloads", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-artifact-download-ok-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  merge:
    runs-on: ubuntu-latest
    steps:
      - uses: ${PINNED_DOWNLOAD_ARTIFACT}
        with:
          path: all-blobs
          pattern: playwright-blob-*
          merge-multiple: true
`
  );

  const report = analyzeCiArtifactSecretLeakage(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.downloadStepCount, 1);
});

test("analyzeCiArtifactSecretLeakage rejects broad or unscoped artifact downloads", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-artifact-download-unsafe-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  merge:
    runs-on: ubuntu-latest
    steps:
      - uses: ${PINNED_DOWNLOAD_ARTIFACT}
        with:
          path: all-artifacts
      - uses: ${PINNED_DOWNLOAD_ARTIFACT}
        with:
          path: .
          pattern: "*"
          merge-multiple: true
      - uses: ${PINNED_DOWNLOAD_ARTIFACT}
        with:
          path: downloads
          name: \${{ inputs.artifact_name }}
      - uses: ${PINNED_DOWNLOAD_ARTIFACT}
        with:
          path: downloads
          pattern: playwright-blob-*
`
  );

  const report = analyzeCiArtifactSecretLeakage(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_artifact_download_selector"));
  assert(report.issues.some((issue) => issue.issue === "broad_artifact_download_pattern"));
  assert(report.issues.some((issue) => issue.issue === "unsafe_artifact_download_path"));
  assert(report.issues.some((issue) => issue.issue === "dynamic_artifact_download_selector"));
  assert(report.issues.some((issue) => issue.issue === "artifact_download_pattern_without_merge_multiple"));
});

test("analyzeGithubScheduledWorkflowsSecrets rejects unregistered scheduled secret usage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-scheduled-"));
  write(
    root,
    ".github/workflows/nightly.yml",
    `name: Nightly
on:
  schedule:
    - cron: "0 7 * * *"
permissions:
  contents: read
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - env:
          STAGING_BASE_URL: \${{ secrets.STAGING_BASE_URL }}
        run: npm run smoke
`
  );
  writeRegistry(root, {
    "nightly.yml": { kind: "standard" },
  });

  const report = analyzeGithubScheduledWorkflowsSecrets(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "scheduled_secret_usage_not_registered"));
});

test("analyzeGithubScheduledWorkflowsSecrets rejects unregistered secret-gate invocations", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-gate-unregistered-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - id: gate_e2e
        env:
          REQUIRE_CI_E2E_AUTH: \${{ vars.REQUIRE_CI_E2E_AUTH }}
          E2E_TEST_EMAIL: \${{ secrets.E2E_TEST_EMAIL }}
        run: bash scripts/github-actions/secret-gate.sh "e2e" "REQUIRE_CI_E2E_AUTH" "E2E_TEST_EMAIL"
`
  );
  writeRegistry(root, {
    "ci.yml": { kind: "standard" },
  });

  const report = analyzeGithubScheduledWorkflowsSecrets(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "secret_gate_invocation_not_registered"));
});

test("analyzeGithubScheduledWorkflowsSecrets rejects stale secret-gate registry entries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-gate-stale-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`
  );
  writeRegistry(root, {
    "ci.yml": {
      gates: [
        {
          job: "e2e",
          requiredSecrets: ["E2E_TEST_EMAIL"],
          defaultBehavior: "skip",
          strictVariable: "REQUIRE_CI_E2E_AUTH",
        },
      ],
    },
  });

  const report = analyzeGithubScheduledWorkflowsSecrets(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "secret_gate_registry_missing_invocation"));
});

test("analyzeGithubScheduledWorkflowsSecrets rejects secret-gate secret drift and missing step env", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-workflows-gate-drift-"));
  write(
    root,
    ".github/workflows/ci.yml",
    `name: CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - id: gate_e2e
        env:
          REQUIRE_CI_E2E_AUTH: \${{ vars.REQUIRE_CI_E2E_AUTH }}
          E2E_TEST_EMAIL: \${{ secrets.E2E_TEST_EMAIL }}
        run: bash scripts/github-actions/secret-gate.sh "e2e" "REQUIRE_CI_E2E_AUTH" "E2E_TEST_EMAIL,E2E_TEST_PASSWORD"
`
  );
  writeRegistry(root, {
    "ci.yml": {
      gates: [
        {
          job: "e2e",
          requiredSecrets: ["E2E_TEST_EMAIL"],
          defaultBehavior: "skip",
          strictVariable: "REQUIRE_CI_E2E_AUTH",
        },
      ],
    },
  });

  const report = analyzeGithubScheduledWorkflowsSecrets(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "secret_gate_invocation_secret_mismatch"));
  assert(report.issues.some((issue) => issue.issue === "secret_gate_step_missing_required_secret_env" && issue.secret === "E2E_TEST_PASSWORD"));
});
