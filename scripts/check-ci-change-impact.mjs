#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_BASE_REF = process.env.CI_CHANGE_IMPACT_BASE_REF?.trim() || "HEAD~1";

export const RISK_AREAS = [
  {
    id: "migrations",
    checks: [
      "check:migrations:strict",
      "check:migration-manifest",
      "check:migration-organization",
      "check:migration-idempotency",
      "check:migration-history-version-exceptions",
      "check:sql-neutral-table-view-aliases",
      "check:sql-policy-alias-readiness",
      "check:sql-policy-predicate-equivalence",
      "check:sql-policy-forward-migration-blueprint",
      "check:versioned-forward-migration-readiness",
      "check:supabase:ops",
      "check:supabase:fingerprint-artifact",
      "check:supabase:local-reset-harness",
      "check:supabase:release-checklist",
      "check:supabase:seed-safety",
      "check:seed-versioned-name-queue-coverage",
      "check:supabase:retention-inventory",
      "report:migration-rollbacks",
    ],
    matches: (file) => /^supabase\/migrations\/.+\.sql$/u.test(file),
  },
  {
    id: "rls_sql_functions",
    checks: [
      "check:sql-security-migrations-bundle",
      "check:sql-definer-invoker-inventory",
      "check:sql-object-reference-inventory",
      "check:sql-object-rename-staging",
      "check:sql-neutral-table-view-aliases",
      "check:sql-policy-alias-readiness",
      "check:sql-policy-predicate-equivalence",
      "check:sql-policy-forward-migration-blueprint",
      "check:sql-rename-verification-sql",
      "check:sql-security-automation-coverage",
      "check:versioned-forward-migration-readiness",
      "check:supabase:seed-safety",
      "check:supabase:retention-inventory",
      "check:supabase:fingerprint-artifact",
      "check:migration-idempotency",
    ],
    matches: (file) =>
      /^supabase\/(?:migrations|tests|sql)\/.+\.sql$/u.test(file) ||
      /^scripts\/check-(?:sql|migration|rls|supabase)/u.test(file),
  },
  {
    id: "api_routes",
    checks: [
      "check:api-route-tests",
      "check:api-route-auth-contract",
      "check:api-route-auth-route-index",
      "check:api-route-rate-limit-coverage",
      "check:compatibility-route-inventory",
      "check:telemetry-event-inventory",
      "check:versioned-content-contracts",
      "check:versioned-local-content-rewrites",
      "check:versioned-content-surface-coverage",
      "check:versioned-remaining-surface-coverage",
      "check:versioned-detailed-objective-coverage",
      "check:versioned-public-contract-preservation",
      "check:versioned-public-runtime-dual-read",
      "check:versioned-forward-migration-readiness",
      "check:versioned-export-download-contracts",
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
      "check:runtime-health-probe-contracts",
    ],
    matches: (file) => /^src\/app\/api\/.+\/route\.(?:ts|tsx|js|jsx)$/u.test(file),
  },
  {
    id: "telemetry_events",
    checks: [
      "check:telemetry-event-inventory",
      "check:compatibility-removal-queue",
      "check:versioned-content-contracts",
      "check:versioned-local-content-rewrites",
      "check:versioned-content-surface-coverage",
      "check:versioned-remaining-surface-coverage",
      "check:versioned-detailed-objective-coverage",
      "check:versioned-manual-surface-closure",
      "check:versioned-export-download-contracts",
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
      "check:audit-event-coverage",
      "check:security-event-contract",
    ],
    matches: (file) =>
      /^artifacts\/telemetry\/event-inventory\.json$/u.test(file) ||
      /^scripts\/check-telemetry-event-inventory/u.test(file) ||
      /(?:telemetry|audit-events?|outbound-events?|events?)/iu.test(file),
  },
  {
    id: "cron_routes",
    checks: ["check:cron-route-auth", "check:vercel-cron", "check:scheduled-cron-route-wrappers"],
    matches: (file) => /^src\/app\/api\/(?:cron|reports\/send-summaries|tasks\/run-rules|reminders)\/.+\/route\.(?:ts|tsx|js|jsx)$/u.test(file),
  },
  {
    id: "auth_session",
    checks: [
      "check:auth-callback-guardrails",
      "check:auth-cookie-attributes",
      "check:session-lifecycle-security",
      "check:api-route-auth-contract",
    ],
    matches: (file) =>
      /(?:^|\/)(?:auth|session|sessions|oauth|mfa|middleware|proxy)\b/u.test(file) ||
      /^src\/lib\/(?:auth|security|supabase)\//u.test(file),
  },
  {
    id: "environment_contracts",
    checks: [
      "check:env-example-parity",
      "check:env-matrix",
      "check:security-env-contract",
      "check:env-contract-hygiene",
      "check:versioned-content-contracts",
      "check:versioned-local-content-rewrites",
      "check:versioned-content-surface-coverage",
      "check:versioned-remaining-surface-coverage",
      "check:versioned-detailed-objective-coverage",
      "check:versioned-source-config-preservation",
      "check:seed-versioned-name-queue-coverage",
      "check:versioned-forward-migration-readiness",
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
    ],
    matches: (file) =>
      /(^|\/)\.env(?:\.|$)/u.test(file) ||
      /(^|\/)(?:env|environment|vercel|next\.config|supabase\/config)\b/u.test(file) ||
      /^scripts\/check-.*env/u.test(file),
  },
  {
    id: "billing_webhooks",
    checks: ["check:webhook-inbound-policy", "check:api-route-auth-contract", "check:security-env-contract", "check:static-secret-safety"],
    matches: (file) => /(?:stripe|billing|invoice|subscription|webhook|webhooks)/iu.test(file),
  },
  {
    id: "provider_integrations",
    checks: [
      "check:operational-provider-integrations",
      "check:provider-integration-fixtures",
      "check:operational-environment-isolation",
      "check:webhook-inbound-policy",
      "check:release-security-required-env",
    ],
    matches: (file) =>
      /(?:stripe|resend|openai|sentry|upstash|oauth|calendar|crm|provider|integration|webhook_outbox)/iu.test(file) ||
      /^src\/lib\/(?:email|extraction|integrations|observability)\//u.test(file),
  },
  {
    id: "ui_surface",
    checks: [
      "check:operational-frontend-resilience",
      "check:operational-platform-variant-coverage",
      "check:ui-surface-consistency",
      "check:route-state-coverage",
      "test:e2e:ui-qa-plan",
    ],
    matches: (file) =>
      /^src\/(?:app|components)\/.+\.(?:tsx|jsx|css)$/u.test(file) ||
      /^e2e\/.+\.(?:ts|tsx|js|jsx)$/u.test(file) ||
      /^playwright\.config\.ts$/u.test(file),
  },
  {
    id: "public_copy",
    checks: [
      "check:operational-public-launch-positioning",
      "check:operational-legal-trust-compliance",
      "audit:marketing-identity:strict",
      "audit:release-state-code-only:strict",
    ],
    matches: (file) =>
      /^src\/app\/\(marketing\)\//u.test(file) ||
      /^src\/lib\/marketing\//u.test(file) ||
      /(?:privacy|terms|security|trust|cookie|accessibility|subprocessor|marketing|public|claim)/iu.test(file),
  },
  {
    id: "generated_artifacts",
    checks: [
      "check:baseline-registry",
      "check:hardening-ci-wiring",
      "check:static-secret-safety",
      "check:generated-artifact-hygiene",
      "check:compatibility-removal-queue",
      "check:sql-object-rename-staging",
      "check:sql-policy-alias-readiness",
      "check:sql-policy-predicate-equivalence",
      "check:sql-policy-forward-migration-blueprint",
      "check:sql-rename-verification-sql",
      "check:sql-security-automation-coverage",
      "check:migration-history-version-exceptions",
      "check:seed-versioned-name-queue-coverage",
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
    ],
    matches: (file) =>
      /^artifacts\//u.test(file) ||
      /(?:baseline|manifest|inventory|registry)\.(?:json|txt|tsv|md)$/u.test(file) ||
      /^scripts\/(?:versioned-naming-baseline|versioned-naming-removal-queue|baseline-registry)/u.test(file),
  },
  {
    id: "ci_scripts",
    checks: [
      "check:checks-integrity-meta",
      "check:config-drift",
      "check:hardening-ci-wiring",
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
      "check:sql-policy-alias-readiness",
      "check:sql-policy-predicate-equivalence",
      "check:sql-policy-forward-migration-blueprint",
      "check:sql-rename-verification-sql",
      "check:sql-security-automation-coverage",
      "check:migration-history-version-exceptions",
      "check:seed-versioned-name-queue-coverage",
      "check:compatibility-removal-queue",
    ],
    matches: (file) => /^\.github\/workflows\/.+\.ya?ml$/u.test(file) || /^scripts\/.+\.(?:mjs|js|ts)$/u.test(file) || file === "package.json",
  },
  {
    id: "documentation",
    checks: ["check:documentation-runtime-dependencies", "check:operational-hardening-objectives"],
    matches: (file) =>
      /(?:^|\/)(?:README|CHANGELOG|CONTRIBUTING|AGENTS)\.md$/iu.test(file) ||
      /^docs\//u.test(file) ||
      /\.mdx?$/iu.test(file) ||
      /^\.cursor\/rules\/.+\.mdc$/u.test(file),
  },
];

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function normalizePath(value) {
  return String(value ?? "").trim().replace(/\\/gu, "/");
}

