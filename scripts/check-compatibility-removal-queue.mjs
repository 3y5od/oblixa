#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildVersionedRouteAliasPlan } from "./check-versioned-route-aliases.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/removal-queue.json";
const TELEMETRY_INVENTORY_REL = "artifacts/telemetry/event-inventory.json";
const SQL_RENAME_STAGING_REL = "artifacts/supabase/sql-object-rename-staging.json";
const EXPORTED_SYMBOL_INVENTORY_REL = "artifacts/compatibility/versioned-exported-symbol-inventory.json";
const CONTENT_CONTRACT_INVENTORY_REL = "artifacts/compatibility/versioned-content-contract-inventory.json";
const CONTENT_SURFACE_COVERAGE_REL = "artifacts/compatibility/versioned-content-surface-coverage.json";
const MANUAL_SURFACE_CLOSURE_REL = "artifacts/compatibility/versioned-manual-surface-closure.json";
const PACKAGE_SCRIPT_READINESS_REL = "artifacts/compatibility/versioned-package-script-readiness.json";
const EXPORT_DOWNLOAD_CONTRACTS_REL = "artifacts/compatibility/versioned-export-download-contracts.json";
const SQL_SECURITY_AUTOMATION_REL = "artifacts/supabase/sql-security-automation-coverage.json";
const MIGRATION_HISTORY_EXCEPTIONS_REL = "artifacts/supabase/migration-history-version-exceptions.json";
const SEED_VERSIONED_QUEUE_COVERAGE_REL = "artifacts/supabase/seed-versioned-name-queue-coverage.json";
const STATUS_VOCABULARY = [
  "alias_added",
  "awaiting_analytics_dashboard_cutover",
  "awaiting_linked_verification",
  "awaiting_production_cutover",
  "ready_for_removal",
];

export const PACKAGE_SCRIPT_ALIASES = [
  { legacy: "report:v9-pr-body-rollup", neutral: "report:release-pr-body-rollup" },
  { legacy: "test:e2e:v9", neutral: "test:e2e:compatibility" },
  { legacy: "test:e2e:v9:visual", neutral: "test:e2e:compatibility:visual" },
  { legacy: "test:e2e:v9:visual:update", neutral: "test:e2e:compatibility:visual:update" },
  { legacy: "test:e2e:v10", neutral: "test:e2e:current-product" },
  { legacy: "test:e2e:v10:matrix", neutral: "test:e2e:current-product:matrix" },
  { legacy: "test:vitest:v10", neutral: "test:vitest:current-product" },
  { legacy: "check:v7-suite", neutral: "check:surface-suite:compatibility" },
  { legacy: "check:v7-hrefs:strict", neutral: "check:surface-hrefs:compatibility:strict" },
  { legacy: "check:v8-hrefs", neutral: "check:surface:hrefs" },
  { legacy: "check:v8-hrefs:strict", neutral: "check:surface:hrefs:strict" },
  { legacy: "check:v8-vocabulary", neutral: "check:surface:vocabulary" },
  { legacy: "check:v8-page-inventory", neutral: "check:surface:page-inventory" },
  { legacy: "check:v8-api-inventory", neutral: "check:surface:api-inventory" },
  { legacy: "check:v8-action-inventory", neutral: "check:surface:action-inventory" },
  { legacy: "check:v8-api-eligibility", neutral: "check:surface:api-eligibility" },
  { legacy: "check:v8-action-eligibility", neutral: "check:surface:action-eligibility" },
  { legacy: "check:v8-denial-mapping", neutral: "check:surface:denial-mapping" },
  { legacy: "check:v8-supplemental-contracts", neutral: "check:surface:supplemental-contracts" },
  { legacy: "check:v8-diagnostics-contract", neutral: "check:surface:diagnostics-contract" },
  { legacy: "check:v8-acceptance-matrix", neutral: "check:surface:acceptance-matrix" },
  { legacy: "check:v8-acceptance-criteria", neutral: "check:surface:acceptance-criteria" },
  { legacy: "v8:inventory-report", neutral: "report:surface-inventory" },
  { legacy: "check:v8-suite", neutral: "check:surface:suite" },
  { legacy: "check:v9-suite", neutral: "check:previous-release-suite" },
  { legacy: "check:v10-release-evidence", neutral: "check:release-evidence" },
  { legacy: "check:v10-inventory-lock", neutral: "check:release-inventory-lock" },
  { legacy: "check:v10-migration-smoke", neutral: "check:migration-smoke:current" },
  { legacy: "check:v10-migration-smoke:strict", neutral: "check:migration-smoke:current:strict" },
  { legacy: "check:v10-promotable", neutral: "check:release-promotable" },
  { legacy: "check:v10-promotable:report", neutral: "report:release-promotable" },
  { legacy: "check:v10-runtime-evidence-plan", neutral: "report:runtime-evidence-plan" },
  { legacy: "check:v10-privacy-scan", neutral: "check:release-privacy-scan" },
  { legacy: "check:v10-zero-exclusion-report", neutral: "check:zero-exclusion-report" },
  { legacy: "check:v10-complete-closure", neutral: "check:complete-closure" },
  { legacy: "check:v10-suite", neutral: "check:release-suite-current" },
  { legacy: "rebuild:v10-read-models", neutral: "rebuild:read-models" },
];

