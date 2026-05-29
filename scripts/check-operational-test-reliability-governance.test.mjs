import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildPlaywrightFlakeClassificationReport, classifyFailureText } from "./classify-playwright-flakes.mjs";
import { analyzeE2eQuarantine } from "./check-e2e-quarantine.mjs";
import { analyzeVisualBaselineGovernance } from "./check-operational-test-reliability-governance.mjs";
import { buildTestSkipGovernanceReport } from "./report-test-skip-governance.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-test-reliability-"));
}

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

test("flake classifier maps required failure classes", () => {
  assert.deepEqual(classifyFailureText("Timeout 30000ms exceeded while waiting for locator getByRole"), [
    "timeout",
    "locator_failure",
  ]);
  assert.deepEqual(classifyFailureText("expect(page).toHaveScreenshot('home.png') exceeded max diff"), [
    "assertion_drift",
    "visual_drift",
  ]);
});

test("flake report parser emits owner and next validation command metadata", () => {
  const root = makeRoot();
  write(
    root,
    "test-results/junit.xml",
    '<testsuite><testcase classname="e2e/auth.spec.ts" name="login"><failure message="Target closed because browser crashed" /></testcase></testsuite>'
  );
  const report = buildPlaywrightFlakeClassificationReport({
    root,
    reportPaths: ["test-results/junit.xml"],
    owner: "@test-platform",
    nextValidationCommand: "check:operational-test-reliability-governance",
  });

  assert.equal(report.classifiedFailureCount, 1);
  assert.equal(report.rows[0].primaryClass, "browser_crash");
  assert.equal(report.rows[0].owner, "@test-platform");
  assert.equal(report.rows[0].nextValidationCommand, "check:operational-test-reliability-governance");
});

test("quarantine strict mode requires complete row metadata", () => {
  const root = makeRoot();
  writeJson(root, "package.json", { scripts: { "test:e2e": "playwright test" } });
  write(root, "e2e/flaky.spec.ts", "import { test } from '@playwright/test';\ntest('ok', () => {});\n");
  writeJson(root, "e2e-quarantine.json", {
    files: [
      {
        id: "qnt-flaky-login",
        path: "e2e/flaky.spec.ts",
        reason: "auth provider timeout is under investigation",
        owner: "@test-platform",
        expiry: "2099-01-01",
        issue: "GH-1234",
        replacementCoverage: "src/lib/auth.test.ts",
        reenableCommand: "npm run test:e2e -- e2e/flaky.spec.ts",
      },
    ],
  });

  const ok = analyzeE2eQuarantine(root, { strict: true });
  assert.equal(ok.ok, true);

  writeJson(root, "e2e-quarantine.json", { files: [{ id: "bad", path: "e2e/flaky.spec.ts" }] });
  const bad = analyzeE2eQuarantine(root, { strict: true });
  assert.equal(bad.ok, false);
  assert.ok(bad.issues.some((entry) => entry.issue === "e2e_quarantine_missing_required_field"));
});

test("skip governance detects skip files and describe skip references while ignoring string literals", () => {
  const root = makeRoot();
  write(
    root,
    "e2e/visual.skip.spec.ts",
    [
      "// skip-meta-default: owner=@test-governance expiry=2099-01-01 reason=optional_visual_matrix",
      "import { test } from '@playwright/test';",
      "const gated = process.env.PLAYWRIGHT_VISUAL ? test.describe : test.describe.skip;",
      "test.skip(!process.env.PLAYWRIGHT_VISUAL, 'Set PLAYWRIGHT_VISUAL=1');",
      "test('string literal is ignored', () => { const text = \"it.skip('not real', () => {})\"; });",
    ].join("\n")
  );
  const report = buildTestSkipGovernanceReport(root, { targets: ["e2e"], strict: true });

  assert.equal(report.problemCount, 0);
  assert.equal(report.byKind["file-name.skip"], 1);
  assert.equal(report.byKind["test.describe.skip"], 1);
  assert.equal(report.byKind["test.skip"], 1);
  assert.equal(report.byKind["it.skip"], undefined);
});

test("visual baseline governance requires route matrices, update commands, and snapshot metadata", () => {
  const root = makeRoot();
  writeJson(root, "package.json", {
    scripts: {
      "test:e2e:visual": "PLAYWRIGHT_VISUAL=1 playwright test e2e/visual.public.spec.ts",
      "test:e2e:visual:update": "PLAYWRIGHT_VISUAL=1 playwright test e2e/visual.public.spec.ts --update-snapshots",
      "check:operational-test-reliability-governance": "node scripts/check-operational-test-reliability-governance.mjs",
    },
  });
  write(root, "e2e/generated/visual-routes.ts", "export const GENERATED_VISUAL_ROUTES = [];\n");
  write(root, "e2e/visual-helpers.ts", "export function snapshotName() { return 'x.png'; }\n");
  write(root, "e2e/visual.public.spec.ts", "import './visual-helpers';\nexpect(page).toHaveScreenshot('home.png');\n");
  write(root, "e2e/visual.public.spec.ts-snapshots/home-chromium-darwin.png", "png");

  const issues = [];
  const report = analyzeVisualBaselineGovernance(
    root,
    {
      visualBaselineGovernance: {
        routeMatrices: ["e2e/generated/visual-routes.ts"],
        helper: "e2e/visual-helpers.ts",
        suites: [
          {
            spec: "e2e/visual.public.spec.ts",
            snapshotRoot: "e2e/visual.public.spec.ts-snapshots",
            owner: "@test-platform",
            runCommand: "test:e2e:visual",
            updateCommand: "test:e2e:visual:update",
            browser: "chromium",
            device: "Desktop Chrome",
            osAssumption: "darwin",
            diffThreshold: "playwright-default",
            reviewEvidenceCommand: "check:operational-test-reliability-governance",
          },
        ],
      },
    },
    issues
  );

  assert.equal(report.snapshotCount, 1);
  assert.equal(issues.length, 0);
});
