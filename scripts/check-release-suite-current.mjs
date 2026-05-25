#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const V10_OBJECTIVE_METRICS = [
  "activation",
  "command_palette_search",
  "report_reliability",
  "export_reliability",
  "renewal_reminders",
  "evidence_follow_up",
  "work_reachability",
  "contract_record_trust",
  "recoverability",
  "usability_participants",
  "scripted_first_time_activation_sessions",
];
const V10_OBJECTIVE_SAMPLE_SIZES = {
  activation: 100,
  command_palette_search: 200,
  report_reliability: 100,
  export_reliability: 100,
  renewal_reminders: 100,
  evidence_follow_up: 100,
  work_reachability: 200,
  contract_record_trust: 50,
  recoverability: 50,
  usability_participants: 20,
  scripted_first_time_activation_sessions: 100,
};
const V10_RELEASE_FIXTURE_MINIMUMS = {
  organizations: 1,
  contracts: 25,
  extracted_fields: 250,
  work_items: 50,
  obligations: 30,
  renewals: 20,
  approvals: 20,
  exceptions: 15,
  evidence_requests: 20,
  report_runs: 10,
  export_jobs: 10,
  import_jobs: 10,
};

function readOption(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? "";
}

function handleFixtureCommand() {
  const fixture = readOption("--fixture");
  const cleanup = readOption("--cleanup-fixture");
  const metric = fixture ?? cleanup;
  if (metric == null) return false;
  if (metric !== "all" && !V10_OBJECTIVE_METRICS.includes(metric)) {
    console.error(`Unknown V10 objective metric: ${metric}`);
    process.exit(1);
  }
  const action = fixture == null ? "cleanup" : "rebuild";
  const metrics = metric === "all" ? V10_OBJECTIVE_METRICS : [metric];
  const payload = {
    ok: true,
    action,
    metric,
    metrics,
    fixtureId: `v10-rc-${metric}`,
    fixtureManifest: {
      specVersion: "v10",
      fixtureVersion: `v10-rc-${metric}`,
      counts: V10_RELEASE_FIXTURE_MINIMUMS,
    },
    denominatorLocks: Object.fromEntries(
      metrics.map((name) => [name, `v10-rc:${name}:${V10_OBJECTIVE_SAMPLE_SIZES[name]}`])
    ),
    sampleSizes: Object.fromEntries(metrics.map((name) => [name, V10_OBJECTIVE_SAMPLE_SIZES[name]])),
    metricCaptureCommands: metrics.map(
      (name) => `npm run check:release-evidence -- --metric ${name} --lock v10-rc:${name}:${V10_OBJECTIVE_SAMPLE_SIZES[name]}`
    ),
    releaseEvidenceRows: metrics.map((name) => ({
      evidenceKey: `v10-release:objective-metric:${name}`,
      denominatorLockId: `v10-rc:${name}:${V10_OBJECTIVE_SAMPLE_SIZES[name]}`,
      fixedSampleSize: V10_OBJECTIVE_SAMPLE_SIZES[name],
      status: "release_check_required",
      promotionRule: "must_be_captured_in_release_candidate_workspace_before_promotion",
    })),
    teardownEvidenceKeys: metrics.map((name) => `v10-release:fixture-teardown:${name}`),
    privacyScanCommand: "npm run check:release-privacy-scan",
    denominatorLockPolicy: "fixed_sample_size_and_fixture_version_required_before_metric_capture",
    exclusionPolicy: "release_check_required until real RC evidence is captured",
    generatedDataOnly: true,
    fixtureSafetyPolicy: "generated_data_only_no_customer_data_and_teardown_required",
    syntheticDataUsedForPromotion: false,
    runtimeCaptureRequired: true,
    persistenceMode: "release_evidence_command_backed",
    environmentBlocker: "real_rc_seed_requires_database_credentials_and_release_candidate_workspace",
    persistentRowsRequired: metrics.length,
  };
  console.log(JSON.stringify(payload, null, 2));
  return true;
}

function walk(dir, out) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walk(p, out);
    } else if (
      ent.name.endsWith(".v10.test.ts") ||
      ent.name.endsWith(".v10.test.tsx") ||
      ent.name === "v10-recoverable-state.test.tsx"
    ) {
      out.push(p);
    }
  }
}

function isLegacyReleaseTestPath(path) {
  const name = path.split(/[\\/]/).pop() ?? "";
  return (
    name.endsWith(".v10.test.ts") ||
    name.endsWith(".v10.test.tsx") ||
    name === "v10-recoverable-state.test.tsx"
  );
}

function collectRenamedReleaseTestFiles(root) {
  const manifestPath = join(root, "artifacts/compatibility/versioned-naming-safe-rename-manifest.json");
  if (!existsSync(manifestPath)) return [];

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const plannedRenames = Array.isArray(manifest.plannedRenames) ? manifest.plannedRenames : [];
  const targets = new Set();
  for (const rename of plannedRenames) {
    if (rename?.status !== "applied") continue;
    if (typeof rename.from !== "string" || typeof rename.to !== "string") continue;
    if (!isLegacyReleaseTestPath(rename.from)) continue;
    const target = join(root, rename.to);
    if (existsSync(target)) targets.add(target);
  }
  return [...targets].sort();
}

if (handleFixtureCommand()) process.exit(0);

const root = process.cwd();
const files = [];
walk(join(root, "src"), files);
if (files.length === 0) {
  files.push(...collectRenamedReleaseTestFiles(root));
}
files.sort();

const userFacingCopyFiles = [
  "src/components/layout/command-palette.tsx",
  "src/components/ui/recoverable-state.tsx",
  "src/app/(dashboard)/dashboard/page.tsx",
  "src/app/(dashboard)/work/page.tsx",
  "src/app/(dashboard)/contracts/[id]/page.tsx",
];
const forbiddenUserFacingCopy = ["V10 recovery action", "V10 state contract needs attention"];
for (const relative of userFacingCopyFiles) {
  const source = readFileSync(join(root, relative), "utf8");
  for (const phrase of forbiddenUserFacingCopy) {
    if (source.includes(phrase)) {
      console.error(`V10 cleanup failed: internal user-facing copy remains in ${relative}: ${phrase}`);
      process.exit(1);
    }
  }
}

const evidence = spawnSync("node", ["scripts/check-release-evidence.mjs"], {
  stdio: "inherit",
  cwd: root,
  shell: false,
});

if ((evidence.status ?? 1) !== 0) process.exit(evidence.status ?? 1);

for (const args of [
  ["scripts/check-release-inventory-lock.mjs"],
  ["scripts/check-migration-smoke-current.mjs"],
  ["scripts/check-release-evidence.mjs", "--privacy-scan", "all"],
  ["scripts/check-cron-route-auth.mjs"],
  ["scripts/check-scheduled-cron-route-wrappers.mjs"],
  ["scripts/check-vercel-cron-alignment.mjs"],
]) {
  const gate = spawnSync("node", args, {
    stdio: "inherit",
    cwd: root,
    shell: false,
  });
  if ((gate.status ?? 1) !== 0) process.exit(gate.status ?? 1);
}

if (files.length === 0) {
  console.error("No current release test files found.");
  process.exit(1);
}

// After heavy upstream steps (e.g. full coverage), many parallel fork workers can hit
// vitest-pool "Timeout waiting for worker to respond". Cap parallelism for this suite.
const result = spawnSync(
  "npx",
  ["vitest", "run", "--no-file-parallelism", "--max-workers=4", ...files],
  {
    stdio: "inherit",
    cwd: root,
    shell: false,
  }
);
process.exit(result.status ?? 1);
