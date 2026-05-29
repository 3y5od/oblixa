import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeChangeImpact,
  classifyChangedEntries,
  classifyPath,
  parseGitNameStatus,
} from "./check-ci-change-impact.mjs";

test("parseGitNameStatus includes deleted and renamed files", () => {
  assert.deepEqual(
    parseGitNameStatus("D\tsupabase/migrations/001_old.sql\nR100\tsrc/app/api/old/route.ts\tsrc/app/api/new/route.ts\n"),
    [
      { status: "D", path: "supabase/migrations/001_old.sql", oldPath: null },
      { status: "R", path: "src/app/api/new/route.ts", oldPath: "src/app/api/old/route.ts" },
    ],
  );
});

test("classifyPath maps Supabase migrations to migration and SQL risk", () => {
  assert.deepEqual(classifyPath("supabase/migrations/085_contract_fields_compatibility_view.sql"), [
    "migrations",
    "rls_sql_functions",
  ]);
});

test("classifyChangedEntries treats docs-only changes as non-production", () => {
  const report = classifyChangedEntries([
    { status: "M", path: "docs/autonomous-code-only-hardening-checklist.md" },
    { status: "M", path: "README.md" },
  ]);

  assert.equal(report.documentationOnly, true);
  assert.equal(report.productionRelevant, false);
  assert.ok(report.requiredChecks.includes("check:documentation-runtime-dependencies"));
  assert.ok(report.requiredChecks.includes("check:operational-hardening-objectives"));
});

test("classifyChangedEntries maps route-only changes to route checks", () => {
  const report = classifyChangedEntries([{ status: "M", path: "src/app/api/cron/reconcile/route.ts" }]);

  assert.equal(report.documentationOnly, false);
  assert.ok(report.riskAreas.some((row) => row.area === "api_routes"));
  assert.ok(report.riskAreas.some((row) => row.area === "cron_routes"));
  assert.ok(report.requiredChecks.includes("check:api-route-auth-route-index"));
  assert.ok(report.requiredChecks.includes("check:versioned-content-surface-coverage"));
  assert.ok(report.requiredChecks.includes("check:versioned-remaining-surface-coverage"));
  assert.ok(report.requiredChecks.includes("check:versioned-detailed-objective-coverage"));
  assert.ok(report.requiredChecks.includes("check:versioned-public-contract-preservation"));
  assert.ok(report.requiredChecks.includes("check:versioned-public-runtime-dual-read"));
  assert.ok(report.requiredChecks.includes("check:versioned-forward-migration-readiness"));
  assert.ok(report.requiredChecks.includes("check:versioned-manual-surface-closure"));
  assert.ok(report.requiredChecks.includes("check:versioned-open-objective-closure"));
  assert.ok(report.requiredChecks.includes("check:versioned-compatibility-equivalence"));
  assert.ok(report.requiredChecks.includes("check:versioned-local-surface-regression"));
  assert.ok(report.requiredChecks.includes("check:versioned-alias-usage-neutrality"));
  assert.ok(report.requiredChecks.includes("check:versioned-env-flag-aliases"));
  assert.ok(report.requiredChecks.includes("check:versioned-code-only-closure"));
  assert.ok(report.requiredChecks.includes("check:versioned-additive-alias-preservation"));
  assert.ok(report.requiredChecks.includes("check:versioned-remaining-local-contract-closure"));
  assert.ok(report.requiredChecks.includes("check:versioned-unchecked-objective-readiness"));
  assert.ok(report.requiredChecks.includes("check:versioned-final-checklist-reconciliation"));
  assert.ok(report.requiredChecks.includes("check:cron-route-auth"));
});

test("classifyChangedEntries flags Supabase-affecting changes in mixed changes", () => {
  const report = classifyChangedEntries([
    { status: "M", path: "supabase/migrations/085_contract_fields_compatibility_view.sql" },
    { status: "M", path: "src/app/api/stripe/webhook/route.ts" },
    { status: "M", path: "docs/runbook.md" },
  ]);

  assert.equal(report.documentationOnly, false);
  assert.equal(report.supabaseAffecting, true);
  assert.ok(report.requiredChecks.includes("check:migrations:strict"));
  assert.ok(report.requiredChecks.includes("check:supabase:local-reset-harness"));
  assert.ok(report.requiredChecks.includes("check:supabase:seed-safety"));
  assert.ok(report.requiredChecks.includes("check:supabase:retention-inventory"));
  assert.ok(report.requiredChecks.includes("check:sql-neutral-table-view-aliases"));
  assert.ok(report.requiredChecks.includes("check:sql-policy-alias-readiness"));
  assert.ok(report.requiredChecks.includes("check:sql-policy-predicate-equivalence"));
  assert.ok(report.requiredChecks.includes("check:sql-policy-forward-migration-blueprint"));
  assert.ok(report.requiredChecks.includes("check:versioned-forward-migration-readiness"));
  assert.ok(report.requiredChecks.includes("check:webhook-inbound-policy"));
  assert.ok(report.requiredChecks.includes("check:static-secret-safety"));
  assert.ok(report.requiredChecks.includes("check:operational-provider-integrations"));
});