export const FEATURE_FLAG_ENV_ALIASES = [
  ["ENABLE_V3_TASKS_ENGINE", "ENABLE_TASKS_ENGINE"],
  ["ENABLE_V3_OBLIGATIONS_EXECUTION", "ENABLE_OBLIGATIONS_EXECUTION"],
  ["ENABLE_V3_APPROVALS_SLA", "ENABLE_APPROVALS_SLA"],
  ["ENABLE_V3_RENEWAL_WORKSPACE", "ENABLE_RENEWAL_WORKSPACE"],
  ["ENABLE_V3_INTAKE_PIPELINE", "ENABLE_INTAKE_PIPELINE"],
  ["ENABLE_V3_PERSONA_DASHBOARDS", "ENABLE_PERSONA_DASHBOARDS"],
  ["ENABLE_V3_REPORTING_HISTORY", "ENABLE_REPORTING_HISTORY"],
  ["ENABLE_V3_AUTOMATION_EXPANSION", "ENABLE_AUTOMATION_EXPANSION"],
  ["ENABLE_V5_DECISION_FOUNDATION", "ENABLE_DECISION_FOUNDATION"],
  ["ENABLE_V5_PORTFOLIO_CAMPAIGNS", "ENABLE_PORTFOLIO_CAMPAIGNS"],
  ["ENABLE_V5_SIMULATION_AND_INTELLIGENCE", "ENABLE_SIMULATION_AND_INTELLIGENCE"],
  ["ENABLE_V5_RELATIONSHIP_LAYER", "ENABLE_RELATIONSHIP_LAYER"],
  ["ENABLE_V5_EXTERNAL_COLLABORATION", "ENABLE_EXTERNAL_COLLABORATION"],
  ["ENABLE_V5_CONTROL_ROOM_UX", "ENABLE_CONTROL_ROOM_UX"],
  ["ENABLE_V6_ASSURANCE_CORE", "ENABLE_ASSURANCE_CORE"],
  ["ENABLE_V6_CONTROL_POLICIES", "ENABLE_CONTROL_POLICIES"],
  ["ENABLE_V6_ADAPTIVE_PLAYBOOKS", "ENABLE_ADAPTIVE_PLAYBOOKS"],
  ["ENABLE_V6_AUTOPILOT", "ENABLE_AUTOPILOT"],
  ["ENABLE_V6_AUTOPILOT_ALLOW_EXECUTION", "ENABLE_AUTOPILOT_ALLOW_EXECUTION"],
  ["ENABLE_V6_OUTCOME_INTELLIGENCE", "ENABLE_OUTCOME_INTELLIGENCE"],
  ["ENABLE_V6_REVIEW_BOARDS", "ENABLE_REVIEW_BOARDS"],
  ["ENABLE_V6_SEGMENTS", "ENABLE_SEGMENTS"],
].map(([legacy, neutral]) => ({
  legacy,
  neutral,
  owner: "platform-hardening",
  reason: "Retain the versioned feature-flag env key while runtime code and examples prefer the neutral key.",
  validationCommand: "vitest run src/lib/feature-flags.test.ts src/lib/observability/instrumentation-env-warn.test.ts",
  earliestRemovalCondition: `Production, CI, examples, and runbooks use ${neutral} and no deployed environment depends on ${legacy}.`,
  manualFollowUp: `Remove ${legacy} fallback only after production env inventory confirms ${neutral} is configured everywhere.`,
}));

export const ENV_KEY_ALIASES = [
  ...FEATURE_FLAG_ENV_ALIASES,
  {
    legacy: "V5_DECISION_PACKET_BUCKET",
    neutral: "DECISION_PACKET_BUCKET",
    owner: "decision-intelligence",
    reason: "Retain the legacy decision-packet storage bucket env key while server code and examples prefer the neutral bucket key.",
    validationCommand: "vitest run src/lib/decision-intelligence/decision-packet-storage.test.ts",
    earliestRemovalCondition:
      "Production, local examples, CI, and runbooks use DECISION_PACKET_BUCKET and no deployed environment depends on V5_DECISION_PACKET_BUCKET.",
    manualFollowUp: "Remove V5_DECISION_PACKET_BUCKET fallback only after production env inventory confirms the neutral key is configured.",
  },
  {
    legacy: "PLAYWRIGHT_V10_MATRIX",
    neutral: "PLAYWRIGHT_DEVICE_MATRIX",
    owner: "test-platform",
    reason: "Retain the legacy Playwright device-matrix env key while local and CI callers move to the neutral key.",
    validationCommand: "npx playwright test --list e2e/current-product-device-matrix.chromium.spec.ts",
    earliestRemovalCondition:
      "Package scripts, CI, documentation, and local runbooks use PLAYWRIGHT_DEVICE_MATRIX and no callers rely on PLAYWRIGHT_V10_MATRIX.",
    manualFollowUp: "Remove PLAYWRIGHT_V10_MATRIX fallback from the E2E specs after the compatibility window.",
  },
];

export const EXPORTED_SYMBOL_ALIASES = [
  { legacy: "V9_DUE_SOON_DAYS", neutral: "DUE_SOON_DAYS", owner: "frontend-platform", validationCommand: "vitest run src/lib/business-dates-drift.test.ts src/lib/hardening.test.ts" },
  { legacy: "V10RecoverableState", neutral: "RecoverableState", owner: "frontend-platform", validationCommand: "vitest run src/components/ui/recoverable-state.test.tsx" },
  { legacy: "V5SignalQualityDisplayRow", neutral: "SignalQualityDisplayRow", owner: "decision-intelligence", validationCommand: "vitest run src/lib/decision-intelligence/signal-quality-labels.test.ts" },
  { legacy: "V6OrgSettingsJson", neutral: "OrgSettingsJson", owner: "product-surface", validationCommand: "vitest run src/lib/assurance/org-settings.test.ts" },
  { legacy: "getV6OrgSettingsJson", neutral: "getOrgSettingsJson", owner: "product-surface", validationCommand: "vitest run src/lib/assurance/org-settings.test.ts" },
  { legacy: "mergeV6OrgSettingsJson", neutral: "mergeOrgSettingsJson", owner: "product-surface", validationCommand: "vitest run src/lib/assurance/org-settings.test.ts" },
  { legacy: "V8EligibilityDenialClass", neutral: "EligibilityDenialClass", owner: "product-surface", validationCommand: "vitest run src/lib/product-surface/denial-class-reachability.test.ts" },
  { legacy: "V8SurfaceType", neutral: "SurfaceType", owner: "product-surface", validationCommand: "vitest run src/lib/product-surface/page-inventory-coverage.test.ts" },
  { legacy: "V8SurfaceMapping", neutral: "SurfaceMapping", owner: "product-surface", validationCommand: "vitest run src/lib/product-surface/page-inventory-coverage.test.ts" },
  { legacy: "V8ExemptSurfaceClass", neutral: "ExemptSurfaceClass", owner: "product-surface", validationCommand: "vitest run src/lib/product-surface/exempt-surfaces-exemplars.test.ts" },
  { legacy: "V8ExemptSurfaceRule", neutral: "ExemptSurfaceRule", owner: "product-surface", validationCommand: "vitest run src/lib/product-surface/exempt-surfaces-exemplars.test.ts" },
  { legacy: "V8FeatureDiscoverability", neutral: "FeatureDiscoverabilityPolicy", owner: "product-surface", validationCommand: "vitest run src/lib/product-surface/refinement-contract.test.ts" },
  { legacy: "V8AdminRevealPolicy", neutral: "AdminRevealPolicy", owner: "product-surface", validationCommand: "vitest run src/lib/product-surface/refinement-contract.test.ts" },
  { legacy: "v8DiscoverabilityForFeature", neutral: "discoverabilityForFeature", owner: "product-surface", validationCommand: "vitest run src/lib/product-surface/refinement-contract.test.ts" },
  { legacy: "v8AdminRevealPolicyForFeature", neutral: "adminRevealPolicyForFeature", owner: "product-surface", validationCommand: "vitest run src/lib/product-surface/refinement-contract.test.ts" },
  { legacy: "v8DenialStatusMatrix", neutral: "denialStatusMatrix", owner: "product-surface", validationCommand: "vitest run src/lib/product-surface/denial-status.test.ts" },
  { legacy: "allV8ExemptSurfaceRules", neutral: "allExemptSurfaceRules", owner: "product-surface", validationCommand: "vitest run src/lib/product-surface/exempt-surfaces-exemplars.test.ts" },
  { legacy: "v8GovernedPageRootPrefixes", neutral: "governedPageRootPrefixes", owner: "product-surface", validationCommand: "vitest run src/lib/product-surface/page-inventory-coverage.test.ts" },
];

