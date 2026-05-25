import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedAdditiveAliasPreservation,
  buildVersionedAdditiveAliasPreservation,
} from "./check-versioned-additive-alias-preservation.mjs";
import { analyzeSemgrepRulepackIntegrity } from "./check-semgrep-rulepack-integrity.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versioned-additive-alias-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

function writeDomAliasSources(root, options = {}) {
  write(
    root,
    "src/components/ui/recoverable-state.tsx",
    options.omitRecoverableNeutral
      ? "data-v10-state data-v10-contract-ok data-v10-contract-failures"
      : "data-v10-state data-state data-v10-surface data-surface data-v10-section data-section data-v10-action data-action data-v10-source-object data-source-object data-v10-diagnostic-id data-diagnostic-id data-v10-contract-ok data-contract-ok data-v10-focus-target data-focus-target data-v10-next-action-label data-next-action-label data-v10-contract-failures data-contract-failures",
  );
  write(
    root,
    "src/components/contracts/contract-evidence-requirements-panel.tsx",
    "data-v9-evidence-req-status data-evidence-req-status",
  );
}

function writeSqlAliasSources(root, options = {}) {
  write(
    root,
    "supabase/migrations/087_organization_settings_compatibility_view.sql",
    options.omitSecurityInvoker
      ? `create or replace view public.organization_settings as
select v6_org_settings_json as org_settings_json
from public.organizations;
`
      : `create or replace view public.organization_settings
with (security_invoker = true)
as
select
  v6_org_settings_json as org_settings_json
from public.organizations;
`,
  );
  write(
    root,
    "supabase/seed.sql",
    "insert into public.organizations (id, name, v6_org_settings_json) values ('00000000-0000-4000-8000-000000000001', 'Local', '{}'::jsonb);\n",
  );
}

function sourceReports(overrides = {}) {
  return {
    semgrepRulepackIntegrity: {
      ok: true,
      issueCount: 0,
      issues: [],
      activeRulepacks: ["semgrep/oblixa-security.yml", "semgrep/oblixa-performance.yml", "semgrep/oblixa-surface.yml"],
      legacyRulepacks: ["semgrep/oblixa-v7-surface.yml", "semgrep/oblixa-v8-surface.yml", "semgrep/oblixa-v10-surface.yml"],
      missingLegacyRulepacks: [],
      legacyStillActive: [],
      versionedActiveRuleIds: [],
    },
    publicContractPreservation: { ok: true, issueCount: 0, issues: [] },
    sourceConfigPreservation: { ok: true, issueCount: 0, issues: [] },
    localSurfaceRegression: { ok: true, issueCount: 0, issues: [] },
    seedQueueCoverage: { ok: true, issueCount: 0, issues: [] },
    ...overrides,
  };
}

test("additive alias preservation accepts neutral Semgrep pack and DOM selector aliases", () => {
  const root = makeRoot();
  writeDomAliasSources(root);
  writeSqlAliasSources(root);

  const artifact = buildVersionedAdditiveAliasPreservation(root, { sources: sourceReports() });

  assert.equal(artifact.issueCount, 0);
  assert.equal(artifact.semgrep.neutralRulepackActive, true);
  assert.equal(artifact.semgrep.legacyRulepacksRetained, true);
  assert.equal(artifact.semgrep.legacyRulepacksInactiveInCi, true);
  assert.equal(artifact.totals.domAliasPairCount, artifact.totals.coveredDomAliasPairCount);
  assert.equal(artifact.totals.coveredSqlAliasTargetCount, 1);
});

test("additive alias preservation fails when a neutral DOM alias is missing", () => {
  const root = makeRoot();
  writeDomAliasSources(root, { omitRecoverableNeutral: true });
  writeSqlAliasSources(root);

  const artifact = buildVersionedAdditiveAliasPreservation(root, { sources: sourceReports() });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((issue) => issue.issue === "versioned_additive_alias_missing_neutral_selector"));
});

test("additive alias preservation surfaces dependent source issues", () => {
  const root = makeRoot();
  writeDomAliasSources(root);
  writeSqlAliasSources(root);

  const artifact = buildVersionedAdditiveAliasPreservation(root, {
    sources: sourceReports({
      seedQueueCoverage: { ok: false, issueCount: 1, issues: [{ issue: "seed_versioned_queue_manual_row_unqueued" }] },
    }),
  });

  assert.equal(artifact.issueCount, 1);
  assert.equal(artifact.issues[0].issue, "versioned_additive_alias_preservation_source_issues");
  assert.equal(artifact.issues[0].source, "seed_versioned_name_queue_coverage");
});

