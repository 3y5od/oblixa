import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeCompatibilityRemovalQueue,
  buildCompatibilityRemovalQueue,
  ENV_KEY_ALIASES,
  EXPORTED_SYMBOL_ALIASES,
  PACKAGE_SCRIPT_ALIASES,
} from "./check-compatibility-removal-queue.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "compat-removal-queue-"));
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

function writeCoverageArtifacts(root) {
  writeJson(root, "artifacts/compatibility/versioned-content-surface-coverage.json", {
    uncoveredManualCount: 0,
    remainingSafeActionCount: 0,
  });
  writeJson(root, "artifacts/compatibility/versioned-manual-surface-closure.json", {
    uncoveredManualCount: 0,
    remainingSafeActionCount: 0,
  });
}

function packageJsonWithAliases() {
  return {
    scripts: Object.fromEntries(PACKAGE_SCRIPT_ALIASES.flatMap((alias) => [
      [alias.legacy, `node legacy-${alias.legacy}.mjs`],
      [alias.neutral, `npm run ${alias.legacy}`],
    ])),
  };
}

function label(number, suffix = "") {
  return `V${number}${suffix}`;
}

function lowerLabel(number, suffix = "") {
  return `v${number}${suffix}`;
}

test("analyzeCompatibilityRemovalQueue accepts current deterministic artifact", () => {
  const deviceMatrixKey = `PLAYWRIGHT_${label(10)}_MATRIX`;
  const decisionBucketKey = `${label(5)}_DECISION_PACKET_BUCKET`;
  const recoverableState = `${label(10)}RecoverableState`;
  const supportDiagnostics = `NEXT_PUBLIC_${label(10)}_SUPPORT_DIAGNOSTICS`;
  const root = makeRoot();
  writeJson(root, "package.json", packageJsonWithAliases());
  writeJson(root, "artifacts/telemetry/event-inventory.json", {
    versionedEventRemovalQueue: [
      {
        eventName: `product.${lowerLabel(9)}.example`,
        owner: "platform",
        reason: "compatibility",
        neutralAlias: "product.compat.example",
        status: "legacy_retained",
        validationCommand: "npm run check:telemetry-event-inventory",
        manualFollowUp: "migrate consumers",
      },
    ],
  });
  writeCoverageArtifacts(root);
  writeJson(root, "artifacts/compatibility/removal-queue.json", buildCompatibilityRemovalQueue(root));

  const report = analyzeCompatibilityRemovalQueue({ root });

  assert.equal(report.ok, true);
  assert.equal(report.packageScriptAliasCount, PACKAGE_SCRIPT_ALIASES.length);
  assert.equal(report.telemetryEventQueueCount, 1);
  assert.equal(report.issueCount, 0);
  const queue = buildCompatibilityRemovalQueue(root);
  assert.ok(queue.statusVocabulary.includes("awaiting_production_cutover"));
  assert.ok(queue.statusVocabulary.includes("ready_for_removal"));
  assert.equal(queue.queues.telemetryEventNames[0].status, "awaiting_analytics_dashboard_cutover");
  assert.equal(queue.queues.environmentKeys.length, ENV_KEY_ALIASES.length);
  assert.ok(queue.queues.environmentKeys.some((row) => row.legacyName === deviceMatrixKey && row.neutralAlias === "PLAYWRIGHT_DEVICE_MATRIX"));
  assert.ok(queue.queues.environmentKeys.some((row) => row.legacyName === decisionBucketKey && row.neutralAlias === "DECISION_PACKET_BUCKET"));
  assert.equal(queue.queues.exportedSymbolAliases.length, EXPORTED_SYMBOL_ALIASES.length);
  assert.ok(queue.queues.exportedSymbolAliases.some((row) => row.legacyName === recoverableState && row.neutralAlias === "RecoverableState"));
  assert.ok(queue.queues.contentContractAliases.some((row) => row.legacyName === supportDiagnostics));
});