export const CONTENT_CONTRACT_ALIASES = [
  {
    legacy: "NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS",
    neutral: "NEXT_PUBLIC_SUPPORT_DIAGNOSTICS",
    owner: "frontend-platform",
    surface: "public_env_key",
    status: "awaiting_production_cutover",
    validationCommand: "vitest run src/components/ui/recoverable-state.test.tsx",
    reason: "Diagnostics public env key is browser-visible and needs a compatibility window before the legacy key can be removed.",
    earliestRemovalCondition: "Examples, CI, deployed environments, and support runbooks use NEXT_PUBLIC_SUPPORT_DIAGNOSTICS.",
    manualFollowUp: "Confirm deployed config and support runbooks use the neutral key before removing the legacy fallback.",
  },
  {
    legacy: "NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS",
    neutral: "NEXT_PUBLIC_INLINE_QUEUE_ACTIONS",
    owner: "frontend-platform",
    surface: "public_env_key",
    status: "awaiting_production_cutover",
    validationCommand: "vitest run src/lib/rollout-inline-queue-kill-switch.test.ts",
    reason: "Inline queue rollout env key is browser-visible and may be configured outside the repository.",
    earliestRemovalCondition: "All deployed environments and runbooks use NEXT_PUBLIC_INLINE_QUEUE_ACTIONS and rollout inventory is updated.",
    manualFollowUp: "Validate deployed config before removing the legacy key fallback.",
  },
];

