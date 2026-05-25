#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");

export const LOCAL_REQUIRED_CHECKS = [
  "check:migrations:strict",
  "check:migration-manifest",
  "check:migration-organization",
  "check:migration-idempotency",
  "check:supabase:ops",
  "check:supabase:snapshot",
  "check:supabase:fingerprint-artifact",
  "check:supabase:advisor-registry",
  "check:supabase:config",
  "check:supabase:local-reset-harness",
  "check:supabase:release-checklist",
  "check:supabase:seed-safety",
  "check:supabase:retention-inventory",
  "check:runtime-health-probe-contracts",
  "check:static-secret-safety",
  "check:env-contract-hygiene",
  "check:documentation-runtime-dependencies",
  "check:versioned-naming",
  "check:versioned-naming-safe-renames",
  "check:versioned-naming-removal-queue",
  "check:version-reference-allowlist",
  "check:versioned-exported-symbols",
  "check:versioned-exported-symbol-aliases",
  "check:versioned-content-contracts",
  "check:versioned-local-content-rewrites",
  "check:versioned-content-surface-coverage",
  "check:versioned-remaining-surface-coverage",
  "check:versioned-detailed-objective-coverage",
  "check:versioned-public-contract-preservation",
  "check:versioned-public-runtime-dual-read",
  "check:versioned-forward-migration-readiness",
  "check:versioned-source-config-preservation",
  "check:versioned-export-download-contracts",
  "check:versioned-package-script-readiness",
  "check:neutral-naming-rules",
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
  "check:versioned-route-aliases",
  "check:baseline-registry",
  "check:api-route-auth-route-index",
  "check:compatibility-route-inventory",
  "check:telemetry-event-inventory",
  "check:compatibility-removal-queue",
  "check:sql-object-reference-inventory",
  "check:sql-object-rename-staging",
  "check:sql-neutral-table-view-aliases",
  "check:sql-policy-alias-readiness",
  "check:sql-policy-predicate-equivalence",
  "check:sql-policy-forward-migration-blueprint",
  "check:sql-rename-verification-sql",
  "check:sql-security-automation-coverage",
  "check:migration-history-version-exceptions",
  "check:seed-versioned-name-queue-coverage",
  "check:hardening-ci-wiring",
];

export const OPTIONAL_CREDENTIAL_CHECKS = [
  "check:supabase:prod",
  "check:supabase:prod:deep",
];

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function readJson(file) {
  return JSON.parse(read(file));
}

function commandFor(script) {
  return `npm run ${script}`;
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function firstIndexOfAny(text, needles) {
  const indexes = needles.map((needle) => text.indexOf(needle)).filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : -1;
}

export function analyzeHardeningCiWiring(root = DEFAULT_ROOT) {
  const pkgPath = path.join(root, "package.json");
  const ciPath = path.join(root, ".github", "workflows", "ci.yml");
  const pkg = fs.existsSync(pkgPath) ? readJson(pkgPath) : { scripts: {} };
  const ci = read(ciPath);
  const scripts = pkg.scripts ?? {};
  const issues = [];

  for (const script of [...LOCAL_REQUIRED_CHECKS, ...OPTIONAL_CREDENTIAL_CHECKS]) {
    if (typeof scripts[script] !== "string" || scripts[script].trim() === "") {
      issues.push(issue("missing_package_script", { script }));
    }
  }

  for (const script of LOCAL_REQUIRED_CHECKS) {
    const command = commandFor(script);
    if (!ci.includes(command)) {
      issues.push(issue("missing_ci_hardening_command", { script, command }));
    }
  }

  for (const script of OPTIONAL_CREDENTIAL_CHECKS) {
    const command = commandFor(script);
    if (ci.includes(command)) {
      issues.push(issue("credential_required_check_is_mandatory_ci", { script, command }));
    }
  }

  const order = [
    "check:migrations:strict",
    "check:migration-manifest",
    "check:migration-organization",
    "check:migration-idempotency",
    "check:supabase:ops",
    "check:supabase:snapshot",
    "check:supabase:fingerprint-artifact",
    "check:supabase:advisor-registry",
    "check:supabase:config",
    "check:supabase:local-reset-harness",
    "check:supabase:release-checklist",
    "check:supabase:seed-safety",
    "check:supabase:retention-inventory",
    "check:runtime-health-probe-contracts",
    "check:static-secret-safety",
    "check:env-contract-hygiene",
    "check:documentation-runtime-dependencies",
    "check:versioned-naming",
    "check:versioned-naming-safe-renames",
    "check:versioned-naming-removal-queue",
    "check:version-reference-allowlist",
    "check:versioned-exported-symbols",
    "check:versioned-exported-symbol-aliases",
    "check:versioned-content-contracts",
    "check:versioned-local-content-rewrites",
    "check:versioned-content-surface-coverage",
    "check:versioned-remaining-surface-coverage",
    "check:versioned-detailed-objective-coverage",
    "check:versioned-public-contract-preservation",
    "check:versioned-public-runtime-dual-read",
    "check:versioned-forward-migration-readiness",
    "check:versioned-source-config-preservation",
    "check:versioned-export-download-contracts",
    "check:versioned-package-script-readiness",
    "check:neutral-naming-rules",
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
    "check:versioned-route-aliases",
    "check:baseline-registry",
    "check:api-route-auth-route-index",
    "check:compatibility-route-inventory",
    "check:telemetry-event-inventory",
    "check:compatibility-removal-queue",
    "check:sql-object-reference-inventory",
    "check:sql-object-rename-staging",
    "check:sql-neutral-table-view-aliases",
    "check:sql-policy-alias-readiness",
    "check:sql-policy-predicate-equivalence",
    "check:sql-policy-forward-migration-blueprint",
    "check:sql-rename-verification-sql",
    "check:sql-security-automation-coverage",
    "check:migration-history-version-exceptions",
    "check:seed-versioned-name-queue-coverage",
    "check:hardening-ci-wiring",
  ];
  let previous = -1;
  for (const script of order) {
    const index = firstIndexOfAny(ci, [commandFor(script)]);
    if (index < 0) continue;
    if (index < previous) {
      issues.push(issue("hardening_ci_command_order_mismatch", { script }));
    }
    previous = index;
  }

  return {
    ok: issues.length === 0,
    localRequiredChecks: LOCAL_REQUIRED_CHECKS.map((script) => ({
      script,
      command: commandFor(script),
      credentialRequirement: "none",
    })),
    optionalCredentialChecks: OPTIONAL_CREDENTIAL_CHECKS.map((script) => ({
      script,
      command: commandFor(script),
      credentialRequirement: "production",
    })),
    issueCount: issues.length,
    issues,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    }
  }
  return options;
}

export function runHardeningCiWiringCheck(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeHardeningCiWiring(options.root);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runHardeningCiWiringCheck();
}