test("additive alias preservation fails when the SQL alias view is not security invoker", () => {
  const root = makeRoot();
  writeDomAliasSources(root);
  writeSqlAliasSources(root, { omitSecurityInvoker: true });

  const artifact = buildVersionedAdditiveAliasPreservation(root, { sources: sourceReports() });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((issue) => issue.issue === "versioned_additive_alias_missing_sql_security_invoker"));
});

test("additive alias preservation detects deterministic artifact drift", () => {
  const root = makeRoot();
  writeDomAliasSources(root);
  writeSqlAliasSources(root);
  writeJson(root, "artifacts/compatibility/versioned-additive-alias-preservation.json", { stale: true });

  const report = analyzeVersionedAdditiveAliasPreservation({ root, sources: sourceReports() });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_additive_alias_preservation_drift"));
});

test("additive alias preservation passes when artifact matches current evidence", () => {
  const root = makeRoot();
  writeDomAliasSources(root);
  writeSqlAliasSources(root);
  const sources = sourceReports();
  const artifact = buildVersionedAdditiveAliasPreservation(root, { sources });
  writeJson(root, "artifacts/compatibility/versioned-additive-alias-preservation.json", artifact);

  const report = analyzeVersionedAdditiveAliasPreservation({ root, sources });

  assert.equal(report.ok, true);
});

test("semgrep rulepack integrity requires neutral active pack and keeps legacy packs inactive", () => {
  const root = makeRoot();
  write(root, ".github/workflows/ci.yml", "semgrep/oblixa-security.yml semgrep/oblixa-performance.yml semgrep/oblixa-surface.yml");
  write(root, ".github/workflows/semgrep-sarif.yml", "semgrep/oblixa-security.yml semgrep/oblixa-performance.yml semgrep/oblixa-surface.yml");
  write(root, "semgrep/oblixa-security.yml", "rules: []\n");
  write(root, "semgrep/oblixa-performance.yml", "rules: []\n");
  write(root, "semgrep/oblixa-surface.yml", "rules:\n  - id: oblixa-surface\n    languages: [typescript]\n    message: ok\n    severity: ERROR\n    pattern: foo()\n");
  write(root, "semgrep/oblixa-v7-surface.yml", "rules: []\n");
  write(root, "semgrep/oblixa-v8-surface.yml", "rules: []\n");
  write(root, "semgrep/oblixa-v10-surface.yml", "rules: []\n");

  const report = analyzeSemgrepRulepackIntegrity({ root, strict: true });

  assert.equal(report.ok, true);
  assert.deepEqual(report.legacyStillActive, []);
  assert.deepEqual(report.versionedActiveRuleIds, []);
});

test("semgrep rulepack integrity rejects versioned active rule IDs", () => {
  const root = makeRoot();
  write(root, ".github/workflows/ci.yml", "semgrep/oblixa-security.yml semgrep/oblixa-performance.yml semgrep/oblixa-surface.yml");
  write(root, ".github/workflows/semgrep-sarif.yml", "semgrep/oblixa-security.yml semgrep/oblixa-performance.yml semgrep/oblixa-surface.yml");
  write(root, "semgrep/oblixa-security.yml", "rules: []\n");
  write(root, "semgrep/oblixa-performance.yml", "rules: []\n");
  write(root, "semgrep/oblixa-surface.yml", "rules:\n  - id: oblixa-v10-rule\n    languages: [typescript]\n    message: bad\n    severity: ERROR\n    pattern: foo()\n");
  write(root, "semgrep/oblixa-v7-surface.yml", "rules: []\n");
  write(root, "semgrep/oblixa-v8-surface.yml", "rules: []\n");
  write(root, "semgrep/oblixa-v10-surface.yml", "rules: []\n");

  const report = analyzeSemgrepRulepackIntegrity({ root, strict: true });

  assert.equal(report.ok, false);
  assert.equal(report.versionedActiveRuleIds[0].id, "oblixa-v10-rule");
});
