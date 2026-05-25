#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { governanceForVersionedNamingPath } from "./check-versioned-naming.mjs";
import { runVersionedNamingCleanupReport } from "./report-versioned-naming-cleanup.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_BASELINE = path.join(__dirname, "versioned-naming-baseline.json");
const DEFAULT_MANIFEST_REL = "artifacts/compatibility/versioned-naming-safe-rename-manifest.json";

function stripKnownExtension(rel) {
  return rel.replace(/\.(?:[cm]?js|[cm]?jsx|[cm]?ts|[cm]?tsx|mjs|json)$/u, "");
}

function uniqueRewrites(rewrites) {
  const seen = new Set();
  const out = [];
  for (const rewrite of rewrites) {
    if (!rewrite?.from || !rewrite?.to || rewrite.from === rewrite.to) continue;
    const key = `${rewrite.from}\0${rewrite.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rewrite);
  }
  return out;
}

function referenceRewritesForPath(from, to, extra = []) {
  const fromNoExt = stripKnownExtension(from);
  const toNoExt = stripKnownExtension(to);
  const rewrites = [
    { from, to },
    { from: fromNoExt, to: toNoExt },
  ];

  if (fromNoExt.startsWith("src/") && toNoExt.startsWith("src/")) {
    rewrites.push({
      from: `@/${fromNoExt.slice("src/".length)}`,
      to: `@/${toNoExt.slice("src/".length)}`,
    });
  }

  if (path.posix.dirname(fromNoExt) === path.posix.dirname(toNoExt)) {
    rewrites.push({
      from: `./${path.posix.basename(fromNoExt)}`,
      to: `./${path.posix.basename(toNoExt)}`,
    });
  }

  if (from.startsWith("scripts/") && to.startsWith("scripts/")) {
    rewrites.push(
      { from: path.posix.basename(from), to: path.posix.basename(to) },
      { from: path.posix.basename(fromNoExt), to: path.posix.basename(toNoExt) },
    );
  }

  return uniqueRewrites([...rewrites, ...extra]);
}

function pathRename(from, to, extraRewrites = []) {
  return {
    from,
    to,
    referenceRewrites: referenceRewritesForPath(from, to, extraRewrites),
  };
}

const LOCAL_V10_LIBRARY_STEMS = [
  "acceptance-gates-and-promotable.v10.test",
  "acceptance-matrix",
  "acceptance-matrix.v10.test",
  "activation-state",
  "advanced-assurance-continuity",
  "api-client",
  "api-client.v10.test",
  "approval-exception",
  "autonomous-coverage",
  "autonomous-coverage.v10.test",
  "complete-closure",
  "complete-closure.v10.test",
  "continuity.v10.test",
  "contract-health",
  "core-workflow-contracts",
  "core-workflow-contracts.v10.test",
  "coverage-doctrine",
  "coverage-doctrine.v10.test",
  "data-contracts.v10.test",
  "domain-depth-contracts",
  "domain-depth-contracts.v10.test",
  "enum-work-item-coverage.v10.test",
  "evidence-collaboration",
  "evidence-collaboration.v10.test",
  "field-provenance",
  "final-gap-audit",
  "final-gap-audit.v10.test",
  "governance",
  "hardening-contracts",
  "hardening-contracts.v10.test",
  "human-external-evidence.v10.test",
  "implementation-checklist",
  "implementation-checklist.v10.test",
  "job-retry",
  "job-retry.v10.test",
  "job-routing",
  "job-routing.v10.test",
  "job-visibility",
  "job-visibility.v10.test",
  "mutation-envelope",
  "mutation-envelope.v10.test",
  "mutation-rollout",
  "mutation-rollout.v10.test",
  "no-exclusions-matrix",
  "no-exclusions-matrix.v10.test",
  "objective-measurements",
  "objective-measurements.v10.test",
  "objective-telemetry.v10.test",
  "operational-contracts",
  "operational-contracts.v10.test",
  "p0-p1-implementation-artifacts.v10.test",
  "p2-branch-scope.v10.test",
  "per-db-index-migration.v10.test",
  "performance-budget-contract.v10.test",
  "phase11-human-ops.v10.test",
  "plan-completion-harness.v10.test",
  "program-plan-gates.v10.test",
  "promotability",
  "promotability.v10.test",
  "rc-metrics-capture-path.v10.test",
  "read-model-refresh",
  "read-model-refresh.v10.test",
  "read-models",
  "readiness-scorecard",
  "readiness-scorecard.v10.test",
  "release-contract",
  "release-contract.v10.test",
  "release-evidence",
  "release-evidence.v10.test",
  "renewal-posture",
  "report-export",
  "report-export.v10.test",
  "route-api-catalog",
  "route-api-catalog.v10.test",
  "section6-gate-ci.v10.test",
  "semantics.v10.test",
  "server-contracts",
  "server-contracts.v10.test",
  "slo-dashboard-descriptors",
  "slo-dashboard-descriptors.v10.test",
  "source-object-inventory",
  "source-object-inventory.v10.test",
  "spec-trace-map",
  "status-action-vocabulary",
  "status-action-vocabulary.v10.test",
  "traceability-ledger",
  "traceability-ledger.v10.test",
  "ui-state-contracts",
  "ui-state-contracts.v10.test",
  "visibility",
  "visibility.v10.test",
  "work-semantics",
  "zero-exclusion-report",
  "zero-exclusion-report.v10.test",
];

function v10LibraryRename(stem) {
  const neutralStem = stem.replace(/\.v10\.test$/u, ".test");
  const from = `src/lib/v10-${stem}.ts`;
  const to = `src/lib/${neutralStem}.ts`;
  const partialTestRewrite =
    stem.endsWith(".v10.test") ? referenceRewritesForPath(`src/lib/${stem}.ts`, to) : [];
  return pathRename(from, to, partialTestRewrite);
}

function lines(value) {
  return value
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function directoryPathRename(fromDir, toDir, file, toFile = file) {
  const from = `${fromDir}/${file}`;
  const to = `${toDir}/${toFile}`;
  const fromStem = stripKnownExtension(file);
  const toStem = stripKnownExtension(toFile);
  const fromDirectoryName = path.posix.basename(fromDir);
  const toDirectoryName = path.posix.basename(toDir);
  return pathRename(from, to, [
    {
      from: `"./${fromDirectoryName}/${fromStem}"`,
      to: `"./${toDirectoryName}/${toStem}"`,
    },
    {
      from: `'./${fromDirectoryName}/${fromStem}'`,
      to: `'./${toDirectoryName}/${toStem}'`,
    },
  ]);
}

function directoryRenames(fromDir, toDir, files, transform = (file) => file) {
  return files.map((file) => directoryPathRename(fromDir, toDir, file, transform(file)));
}

function stripLeadingProductVersion(file) {
  return file.replace(/^v[0-9]+-/u, "").replace(/\.v[0-9]+(?=\.test\.)/u, "");
}

const LOCAL_V6_ASSURANCE_FILES = lines(`
api-auth.ts
assurance-analytics.ts
assurance-checks.ts
assurance.ts
autopilot-executors.ts
autopilot-revert.ts
autopilot.ts
business-days.test.ts
business-days.ts
capacity-assurance-bridge.ts
control-policies.test.ts
control-policies.ts
cron-jobs.test.ts
cron-jobs.ts
cron-route-runner.ts
cron.ts
external-collaboration.ts
feature-guards.test.ts
feature-guards.ts
health-graph-paths.test.ts
health-graph-paths.ts
health-graph.test.ts
health-graph.ts
org-settings.test.ts
org-settings.ts
outcome-writers.ts
outcomes.test.ts
outcomes.ts
playbook-executors.ts
playbook-followups.ts
playbooks.ts
policy-enforcement-router.test.ts
policy-enforcement-router.ts
policy-evaluator.ts
policy-json-diff.test.ts
policy-json-diff.ts
policy-scope.ts
policy-types.test.ts
policy-types.ts
policy-validation.test.ts
policy-validation.ts
policy-work-objects.ts
portfolio-metrics.ts
program-evolution.ts
require-assurance-workspace-for-autopilot-api.test.ts
require-assurance-workspace-for-autopilot-api.ts
review-board-notifications.ts
review-boards.ts
scorecards.ts
segment-rollups.ts
segments.test.ts
segments.ts
service.insert-projection.test.ts
service.ts
types.ts
workflows.ts
`);

const LOCAL_DECISION_INTELLIGENCE_FILES = lines(`
api-pure.test.ts
api.external.test.ts
api.ts
campaign-assignment.ts
campaign-eligibility.test.ts
campaign-eligibility.ts
campaign-types.test.ts
campaign-types.ts
capacity-forecast-keys.test.ts
capacity-forecast-keys.ts
control-room-dashboard.test.ts
control-room-dashboard.ts
cron.test.ts
cron.ts
decision-context.test.ts
decision-context.ts
decision-packet-export.ts
decision-packet-html.test.ts
decision-packet-html.ts
decision-packet-pdf.tsx
decision-packet-storage.test.ts
decision-packet-storage.ts
decision-queue-sla.test.ts
decision-queue-sla.ts
decision-types.test.ts
decision-types.ts
external-action-payload.fast-check.test.ts
external-action-payload.test.ts
external-action-payload.ts
external-action-types.test.ts
external-action-types.ts
feature-guards.test.ts
feature-guards.ts
packet-types.ts
persist-signal-quality.test.ts
persist-signal-quality.ts
portfolio-analytics.ts
portfolio-signal-summary.test.ts
portfolio-signal-summary.ts
post-decision-actions.ts
relationship-bootstrap.test.ts
relationship-bootstrap.ts
relationship-key-metrics.ts
relationship-timeline.test.ts
relationship-timeline.ts
signal-quality-merge.test.ts
signal-quality-merge.ts
simulation-type-metrics.test.ts
simulation-type-metrics.ts
simulation-types.test.ts
simulation-types.ts
v5-flag-matrix.test.ts
v5-signal-quality-labels.test.ts
v5-signal-quality-labels.ts
`);

const LOCAL_CONTRACT_OPERATIONS_FILES = lines(`
api-auth.test.ts
api-auth.ts
automation-audit.test.ts
automation-audit.ts
casefile.ts
cron-schedule.test.ts
cron-schedule.ts
cron.ts
exceptions.test.ts
exceptions.ts
execution-engine.ts
graph-edge-labels.test.ts
graph-edge-labels.ts
policy-registry.test.ts
policy-registry.ts
program-auto-attach.test.ts
program-auto-attach.ts
renewal-decision-packet.test.ts
renewal-decision-packet.ts
report-pack-metrics.ts
`);

const PRODUCT_SURFACE_RENAME_FILES = new Map([
  ["api-error-json-core.v7.test.ts", "api-error-json-core-compatibility.test.ts"],
  ["api-workspace-guard.v7-matrix.test.ts", "api-workspace-guard-compatibility-matrix.test.ts"],
  ["href-eligibility-registry.v7.test.ts", "href-eligibility-registry-compatibility.test.ts"],
  ["v7-acceptance-matrix.test.ts", "compatibility-acceptance-matrix.test.ts"],
  ["v7-vocabulary-consistency.test.ts", "compatibility-vocabulary-consistency.test.ts"],
  ["v8-v7-alias-parity.test.ts", "alias-compatibility-parity.test.ts"],
  ...lines(`
v8-acceptance-criteria.test.ts
v8-acceptance-matrix.test.ts
v8-action-eligibility-check.ts
v8-action-eligibility-gate.test.ts
v8-api-inventory-coverage.test.ts
v8-capability-token-discoverability.test.ts
v8-context-load-build-parity.test.ts
v8-cross-surface-consistency.test.ts
v8-dashboard-layout-contract.test.ts
v8-denial-class-reachability.test.ts
v8-denial-status.test.ts
v8-denial-status.ts
v8-diagnostics-contract.test.ts
v8-diagnostics-field-presence.test.ts
v8-eligibility-output-contract.test.ts
v8-eligibility-surface-type-matrix.test.ts
v8-exempt-surfaces-exemplars.test.ts
v8-exempt-surfaces.ts
v8-governed-page-shell.test.ts
v8-governed-prefixes.ts
v8-href-audit-roots-contract.test.ts
v8-metadata-public-routes.test.ts
v8-nav-cmdk-utilities-parity.test.ts
v8-objectives-trace.test.ts
v8-outbound-link-sources.test.ts
v8-page-inventory-coverage.test.ts
v8-proxy-path-policy-alignment.test.ts
v8-request-pathname.ts
v8-route-inventory-mapping.test.ts
v8-sentry-scrub-bridge.test.ts
v8-server-action-inventory-coverage.test.ts
v8-surface-mapping.test.ts
v8-surface-mapping.ts
v8-test-exemptions-contract.test.ts
v8-workspace-role-matrix.test.ts
`).map((file) => [file, file.replace(/^v8-/u, "")]),
]);

export const SAFE_RENAME_MAPPINGS = [
  ...LOCAL_V10_LIBRARY_STEMS.map(v10LibraryRename),
  ...directoryRenames("src/lib/v6", "src/lib/assurance", LOCAL_V6_ASSURANCE_FILES),
  ...directoryRenames(
    "src/lib/v5",
    "src/lib/decision-intelligence",
    LOCAL_DECISION_INTELLIGENCE_FILES,
    stripLeadingProductVersion,
  ),
  ...directoryRenames("src/lib/v4", "src/lib/contract-operations", LOCAL_CONTRACT_OPERATIONS_FILES),
  ...Array.from(PRODUCT_SURFACE_RENAME_FILES, ([fromFile, toFile]) =>
    directoryPathRename("src/lib/product-surface", "src/lib/product-surface", fromFile, toFile),
  ),
  pathRename("src/lib/v9-spec-trace-map.ts", "src/lib/compatibility-spec-trace-map.ts"),
  pathRename("src/lib/v9-pr-body-rollup.ts", "src/lib/compatibility-pr-body-rollup.ts"),
  pathRename("src/lib/v9-pr-body-rollup.v9.test.ts", "src/lib/compatibility-pr-body-rollup.test.ts"),
  pathRename("scripts/check-v10-release-evidence.mjs", "scripts/check-release-evidence.mjs"),
  pathRename("scripts/check-v10-suite.mjs", "scripts/check-release-suite-current.mjs"),
  pathRename("scripts/check-v10-promotable.mjs", "scripts/check-release-promotable.mjs"),
  pathRename("scripts/check-v10-inventory-lock.mjs", "scripts/check-release-inventory-lock.mjs"),
  pathRename("scripts/check-v10-migration-smoke.mjs", "scripts/check-migration-smoke-current.mjs"),
  pathRename("scripts/check-v9-suite.mjs", "scripts/check-previous-release-suite.mjs"),
  pathRename("scripts/rebuild-v10-read-models.mjs", "scripts/rebuild-read-models.mjs"),
  pathRename("scripts/rebuild-v10-read-models-nightly-gate.mjs", "scripts/rebuild-read-models-nightly-gate.mjs"),
  pathRename("scripts/lib/v10-required-indexes.mjs", "scripts/lib/current-required-indexes.mjs"),
  pathRename("scripts/audit-v7-cross-surface-hrefs.mjs", "scripts/audit-compatibility-cross-surface-hrefs.mjs"),
  pathRename("scripts/audit-v8-cross-surface-hrefs.mjs", "scripts/audit-product-surface-cross-surface-hrefs.mjs"),
  pathRename("scripts/check-v7-vocabulary.mjs", "scripts/check-product-surface-compatibility-vocabulary.mjs"),
  pathRename("scripts/check-v8-vocabulary.mjs", "scripts/check-product-surface-vocabulary.mjs"),
  pathRename("scripts/v7-href-audit-allowlist.txt", "scripts/compatibility-href-audit-allowlist.txt"),
  pathRename("scripts/v8-inventory-report.mjs", "scripts/product-surface-inventory-report.mjs"),
  {
    from: "src/actions/v4.ts",
    to: "src/actions/policy-operations.ts",
    referenceRewrites: [
      {
        from: "src/actions/v4.ts",
        to: "src/actions/policy-operations.ts",
      },
      {
        from: "\"@/actions/v4\"",
        to: "\"@/actions/policy-operations\"",
      },
      {
        from: "'@/actions/v4'",
        to: "'@/actions/policy-operations'",
      },
    ],
  },
  pathRename("src/actions/v4-surface-guards.ts", "src/actions/program-surface-guards.ts"),
  pathRename("src/actions/v4-program-surface-guard.test.ts", "src/actions/program-surface-guard.test.ts"),
  pathRename("src/actions/v10-bulk-compatible-work-helpers.ts", "src/actions/bulk-compatible-work-helpers.ts"),
  pathRename("src/actions/v10-bulk-compatible-work.ts", "src/actions/bulk-compatible-work.ts"),
  pathRename("src/actions/v10-bulk-compatible-work.v10.test.ts", "src/actions/bulk-compatible-work.test.ts"),
  pathRename("src/actions/contracts-bulk-import-telemetry.v9.test.ts", "src/actions/contracts-bulk-import-telemetry.test.ts"),
  pathRename("src/components/work/v10-work-inbox-list-helpers.tsx", "src/components/work/work-inbox-list-helpers.tsx"),
  pathRename("src/components/work/v10-work-inbox-list.tsx", "src/components/work/work-inbox-list.tsx"),
  pathRename("src/components/work/v10-work-inbox-list.test.tsx", "src/components/work/work-inbox-list.test.tsx"),
  pathRename("src/components/ui/v10-recoverable-state.tsx", "src/components/ui/recoverable-state.tsx"),
  pathRename("src/components/ui/v10-recoverable-state.test.tsx", "src/components/ui/recoverable-state.test.tsx"),
  pathRename("src/components/dashboard/v5-control-room-strip.tsx", "src/components/dashboard/control-room-strip.tsx"),
  pathRename("src/components/dashboard/dashboard-v6-operational-blocks.tsx", "src/components/dashboard/dashboard-operational-blocks.tsx"),
  pathRename("src/components/assurance/org-v6-settings-panel.tsx", "src/components/assurance/org-settings-panel.tsx"),
  pathRename("src/components/layout/legal-footer.v7.test.ts", "src/components/layout/legal-footer.test.ts"),
  pathRename("src/components/reports/reports-v6-assurance-section.tsx", "src/components/reports/reports-assurance-section.tsx"),
  {
    from: "src/components/v4/execution-edge-blockers.tsx",
    to: "src/components/execution-edge-blockers.tsx",
    importRewrites: [],
  },
  {
    from: "src/components/v4/slack-renewal-summary-form.ui.test.tsx",
    to: "src/components/slack-renewal-summary-form.ui.test.tsx",
    importRewrites: [],
  },
  {
    from: "src/components/v4/campaign-maintenance-actions.tsx",
    to: "src/components/campaign-maintenance-actions.tsx",
    referenceRewrites: [
      {
        from: "@/components/v4/campaign-maintenance-actions",
        to: "@/components/campaign-maintenance-actions",
      },
      {
        from: "src/components/v4/campaign-maintenance-actions.tsx",
        to: "src/components/campaign-maintenance-actions.tsx",
      },
    ],
  },
  {
    from: "src/components/v4/command-center-role-metrics.tsx",
    to: "src/components/command-center-role-metrics.tsx",
    referenceRewrites: [
      {
        from: "src/components/v4/command-center-role-metrics.tsx",
        to: "src/components/command-center-role-metrics.tsx",
      },
    ],
  },
  {
    from: "src/components/v4/execution-graph-viz-dynamic.tsx",
    to: "src/components/execution-graph-viz-dynamic.tsx",
    referenceRewrites: [
      {
        from: "@/components/v4/execution-graph-viz-dynamic",
        to: "@/components/execution-graph-viz-dynamic",
      },
      {
        from: "src/components/v4/execution-graph-viz-dynamic.tsx",
        to: "src/components/execution-graph-viz-dynamic.tsx",
      },
    ],
  },
  {
    from: "src/components/v4/execution-graph-viz.tsx",
    to: "src/components/execution-graph-viz.tsx",
  },
  {
    from: "src/components/v4/policy-simulation-panel.tsx",
    to: "src/components/policy-simulation-panel.tsx",
    referenceRewrites: [
      {
        from: "@/components/v4/policy-simulation-panel",
        to: "@/components/policy-simulation-panel",
      },
      {
        from: "src/components/v4/policy-simulation-panel.tsx",
        to: "src/components/policy-simulation-panel.tsx",
      },
    ],
  },
  {
    from: "src/components/v4/program-impact-preview-button.tsx",
    to: "src/components/program-impact-preview-button.tsx",
    referenceRewrites: [
      {
        from: "@/components/v4/program-impact-preview-button",
        to: "@/components/program-impact-preview-button",
      },
      {
        from: "src/components/v4/program-impact-preview-button.tsx",
        to: "src/components/program-impact-preview-button.tsx",
      },
    ],
  },
  {
    from: "src/components/v4/sla-simulator-client.tsx",
    to: "src/components/sla-simulator-client.tsx",
    referenceRewrites: [
      {
        from: "@/components/v4/sla-simulator-client",
        to: "@/components/sla-simulator-client",
      },
      {
        from: "src/components/v4/sla-simulator-client.tsx",
        to: "src/components/sla-simulator-client.tsx",
      },
    ],
  },
  {
    from: "src/components/v4/slack-renewal-summary-form.tsx",
    to: "src/components/slack-renewal-summary-form.tsx",
    referenceRewrites: [
      {
        from: "./v4/slack-renewal-summary-form",
        to: "./slack-renewal-summary-form",
      },
      {
        from: "src/components/v4/slack-renewal-summary-form.tsx",
        to: "src/components/slack-renewal-summary-form.tsx",
      },
    ],
  },
  {
    from: "src/lib/v5/campaign-assignment.test.ts",
    to: "src/lib/campaign-assignment.test.ts",
    importRewrites: [{ from: "./campaign-assignment", to: "./v5/campaign-assignment" }],
  },
  {
    from: "src/lib/v5/decision-packet-pdf.test.tsx",
    to: "src/lib/decision-packet-pdf.test.tsx",
    importRewrites: [{ from: "./decision-packet-pdf", to: "./v5/decision-packet-pdf" }],
  },
  {
    from: "src/lib/v5/portfolio-analytics.test.ts",
    to: "src/lib/portfolio-analytics.test.ts",
    importRewrites: [{ from: "./portfolio-analytics", to: "./v5/portfolio-analytics" }],
  },
  {
    from: "src/lib/v5/post-decision-actions.test.ts",
    to: "src/lib/post-decision-actions.test.ts",
    importRewrites: [{ from: "./post-decision-actions", to: "./v5/post-decision-actions" }],
  },
  {
    from: "src/lib/qa/e2e-inventory-allowlist.v9.test.ts",
    to: "src/lib/qa/e2e-inventory-allowlist.test.ts",
  },
  {
    from: "e2e/v10-core-smoke.spec.ts",
    to: "e2e/current-product-core-smoke.spec.ts",
    referenceRewrites: [
      { from: "e2e/v10-core-smoke.spec.ts", to: "e2e/current-product-core-smoke.spec.ts" },
      { from: "v10-core-smoke.spec.ts", to: "current-product-core-smoke.spec.ts" },
    ],
  },
  {
    from: "e2e/v10-device-matrix.chromium.spec.ts",
    to: "e2e/current-product-device-matrix.chromium.spec.ts",
    referenceRewrites: [
      {
        from: "e2e/v10-device-matrix.chromium.spec.ts",
        to: "e2e/current-product-device-matrix.chromium.spec.ts",
      },
      { from: "v10-device-matrix.chromium.spec.ts", to: "current-product-device-matrix.chromium.spec.ts" },
    ],
  },
  {
    from: "e2e/v10-device-matrix.firefox.spec.ts",
    to: "e2e/current-product-device-matrix.firefox.spec.ts",
    referenceRewrites: [
      {
        from: "e2e/v10-device-matrix.firefox.spec.ts",
        to: "e2e/current-product-device-matrix.firefox.spec.ts",
      },
      { from: "v10-device-matrix.firefox.spec.ts", to: "current-product-device-matrix.firefox.spec.ts" },
    ],
  },
  {
    from: "e2e/v10-device-matrix.webkit.spec.ts",
    to: "e2e/current-product-device-matrix.webkit.spec.ts",
    referenceRewrites: [
      {
        from: "e2e/v10-device-matrix.webkit.spec.ts",
        to: "e2e/current-product-device-matrix.webkit.spec.ts",
      },
      { from: "v10-device-matrix.webkit.spec.ts", to: "current-product-device-matrix.webkit.spec.ts" },
    ],
  },
  {
    from: "e2e/v9-core-smoke.spec.ts",
    to: "e2e/compatibility-core-smoke.spec.ts",
    referenceRewrites: [
      { from: "e2e/v9-core-smoke.spec.ts", to: "e2e/compatibility-core-smoke.spec.ts" },
      { from: "v9-core-smoke.spec.ts", to: "compatibility-core-smoke.spec.ts" },
    ],
  },
  {
    from: "e2e/v9-visual-optional.spec.ts",
    to: "e2e/compatibility-visual-optional.spec.ts",
    referenceRewrites: [
      { from: "e2e/v9-visual-optional.spec.ts", to: "e2e/compatibility-visual-optional.spec.ts" },
      { from: "v9-visual-optional.spec.ts", to: "compatibility-visual-optional.spec.ts" },
      { from: "v9-optional", to: "compatibility-optional" },
    ],
  },
  {
    from: "e2e/v6-assurance.spec.ts",
    to: "e2e/assurance.spec.ts",
    referenceRewrites: [
      { from: "e2e/v6-assurance.spec.ts", to: "e2e/assurance.spec.ts" },
      { from: "v6-assurance.spec.ts", to: "assurance.spec.ts" },
    ],
  },
  {
    from: "e2e/v5-surfaces.spec.ts",
    to: "e2e/external-surfaces.spec.ts",
    referenceRewrites: [
      { from: "e2e/v5-surfaces.spec.ts", to: "e2e/external-surfaces.spec.ts" },
      { from: "v5-surfaces.spec.ts", to: "external-surfaces.spec.ts" },
    ],
  },
  {
    from: "e2e/v5-workflows.spec.ts",
    to: "e2e/workflow-surfaces.spec.ts",
    referenceRewrites: [
      { from: "e2e/v5-workflows.spec.ts", to: "e2e/workflow-surfaces.spec.ts" },
      { from: "v5-workflows.spec.ts", to: "workflow-surfaces.spec.ts" },
    ],
  },
  {
    from: "e2e/v3-workflows.spec.ts",
    to: "e2e/workflow-hubs.spec.ts",
    referenceRewrites: [
      { from: "e2e/v3-workflows.spec.ts", to: "e2e/workflow-hubs.spec.ts" },
      { from: "v3-workflows.spec.ts", to: "workflow-hubs.spec.ts" },
    ],
  },
  {
    from: "scripts/render-v9-pr-body-rollup.mjs",
    to: "scripts/render-compatibility-pr-body-rollup.mjs",
    referenceRewrites: [
      {
        from: "scripts/render-v9-pr-body-rollup.mjs",
        to: "scripts/render-compatibility-pr-body-rollup.mjs",
      },
    ],
  },
  {
    from: "src/app/(dashboard)/reports/reports-control-room-reliability.v9.test.ts",
    to: "src/app/(dashboard)/reports/reports-control-room-reliability.test.ts",
    referenceRewrites: [
      {
        from: "src/app/(dashboard)/reports/reports-control-room-reliability.v9.test.ts",
        to: "src/app/(dashboard)/reports/reports-control-room-reliability.test.ts",
      },
    ],
  },
  pathRename(
    "src/app/(dashboard)/contracts/reports/contracts-reports-pack-surface.v7.test.ts",
    "src/app/(dashboard)/contracts/reports/contracts-reports-pack-surface.test.ts",
  ),
  pathRename(
    "src/app/(dashboard)/settings/operations/settings-operations-surface.v7.test.ts",
    "src/app/(dashboard)/settings/operations/settings-operations-surface.test.ts",
  ),
  pathRename(
    "src/app/(dashboard)/settings/health/settings-health-visible-impact.v9.test.ts",
    "src/app/(dashboard)/settings/health/settings-health-visible-impact.test.ts",
  ),
  pathRename(
    "src/app/(dashboard)/settings/health/settings-health-recoverability.v10.test.ts",
    "src/app/(dashboard)/settings/health/settings-health-recoverability.test.ts",
  ),
  pathRename("src/app/(dashboard)/loading-error-consistency.v9.test.ts", "src/app/(dashboard)/loading-error-consistency.test.ts"),
  pathRename("src/app/api/import-export-job-org-scope.v9.test.ts", "src/app/api/import-export-job-org-scope.test.ts"),
  pathRename("src/app/api/import-contracts-job-post-retry.v9.test.ts", "src/app/api/import-contracts-job-post-retry.test.ts"),
  pathRename("src/app/api/intelligence/v5-intelligence-routes.test.ts", "src/app/api/intelligence/intelligence-routes.test.ts"),
  pathRename("src/app/api/command-palette/contracts/route.v10.test.ts", "src/app/api/command-palette/contracts/route.test.ts"),
  pathRename("src/app/api/v6-api-feature-gate.test.ts", "src/app/api/api-feature-gate.test.ts"),
  pathRename("src/app/api/cron/v5/v5-crons-feature-skip.test.ts", "src/app/api/cron/v5/crons-feature-skip.test.ts"),
  pathRename("src/app/api/cron/v6/v6-crons-feature-skip.test.ts", "src/app/api/cron/v6/crons-feature-skip.test.ts"),
  {
    from: "src/lib/import-job-visibility.v9.test.ts",
    to: "src/lib/import-job-visibility.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/import-job-visibility.v9.test.ts",
        to: "src/lib/import-job-visibility.test.ts",
      },
    ],
  },
  {
    from: "src/lib/product-surface/v8-admin-bypass-boundary.test.ts",
    to: "src/lib/product-surface/admin-bypass-boundary.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/product-surface/v8-admin-bypass-boundary.test.ts",
        to: "src/lib/product-surface/admin-bypass-boundary.test.ts",
      },
    ],
  },
  {
    from: "src/lib/product-surface/v8-external-actions-token-contract.test.ts",
    to: "src/lib/product-surface/external-actions-token-contract.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/product-surface/v8-external-actions-token-contract.test.ts",
        to: "src/lib/product-surface/external-actions-token-contract.test.ts",
      },
    ],
  },
  {
    from: "src/lib/product-surface/v8-registry-contract.test.ts",
    to: "src/lib/product-surface/registry-contract.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/product-surface/v8-registry-contract.test.ts",
        to: "src/lib/product-surface/registry-contract.test.ts",
      },
    ],
  },
  {
    from: "src/lib/product-surface/v8-test-exemptions.json",
    to: "src/lib/product-surface/test-exemptions.json",
    referenceRewrites: [
      {
        from: "src/lib/product-surface/v8-test-exemptions.json",
        to: "src/lib/product-surface/test-exemptions.json",
      },
      {
        from: "src/lib/product-surface/v8-test-exemptions",
        to: "src/lib/product-surface/test-exemptions",
      },
    ],
  },
  {
    from: "src/lib/product-telemetry.details.v9.test.ts",
    to: "src/lib/product-telemetry.details.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/product-telemetry.details.v9.test.ts",
        to: "src/lib/product-telemetry.details.test.ts",
      },
      {
        from: "product-telemetry.details.v9.test.ts",
        to: "product-telemetry.details.test.ts",
      },
    ],
  },
  {
    from: "src/lib/qa/aria-future-detect.v9.test.ts",
    to: "src/lib/qa/aria-future-detect.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/qa/aria-future-detect.v9.test.ts",
        to: "src/lib/qa/aria-future-detect.test.ts",
      },
    ],
  },
  {
    from: "src/lib/qa/cidr.v9.test.ts",
    to: "src/lib/qa/cidr.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/qa/cidr.v9.test.ts",
        to: "src/lib/qa/cidr.test.ts",
      },
    ],
  },
  {
    from: "src/lib/qa/contracts-search-url-fuzz-sampling.v9.test.ts",
    to: "src/lib/qa/contracts-search-url-fuzz-sampling.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/qa/contracts-search-url-fuzz-sampling.v9.test.ts",
        to: "src/lib/qa/contracts-search-url-fuzz-sampling.test.ts",
      },
    ],
  },
  {
    from: "src/lib/qa/csv-formula-safety-usage.v9.test.ts",
    to: "src/lib/qa/csv-formula-safety-usage.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/qa/csv-formula-safety-usage.v9.test.ts",
        to: "src/lib/qa/csv-formula-safety-usage.test.ts",
      },
    ],
  },
  {
    from: "src/lib/qa/intl-format-sampling.v9.test.ts",
    to: "src/lib/qa/intl-format-sampling.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/qa/intl-format-sampling.v9.test.ts",
        to: "src/lib/qa/intl-format-sampling.test.ts",
      },
    ],
  },
  {
    from: "src/lib/qa/landing-structured-data.v9.test.ts",
    to: "src/lib/qa/landing-structured-data.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/qa/landing-structured-data.v9.test.ts",
        to: "src/lib/qa/landing-structured-data.test.ts",
      },
    ],
  },
  {
    from: "src/lib/qa/next-app-router-shell-surface.v9.test.ts",
    to: "src/lib/qa/next-app-router-shell-surface.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/qa/next-app-router-shell-surface.v9.test.ts",
        to: "src/lib/qa/next-app-router-shell-surface.test.ts",
      },
    ],
  },
  {
    from: "src/lib/qa/pwa-seo-metadata.v9.test.ts",
    to: "src/lib/qa/pwa-seo-metadata.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/qa/pwa-seo-metadata.v9.test.ts",
        to: "src/lib/qa/pwa-seo-metadata.test.ts",
      },
    ],
  },
  {
    from: "src/lib/qa/regulatory-id-format-sampling.v9.test.ts",
    to: "src/lib/qa/regulatory-id-format-sampling.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/qa/regulatory-id-format-sampling.v9.test.ts",
        to: "src/lib/qa/regulatory-id-format-sampling.test.ts",
      },
    ],
  },
  {
    from: "src/lib/qa/telemetry-sentry-capture-mocks.v9.test.ts",
    to: "src/lib/qa/telemetry-sentry-capture-mocks.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/qa/telemetry-sentry-capture-mocks.v9.test.ts",
        to: "src/lib/qa/telemetry-sentry-capture-mocks.test.ts",
      },
    ],
  },
  {
    from: "src/lib/qa/user-visible-error-shape.v9.test.ts",
    to: "src/lib/qa/user-visible-error-shape.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/qa/user-visible-error-shape.v9.test.ts",
        to: "src/lib/qa/user-visible-error-shape.test.ts",
      },
    ],
  },
  {
    from: "src/lib/reminder-delivery-visibility.v9.test.ts",
    to: "src/lib/reminder-delivery-visibility.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/reminder-delivery-visibility.v9.test.ts",
        to: "src/lib/reminder-delivery-visibility.test.ts",
      },
    ],
  },
  {
    from: "src/lib/reminder-inactive-missing-dates-copy.v9.test.ts",
    to: "src/lib/reminder-inactive-missing-dates-copy.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/reminder-inactive-missing-dates-copy.v9.test.ts",
        to: "src/lib/reminder-inactive-missing-dates-copy.test.ts",
      },
    ],
  },
  {
    from: "src/lib/v9-cmdk-contracts-search-parity.v9.test.ts",
    to: "src/lib/compatibility-cmdk-contracts-search-parity.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/v9-cmdk-contracts-search-parity.v9.test.ts",
        to: "src/lib/compatibility-cmdk-contracts-search-parity.test.ts",
      },
    ],
  },
  {
    from: "src/lib/v9-dashboard-persona-density.v9.test.ts",
    to: "src/lib/compatibility-dashboard-persona-density.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/v9-dashboard-persona-density.v9.test.ts",
        to: "src/lib/compatibility-dashboard-persona-density.test.ts",
      },
    ],
  },
  {
    from: "src/lib/v9-evidence-studio-surface.v9.test.ts",
    to: "src/lib/compatibility-evidence-studio-surface.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/v9-evidence-studio-surface.v9.test.ts",
        to: "src/lib/compatibility-evidence-studio-surface.test.ts",
      },
    ],
  },
  {
    from: "src/lib/v9-extraction-queued-vs-in-progress-ui.v9.test.ts",
    to: "src/lib/compatibility-extraction-queued-vs-in-progress-ui.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/v9-extraction-queued-vs-in-progress-ui.v9.test.ts",
        to: "src/lib/compatibility-extraction-queued-vs-in-progress-ui.test.ts",
      },
    ],
  },
  {
    from: "src/lib/v9-list-virtualization-contract-table.v9.test.ts",
    to: "src/lib/compatibility-list-virtualization-contract-table.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/v9-list-virtualization-contract-table.v9.test.ts",
        to: "src/lib/compatibility-list-virtualization-contract-table.test.ts",
      },
    ],
  },
  {
    from: "src/lib/v9-long-title-unicode-row.v9.test.ts",
    to: "src/lib/compatibility-long-title-unicode-row.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/v9-long-title-unicode-row.v9.test.ts",
        to: "src/lib/compatibility-long-title-unicode-row.test.ts",
      },
    ],
  },
  {
    from: "src/lib/v9-pii-minimization.v9.test.ts",
    to: "src/lib/compatibility-pii-minimization.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/v9-pii-minimization.v9.test.ts",
        to: "src/lib/compatibility-pii-minimization.test.ts",
      },
    ],
  },
  {
    from: "src/lib/v9-renewal-horizon-contract-list-parity.v9.test.ts",
    to: "src/lib/compatibility-renewal-horizon-contract-list-parity.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/v9-renewal-horizon-contract-list-parity.v9.test.ts",
        to: "src/lib/compatibility-renewal-horizon-contract-list-parity.test.ts",
      },
    ],
  },
  {
    from: "src/lib/v9-work-lens-empty-states.v9.test.ts",
    to: "src/lib/compatibility-work-lens-empty-states.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/v9-work-lens-empty-states.v9.test.ts",
        to: "src/lib/compatibility-work-lens-empty-states.test.ts",
      },
    ],
  },
  {
    from: "src/lib/v9-work-queue-surface.v9.test.ts",
    to: "src/lib/compatibility-work-queue-surface.test.ts",
    referenceRewrites: [
      {
        from: "src/lib/v9-work-queue-surface.v9.test.ts",
        to: "src/lib/compatibility-work-queue-surface.test.ts",
      },
    ],
  },
  pathRename("src/components/dashboard/v5-telemetry-compact.tsx", "src/components/dashboard/telemetry-compact.tsx"),
  pathRename("src/components/settings/billing-stripe-surface.v7.test.ts", "src/components/settings/billing-stripe-surface.test.ts"),
  pathRename("src/components/ui/v10-empty-state-telemetry-link.tsx", "src/components/ui/empty-state-telemetry-link.tsx"),
  pathRename("src/lib/contract-list-id-filters.v9.test.ts", "src/lib/contract-list-id-filters-compatibility.test.ts"),
  pathRename("src/lib/contract-list-id-filters.v10.test.ts", "src/lib/contract-list-id-filters-current.test.ts"),
  pathRename("src/lib/integrations/calendar.v7.test.ts", "src/lib/integrations/calendar-compatibility.test.ts"),
  pathRename("src/lib/onboarding/onboarding-banner-checklist-order.v9.test.ts", "src/lib/onboarding/onboarding-banner-checklist-order-compatibility.test.ts"),
  pathRename("src/lib/product-telemetry.v9.test.ts", "src/lib/product-telemetry-compatibility.test.ts"),
  pathRename("src/lib/product-telemetry.v10.test.ts", "src/lib/product-telemetry-current.test.ts"),
  pathRename("src/lib/v9-field-provenance.ts", "src/lib/compatibility-field-provenance.ts"),
  pathRename("src/lib/v9-release-contract.ts", "src/lib/compatibility-release-contract.ts"),
  pathRename("src/lib/v10-objective-telemetry.ts", "src/lib/objective-telemetry.ts"),
  pathRename("src/test-utils/v9-deterministic-time.ts", "src/test-utils/deterministic-time.ts"),
];

const REFUSED_PREFIXES = [
  "artifacts/",
  "config/",
  "public/",
  "semgrep/",
  "supabase/",
];
const REFERENCE_REWRITE_ALLOWED_PREFIXES = [
  ".github/",
  "docs/",
  "e2e/",
  "scripts/",
  "src/",
];
const REFERENCE_REWRITE_EXCLUDED_FILES = new Set([
  "scripts/versioned-naming-baseline.json",
  "scripts/versioned-naming-removal-queue.json",
  "scripts/check-versioned-naming-safe-renames.mjs",
  "artifacts/compatibility/versioned-naming-safe-rename-manifest.json",
]);
const REFERENCE_REWRITE_TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const REFERENCE_REWRITE_TEXT_BASENAMES = new Set([
  "package.json",
]);
const REFERENCED_LOCAL_RENAME_PREFIXES = [
  "src/actions/",
  "src/components/",
  "src/lib/",
  "src/test-utils/",
];

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function abs(root, rel) {
  return path.join(root, rel);
}

function isLocalAppTestPath(rel) {
  return rel.startsWith("src/app/") && !rel.startsWith("src/app/api/") && /\.test\.[cm]?[jt]sx?$/u.test(rel);
}

function isLocalAppApiTestPath(rel) {
  return rel.startsWith("src/app/api/") && /\.test\.[cm]?[jt]sx?$/u.test(rel);
}

function isRefusedPath(rel) {
  if (rel.startsWith("src/app/") && !isLocalAppTestPath(rel) && !isLocalAppApiTestPath(rel)) return true;
  if (/\/route\.[cm]?[jt]sx?$/u.test(rel) && !/\.test\.[cm]?[jt]sx?$/u.test(rel)) return true;
  if (rel === "src/lib/v6/telemetry.ts") return true;
  return (
    REFUSED_PREFIXES.some((prefix) => rel.startsWith(prefix)) ||
    (!/\.test\.[cm]?[jt]sx?$/u.test(rel) && /(?:webhook|provider|stripe)/iu.test(rel))
  );
}

function isReferencedLocalRenamePath(rel) {
  return REFERENCED_LOCAL_RENAME_PREFIXES.some((prefix) => rel.startsWith(prefix)) || isLocalAppTestPath(rel) || isLocalAppApiTestPath(rel);
}

function readBaselineFiles(baselinePath) {
  if (!baselinePath || !fs.existsSync(baselinePath)) return [];
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  return Array.isArray(baseline.files) ? baseline.files : [];
}

function suggestedNeutralPath(row) {
  const suggestion = row?.suggestedNeutralName;
  if (typeof suggestion === "string") return suggestion;
  if (typeof suggestion?.value === "string") return suggestion.value;
  return null;
}

function buildReferencedLocalRenameMappings(root, baselinePath, staticMappings = SAFE_RENAME_MAPPINGS) {
  const staticMappingKeys = new Set(staticMappings.map(mappingKey));
  const candidates = [];

  for (const row of readBaselineFiles(baselinePath)) {
    const from = toPosix(row.path ?? "");
    const to = toPosix(suggestedNeutralPath(row) ?? "");
    if (!from || !to || from === to) continue;
    if ((row.sources?.path ?? 0) <= 0) continue;
    if (row.governance?.manualOnly) continue;
    if (!isReferencedLocalRenamePath(from) || !isReferencedLocalRenamePath(to)) continue;
    if (isRefusedPath(from) || isRefusedPath(to)) continue;
    if (pathVersionHitCount(to) >= pathVersionHitCount(from)) continue;
    if (staticMappingKeys.has(mappingKey({ from, to }))) continue;

    const fromExists = fs.existsSync(abs(root, from));
    const toExists = fs.existsSync(abs(root, to));
    if (!fromExists || toExists) continue;
    candidates.push({ from, to });
  }

  const pendingTargets = new Map();
  for (const candidate of candidates) {
    const entries = pendingTargets.get(candidate.to) ?? [];
    entries.push(candidate.from);
    pendingTargets.set(candidate.to, entries);
  }
  const ambiguousTargets = new Set(
    Array.from(pendingTargets.entries())
      .filter(([, froms]) => froms.length > 1)
      .map(([target]) => target),
  );

  return candidates
    .filter((candidate) => !ambiguousTargets.has(candidate.to))
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((candidate) => pathRename(candidate.from, candidate.to));
}

function defaultSafeRenameMappings(root, baselinePath) {
  const generated = buildReferencedLocalRenameMappings(root, baselinePath);
  const seen = new Set();
  const out = [];
  for (const mapping of [...SAFE_RENAME_MAPPINGS, ...generated]) {
    const key = mappingKey(mapping);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mapping);
  }
  return out;
}

function rewriteContent(text, rewrites) {
  let out = text;
  for (const rewrite of rewrites ?? []) {
    out = out.replaceAll(`"${rewrite.from}"`, `"${rewrite.to}"`).replaceAll(`'${rewrite.from}'`, `'${rewrite.to}'`);
  }
  return out;
}

function shouldRewriteReferenceFile(rel) {
  if (REFERENCE_REWRITE_EXCLUDED_FILES.has(rel)) return false;
  if (!REFERENCE_REWRITE_ALLOWED_PREFIXES.some((prefix) => rel.startsWith(prefix)) && !REFERENCE_REWRITE_TEXT_BASENAMES.has(rel)) {
    return false;
  }
  const basename = path.basename(rel);
  return REFERENCE_REWRITE_TEXT_BASENAMES.has(basename) || REFERENCE_REWRITE_TEXT_EXTENSIONS.has(path.extname(basename));
}

function walkReferenceRewriteFiles(root, dir = root, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryAbs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if ([".git", ".next", "artifacts", "blob-report", "coverage", "node_modules", "playwright-report", "test-results"].includes(entry.name)) continue;
      walkReferenceRewriteFiles(root, entryAbs, acc);
      continue;
    }
    if (!entry.isFile()) continue;
    const rel = toPosix(path.relative(root, entryAbs));
    if (shouldRewriteReferenceFile(rel)) acc.push({ abs: entryAbs, rel });
  }
  return acc;
}

function normalizeReferenceRewrites(mappings) {
  const rewrites = [];
  for (const mapping of mappings) {
    for (const rewrite of mapping.referenceRewrites ?? []) {
      if (!rewrite?.from || !rewrite?.to || rewrite.from === rewrite.to) continue;
      rewrites.push({
        from: rewrite.from,
        to: rewrite.to,
        mappingFrom: toPosix(mapping.from),
        mappingTo: toPosix(mapping.to),
      });
    }
  }
  return rewrites;
}

function applyFixedReferenceRewrites(root, mappings) {
  const rewrites = normalizeReferenceRewrites(mappings);
  if (rewrites.length === 0) return [];

  const changedFiles = [];
  for (const file of walkReferenceRewriteFiles(root)) {
    let content = fs.readFileSync(file.abs, "utf8");
    let next = content;
    for (const rewrite of rewrites) {
      next = next.replaceAll(rewrite.from, rewrite.to);
    }
    if (next === content) continue;
    fs.writeFileSync(file.abs, next);
    changedFiles.push(file.rel);
  }
  return changedFiles;
}

function approvedCandidateSet(root, baselinePath) {
  const report = runVersionedNamingCleanupReport({
    root,
    baselinePath,
    limit: 10_000,
  });
  return new Set((report.safeRenameCandidates ?? []).map((candidate) => candidate.path));
}

function mappingKey(mapping) {
  return `${toPosix(mapping.from)} -> ${toPosix(mapping.to)}`;
}

function pathVersionHitCount(rel) {
  return (toPosix(rel).match(/(^|[./_-])[Vv][0-9]+(?!\.[0-9])/gu) ?? []).length;
}

function plannedRenameMetadata(mapping, status) {
  const governance = governanceForVersionedNamingPath(mapping.from);
  const fixedReferenceUpdates = (mapping.referenceRewrites ?? []).map((rewrite) => ({
    from: rewrite.from,
    to: rewrite.to,
  }));
  return {
    surface: governance.surface,
    reason: governance.reason,
    expectedReferenceUpdates: (mapping.importRewrites ?? []).map((rewrite) => ({
      from: rewrite.from,
      to: rewrite.to,
    })),
    expectedFixedStringReferenceUpdates: fixedReferenceUpdates,
    beforePathHitCount: pathVersionHitCount(mapping.from),
    afterPathHitCount: pathVersionHitCount(mapping.to),
    rollbackNote:
      status === "pending"
        ? `Move ${mapping.to} back to ${mapping.from} and restore the listed import rewrites.`
        : `If rollback is needed, move ${mapping.to} back to ${mapping.from} and reverse the listed import rewrites.`,
  };
}

function buildMoveManifest(report) {
  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-naming-safe-renames.mjs --write",
    plannedRenameCount: report.plannedRenameCount,
    pendingRenameCount: report.pendingRenameCount,
    appliedRenameCount: report.appliedRenameCount,
    plannedRenames: report.plannedRenames,
  };
}

function writeMoveManifest(root, manifestRel, report) {
  const out = path.join(root, manifestRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(buildMoveManifest(report), null, 2)}\n`);
}