export function parseGitNameStatus(text) {
  return String(text ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawStatus, firstPath, secondPath] = line.split(/\t/u);
      const status = rawStatus.replace(/\d+$/u, "");
      if ((status === "R" || status === "C") && secondPath) {
        return {
          status,
          path: normalizePath(secondPath),
          oldPath: normalizePath(firstPath),
        };
      }
      return {
        status: status || "M",
        path: normalizePath(firstPath ?? rawStatus),
        oldPath: null,
      };
    })
    .filter((entry) => entry.path);
}

export function classifyPath(file) {
  const areas = RISK_AREAS.filter((area) => area.matches(file)).map((area) => area.id);
  return areas.length > 0 ? areas : ["unclassified"];
}

export function classifyChangedEntries(entries) {
  const normalized = entries.map((entry) => {
    const pathAreas = classifyPath(entry.path);
    const oldPathAreas = entry.oldPath ? classifyPath(entry.oldPath) : [];
    const riskAreas = uniqueSorted([...pathAreas, ...oldPathAreas]);
    const checks = uniqueSorted(
      RISK_AREAS.filter((area) => riskAreas.includes(area.id)).flatMap((area) => area.checks),
    );
    const documentationOnly = riskAreas.length === 1 && riskAreas[0] === "documentation";
    return {
      status: entry.status ?? "M",
      path: normalizePath(entry.path),
      oldPath: entry.oldPath ? normalizePath(entry.oldPath) : null,
      riskAreas,
      requiredChecks: checks,
      documentationOnly,
      productionRelevant: !documentationOnly,
    };
  });

  const requiredChecks = uniqueSorted(normalized.flatMap((entry) => entry.requiredChecks));
  const riskAreaIds = uniqueSorted(normalized.flatMap((entry) => entry.riskAreas));
  const riskAreas = riskAreaIds.map((area) => ({
    area,
    changedCount: normalized.filter((entry) => entry.riskAreas.includes(area)).length,
    paths: uniqueSorted(normalized.filter((entry) => entry.riskAreas.includes(area)).map((entry) => entry.path)),
    requiredChecks: uniqueSorted(
      RISK_AREAS.filter((definition) => definition.id === area).flatMap((definition) => definition.checks),
    ),
  }));

  const documentationOnly = normalized.length > 0 && normalized.every((entry) => entry.documentationOnly);
  const productionRelevant = normalized.some((entry) => entry.productionRelevant);
  return {
    changedCount: normalized.length,
    changed: normalized.sort((a, b) => a.path.localeCompare(b.path)),
    riskAreas,
    requiredChecks,
    documentationOnly,
    productionRelevant,
    supabaseAffecting: riskAreaIds.some((area) => ["migrations", "rls_sql_functions", "environment_contracts"].includes(area)),
  };
}