test("classifyChangedEntries maps env changes to env contract hygiene", () => {
  const report = classifyChangedEntries([{ status: "M", path: ".env.example" }]);

  assert.equal(report.documentationOnly, false);
  assert.ok(report.riskAreas.some((row) => row.area === "environment_contracts"));
  assert.ok(report.requiredChecks.includes("check:env-contract-hygiene"));
  assert.ok(report.requiredChecks.includes("check:versioned-content-surface-coverage"));
  assert.ok(report.requiredChecks.includes("check:versioned-remaining-surface-coverage"));
  assert.ok(report.requiredChecks.includes("check:versioned-detailed-objective-coverage"));
  assert.ok(report.requiredChecks.includes("check:versioned-source-config-preservation"));
  assert.ok(report.requiredChecks.includes("check:versioned-forward-migration-readiness"));
  assert.ok(report.requiredChecks.includes("check:versioned-package-script-readiness"));
  assert.ok(report.requiredChecks.includes("check:neutral-naming-rules"));
  assert.ok(report.requiredChecks.includes("check:versioned-manual-surface-closure"));
  assert.ok(report.requiredChecks.includes("check:versioned-open-objective-closure"));
  assert.ok(report.requiredChecks.includes("check:versioned-compatibility-equivalence"));
  assert.ok(report.requiredChecks.includes("check:versioned-local-surface-regression"));
  assert.ok(report.requiredChecks.includes("check:versioned-alias-usage-neutrality"));
  assert.ok(report.requiredChecks.includes("check:versioned-env-flag-aliases"));
  assert.ok(report.requiredChecks.includes("check:versioned-code-only-closure"));
  assert.ok(report.requiredChecks.includes("check:versioned-additive-alias-preservation"));
  assert.ok(report.requiredChecks.includes("check:versioned-remaining-local-contract-closure"));
  assert.ok(report.requiredChecks.includes("check:versioned-unchecked-objective-readiness"));
  assert.ok(report.requiredChecks.includes("check:versioned-final-checklist-reconciliation"));
});

test("analyzeChangeImpact fails strict mode on empty changes", () => {
  const report = analyzeChangeImpact({ entries: [], strict: true, baseRef: "main" });

  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "no_changed_files_detected");
});

test("analyzeChangeImpact bounds detailed output while preserving counts", () => {
  const report = analyzeChangeImpact({
    entries: [
      { status: "M", path: "src/app/api/one/route.ts" },
      { status: "M", path: "src/app/api/two/route.ts" },
      { status: "M", path: "src/app/api/three/route.ts" },
    ],
    maxChangedEntries: 2,
    maxPathsPerArea: 1,
  });

  assert.equal(report.changedCount, 3);
  assert.equal(report.changed.length, 2);
  assert.equal(report.omittedChangedCount, 1);
  assert.equal(report.riskAreas.find((row) => row.area === "api_routes").omittedPathCount, 2);
  assert.match(report.prSummary.markdown, /Recommended validation:/u);
});

test("classifyChangedEntries maps UI public copy and provider changes to targeted recommendations", () => {
  const report = analyzeChangeImpact({
    entries: [
      { status: "M", path: "src/components/settings/billing-actions.tsx" },
      { status: "M", path: "src/app/(marketing)/privacy/page.tsx" },
      { status: "M", path: "src/lib/extraction/openai-pdf-text.ts" },
      { status: "M", path: "misc/unknown.asset" },
    ],
  });

  assert.ok(report.riskAreas.some((row) => row.area === "ui_surface"));
  assert.ok(report.riskAreas.some((row) => row.area === "public_copy"));
  assert.ok(report.riskAreas.some((row) => row.area === "provider_integrations"));
  assert.ok(report.riskAreas.some((row) => row.area === "unclassified"));
  assert.ok(report.requiredChecks.includes("check:operational-frontend-resilience"));
  assert.ok(report.requiredChecks.includes("check:operational-public-launch-positioning"));
  assert.ok(report.requiredChecks.includes("check:operational-provider-integrations"));
  assert.match(report.prSummary.markdown, /Missing evidence warnings:/u, "PR summary should surface evidence gaps for targeted review when needed");
});