export function analyzeVersionedNamingSafeRenames(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const baselinePath = options.baselinePath ?? DEFAULT_BASELINE;
  const usingDefaultMappings = !options.mappings;
  const mappings = options.mappings ?? defaultSafeRenameMappings(root, baselinePath);
  const approved = options.approvedCandidates ? new Set(options.approvedCandidates) : approvedCandidateSet(root, baselinePath);
  const reviewedMappings = new Set((options.reviewedMappings ?? (usingDefaultMappings ? mappings : SAFE_RENAME_MAPPINGS)).map(mappingKey));
  const issues = [];
  const plannedRenames = [];

  for (const mapping of mappings) {
    const from = toPosix(mapping.from);
    const to = toPosix(mapping.to);
    const fromExists = fs.existsSync(abs(root, from));
    const toExists = fs.existsSync(abs(root, to));
    const refused = isRefusedPath(from) || isRefusedPath(to);
    const reviewed = reviewedMappings.has(mappingKey({ from, to }));
    const status = fromExists && !toExists ? "pending" : !fromExists && toExists ? "applied" : fromExists && toExists ? "conflict" : "missing";

    if (refused) {
      issues.push({ issue: "safe_rename_refuses_compatibility_sensitive_path", from, to });
    }
    if (status === "conflict") {
      issues.push({ issue: "safe_rename_source_and_target_both_exist", from, to });
    } else if (status === "missing") {
      issues.push({ issue: "safe_rename_source_and_target_missing", from, to });
    } else if (status === "pending" && !approved.has(from) && !reviewed) {
      issues.push({ issue: "safe_rename_not_report_approved", from, to });
    }

    plannedRenames.push({
      from,
      to,
      status,
      approved: status === "applied" || approved.has(from) || reviewed,
      reviewed,
      importRewriteCount: mapping.importRewrites?.length ?? 0,
      fixedStringRewriteCount: mapping.referenceRewrites?.length ?? 0,
      ...plannedRenameMetadata({ ...mapping, from, to }, status),
    });
  }

  return {
    ok: issues.length === 0,
    mode: "check",
    plannedRenameCount: plannedRenames.length,
    pendingRenameCount: plannedRenames.filter((row) => row.status === "pending").length,
    appliedRenameCount: plannedRenames.filter((row) => row.status === "applied").length,
    plannedRenames,
    issueCount: issues.length,
    issues,
  };
}