test("buildCompatibilityRemovalQueue includes route aliases with removal conditions", () => {
  const cronVersion = lowerLabel(10);
  const settingsVersion = lowerLabel(6);
  const root = makeRoot();
  writeJson(root, "package.json", packageJsonWithAliases());
  writeJson(root, "artifacts/telemetry/event-inventory.json", { versionedEventRemovalQueue: [] });
  fs.mkdirSync(path.join(root, `src/app/api/cron/${cronVersion}/read-model-refresh`), { recursive: true });
  fs.writeFileSync(path.join(root, `src/app/api/cron/${cronVersion}/read-model-refresh/route.ts`), "export function GET() {}\n");
  fs.mkdirSync(path.join(root, `src/app/api/workspace/${settingsVersion}-settings`), { recursive: true });
  fs.writeFileSync(path.join(root, `src/app/api/workspace/${settingsVersion}-settings/route.ts`), "export function GET() {}\n");

  const queue = buildCompatibilityRemovalQueue(root);

  assert.equal(queue.queues.cronRoutes[0].legacyName, `/api/cron/${cronVersion}/read-model-refresh`);
  assert.equal(queue.queues.cronRoutes[0].neutralAlias, "/api/cron/read-model-refresh");
  assert.equal(queue.queues.cronRoutes[0].status, "alias_added");
  assert.equal(queue.queues.cronRoutes[0].validationCommands.neutral, "npm run check:compatibility-route-inventory");
  assert.equal(queue.queues.cronRoutes[0].productionSchedulerFollowUp.length > 0, true);
  assert.equal(queue.queues.cronRoutes[0].earliestRemovalCondition.length > 0, true);
  assert.equal(queue.queues.apiRoutes[0].legacyName, `/api/workspace/${settingsVersion}-settings`);
  assert.equal(queue.queues.apiRoutes[0].neutralAlias, "/api/workspace/settings");
});

test("analyzeCompatibilityRemovalQueue rejects missing aliases and stale artifacts", () => {
  const root = makeRoot();
  writeJson(root, "package.json", { scripts: { [PACKAGE_SCRIPT_ALIASES[0].legacy]: "node old.mjs" } });
  writeJson(root, "artifacts/telemetry/event-inventory.json", { versionedEventRemovalQueue: [] });
  writeJson(root, "artifacts/compatibility/removal-queue.json", { stale: true });

  const report = analyzeCompatibilityRemovalQueue({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "compatibility_package_neutral_script_missing"));
  assert.ok(report.issues.some((issue) => issue.issue === "compatibility_package_alias_bridge_missing"));
  assert.ok(report.issues.some((issue) => issue.issue === "compatibility_removal_queue_drift"));
});

test("analyzeCompatibilityRemovalQueue rejects unqueued versioned package scripts", () => {
  const root = makeRoot();
  const pkg = packageJsonWithAliases();
  pkg.scripts[`check:${"v"}99-unqueued`] = "node scripts/example.mjs";
  writeJson(root, "package.json", pkg);
  writeJson(root, "artifacts/telemetry/event-inventory.json", { versionedEventRemovalQueue: [] });
  writeCoverageArtifacts(root);
  writeJson(root, "artifacts/compatibility/removal-queue.json", buildCompatibilityRemovalQueue(root));

  const report = analyzeCompatibilityRemovalQueue({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "compatibility_package_versioned_script_missing_queue_entry"));
});

