#!/usr/bin/env node
/**
 * Tiered autonomous perf driver. Writes artifacts/autonomous-perf-run.json.
 *
 * Env:
 *   PERF_TIER=A|B|C|D|E|F (default A)
 *   RUN_ANALYZE=1 — Tier B includes npm run analyze
 *   RUN_LIGHTHOUSE=1 / RUN_K6=1 — Tier C synthetic checks
 *   RUN_E2E_PERF=1 — Tier D subset
 *   RUN_STRYKER=1 / RUN_K6_SOAK=1 — Tier E
 *   RUN_TIER_F=1 — optional mega verify (never default)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runParallel, runSequential } from "../lib/scheduler.mjs";
import { AUTONOMOUS_PERF_EXT_KEYS } from "../lib/autonomous-perf-ext-keys.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const artifactsDir = path.join(root, "artifacts");
const runPath = path.join(artifactsDir, "autonomous-perf-run.json");
const handoffPath = path.join(artifactsDir, "autonomous-perf-external-handoff.keys.json");
const groupsPath = path.join(artifactsDir, "autonomous-perf-ext-key-groups.json");
const coveragePath = path.join(artifactsDir, "autonomous-perf-coverage-matrix.json");

function nowIso() {
  return new Date().toISOString();
}

function validateRegistryFiles() {
  if (!fs.existsSync(handoffPath)) throw new Error(`Missing ${handoffPath}`);
  if (!fs.existsSync(groupsPath)) throw new Error(`Missing ${groupsPath}`);
  const handoff = JSON.parse(fs.readFileSync(handoffPath, "utf8"));
  const grouped = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
  const handoffKeys = Object.keys(handoff.keys ?? {}).sort();
  const groupKeys = Object.keys(grouped.groups ?? {}).sort();
  const expected = [...AUTONOMOUS_PERF_EXT_KEYS].sort();
  if (handoffKeys.join("\n") !== expected.join("\n")) {
    throw new Error(
      "autonomous-perf-external-handoff.keys.json keys do not match scripts/lib/autonomous-perf-ext-keys.mjs",
    );
  }
  if (groupKeys.join("\n") !== expected.join("\n")) {
    throw new Error(
      "autonomous-perf-ext-key-groups.json keys do not match scripts/lib/autonomous-perf-ext-keys.mjs",
    );
  }
  for (const k of expected) {
    const slug = grouped.groups[k];
    if (typeof slug !== "string" || !slug.length) {
      throw new Error(`Missing taxonomy_group_slug for ${k}`);
    }
  }
}

function npmLifecycleFlags() {
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const scripts = pkg.scripts ?? {};
  const flags = {};
  for (const name of ["prepare", "postinstall", "prepublishOnly", "prepack", "postpack"]) {
    flags[`npmScript.${name}Present`] = Boolean(scripts[name]);
  }
  return flags;
}

function loadOptionalComplianceArtifacts() {
  const tier = (process.env.PERF_TIER ?? "A").toUpperCase();
  const heavy = tier === "D" || tier === "E" || tier === "F";
  const results = [];
  const candidates = [
    "pqc-readiness.json",
    "neurodiversity-cognitive-path.json",
    "graphql-surface-absent.json",
    "web3-surface-absent.json",
    "zap-baseline.json",
    "pen-test-findings.json",
    "stride-dread-threat-model.json",
    "sbom-diff-report.json",
    "license-allowlist.json",
    "outbox-event-schemas.json",
    "subprocessors.json",
    "scim-oidc-contract.json",
    "rpo-rto-status.json",
  ];
  for (const name of candidates) {
    const p = path.join(artifactsDir, name);
    if (!fs.existsSync(p)) {
      results.push({ id: `artifact:${name}`, cmd: "(absent)", status: "skipped", durationMs: 0, exitCode: 0 });
      continue;
    }
    const started = Date.now();
    try {
      JSON.parse(fs.readFileSync(p, "utf8"));
      if (heavy && name.endsWith(".json")) {
        fs.readFileSync(p, "utf8");
      }
      results.push({
        id: `artifact:${name}`,
        cmd: "JSON.parse",
        status: "passed",
        durationMs: Date.now() - started,
        exitCode: 0,
      });
    } catch {
      results.push({
        id: `artifact:${name}`,
        cmd: "JSON.parse",
        status: "failed",
        durationMs: Date.now() - started,
        exitCode: 1,
      });
    }
  }
  return results;
}

function mapSchedulerResult(r) {
  const script = r.script;
  return {
    id: script.replace(/:/g, "-"),
    cmd: `npm run ${script}`,
    status: r.ok ? "passed" : "failed",
    durationMs: r.durationMs,
    exitCode: r.ok ? 0 : r.code,
  };
}

async function main() {
  const tier = (process.env.PERF_TIER ?? "A").toUpperCase();
  const startedAt = nowIso();
  const checks = [];
  const riskNotes = [];

  validateRegistryFiles();
  if (!fs.existsSync(coveragePath)) {
    riskNotes.push(`Missing ${path.relative(root, coveragePath)} — run generator or restore from repo.`);
  }

  const skipBuild = process.env.PERF_SKIP_BUILD === "1";
  const tierASteps = skipBuild
    ? [
        "check:performance-static",
        "check:bundle-budget",
        "check:autonomous-perf-registry",
        "check:autonomous-perf-phase-closure",
        "check:duplicate-deps-react",
      ]
    : [
        "check:performance-static",
        "check:bundle-budget",
        "check:autonomous-perf-registry",
        "check:autonomous-perf-phase-closure",
        "check:duplicate-deps-react",
        "build",
      ];
  const tierA = await runSequential(tierASteps);
  checks.push(...tierA.map(mapSchedulerResult));
  if (skipBuild) {
    riskNotes.push("PERF_SKIP_BUILD=1: build step omitted (assumes prior npm run build in same workspace).");
  }

  const analyzePresent = fs.existsSync(path.join(root, ".next", "analyze"));
  const prerequisites = {
    analyzeArtifactPresent: analyzePresent,
    baseUrlPresent: Boolean(process.env.BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL),
  };

  if (process.env.RUN_ANALYZE === "1" || tier === "B" || tier === "F") {
    const b = await runSequential([{ script: "analyze", required: tier === "F" }]);
    checks.push(...b.map(mapSchedulerResult));
    prerequisites.analyzeArtifactPresent = fs.existsSync(path.join(root, ".next", "analyze"));
  }

  if (process.env.RUN_LIGHTHOUSE === "1") {
    if (prerequisites.baseUrlPresent) {
      const c = await runSequential(["test:lighthouse"]);
      checks.push(...c.map(mapSchedulerResult));
    } else {
      checks.push({
        id: "test-lighthouse",
        cmd: "npm run test:lighthouse",
        status: "skipped",
        durationMs: 0,
        exitCode: 0,
      });
      riskNotes.push("test:lighthouse skipped: set BASE_URL or PLAYWRIGHT_BASE_URL");
    }
  }

  if (process.env.RUN_K6 === "1") {
    const k = await runSequential(["test:k6:smoke"]);
    checks.push(...k.map(mapSchedulerResult));
  }

  if (process.env.RUN_E2E_PERF === "1" || tier === "D") {
    const d = await runParallel(["test:e2e:smoke"]);
    checks.push(...d.map(mapSchedulerResult));
  }

  if (process.env.RUN_STRYKER === "1" || process.env.RUN_K6_SOAK === "1" || tier === "E") {
    const eScripts = [
      ...(process.env.RUN_STRYKER === "1" || tier === "E" ? ["test:stryker"] : []),
      ...(process.env.RUN_K6_SOAK === "1" || tier === "E" ? ["test:k6:soak"] : []),
    ];
    if (eScripts.length) {
      const e = await runParallel(eScripts);
      checks.push(...e.map(mapSchedulerResult));
    }
  }

  if (process.env.RUN_TIER_F === "1" || tier === "F") {
    const f = await runSequential([{ script: "pipeline:verify", required: false }]);
    checks.push(...f.map(mapSchedulerResult));
  }

  checks.push(...loadOptionalComplianceArtifacts());

  const failed = checks.find((c) => c.status === "failed");
  const finishedAt = nowIso();

  const run = {
    schemaVersion: 2,
    startedAt,
    finishedAt,
    tier,
    checks,
    prerequisites,
    riskNotes,
    npmLifecycle: npmLifecycleFlags(),
    runner: {
      os: process.platform,
      arch: process.arch,
      cpus: typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length,
      label: process.env.RUNNER_OS ?? process.env.ImageOS ?? null,
      cpuModel: os.cpus()[0]?.model ?? null,
    },
    gitSha: process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    nodeVersion: process.version,
    platform: process.platform,
    githubWorkflowRunId: process.env.GITHUB_RUN_ID ?? null,
    githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    githubRepository: process.env.GITHUB_REPOSITORY ?? null,
    ciBranch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || null,
    runnerImageDigest: process.env.RUNNER_IMAGE_DIGEST ?? null,
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ pipeline: "autonomous-perf", tier, checks: checks.length, failed: Boolean(failed) }, null, 2));
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