function readJson(abs, fallback = null) {
  return fs.existsSync(abs) ? JSON.parse(fs.readFileSync(abs, "utf8")) : fallback;
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sortRows(rows) {
  return rows.sort(
    (a, b) =>
      String(a.legacyName ?? "").localeCompare(String(b.legacyName ?? "")) ||
      String(a.surface ?? "").localeCompare(String(b.surface ?? "")) ||
      String(a.sourcePath ?? "").localeCompare(String(b.sourcePath ?? "")) ||
      String(a.neutralAlias ?? "").localeCompare(String(b.neutralAlias ?? "")),
  );
}

function dedupeRows(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.surface ?? ""}\0${row.sourcePath ?? ""}\0${row.legacyName ?? ""}\0${row.neutralAlias ?? ""}`;
    if (!byKey.has(key)) byKey.set(key, row);
  }
  return sortRows(Array.from(byKey.values()));
}

function followUps(label) {
  return {
    productionSchedulerFollowUp: `No scheduler change is authorized by this ${label} queue entry.`,
    providerDashboardFollowUp: `No provider dashboard change is authorized by this ${label} queue entry.`,
    analyticsDashboardFollowUp: `Update analytics dashboards only if they explicitly inspect this ${label}.`,
    sqlObjectFollowUp: `No SQL object change is authorized by this ${label} queue entry.`,
  };
}

const READINESS_EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  "artifacts",
  "blob-report",
  "coverage",
  "docs",
  "node_modules",
  "playwright-report",
  "test-results",
]);

const READINESS_TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function walkReadinessFiles(root, dir = root, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (READINESS_EXCLUDED_DIRS.has(entry.name)) continue;
      walkReadinessFiles(root, path.join(dir, entry.name), acc);
      continue;
    }
    if (!entry.isFile()) continue;
    const abs = path.join(dir, entry.name);
    const rel = toPosix(path.relative(root, abs));
    if (rel === "package.json" || rel === DEFAULT_ARTIFACT_REL) continue;
    if (READINESS_TEXT_EXTENSIONS.has(path.extname(entry.name))) acc.push(rel);
  }
  return acc;
}

function packageScriptExternalReferences(root, scriptName) {
  const references = [];
  for (const rel of walkReadinessFiles(root)) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    if (text.includes(scriptName)) references.push(rel);
  }
  return references.sort((a, b) => a.localeCompare(b));
}

function readinessRowsByLegacy(root) {
  const artifact = readJson(path.join(root, PACKAGE_SCRIPT_READINESS_REL), null);
  return new Map((artifact?.aliases ?? []).map((row) => [row.legacyName, row]));
}

function packageScriptReadinessFallback(root, alias) {
  const externalReferences = packageScriptExternalReferences(root, alias.legacy);
  const repoLocalReferenceCount = externalReferences.length;
  return {
    status: "alias_added",
    readinessStatus: repoLocalReferenceCount > 0 ? "blocked_by_repo_local_references" : "blocked_by_manual_follow_up",
    readinessBlocker:
      repoLocalReferenceCount > 0
        ? `${repoLocalReferenceCount} repo-local reference(s) still point at the legacy package script.`
        : "No repo-local blocking references remain, but external branch protection, runbooks, and manual compatibility evidence have not approved removal.",
    localReadyForRemoval: repoLocalReferenceCount === 0,
    referenceCount: externalReferences.length,
    blockingReferenceCount: externalReferences.length,
    repoLocalReferenceCount,
    docsOnlyReferenceCount: 0,
    generatedArtifactReferenceCount: 0,
    externalOrManualReferenceCount: 0,
    blockerCategoryCounts: {
      docs_only: 0,
      external_or_manual: 0,
      generated_artifact: 0,
      ready_for_removal: 0,
      repo_local: repoLocalReferenceCount,
    },
    blockingReferences: externalReferences.map((referencePath) => ({
      path: referencePath,
      class: referencePath.startsWith(".github/") || referencePath.startsWith("config/") ? "ci_or_config" : "tooling",
      blockerCategory: "repo_local",
    })),
  };
}

function packageScriptRows(pkg, root = DEFAULT_ROOT) {
  const scripts = pkg?.scripts ?? {};
  const readinessByLegacy = readinessRowsByLegacy(root);
  return PACKAGE_SCRIPT_ALIASES.map((alias) => {
    const readiness = readinessByLegacy.get(alias.legacy) ?? packageScriptReadinessFallback(root, alias);
    const readyForRemoval = readiness.status === "ready_for_removal" && (readiness.repoLocalReferenceCount ?? 0) === 0;
    return {
      surface: "package_script",
      legacyName: alias.legacy,
      neutralAlias: alias.neutral,
      owner: "platform-hardening",
      reason: "Retain version-numbered package script while callers migrate to the neutral command.",
      status: readyForRemoval ? "ready_for_removal" : "alias_added",
      validationCommand: `npm run ${alias.neutral}`,
      validationCommands: {
        legacy: `npm run ${alias.legacy}`,
        neutral: `npm run ${alias.neutral}`,
      },
      earliestRemovalCondition:
        "Neutral script is used by CI, documentation, release evidence, and developer runbooks; package-script consumers have had a compatibility window.",
      manualFollowUp: "Remove the legacy script only after CI, docs, and external references use the neutral alias.",
      productionSchedulerFollowUp: "No scheduler change is authorized by this package-script alias entry.",
      providerDashboardFollowUp: "No provider dashboard change is authorized by this package-script alias entry.",
      analyticsDashboardFollowUp: "No analytics dashboard change is authorized by this package-script alias entry.",
      sqlObjectFollowUp: "No SQL object change is authorized by this package-script alias entry.",
      legacyCommand: scripts[alias.legacy] ?? null,
      neutralCommand: scripts[alias.neutral] ?? null,
      externalReferenceCount: readiness.blockingReferenceCount ?? readiness.repoLocalReferenceCount ?? 0,
      externalReferences: (readiness.blockingReferences ?? []).map((row) => row.path).slice(0, 20),
      readinessArtifactPath: fs.existsSync(path.join(root, PACKAGE_SCRIPT_READINESS_REL)) ? PACKAGE_SCRIPT_READINESS_REL : null,
      readinessStatus: readiness.readinessStatus ?? (readyForRemoval ? "ready_for_removal" : "blocked_by_manual_follow_up"),
      readinessBlocker:
        readiness.readinessBlocker ??
        (readyForRemoval
          ? "Readiness artifact reports this alias is ready for removal."
          : "Readiness artifact is missing; removal stays blocked by manual follow-up."),
      readinessRule:
        "ready_for_removal only when the package-script readiness artifact reports ready_for_removal and no non-doc repo-local references remain.",
      localReadyForRemoval: Boolean(readiness.localReadyForRemoval),
      repoLocalReferenceCount: readiness.repoLocalReferenceCount ?? 0,
      docsOnlyReferenceCount: readiness.docsOnlyReferenceCount ?? 0,
      generatedArtifactReferenceCount: readiness.generatedArtifactReferenceCount ?? 0,
      externalOrManualReferenceCount: readiness.externalOrManualReferenceCount ?? 0,
      blockerCategoryCounts:
        readiness.blockerCategoryCounts ?? {
          docs_only: readiness.docsOnlyReferenceCount ?? 0,
          external_or_manual: readiness.externalOrManualReferenceCount ?? 0,
          generated_artifact: readiness.generatedArtifactReferenceCount ?? 0,
          ready_for_removal: 0,
          repo_local: readiness.repoLocalReferenceCount ?? 0,
        },
      aliasDirection:
        scripts[alias.legacy] === `npm run ${alias.neutral}`
          ? "legacy_to_neutral"
          : scripts[alias.neutral] === `npm run ${alias.legacy}`
            ? "neutral_to_legacy"
            : "direct_or_mixed",
    };
  }).sort((a, b) => a.legacyName.localeCompare(b.legacyName));
}

function envKeyRows() {
  return ENV_KEY_ALIASES.map((alias) => ({
    surface: "environment_key",
    legacyName: alias.legacy,
    neutralAlias: alias.neutral,
    owner: alias.owner,
    reason: alias.reason,
    status: "alias_added",
    validationCommand: alias.validationCommand,
    validationCommands: {
      legacy: alias.validationCommand,
      neutral: alias.validationCommand,
    },
    earliestRemovalCondition: alias.earliestRemovalCondition,
    manualFollowUp: alias.manualFollowUp,
    productionSchedulerFollowUp: "No scheduler change is authorized by this env-key queue entry.",
    providerDashboardFollowUp: "No provider dashboard change is authorized by this env-key queue entry.",
    analyticsDashboardFollowUp: "No analytics dashboard change is authorized by this env-key queue entry.",
    sqlObjectFollowUp: "No SQL object change is authorized by this env-key queue entry.",
  })).sort((a, b) => a.legacyName.localeCompare(b.legacyName));
}

function exportedSymbolRows(root) {
  const curated = EXPORTED_SYMBOL_ALIASES.map((alias) => ({
    surface: "exported_symbol_alias",
    legacyName: alias.legacy,
    neutralAlias: alias.neutral,
    owner: alias.owner,
    reason: "Retain deprecated exported symbol alias while source callers migrate to the neutral export.",
    status: "alias_added",
    validationCommand: alias.validationCommand,
    validationCommands: {
      legacy: alias.validationCommand,
      neutral: alias.validationCommand,
    },
    earliestRemovalCondition:
      "All internal imports use the neutral export, downstream packages have had a compatibility window, and check:versioned-exported-symbols remains green.",
    manualFollowUp: "Remove the legacy exported alias only after code search and release evidence show no remaining consumers.",
    productionSchedulerFollowUp: "No scheduler change is authorized by this exported-symbol queue entry.",
    providerDashboardFollowUp: "No provider dashboard change is authorized by this exported-symbol queue entry.",
    analyticsDashboardFollowUp: "No analytics dashboard change is authorized by this exported-symbol queue entry.",
    sqlObjectFollowUp: "No SQL object change is authorized by this exported-symbol queue entry.",
  }));
  const inventory = readJson(path.join(root, EXPORTED_SYMBOL_INVENTORY_REL), { symbols: [] });
  const generated = (inventory.symbols ?? [])
    .filter((row) => row.compatibilityAction === "alias_added")
    .map((row) => ({
      surface: "exported_symbol_alias",
      legacyName: row.exportedName,
      neutralAlias: row.suggestedNeutralName,
      owner: row.owner,
      reason: "Retain deprecated exported symbol alias while source callers migrate to the neutral export.",
      status: "alias_added",
      validationCommand: row.validationCommand || "npm run check:versioned-exported-symbols",
      validationCommands: {
        legacy: row.validationCommand || "npm run check:versioned-exported-symbols",
        neutral: row.validationCommand || "npm run check:versioned-exported-symbols",
      },
      earliestRemovalCondition:
        "All internal imports use the neutral export, downstream packages have had a compatibility window, and check:versioned-exported-symbols remains green.",
      manualFollowUp: "Remove the legacy exported alias only after code search and release evidence show no remaining consumers.",
      ...followUps("exported-symbol"),
      sourcePath: row.path,
      exportKind: row.exportKind ?? null,
      declarationKind: row.declarationKind ?? null,
      typeOnly: Boolean(row.typeOnly),
    }));
  return dedupeRows([...curated, ...generated]);
}

function contentContractStatus(row) {
  if (row.surfaceClass === "telemetry_event") return "awaiting_analytics_dashboard_cutover";
  if (row.surfaceClass === "sql_object") return "awaiting_linked_verification";
  if (row.manualOnly) return "awaiting_production_cutover";
  if (!row.suggestedNeutralName) return "awaiting_production_cutover";
  return "alias_added";
}

function includeContentContractRow(row) {
  if (!row || row.surfaceClass === "documentation_contract" || row.surfaceClass === "source_content") return false;
  if (typeof row.path === "string" && row.path.startsWith("docs/")) return false;
  return true;
}

function contentContractRows(root) {
  const curated = CONTENT_CONTRACT_ALIASES.map((alias) => ({
    surface: alias.surface,
    legacyName: alias.legacy,
    neutralAlias: alias.neutral,
    owner: alias.owner,
    reason: alias.reason,
    status: alias.status,
    validationCommand: alias.validationCommand,
    validationCommands: {
      legacy: alias.validationCommand,
      neutral: alias.validationCommand,
    },
    earliestRemovalCondition: alias.earliestRemovalCondition,
    manualFollowUp: alias.manualFollowUp,
    productionSchedulerFollowUp: "No scheduler change is authorized by this content-contract queue entry.",
    providerDashboardFollowUp: "No provider dashboard change is authorized by this content-contract queue entry.",
    analyticsDashboardFollowUp: "Update dashboards only if they explicitly inspect this contract key.",
    sqlObjectFollowUp: "No SQL object change is authorized by this content-contract queue entry.",
  }));
  const inventory = readJson(path.join(root, CONTENT_CONTRACT_INVENTORY_REL), { contracts: [] });
  const generated = (inventory.contracts ?? [])
    .filter(includeContentContractRow)
    .map((row) => {
      const status = contentContractStatus(row);
      return {
        surface: row.surfaceClass,
        subSurface: row.subSurfaceClass ?? null,
        legacyName: row.contractName,
        neutralAlias: row.suggestedNeutralName ?? null,
        owner: row.owner,
        reason: row.reason,
        status,
        validationCommand: row.validationCommand || "npm run check:versioned-content-contracts",
        validationCommands: {
          legacy: row.validationCommand || "npm run check:versioned-content-contracts",
          neutral: row.validationCommand || "npm run check:versioned-content-contracts",
        },
        earliestRemovalCondition: row.manualOnly
          ? "A neutral alias or compatibility reader exists, external consumers have moved, and manual cutover evidence has been captured."
          : "All repository references use the neutral content contract and check:versioned-content-contracts remains green.",
        manualFollowUp:
          row.manualFollowUp ??
          (row.manualOnly
            ? "Do not remove or rename this compatibility-sensitive contract until production and external consumer cutover is complete."
            : "Remove the legacy content contract only after repo-local references and deterministic inventories no longer require it."),
        ...followUps("content-contract"),
        sourcePath: row.path,
        manualOnly: Boolean(row.manualOnly),
        contractCount: row.count ?? null,
      };
    });
  return dedupeRows([...curated, ...generated]);
}

function versionedPackageScriptKeys(pkg) {
  return Object.keys(pkg?.scripts ?? {})
    .filter((key) => /(^|[:_-])v[0-9]+(?:$|[:_-])/iu.test(key))
    .sort((a, b) => a.localeCompare(b));
}

function telemetryRows(root) {
  const inventory = readJson(path.join(root, TELEMETRY_INVENTORY_REL), { versionedEventRemovalQueue: [] });
  return (inventory.versionedEventRemovalQueue ?? []).map((row) => ({
    surface: "telemetry_event",
    legacyName: row.eventName,
    neutralAlias: row.neutralAlias,
    owner: row.owner,
    reason: row.reason,
    status: "awaiting_analytics_dashboard_cutover",
    validationCommand: row.validationCommand,
    validationCommands: {
      legacy: row.validationCommand,
      neutral: row.validationCommand,
    },
    earliestRemovalCondition: row.earliestRemovalCondition ?? "Dashboards, alerts, exports, and analytics consumers read the neutral alias and no longer depend on the legacy event name.",
    manualFollowUp: row.manualFollowUp,
    productionSchedulerFollowUp: "No scheduler change is authorized by this telemetry queue entry.",
    providerDashboardFollowUp: "No provider dashboard change is authorized by this telemetry queue entry.",
    analyticsDashboardFollowUp: "Migrate analytics dashboards, alerts, exports, and warehouse consumers to the neutral event alias before removal.",
    sqlObjectFollowUp: "No SQL object change is authorized by this telemetry queue entry.",
  }));
}

function routeRows(root, surface) {
  return buildVersionedRouteAliasPlan(root)
    .filter((row) => (surface === "cron_route" ? row.surface === "cron_route" : row.surface === "api_route"))
    .map((row) => ({
      surface,
      legacyName: row.legacyPath,
      neutralAlias: row.neutralPath,
      owner: row.owner,
      reason: row.reason,
      status: "alias_added",
      validationCommand: surface === "cron_route" ? "npm run check:cron-route-auth" : "npm run check:api-route-auth-contract",
      validationCommands: {
        legacy: surface === "cron_route" ? "npm run check:cron-route-auth" : "npm run check:api-route-auth-contract",
        neutral: "npm run check:compatibility-route-inventory",
      },
      earliestRemovalCondition:
        surface === "cron_route"
          ? "Vercel cron schedules and any external callers are manually migrated to the neutral route and compatibility route inventory remains green."
          : "Clients and generated API documentation use the neutral route and compatibility route inventory remains green.",
      manualFollowUp:
        surface === "cron_route"
          ? "Keep Vercel cron schedules unchanged until production scheduler cutover is approved."
          : "Keep the legacy API route callable until client and documentation cutover evidence exists.",
      productionSchedulerFollowUp:
        surface === "cron_route"
          ? "Manually update Vercel cron schedules only after neutral route evidence is captured."
          : "No scheduler change is authorized by this API route queue entry.",
      providerDashboardFollowUp: "No provider dashboard change is authorized by this route queue entry.",
      analyticsDashboardFollowUp: "Update route analytics dashboards only after both old and neutral paths are visible in evidence.",
      sqlObjectFollowUp: "No SQL object change is authorized by this route queue entry.",
      legacyRouteFile: row.legacyRouteFile,
      neutralRouteFile: row.neutralRouteFile,
    }))
    .sort((a, b) => a.legacyName.localeCompare(b.legacyName));
}

function sqlObjectRows(root) {
  const staging = readJson(path.join(root, SQL_RENAME_STAGING_REL), { stagedRenames: [] });
  return (staging.stagedRenames ?? []).map((row) => {
    const aliasAdded = row.status === "alias_added";
    const validationCommand = aliasAdded ? "npm run check:sql-rename-verification-sql" : row.validationCommand;
    return {
      surface: "sql_object",
      legacyName: row.legacyObject,
      neutralAlias: row.newObject,
      owner: row.owner,
      reason: row.reason,
      status: aliasAdded ? "alias_added" : "awaiting_linked_verification",
      validationCommand,
      validationCommands: {
        legacy: row.validationCommand,
        neutral: validationCommand,
      },
      earliestRemovalCondition:
        row.earliestRemovalCondition ??
        "Forward migration adds the neutral object or compatibility view, linked read-only catalog verification passes, and app references are moved.",
      manualFollowUp: row.manualFollowUp,
      productionSchedulerFollowUp: "No scheduler change is authorized by this SQL object queue entry.",
      providerDashboardFollowUp: "No provider dashboard change is authorized by this SQL object queue entry.",
      analyticsDashboardFollowUp: "Update database-observability dashboards after neutral SQL aliases exist and linked read-only checks pass.",
      sqlObjectFollowUp: aliasAdded
        ? "Neutral SQL object alias is staged in a forward migration; validate it, move app references later, and defer legacy removal to a later migration."
        : "Create a forward migration for the neutral SQL object or alias, validate it, then defer legacy removal to a later migration.",
      objectType: row.objectType ?? null,
      dataBearing: row.dataBearing ?? null,
    };
  });
}

function artifactRows(root, rel, rowKey) {
  const artifact = readJson(path.join(root, rel), null);
  const rows = artifact?.[rowKey];
  return Array.isArray(rows) ? rows : [];
}

function exportDownloadRows(root) {
  return artifactRows(root, EXPORT_DOWNLOAD_CONTRACTS_REL, "contracts").map((row) => {
    const neutralAlias = row.suggestedNeutralName ?? null;
    return {
      surface: "export_download_contract",
      subSurface: row.subSurfaceClass ?? null,
      legacyName: row.contractName,
      neutralAlias,
      owner: row.owner,
      reason: row.reason,
      status: !neutralAlias || row.manualOnly ? "awaiting_production_cutover" : "alias_added",
      validationCommand: row.validationCommand,
      validationCommands: {
        legacy: row.validationCommand,
        neutral: row.validationCommand,
      },
      earliestRemovalCondition:
        "Neutral filename/header/metadata builders are emitted, downstream importers and signed-link consumers have migrated, and export/download checks remain green.",
      manualFollowUp: row.manualFollowUp,
      ...followUps("export-download"),
      sourcePath: row.path,
      category: row.category,
      manualOnly: Boolean(row.manualOnly),
    };
  });
}

function sqlSecurityAutomationRows(root) {
  return artifactRows(root, SQL_SECURITY_AUTOMATION_REL, "rows").map((row) => ({
    surface: "sql_security_automation",
    subSurface: row.kind ?? null,
    legacyName: row.legacyName,
    neutralAlias: row.neutralAlias ?? null,
    owner: row.owner,
    reason: row.reason,
    status: "awaiting_linked_verification",
    validationCommand: row.validationCommand,
    validationCommands: {
      legacy: row.validationCommand,
      neutral: row.validationCommand,
    },
    earliestRemovalCondition:
      "Forward SQL aliases or neutral policies exist, linked read-only verification passes, and RLS/grant/realtime checks prove no widened access.",
    manualFollowUp: row.manualFollowUp,
    productionSchedulerFollowUp: "No scheduler change is authorized by this SQL security queue entry.",
    providerDashboardFollowUp: "No provider dashboard change is authorized by this SQL security queue entry.",
    analyticsDashboardFollowUp: "Update database-observability dashboards after neutral SQL security objects exist and linked read-only checks pass.",
    sqlObjectFollowUp: "Create and verify forward SQL aliases or neutral policy/helper names before moving app references or removing legacy SQL security objects.",
    sourcePath: row.sourcePath,
    objectType: row.objectType ?? row.kind ?? null,
  }));
}

function migrationHistoryRows(root) {
  return artifactRows(root, MIGRATION_HISTORY_EXCEPTIONS_REL, "exceptions").map((row) => ({
    surface: "migration_history_filename",
    legacyName: row.migrationFile,
    neutralAlias: null,
    owner: row.owner,
    reason: row.reason,
    status: "awaiting_linked_verification",
    validationCommand: row.validationCommand,
    validationCommands: {
      legacy: row.validationCommand,
      neutral: row.validationCommand,
    },
    earliestRemovalCondition:
      "Only an explicit migration-ledger reconciliation or squash project can replace historical migration filenames.",
    manualFollowUp: row.manualFollowUp,
    productionSchedulerFollowUp: "No scheduler change is authorized by this migration-history queue entry.",
    providerDashboardFollowUp: "No provider dashboard change is authorized by this migration-history queue entry.",
    analyticsDashboardFollowUp: "No analytics dashboard change is authorized by this migration-history queue entry.",
    sqlObjectFollowUp: "Do not rename historical migration files in a code-only pass; keep production ledger evidence intact.",
    migrationPath: row.path,
    tokens: row.tokens,
  }));
}

function seedVersionedRows(root) {
  return artifactRows(root, SEED_VERSIONED_QUEUE_COVERAGE_REL, "rows").map((row) => ({
    surface: "seed_versioned_name",
    subSurface: row.subSurfaceClass ?? null,
    legacyName: row.contractName,
    neutralAlias: row.suggestedNeutralName ?? null,
    owner: row.owner,
    reason: row.reason,
    status: row.manualOnly ? "awaiting_production_cutover" : "alias_added",
    validationCommand: row.validationCommand,
    validationCommands: {
      legacy: row.validationCommand,
      neutral: row.validationCommand,
    },
    earliestRemovalCondition:
      "Runtime readers support neutral seed/schema keys, production-compatible schema aliases exist, and seed safety checks remain green.",
    manualFollowUp: row.manualFollowUp,
    ...followUps("seed-versioned-name"),
    sourcePath: row.path,
    manualOnly: Boolean(row.manualOnly),
  }));
}

export function buildCompatibilityRemovalQueue(root = DEFAULT_ROOT) {
  const pkg = readJson(path.join(root, "package.json"), { scripts: {} });
  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-compatibility-removal-queue.mjs --write",
    statusVocabulary: STATUS_VOCABULARY,
    queues: {
      packageScriptAliases: packageScriptRows(pkg, root),
      telemetryEventNames: telemetryRows(root),
      apiRoutes: routeRows(root, "api_route"),
      cronRoutes: routeRows(root, "cron_route"),
      webhookRoutes: [],
      environmentKeys: envKeyRows(),
      exportedSymbolAliases: exportedSymbolRows(root),
      contentContractAliases: contentContractRows(root),
      sqlObjects: sqlObjectRows(root),
      exportDownloadContracts: exportDownloadRows(root),
      sqlSecurityAutomation: sqlSecurityAutomationRows(root),
      migrationHistoryFilenames: migrationHistoryRows(root),
      seedVersionedNames: seedVersionedRows(root),
    },
    manualBoundaries: [
      "Do not remove compatibility-sensitive legacy names in the same change that creates an alias.",
      "Provider dashboards, scheduled jobs, external analytics, and production SQL objects require manual cutover evidence.",
    ],
  };
}

function validateRow(row, issues, pathPrefix, root = DEFAULT_ROOT) {
  for (const key of [
    "legacyName",
    "owner",
    "reason",
    "status",
    "validationCommand",
    "earliestRemovalCondition",
    "manualFollowUp",
    "productionSchedulerFollowUp",
    "providerDashboardFollowUp",
    "analyticsDashboardFollowUp",
    "sqlObjectFollowUp",
  ]) {
    if (typeof row[key] !== "string" || row[key].trim() === "") {
      issues.push({ issue: "compatibility_removal_queue_missing_metadata", path: pathPrefix, key, legacyName: row.legacyName ?? null });
    }
  }
  if (!("neutralAlias" in row)) {
    issues.push({ issue: "compatibility_removal_queue_missing_neutral_alias_field", path: pathPrefix, legacyName: row.legacyName ?? null });
  }
  if (!row.validationCommands || typeof row.validationCommands.legacy !== "string" || typeof row.validationCommands.neutral !== "string") {
    issues.push({ issue: "compatibility_removal_queue_missing_dual_validation_commands", path: pathPrefix, legacyName: row.legacyName ?? null });
  }
  if (row.status === "alias_added" && (typeof row.neutralAlias !== "string" || row.neutralAlias.trim() === "")) {
    issues.push({ issue: "compatibility_removal_queue_alias_missing_neutral_name", path: pathPrefix, legacyName: row.legacyName ?? null });
  }
  if (!STATUS_VOCABULARY.includes(row.status)) {
    issues.push({ issue: "compatibility_removal_queue_unknown_status", path: pathPrefix, legacyName: row.legacyName ?? null, status: row.status ?? null });
  }
  if (row.surface === "package_script") {
    for (const key of ["readinessStatus", "readinessBlocker", "readinessRule"]) {
      if (typeof row[key] !== "string" || row[key].trim() === "") {
        issues.push({ issue: "compatibility_package_readiness_missing_metadata", path: pathPrefix, key, legacyName: row.legacyName ?? null });
      }
    }
    for (const key of [
      "repoLocalReferenceCount",
      "docsOnlyReferenceCount",
      "generatedArtifactReferenceCount",
      "externalOrManualReferenceCount",
      "externalReferenceCount",
    ]) {
      if (typeof row[key] !== "number") {
        issues.push({ issue: "compatibility_package_readiness_missing_count", path: pathPrefix, key, legacyName: row.legacyName ?? null });
      }
    }
    for (const category of ["repo_local", "docs_only", "generated_artifact", "external_or_manual"]) {
      if (typeof row.blockerCategoryCounts?.[category] !== "number") {
        issues.push({ issue: "compatibility_package_readiness_missing_blocker_category", path: pathPrefix, category, legacyName: row.legacyName ?? null });
      }
    }
    if (row.status === "ready_for_removal" && row.readinessStatus !== "ready_for_removal") {
      issues.push({ issue: "compatibility_package_readiness_status_mismatch", path: pathPrefix, legacyName: row.legacyName ?? null });
    }
    if (row.status !== "ready_for_removal" && row.readinessStatus === "ready_for_removal") {
      issues.push({ issue: "compatibility_package_readiness_status_mismatch", path: pathPrefix, legacyName: row.legacyName ?? null });
    }
    if (row.readinessStatus === "ready_for_removal" && row.repoLocalReferenceCount > 0) {
      issues.push({
        issue: "compatibility_package_ready_with_repo_local_references",
        path: pathPrefix,
        legacyName: row.legacyName ?? null,
        repoLocalReferenceCount: row.repoLocalReferenceCount,
      });
    }
    if (row.status === "ready_for_removal" && row.repoLocalReferenceCount > 0) {
      issues.push({
        issue: "compatibility_package_ready_with_repo_local_references",
        path: pathPrefix,
        legacyName: row.legacyName ?? null,
        repoLocalReferenceCount: row.repoLocalReferenceCount,
      });
    }
    if (row.status === "ready_for_removal" && row.externalOrManualReferenceCount > 0) {
      issues.push({
        issue: "compatibility_package_ready_with_external_or_manual_references",
        path: pathPrefix,
        legacyName: row.legacyName ?? null,
        externalOrManualReferenceCount: row.externalOrManualReferenceCount,
      });
    }
  }
  if (typeof row.sourcePath === "string" && row.sourcePath.trim() !== "") {
    if (row.sourcePath.startsWith("docs/")) {
      issues.push({ issue: "compatibility_removal_queue_uses_docs_as_config", path: pathPrefix, legacyName: row.legacyName ?? null, sourcePath: row.sourcePath });
    }
    if (!fs.existsSync(path.join(root, row.sourcePath))) {
      issues.push({ issue: "compatibility_removal_queue_stale_source_path", path: pathPrefix, legacyName: row.legacyName ?? null, sourcePath: row.sourcePath });
    } else if (typeof row.legacyName === "string" && row.legacyName.trim() !== "") {
      const text = fs.readFileSync(path.join(root, row.sourcePath), "utf8");
      if (!text.includes(row.legacyName)) {
        issues.push({
          issue: "compatibility_removal_queue_old_name_missing",
          path: pathPrefix,
          legacyName: row.legacyName,
          sourcePath: row.sourcePath,
        });
      }
    }
  }
}

export function analyzeCompatibilityRemovalQueue(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildCompatibilityRemovalQueue(root);
  const issues = [];

  for (const [groupName, rows] of Object.entries(current.queues)) {
    rows.forEach((row, index) => validateRow(row, issues, `/queues/${groupName}/${index}`, root));
  }

  const pkg = readJson(path.join(root, "package.json"), { scripts: {} });
  const queuedLegacyScripts = new Set(PACKAGE_SCRIPT_ALIASES.map((alias) => alias.legacy));
  for (const scriptName of versionedPackageScriptKeys(pkg)) {
    if (!queuedLegacyScripts.has(scriptName)) {
      issues.push({ issue: "compatibility_package_versioned_script_missing_queue_entry", script: scriptName });
    }
  }
  for (const alias of PACKAGE_SCRIPT_ALIASES) {
    if (!pkg.scripts?.[alias.legacy]) {
      issues.push({ issue: "compatibility_package_legacy_script_missing", script: alias.legacy });
    }
    if (!pkg.scripts?.[alias.neutral]) {
      issues.push({ issue: "compatibility_package_neutral_script_missing", script: alias.neutral });
    }
    if (pkg.scripts?.[alias.neutral] !== `npm run ${alias.legacy}` && pkg.scripts?.[alias.legacy] !== `npm run ${alias.neutral}`) {
      issues.push({
        issue: "compatibility_package_alias_bridge_missing",
        legacy: alias.legacy,
        neutral: alias.neutral,
        expectedLegacyCommand: `npm run ${alias.neutral}`,
        expectedNeutralCommand: `npm run ${alias.legacy}`,
      });
    }
  }

  const artifactPath = path.join(root, artifactRel);
  const committed = readJson(artifactPath, null);
  if (!committed) {
    issues.push({ issue: "compatibility_removal_queue_missing", path: artifactRel });
  } else if (stableStringify(committed) !== stableStringify(current)) {
    issues.push({ issue: "compatibility_removal_queue_drift", path: artifactRel, hint: "Run npm run write:compatibility-removal-queue" });
  }

  const contentSurfaceCoverage = readJson(path.join(root, CONTENT_SURFACE_COVERAGE_REL), null);
  if (!contentSurfaceCoverage) {
    issues.push({ issue: "compatibility_removal_queue_missing_content_surface_coverage", path: CONTENT_SURFACE_COVERAGE_REL });
  } else {
    if ((contentSurfaceCoverage.uncoveredManualCount ?? 0) > 0) {
      issues.push({
        issue: "compatibility_removal_queue_uncovered_manual_content_rows",
        path: CONTENT_SURFACE_COVERAGE_REL,
        uncoveredManualCount: contentSurfaceCoverage.uncoveredManualCount,
      });
    }
    if ((contentSurfaceCoverage.remainingSafeActionCount ?? 0) > 0) {
      issues.push({
        issue: "compatibility_removal_queue_safe_content_actions_remaining",
        path: CONTENT_SURFACE_COVERAGE_REL,
        remainingSafeActionCount: contentSurfaceCoverage.remainingSafeActionCount,
      });
    }
  }

  const manualClosure = readJson(path.join(root, MANUAL_SURFACE_CLOSURE_REL), null);
  if (!manualClosure) {
    issues.push({ issue: "compatibility_removal_queue_missing_manual_surface_closure", path: MANUAL_SURFACE_CLOSURE_REL });
  } else {
    if ((manualClosure.uncoveredManualCount ?? 0) > 0) {
      issues.push({
        issue: "compatibility_removal_queue_manual_surface_uncovered_rows",
        path: MANUAL_SURFACE_CLOSURE_REL,
        uncoveredManualCount: manualClosure.uncoveredManualCount,
      });
    }
    if ((manualClosure.remainingSafeActionCount ?? 0) > 0) {
      issues.push({
        issue: "compatibility_removal_queue_manual_surface_safe_actions_remaining",
        path: MANUAL_SURFACE_CLOSURE_REL,
        remainingSafeActionCount: manualClosure.remainingSafeActionCount,
      });
    }
  }

  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    packageScriptAliasCount: current.queues.packageScriptAliases.length,
    telemetryEventQueueCount: current.queues.telemetryEventNames.length,
    apiRouteQueueCount: current.queues.apiRoutes.length,
    cronRouteQueueCount: current.queues.cronRoutes.length,
    environmentKeyQueueCount: current.queues.environmentKeys.length,
    exportedSymbolAliasQueueCount: current.queues.exportedSymbolAliases.length,
    contentContractAliasQueueCount: current.queues.contentContractAliases.length,
    sqlObjectQueueCount: current.queues.sqlObjects.length,
    exportDownloadContractQueueCount: current.queues.exportDownloadContracts.length,
    sqlSecurityAutomationQueueCount: current.queues.sqlSecurityAutomation.length,
    migrationHistoryFilenameQueueCount: current.queues.migrationHistoryFilenames.length,
    seedVersionedNameQueueCount: current.queues.seedVersionedNames.length,
    issueCount: issues.length,
    issues,
    current,
  };
}

function writeArtifact(root, artifactRel) {
  const artifact = buildCompatibilityRemovalQueue(root);
  const out = path.join(root, artifactRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stableStringify(artifact));
  return artifact;
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, artifactRel: DEFAULT_ARTIFACT_REL, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--artifact") {
      options.artifactRel = argv[index + 1] ?? DEFAULT_ARTIFACT_REL;
      index += 1;
    } else if (arg.startsWith("--artifact=")) {
      options.artifactRel = arg.slice("--artifact=".length);
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runCompatibilityRemovalQueue(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = writeArtifact(options.root, options.artifactRel);
    console.log(
      JSON.stringify(
        {
          ok: true,
          wrote: options.artifactRel,
          packageScriptAliasCount: artifact.queues.packageScriptAliases.length,
          telemetryEventQueueCount: artifact.queues.telemetryEventNames.length,
          apiRouteQueueCount: artifact.queues.apiRoutes.length,
          cronRouteQueueCount: artifact.queues.cronRoutes.length,
          environmentKeyQueueCount: artifact.queues.environmentKeys.length,
          exportedSymbolAliasQueueCount: artifact.queues.exportedSymbolAliases.length,
          contentContractAliasQueueCount: artifact.queues.contentContractAliases.length,
          sqlObjectQueueCount: artifact.queues.sqlObjects.length,
          exportDownloadContractQueueCount: artifact.queues.exportDownloadContracts.length,
          sqlSecurityAutomationQueueCount: artifact.queues.sqlSecurityAutomation.length,
          migrationHistoryFilenameQueueCount: artifact.queues.migrationHistoryFilenames.length,
          seedVersionedNameQueueCount: artifact.queues.seedVersionedNames.length,
        },
        null,
        2,
      ),
    );
    return artifact;
  }
  const report = analyzeCompatibilityRemovalQueue(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCompatibilityRemovalQueue();
}
