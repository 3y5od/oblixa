import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProductionEvidenceSummary,
  DEFAULT_LINKED_READ_ONLY_COMMANDS,
  DEFAULT_LOCAL_COMMANDS,
} from "./report-production-evidence-summary.mjs";

test("buildProductionEvidenceSummary defaults to no production verification or mutation", () => {
  const report = buildProductionEvidenceSummary();

  assert.equal(report.ok, true);
  assert.equal(report.codeVerified, false);
  assert.equal(report.linkedVerified, false);
  assert.equal(report.manualActionRequired, true);
  assert.equal(report.productionMutationPerformed, false);
  assert.deepEqual(report.evidence.local.commandsRun, []);
  assert.deepEqual(report.evidence.linkedReadOnly.commandsRun, []);
  assert.equal(report.evidence.productionWrite.performed, false);
});

test("buildProductionEvidenceSummary records exact local commands without implying linked verification", () => {
  const report = buildProductionEvidenceSummary({
    localCommandsRun: ["npm run check:supabase:ops", "npm run check:supabase:config"],
    includeDefaultManualActions: false,
  });

  assert.equal(report.ok, true);
  assert.equal(report.codeVerified, true);
  assert.equal(report.linkedVerified, false);
  assert.equal(report.productionMutationPerformed, false);
  assert.deepEqual(report.evidence.local.commandsRun, ["npm run check:supabase:config", "npm run check:supabase:ops"]);
  assert.equal(report.evidence.local.recommendedCommands.includes(DEFAULT_LOCAL_COMMANDS[0]), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:supabase:seed-safety"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:static-secret-safety"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:env-contract-hygiene"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-content-surface-coverage"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-remaining-surface-coverage"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-detailed-objective-coverage"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-public-contract-preservation"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-public-runtime-dual-read"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-forward-migration-readiness"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-source-config-preservation"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-package-script-readiness"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:neutral-naming-rules"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-manual-surface-closure"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-open-objective-closure"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-compatibility-equivalence"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-local-surface-regression"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-alias-usage-neutrality"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-env-flag-aliases"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-code-only-closure"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-additive-alias-preservation"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-remaining-local-contract-closure"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-unchecked-objective-readiness"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:versioned-final-checklist-reconciliation"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:sql-neutral-table-view-aliases"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:sql-policy-alias-readiness"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:sql-policy-predicate-equivalence"), true);
  assert.equal(report.evidence.local.recommendedCommands.includes("npm run check:sql-policy-forward-migration-blueprint"), true);
});

test("buildProductionEvidenceSummary records linked read-only commands separately", () => {
  const report = buildProductionEvidenceSummary({
    linkedReadOnlyCommandsRun: ["npm run check:supabase:prod:deep"],
    includeDefaultManualActions: false,
  });

  assert.equal(report.ok, true);
  assert.equal(report.codeVerified, false);
  assert.equal(report.linkedVerified, true);
  assert.equal(report.productionMutationPerformed, false);
  assert.deepEqual(report.evidence.linkedReadOnly.commandsRun, ["npm run check:supabase:prod:deep"]);
  assert.equal(report.evidence.linkedReadOnly.optionalCommands.includes(DEFAULT_LINKED_READ_ONLY_COMMANDS[0]), true);
});

test("buildProductionEvidenceSummary requires explicit mutation flag for mutation commands", () => {
  const report = buildProductionEvidenceSummary({
    productionMutationCommands: ["supabase db push --linked"],
    includeDefaultManualActions: false,
  });

  assert.equal(report.ok, false);
  assert.equal(report.productionMutationPerformed, false);
  assert.ok(report.issues.some((row) => row.issue === "production_mutation_commands_require_explicit_flag"));
});

test("buildProductionEvidenceSummary requires exact mutation command when mutation flag is set", () => {
  const report = buildProductionEvidenceSummary({
    productionMutationPerformed: true,
    includeDefaultManualActions: false,
  });

  assert.equal(report.ok, false);
  assert.equal(report.productionMutationPerformed, true);
  assert.ok(report.issues.some((row) => row.issue === "production_mutation_missing_command"));
});