export function buildPrSummary(changeImpact) {
  const checks = changeImpact.requiredChecks ?? [];
  const areas = (changeImpact.riskAreas ?? []).map((row) => row.area);
  const warnings = [];
  if ((changeImpact.changedCount ?? 0) === 0) warnings.push("No changed files were detected; confirm the base ref or attach explicit evidence.");
  if (areas.includes("unclassified")) warnings.push("At least one changed file is unclassified; add a change-impact rule or record reviewer-owned evidence.");
  for (const entry of changeImpact.changed ?? []) {
    if ((entry.requiredChecks ?? []).length === 0) {
      warnings.push(`${entry.path} has no targeted validation command; record why existing evidence is sufficient.`);
    }
  }

  const lines = [
    `Changed files: ${changeImpact.changedCount ?? 0}`,
    `Risk areas: ${areas.length ? areas.join(", ") : "none"}`,
    `Recommended validation: ${checks.length ? checks.map((check) => `npm run ${check}`).join("; ") : "none"}`,
  ];
  if (warnings.length > 0) lines.push(`Missing evidence warnings: ${warnings.join(" | ")}`);
  return {
    markdown: lines.map((line) => `- ${line}`).join("\n"),
    missingEvidenceWarnings: warnings,
  };
}

function runGit(args) {
  const result = spawnSync("git", args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error([`git ${args.join(" ")} failed`, result.stderr, result.stdout].filter(Boolean).join("\n"));
  }
  return result.stdout;
}

