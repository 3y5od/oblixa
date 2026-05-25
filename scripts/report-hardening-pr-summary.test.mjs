import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildHardeningPrSummary,
  renderHardeningPrSummaryMarkdown,
} from "./report-hardening-pr-summary.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hardening-pr-summary-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("buildHardeningPrSummary summarizes Supabase, compatibility, naming, and evidence separately", () => {
  const root = makeRoot();
  write(root, "supabase/migrations/001_initial.sql", "-- initial\n");
  write(root, "supabase/migrations/002_policy.sql", "-- policy\n");

  const report = buildHardeningPrSummary({
    root,
    changeImpact: {
      changed: [
        { status: "A", path: "supabase/migrations/002_policy.sql", oldPath: null },
        { status: "M", path: "src/app/api/webhooks/dispatch/route.ts", oldPath: null },
        {
          status: "R",
          path: "src/app/api/webhooks/new/route.ts",
          oldPath: "src/app/api/webhooks/old/route.ts",
          riskAreas: ["api_routes", "billing_webhooks", "telemetry_events"],
        },
      ],
      riskAreas: [
        { area: "migrations", changedCount: 1, paths: ["supabase/migrations/002_policy.sql"], requiredChecks: [] },
        { area: "telemetry_events", changedCount: 1, paths: ["src/app/api/webhooks/dispatch/route.ts"], requiredChecks: [] },
      ],
      requiredChecks: [
        "check:migrations:strict",
        "check:telemetry-event-inventory",
        "check:compatibility-route-inventory",
        "check:versioned-content-surface-coverage",
        "check:versioned-remaining-surface-coverage",
        "check:versioned-detailed-objective-coverage",
        "check:versioned-public-contract-preservation",
        "check:versioned-public-runtime-dual-read",
        "check:versioned-forward-migration-readiness",
        "check:versioned-manual-surface-closure",
        "check:versioned-open-objective-closure",
        "check:versioned-compatibility-equivalence",
        "check:versioned-local-surface-regression",
        "check:versioned-alias-usage-neutrality",
        "check:versioned-env-flag-aliases",
        "check:versioned-code-only-closure",
        "check:versioned-additive-alias-preservation",
        "check:versioned-remaining-local-contract-closure",
        "check:versioned-unchecked-objective-readiness",
        "check:versioned-final-checklist-reconciliation",
        "check:sql-neutral-table-view-aliases",
        "check:sql-policy-alias-readiness",
        "check:sql-policy-predicate-equivalence",
        "check:sql-policy-forward-migration-blueprint",
      ],
      supabaseAffecting: true,
    },
    versionedNaming: {
      ok: true,
      delta: -2,
      currentTotal: 8,
      baselineTotal: 10,
      violationCount: 0,
      reductionCount: 1,
      violations: [],
      reductions: [{ path: "src/lib/example.test.ts", current: 0, baseline: 2 }],
    },
    localCommandsRun: ["npm run check:telemetry-event-inventory"],
  });

  assert.equal(report.ok, true);
  assert.equal(report.supabase.affectsSupabase, true);
  assert.equal(report.supabase.latestLocalMigration, "supabase/migrations/002_policy.sql");
  assert.equal(report.supabase.migrationChangeCount, 1);
  assert.equal(report.supabase.strictCheckStatus, "not_reported");
  assert.deepEqual(report.supabase.addedMigrations, ["supabase/migrations/002_policy.sql"]);
  assert.ok(report.compatibility.sensitiveAreas.includes("telemetry_events"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-content-surface-coverage"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-remaining-surface-coverage"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-detailed-objective-coverage"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-public-contract-preservation"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-public-runtime-dual-read"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-forward-migration-readiness"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-manual-surface-closure"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-open-objective-closure"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-compatibility-equivalence"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-local-surface-regression"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-alias-usage-neutrality"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-env-flag-aliases"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-code-only-closure"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-additive-alias-preservation"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-remaining-local-contract-closure"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-unchecked-objective-readiness"));
  assert.ok(report.compatibility.requiredChecks.includes("check:versioned-final-checklist-reconciliation"));
  assert.ok(report.compatibility.requiredChecks.includes("check:sql-neutral-table-view-aliases"));
  assert.ok(report.compatibility.requiredChecks.includes("check:sql-policy-alias-readiness"));
  assert.ok(report.compatibility.requiredChecks.includes("check:sql-policy-predicate-equivalence"));
  assert.ok(report.compatibility.requiredChecks.includes("check:sql-policy-forward-migration-blueprint"));
  assert.deepEqual(report.compatibility.renameFindings, [
    {
      from: "src/app/api/webhooks/old/route.ts",
      to: "src/app/api/webhooks/new/route.ts",
      riskAreas: ["api_routes", "billing_webhooks", "telemetry_events"],
    },
  ]);
  assert.equal(report.versionedNaming.delta, -2);
  assert.equal(report.evidence.codeVerified, true);
  assert.equal(report.evidence.linkedVerified, false);
  assert.equal(report.evidence.productionMutationPerformed, false);
  assert.ok(report.evidence.recommendedLocalCommands.includes("npm run check:supabase:seed-safety"));
  assert.ok(report.evidence.recommendedLocalCommands.includes("npm run check:static-secret-safety"));
  assert.match(report.markdown, /Production mutation performed: No/u);
  assert.match(report.markdown, /Linked production verification: Not run/u);
});

test("buildHardeningPrSummary carries versioned naming failures without claiming production changes", () => {
  const root = makeRoot();
  const report = buildHardeningPrSummary({
    root,
    changeImpact: {
      changed: [{ status: "M", path: "src/lib/product-telemetry.ts", oldPath: null }],
      riskAreas: [{ area: "telemetry_events", changedCount: 1, paths: ["src/lib/product-telemetry.ts"], requiredChecks: [] }],
      requiredChecks: ["check:telemetry-event-inventory"],
      supabaseAffecting: false,
    },
    versionedNaming: {
      ok: false,
      delta: 1,
      currentTotal: 11,
      baselineTotal: 10,
      violationCount: 1,
      reductionCount: 0,
      violations: [{ issue: "new_file_with_versioned_naming", path: "src/lib/product-telemetry.ts" }],
      reductions: [],
    },
    productionMutationPerformed: false,
  });

  assert.equal(report.ok, false);
  assert.equal(report.versionedNaming.violationCount, 1);
  assert.equal(report.evidence.productionMutationPerformed, false);
  assert.ok(report.evidence.manualActions.length > 0);
});

test("renderHardeningPrSummaryMarkdown renders empty sections deterministically", () => {
  const markdown = renderHardeningPrSummaryMarkdown({
    supabase: {
      affectsSupabase: false,
      latestLocalMigration: null,
      localMigrationCount: 0,
      migrationChangeCount: 0,
      deletedMigrations: [],
      requiredChecks: [],
    },
    compatibility: { sensitiveAreas: [], requiredChecks: [] },
    versionedNaming: { ok: true, delta: 0, violationCount: 0, reductionCount: 0 },
    evidence: {
      productionMutationPerformed: false,
      linkedVerified: false,
      localCommandsRun: [],
      recommendedLocalCommands: [],
      optionalLinkedReadOnlyCommands: [],
      manualActions: [],
    },
  });

  assert.match(markdown, /Required Supabase checks:\n- None/u);
  assert.match(markdown, /Local commands run:\n- None/u);
});
