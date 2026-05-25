#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";

export const DEFAULT_LOCAL_COMMANDS = [
  "npm run check:migrations:strict",
  "npm run check:migration-manifest",
  "npm run check:migration-organization",
  "npm run check:migration-idempotency",
  "npm run report:migration-rollbacks",
  "npm run check:supabase:ops",
  "npm run check:supabase:snapshot",
  "npm run check:supabase:fingerprint-artifact",
  "npm run report:supabase:fingerprint-drift",
  "npm run check:supabase:advisor-registry",
  "npm run check:supabase:config",
  "npm run check:supabase:local-reset-harness",
  "npm run check:supabase:release-checklist",
  "npm run check:supabase:seed-safety",
  "npm run check:supabase:retention-inventory",
  "npm run check:runtime-health-probe-contracts",
  "npm run check:static-secret-safety",
  "npm run check:env-contract-hygiene",
  "npm run check:documentation-runtime-dependencies",
  "npm run check:versioned-naming",
  "npm run check:versioned-naming-safe-renames",
  "npm run check:versioned-naming-removal-queue",
  "npm run check:version-reference-allowlist",
  "npm run check:versioned-exported-symbols",
  "npm run check:versioned-exported-symbol-aliases",
  "npm run check:versioned-content-contracts",
  "npm run check:versioned-local-content-rewrites",
  "npm run check:versioned-content-surface-coverage",
  "npm run check:versioned-remaining-surface-coverage",
  "npm run check:versioned-detailed-objective-coverage",
  "npm run check:versioned-public-contract-preservation",
  "npm run check:versioned-public-runtime-dual-read",
  "npm run check:versioned-forward-migration-readiness",
  "npm run check:versioned-source-config-preservation",
  "npm run check:versioned-export-download-contracts",
  "npm run check:versioned-package-script-readiness",
  "npm run check:neutral-naming-rules",
  "npm run check:versioned-manual-surface-closure",
  "npm run check:versioned-open-objective-closure",
  "npm run check:versioned-compatibility-equivalence",
  "npm run check:versioned-local-surface-regression",
  "npm run check:versioned-alias-usage-neutrality",
  "npm run check:versioned-env-flag-aliases",
  "npm run check:versioned-code-only-closure",
  "npm run check:versioned-additive-alias-preservation",
  "npm run check:versioned-remaining-local-contract-closure",
  "npm run check:versioned-unchecked-objective-readiness",
  "npm run check:versioned-final-checklist-reconciliation",
  "npm run check:versioned-route-aliases",
  "npm run check:baseline-registry",
  "npm run check:api-route-auth-route-index",
  "npm run check:compatibility-route-inventory",
  "npm run check:telemetry-event-inventory",
  "npm run check:compatibility-removal-queue",
  "npm run check:sql-object-reference-inventory",
  "npm run check:sql-object-rename-staging",
  "npm run check:sql-neutral-table-view-aliases",
  "npm run check:sql-policy-alias-readiness",
  "npm run check:sql-policy-predicate-equivalence",
  "npm run check:sql-policy-forward-migration-blueprint",
  "npm run check:sql-rename-verification-sql",
  "npm run check:sql-security-automation-coverage",
  "npm run check:migration-history-version-exceptions",
  "npm run check:seed-versioned-name-queue-coverage",
  "npm run check:hardening-ci-wiring",
];

export const DEFAULT_LINKED_READ_ONLY_COMMANDS = [
  "npm run check:supabase:prod",
  "npm run check:supabase:prod:deep",
];

export const DEFAULT_MANUAL_ACTIONS = [
  "Run optional linked read-only Supabase checks with valid production credentials before claiming production state.",
  "Apply reviewed Supabase migrations through the approved production deployment process when ready.",
  "Confirm any provider dashboard, traffic, or secret changes outside this repository separately.",
];

function sortedUnique(values) {
  return Array.from(new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function buildProductionEvidenceSummary(options = {}) {
  const localCommandsRun = sortedUnique(options.localCommandsRun);
  const linkedReadOnlyCommandsRun = sortedUnique(options.linkedReadOnlyCommandsRun);
  const productionMutationCommands = sortedUnique(options.productionMutationCommands);
  const manualActions = options.includeDefaultManualActions === false
    ? sortedUnique(options.manualActions)
    : sortedUnique([...(options.manualActions ?? []), ...DEFAULT_MANUAL_ACTIONS]);
  const productionMutationPerformed = Boolean(options.productionMutationPerformed);
  const issues = [];

  if (!productionMutationPerformed && productionMutationCommands.length > 0) {
    issues.push({
      issue: "production_mutation_commands_require_explicit_flag",
      message: "Set productionMutationPerformed only when a production write actually occurred.",
    });
  }
  if (productionMutationPerformed && productionMutationCommands.length === 0) {
    issues.push({
      issue: "production_mutation_missing_command",
      message: "Production mutations must include the exact command or manual action that performed the write.",
    });
  }

  return {
    schemaVersion: 1,
    ok: issues.length === 0,
    codeVerified: localCommandsRun.length > 0,
    linkedVerified: linkedReadOnlyCommandsRun.length > 0,
    manualActionRequired: manualActions.length > 0,
    productionMutationPerformed,
    evidence: {
      local: {
        verified: localCommandsRun.length > 0,
        commandsRun: localCommandsRun,
        recommendedCommands: DEFAULT_LOCAL_COMMANDS,
      },
      linkedReadOnly: {
        verified: linkedReadOnlyCommandsRun.length > 0,
        commandsRun: linkedReadOnlyCommandsRun,
        optionalCommands: DEFAULT_LINKED_READ_ONLY_COMMANDS,
      },
      manual: {
        required: manualActions.length > 0,
        actions: manualActions,
      },
      productionWrite: {
        performed: productionMutationPerformed,
        commandsRun: productionMutationCommands,
      },
    },
    issueCount: issues.length,
    issues,
  };
}

function parseArgs(argv) {
  const options = {
    localCommandsRun: [],
    linkedReadOnlyCommandsRun: [],
    manualActions: [],
    productionMutationCommands: [],
    productionMutationPerformed: false,
    includeDefaultManualActions: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--local-command") {
      options.localCommandsRun.push(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--local-command=")) {
      options.localCommandsRun.push(arg.slice("--local-command=".length));
    } else if (arg === "--linked-command") {
      options.linkedReadOnlyCommandsRun.push(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--linked-command=")) {
      options.linkedReadOnlyCommandsRun.push(arg.slice("--linked-command=".length));
    } else if (arg === "--manual-action") {
      options.manualActions.push(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--manual-action=")) {
      options.manualActions.push(arg.slice("--manual-action=".length));
    } else if (arg === "--production-mutation-command") {
      options.productionMutationCommands.push(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--production-mutation-command=")) {
      options.productionMutationCommands.push(arg.slice("--production-mutation-command=".length));
    } else if (arg === "--production-mutation-performed") {
      options.productionMutationPerformed = true;
    } else if (arg === "--no-default-manual-actions") {
      options.includeDefaultManualActions = false;
    }
  }

  return options;
}

export function runProductionEvidenceSummary(options = parseArgs(process.argv.slice(2))) {
  const report = buildProductionEvidenceSummary(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProductionEvidenceSummary();
}