export function applyVersionedNamingSafeRenames(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const report = analyzeVersionedNamingSafeRenames(options);
  if (!report.ok) return { ...report, mode: "write", changedFiles: [] };

  const changedFiles = [];
  const mappings = options.mappings ?? defaultSafeRenameMappings(root, options.baselinePath ?? DEFAULT_BASELINE);
  for (const mapping of mappings) {
    const plan = report.plannedRenames.find((row) => row.from === mapping.from && row.to === mapping.to);
    if (!plan || plan.status !== "pending") continue;
    const fromAbs = abs(root, mapping.from);
    const toAbs = abs(root, mapping.to);
    fs.mkdirSync(path.dirname(toAbs), { recursive: true });
    const content = rewriteContent(fs.readFileSync(fromAbs, "utf8"), mapping.importRewrites);
    fs.renameSync(fromAbs, toAbs);
    fs.writeFileSync(toAbs, content);
    changedFiles.push(mapping.from, mapping.to);
  }
  changedFiles.push(...applyFixedReferenceRewrites(root, mappings));

  const finalReport = {
    ...analyzeVersionedNamingSafeRenames(options),
    mode: "write",
    changedFiles: Array.from(new Set(changedFiles)).sort((a, b) => a.localeCompare(b)),
  };
  writeMoveManifest(root, options.manifestRel ?? DEFAULT_MANIFEST_REL, finalReport);
  return finalReport;
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, baselinePath: DEFAULT_BASELINE, manifestRel: DEFAULT_MANIFEST_REL, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--baseline") {
      options.baselinePath = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--baseline=")) {
      options.baselinePath = path.resolve(arg.slice("--baseline=".length));
    } else if (arg === "--manifest") {
      options.manifestRel = argv[index + 1] ?? DEFAULT_MANIFEST_REL;
      index += 1;
    } else if (arg.startsWith("--manifest=")) {
      options.manifestRel = arg.slice("--manifest=".length);
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runVersionedNamingSafeRenames(options = parseArgs(process.argv.slice(2))) {
  const report = options.write ? applyVersionedNamingSafeRenames(options) : analyzeVersionedNamingSafeRenames(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedNamingSafeRenames();
}