test("buildCompatibilityRemovalQueue adds generated exported-symbol and content-contract rows", () => {
  const typeName = label(10, "Thing");
  const scriptName = `check:${lowerLabel(10)}-example`;
  const root = makeRoot();
  writeJson(root, "package.json", packageJsonWithAliases());
  writeJson(root, "artifacts/telemetry/event-inventory.json", { versionedEventRemovalQueue: [] });
  fs.mkdirSync(path.join(root, "src/lib"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/lib/example.ts"), `export type ${typeName} = string;\nexport type Thing = ${typeName};\n`);
  writeJson(root, "artifacts/compatibility/versioned-exported-symbol-inventory.json", {
    symbols: [
      {
        path: "src/lib/example.ts",
        exportedName: typeName,
        suggestedNeutralName: "Thing",
        owner: "platform-hardening",
        compatibilityAction: "alias_added",
        validationCommand: "npm run check:versioned-exported-symbols",
        exportKind: "declaration",
        declarationKind: "type",
        typeOnly: true,
      },
    ],
  });
  writeJson(root, "artifacts/compatibility/versioned-content-contract-inventory.json", {
    contracts: [
      {
        path: "package.json",
        surfaceClass: "package_script_or_metadata",
        subSurfaceClass: "package_script_key",
        contractName: scriptName,
        suggestedNeutralName: "check:example",
        owner: "platform-hardening",
        reason: "Repo-local version content can be renamed after references are listed.",
        manualOnly: false,
        validationCommand: "npm run check:versioned-content-contracts",
        count: 1,
      },
    ],
  });

  const queue = buildCompatibilityRemovalQueue(root);

  assert.ok(queue.queues.exportedSymbolAliases.some((row) => row.legacyName === typeName && row.neutralAlias === "Thing"));
  assert.ok(
    queue.queues.contentContractAliases.some(
      (row) =>
        row.legacyName === scriptName &&
        row.neutralAlias === "check:example" &&
        row.subSurface === "package_script_key",
    ),
  );
});

test("buildCompatibilityRemovalQueue excludes generated content rows from documentation", () => {
  const scriptName = `check:${lowerLabel(10)}-example`;
  const root = makeRoot();
  writeJson(root, "package.json", packageJsonWithAliases());
  writeJson(root, "artifacts/telemetry/event-inventory.json", { versionedEventRemovalQueue: [] });
  writeCoverageArtifacts(root);
  writeJson(root, "artifacts/compatibility/versioned-content-contract-inventory.json", {
    contracts: [
      {
        path: "docs/example.md",
        surfaceClass: "package_script_or_metadata",
        contractName: scriptName,
        suggestedNeutralName: "check:example",
        owner: "platform-hardening",
        reason: "Fixture intentionally misclassified as config.",
        manualOnly: false,
        validationCommand: "npm run check:versioned-content-contracts",
        count: 1,
      },
    ],
  });
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs/example.md"), "fixture\n");
  writeJson(root, "artifacts/compatibility/removal-queue.json", buildCompatibilityRemovalQueue(root));

  const report = analyzeCompatibilityRemovalQueue({ root });

  assert.equal(report.ok, true);
  assert.equal(report.current.queues.contentContractAliases.some((row) => row.sourcePath === "docs/example.md"), false);
});

test("package script queue records readiness references outside package and docs", () => {
  const root = makeRoot();
  writeJson(root, "package.json", packageJsonWithAliases());
  writeJson(root, "artifacts/telemetry/event-inventory.json", { versionedEventRemovalQueue: [] });
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts/local-reference.mjs"), `const command = "${PACKAGE_SCRIPT_ALIASES[0].legacy}";\n`);

  const queue = buildCompatibilityRemovalQueue(root);
  const row = queue.queues.packageScriptAliases.find((entry) => entry.legacyName === PACKAGE_SCRIPT_ALIASES[0].legacy);

  assert.equal(row.status, "alias_added");
  assert.equal(row.externalReferenceCount, 1);
  assert.deepEqual(row.externalReferences, ["scripts/local-reference.mjs"]);
  assert.equal(row.readinessStatus, "blocked_by_repo_local_references");
  assert.equal(row.repoLocalReferenceCount, 1);
  assert.equal(row.blockerCategoryCounts.repo_local, 1);
  assert.match(row.readinessBlocker, /1 repo-local reference/u);
});

test("package script queue keeps aliases blocked until readiness evidence approves removal", () => {
  const root = makeRoot();
  writeJson(root, "package.json", packageJsonWithAliases());
  writeJson(root, "artifacts/telemetry/event-inventory.json", { versionedEventRemovalQueue: [] });

  const queue = buildCompatibilityRemovalQueue(root);
  const row = queue.queues.packageScriptAliases.find((entry) => entry.legacyName === PACKAGE_SCRIPT_ALIASES[0].legacy);

  assert.equal(row.status, "alias_added");
  assert.equal(row.readinessStatus, "blocked_by_manual_follow_up");
  assert.equal(row.localReadyForRemoval, true);
  assert.equal(row.externalReferenceCount, 0);
  assert.match(row.readinessBlocker, /manual compatibility evidence/u);
});

test("package script queue rejects ready aliases with repo-local blockers", () => {
  const root = makeRoot();
  const alias = PACKAGE_SCRIPT_ALIASES[0];
  writeJson(root, "package.json", packageJsonWithAliases());
  writeJson(root, "artifacts/telemetry/event-inventory.json", { versionedEventRemovalQueue: [] });
  writeCoverageArtifacts(root);
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts/local-reference.mjs"), `const command = "${alias.legacy}";\n`);
  writeJson(root, "artifacts/compatibility/versioned-package-script-readiness.json", {
    aliases: [
      {
        legacyName: alias.legacy,
        neutralAlias: alias.neutral,
        status: "ready_for_removal",
        readinessStatus: "ready_for_removal",
        readinessBlocker: "Fixture claims this alias is ready.",
        localReadyForRemoval: true,
        blockingReferenceCount: 1,
        repoLocalReferenceCount: 1,
        docsOnlyReferenceCount: 0,
        generatedArtifactReferenceCount: 0,
        externalOrManualReferenceCount: 0,
        blockerCategoryCounts: {
          docs_only: 0,
          external_or_manual: 0,
          generated_artifact: 0,
          ready_for_removal: 0,
          repo_local: 1,
        },
        blockingReferences: [
          {
            path: "scripts/local-reference.mjs",
            class: "tooling",
            blockerCategory: "repo_local",
          },
        ],
      },
    ],
  });
  writeJson(root, "artifacts/compatibility/removal-queue.json", buildCompatibilityRemovalQueue(root));

  const report = analyzeCompatibilityRemovalQueue({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "compatibility_package_ready_with_repo_local_references"));
});