export function collectGitChangedEntries({ baseRef = DEFAULT_BASE_REF } = {}) {
  try {
    return parseGitNameStatus(runGit(["diff", "--name-status", "--find-renames", `${baseRef}...HEAD`]));
  } catch {
    const unstaged = parseGitNameStatus(runGit(["diff", "--name-status", "--find-renames"]));
    const staged = parseGitNameStatus(runGit(["diff", "--cached", "--name-status", "--find-renames"]));
    return [...unstaged, ...staged];
  }
}

export function analyzeChangeImpact({
  entries,
  baseRef = DEFAULT_BASE_REF,
  strict = false,
  maxChangedEntries = 200,
  maxPathsPerArea = 50,
} = {}) {
  const classified = classifyChangedEntries(entries ?? collectGitChangedEntries({ baseRef }));
  const changed = classified.changed.slice(0, maxChangedEntries);
  const riskAreas = classified.riskAreas.map((area) => ({
    ...area,
    paths: area.paths.slice(0, maxPathsPerArea),
    omittedPathCount: Math.max(0, area.paths.length - maxPathsPerArea),
  }));
  const issues = [];
  if (strict && classified.changedCount === 0) {
    issues.push({ issue: "no_changed_files_detected", baseRef });
  }

  const report = {
    ok: issues.length === 0,
    strict,
    baseRef,
    summary:
      classified.changedCount === 0
        ? "No changed files detected."
        : classified.documentationOnly
          ? `${classified.changedCount} documentation-only file change(s).`
          : `${classified.changedCount} changed file(s) across ${classified.riskAreas.length} risk area(s).`,
    ...classified,
    changed,
    riskAreas,
    omittedChangedCount: Math.max(0, classified.changed.length - maxChangedEntries),
    issueCount: issues.length,
    issues,
  };
  return {
    ...report,
    prSummary: buildPrSummary(report),
  };
}

function parseArgs(argv) {
  const options = { strict: false, baseRef: DEFAULT_BASE_REF, maxChangedEntries: 200, maxPathsPerArea: 50 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--base-ref") {
      options.baseRef = argv[index + 1] ?? DEFAULT_BASE_REF;
      index += 1;
    } else if (arg.startsWith("--base-ref=")) {
      options.baseRef = arg.slice("--base-ref=".length);
    } else if (arg === "--max-changed") {
      options.maxChangedEntries = Number(argv[index + 1] ?? 200);
      index += 1;
    } else if (arg.startsWith("--max-changed=")) {
      options.maxChangedEntries = Number(arg.slice("--max-changed=".length));
    } else if (arg === "--max-paths-per-area") {
      options.maxPathsPerArea = Number(argv[index + 1] ?? 50);
      index += 1;
    } else if (arg.startsWith("--max-paths-per-area=")) {
      options.maxPathsPerArea = Number(arg.slice("--max-paths-per-area=".length));
    }
  }
  return options;
}

export function runChangeImpactCheck(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeChangeImpact(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runChangeImpactCheck();
}
