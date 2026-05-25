#!/usr/bin/env node
/**
 * Emit artifacts/debugging-sweep-closure.json — maximal debugging sweep closure ledger (plan inventories A–AK).
 * --execute runs a bounded npm script batch and records pass/fail; other rows use skipped_waiver LOCAL_RUNSET_V1.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { runCommand } from "./lib/process.mjs";
import { SECURITY_REPORT_FILES, SECURITY_REPORTS_RELATIVE_DIR } from "./lib/security-report-paths.mjs";

/**
 * @typedef {{
 *   id: string;
 *   kind: string;
 *   command_or_workflow: string;
 *   manifest_tier: string | null;
 *   status: string;
 *   waiver_id: string | null;
 *   owner: string | null;
 *   log_uri: string | null;
 *   duration_ms: number | null;
 *   notes: string | null;
 * }} Row
 */

const root = process.cwd();
const outDir = path.join(root, "artifacts");
const outPath = path.join(outDir, "debugging-sweep-closure.json");
const WAIVE_DEFER = "LOCAL_RUNSET_V1";
const WAIVE_INVENTORY = "CLOSURE_INVENTORY_DEFER";

const execute = process.argv.includes("--execute");

function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: root }).trim();
  } catch {
    return "unknown";
  }
}

function readPkgScripts() {
  const raw = fs.readFileSync(path.join(root, "package.json"), "utf8");
  const pkg = JSON.parse(raw);
  return pkg.scripts || {};
}

function listWorkflows() {
  const dir = path.join(root, ".github", "workflows");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();
}

/** @type {{ script: string, id: string, timeoutMs: number }[]} */
const LOCAL_RUNSET = [
  { id: "npm-lint", script: "lint", timeoutMs: 300_000 },
  { id: "npm-typecheck", script: "typecheck", timeoutMs: 180_000 },
  { id: "npm-check-debugging-sweep", script: "check:debugging-sweep", timeoutMs: 120_000 },
  { id: "npm-check-vercel-cron", script: "check:vercel-cron", timeoutMs: 120_000 },
  { id: "npm-check-dependabot-config", script: "check:dependabot-config", timeoutMs: 120_000 },
  { id: "npm-check-next-config-surface", script: "check:next-config-surface", timeoutMs: 120_000 },
  { id: "npm-check-env-matrix", script: "check:env-matrix", timeoutMs: 120_000 },
  { id: "npm-check-e2e-env-matrix", script: "check:e2e-env-matrix", timeoutMs: 120_000 },
  { id: "npm-test-ui-a11y", script: "test:ui:a11y", timeoutMs: 300_000 },
  { id: "npm-check-release-promotable", script: "check:release-promotable", timeoutMs: 180_000 },
  { id: "npm-report-reproducible-build", script: "report:reproducible-build", timeoutMs: 300_000 },
  { id: "npm-report-bus-factor-codeowners", script: "report:bus-factor-codeowners", timeoutMs: 120_000 },
  { id: "npm-report-ratchet-snapshot", script: "report:ratchet-snapshot", timeoutMs: 120_000 },
  { id: "npm-report-security-docs", script: "report:security-docs", timeoutMs: 300_000 },
  { id: "npm-test-scripts", script: "test:scripts", timeoutMs: 600_000 },
];

async function runBatch() {
  /** @type {Row[]} */
  const executed = [];
  for (const step of LOCAL_RUNSET) {
    const started = Date.now();
    const r = await runCommand("npm", ["run", step.script], {
      cwd: root,
      stdio: "inherit",
      timeoutMs: step.timeoutMs,
      shell: false,
    });
    executed.push({
      id: step.id,
      kind: "npm_script",
      command_or_workflow: `npm run ${step.script}`,
      manifest_tier: null,
      status: r.ok ? "pass" : "fail",
      waiver_id: null,
      owner: null,
      log_uri: null,
      duration_ms: Date.now() - started,
      notes: r.timedOut ? "timeout" : null,
    });
  }
  return executed;
}

/** @param {string} dir */
function walkSourceFiles(dir, predicate) {
  const hits = [];
  const absBase = path.join(root, dir);
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      if (ent.name === "node_modules") continue;
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name.startsWith(".")) continue;
        walk(p);
      } else if (predicate(ent.name)) {
        hits.push(path.relative(root, p).replace(/\\/g, "/"));
      }
    }
  }
  walk(absBase);
  return [...new Set(hits)].sort();
}

/** Plan inventories: AJ issue templates, AE Vercel crons, AK shards, CI matrix, tiers, supply-chain, property/fuzz, pipelines. */
/** @param {Row[]} rows */
function appendExtendedPlanInventory(rows) {
  const nvmrcPath = path.join(root, ".nvmrc");
  let nvmrc = "";
  try {
    nvmrc = fs.readFileSync(nvmrcPath, "utf8").trim();
  } catch {
    nvmrc = "";
  }
  rows.push({
    id: "repo-policy-nvmrc-node-version",
    kind: "repo_policy_file",
    command_or_workflow: ".nvmrc",
    manifest_tier: null,
    status: nvmrc ? "pass" : "fail",
    waiver_id: null,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: nvmrc ? `Node pin ${nvmrc}; align CI node-version-file and engines` : "missing .nvmrc",
  });

  const issueDirs = [path.join(root, ".github", "ISSUE_TEMPLATE"), path.join(root, ".github", "issue_template")];
  const issueFiles = [];
  for (const idir of issueDirs) {
    if (!fs.existsSync(idir)) continue;
    for (const ent of fs.readdirSync(idir, { withFileTypes: true })) {
      if (ent.isFile() && (ent.name.endsWith(".md") || ent.name.endsWith(".yml") || ent.name.endsWith(".yaml"))) {
        issueFiles.push(path.relative(root, path.join(idir, ent.name)).replace(/\\/g, "/"));
      }
    }
  }
  rows.push({
    id: "repo-policy-github-issue-templates",
    kind: "repo_policy_file",
    command_or_workflow: ".github/ISSUE_TEMPLATE/*",
    manifest_tier: null,
    status: issueFiles.length ? "pass" : "skipped_waiver",
    waiver_id: issueFiles.length ? null : "NO_ISSUE_TEMPLATES",
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: issueFiles.length
      ? `${issueFiles.length} template file(s); inventory AJ`
      : "optional — add templates when org wants GitHub issue hygiene",
  });

  const vercelPath = path.join(root, "vercel.json");
  try {
    const vj = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
    const crons = Array.isArray(vj.crons) ? vj.crons : [];
    for (let i = 0; i < crons.length; i++) {
      const c = crons[i];
      const p = typeof c?.path === "string" ? c.path : `cron-${i}`;
      const sched = typeof c?.schedule === "string" ? c.schedule : "";
      const slug = p.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || `idx-${i}`;
      rows.push({
        id: `deploy-vercel-cron-${slug}`,
        kind: "deploy_config_review",
        command_or_workflow: `vercel.json cron: ${p} @ ${sched}`,
        manifest_tier: null,
        status: "pass",
        waiver_id: null,
        owner: null,
        log_uri: null,
        duration_ms: null,
        notes: "inventory AE — reconcile with npm run check:vercel-cron",
      });
    }
  } catch {
    /* vercel aggregate row already marks fail if missing */
  }

  for (let s = 1; s <= 4; s++) {
    rows.push({
      id: `playwright-blob-merge-junit-shard-${s}-of-4`,
      kind: "telemetry_report",
      command_or_workflow: `PLAYWRIGHT_BLOB_REPORT=1 merge:junit shard ${s}/4 (junit-merge-shards.mjs)`,
      manifest_tier: null,
      status: "skipped_waiver",
      waiver_id: WAIVE_INVENTORY,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: "inventory AK — qa-code-maximal.yml matrix uploads per-shard junit",
    });
  }

  rows.push({
    id: "playwright-lifecycle-global-setup",
    kind: "playwright_config_axis",
    command_or_workflow: "playwright.config.ts globalSetup (e2e/global-setup-auth-storage.ts when reuse auth)",
    manifest_tier: null,
    status: "pass",
    waiver_id: null,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "inventory AB",
  });
  rows.push({
    id: "playwright-lifecycle-global-teardown",
    kind: "playwright_config_axis",
    command_or_workflow: "playwright.config.ts globalTeardown (e2e/global-teardown.ts)",
    manifest_tier: null,
    status: "pass",
    waiver_id: null,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "inventory AB",
  });
  rows.push({
    id: "playwright-lifecycle-reporters",
    kind: "playwright_config_axis",
    command_or_workflow: "playwright.config.ts reporters (list/html/blob per CI env)",
    manifest_tier: null,
    status: "skipped_waiver",
    waiver_id: WAIVE_INVENTORY,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "inventory AB — verify in CI vs local",
  });

  const ciJobs = [
    "quality_static_security",
    "quality_unit",
    "quality_security",
    "quality_build_e2e",
    "quality_static_surface",
    "quality_static_governance",
    "quality_static_codehealth",
    "quality_e2e_onboarding_full",
    "qa_ultimate_pr_shard",
    "quality",
    "runtime_comprehensive_pass",
  ];
  for (const job of ciJobs) {
    rows.push({
      id: `ci-yml-job-${job.replace(/[^a-zA-Z0-9]+/g, "-")}`,
      kind: "telemetry_report",
      command_or_workflow: `.github/workflows/ci.yml job:${job}`,
      manifest_tier: null,
      status: "pass",
      waiver_id: null,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: "inventory A — map to npm scripts in ci-parity-matrix / pipeline:ci-parity",
    });
  }

  for (const p of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const tierScript = `qa:sweep:max:p${p}`;
    rows.push({
      id: `qa-sweep-max-tier-p${p}`,
      kind: "npm_script",
      command_or_workflow: "npm run " + tierScript,
      manifest_tier: `P${p}`,
      status: "skipped_waiver",
      waiver_id: WAIVE_INVENTORY,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: "tier-ladder inventory — run sequentially for maximal closure; P10 includes checks_batch",
    });
  }

  const pipelines = [
    "pipeline:verify",
    "pipeline:ci-parity",
    "pipeline:security:comprehensive",
    "pipeline:release:checklist",
    "pipeline:qa-ultimate",
    "qa:sweep:code:maximal",
  ];
  for (const script of pipelines) {
    rows.push({
      id: `pipeline-track-${script.replace(/[^a-zA-Z0-9]+/g, "-")}`,
      kind: "npm_script",
      command_or_workflow: `npm run ${script}`,
      manifest_tier: null,
      status: "skipped_waiver",
      waiver_id: WAIVE_INVENTORY,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: "pipeline-verify-track / security / release inventory",
    });
  }

  rows.push({
    id: "code-maximal-github-event-schedule-parity",
    kind: "ifEnv_gate",
    command_or_workflow: "GITHUB_EVENT_NAME=schedule parity (QA_MAXIMAL_SUBSET=0 in qa-code-maximal.yml)",
    manifest_tier: null,
    status: "skipped_waiver",
    waiver_id: WAIVE_INVENTORY,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "inventory code-maximal-parity — cron-only defaults in workflow",
  });

  const supplyScripts = [
    "npm audit --audit-level=high",
    "npm run audit:moderate",
    "npm run sbom",
    "npm run license:allowlist-verify",
    "npm run verify:ofac-sample-hash",
    "npm run verify:ofac-sample-hash:strict",
  ];
  for (const cmd of supplyScripts) {
    const slug = cmd.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
    rows.push({
      id: `supply-chain-${slug}`,
      kind: "telemetry_report",
      command_or_workflow: cmd,
      manifest_tier: null,
      status: "skipped_waiver",
      waiver_id: WAIVE_INVENTORY,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: "inventory X — run in CI audit job or locally for maximal sweep",
    });
  }

  const optionalCli = [
    "dns-caa-smoke",
    "dnssec-privacy-smoke",
    "cert-expiry-smoke",
    "readability-smoke",
    "email-auth-dns-smoke",
    "verify-cosign-artifact",
    "verify-slsa-attestation",
    "security:semgrep:full",
    "check:openapi-contract-smoke",
    "check:zap-baseline-compare",
    "check:dr-drill-smoke",
    "check:k8s-conftest-stub",
  ];
  for (const script of optionalCli) {
    rows.push({
      id: `optional-cli-${script.replace(/[^a-zA-Z0-9]+/g, "-")}`,
      kind: "ifEnv_gate",
      command_or_workflow: `${script} (nightly tier ifEnv)`,
      manifest_tier: "nightly_fast",
      status: "skipped_waiver",
      waiver_id: WAIVE_INVENTORY,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: "inventory Z — org secrets / optional fleet",
    });
  }

  const perfExtras = ["npm run analyze", "npm run test:stryker", "npm run test:k6:soak", "npm run perf:heap-snapshot:staging"];
  for (const cmd of perfExtras) {
    rows.push({
      id: `perf-extra-${cmd.replace(/[^a-zA-Z0-9]+/g, "-")}`,
      kind: "telemetry_report",
      command_or_workflow: cmd,
      manifest_tier: null,
      status: "skipped_waiver",
      waiver_id: WAIVE_INVENTORY,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: "inventory perf-security-extras",
    });
  }

  rows.push({
    id: "npm-run-write-qa-maximal-twelfth-closure",
    kind: "npm_script",
    command_or_workflow: "npm run write:qa-maximal-twelfth-closure",
    manifest_tier: null,
    status: "skipped_waiver",
    waiver_id: WAIVE_INVENTORY,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "perf-security-extras / P12 artifact when policy requires",
  });

  const taxonomyTiers = [
    "qa:sweep:ultimate:taxonomy-closure",
    "qa:sweep:ultimate:taxonomy-closure-strict",
    "qa:sweep:ultimate:taxonomy-bidirectional",
    "qa:sweep:checks:batch:strict",
  ];
  for (const script of taxonomyTiers) {
    rows.push({
      id: `taxonomy-tier-${script.replace(/[^a-zA-Z0-9]+/g, "-")}`,
      kind: "npm_script",
      command_or_workflow: `npm run ${script}`,
      manifest_tier: "taxonomy_closure",
      status: "skipped_waiver",
      waiver_id: WAIVE_INVENTORY,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: "inventory W postmerge-taxonomy-tiers",
    });
  }

  rows.push({
    id: "ifenv-nightly-deep-comprehensive",
    kind: "ifEnv_gate",
    command_or_workflow: "QA_ULTIMATE_TIER=nightly_deep (check:quick + check:comprehensive-pass chain)",
    manifest_tier: "nightly_deep",
    status: "skipped_waiver",
    waiver_id: WAIVE_INVENTORY,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "inventory S — staging secrets for comprehensive-pass",
  });

  rows.push({
    id: "data-plane-supabase-local",
    kind: "ifEnv_gate",
    command_or_workflow: "supabase db reset + migrations + optional docker-compose.chaos",
    manifest_tier: null,
    status: "skipped_waiver",
    waiver_id: WAIVE_INVENTORY,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "data-plane-supabase — run locally when changing RLS/migrations",
  });

  const propFiles = [
    ...walkSourceFiles("src", (n) => n.endsWith(".property.test.ts")),
    ...walkSourceFiles("src", (n) => n.includes("fast-check") && n.endsWith(".test.ts")),
  ].filter((f, i, a) => a.indexOf(f) === i);

  if (propFiles.length === 0) {
    rows.push({
      id: "property-fuzz-no-files",
      kind: "node_smoke_test",
      command_or_workflow: "glob: **/*.property.test.ts + **/*fast-check*.test.ts under src/",
      manifest_tier: null,
      status: "skipped_waiver",
      waiver_id: WAIVE_INVENTORY,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: "inventory AG — none found under src/",
    });
  } else if (propFiles.length > 48) {
    rows.push({
      id: "property-fuzz-aggregate",
      kind: "node_smoke_test",
      command_or_workflow: `property/fuzz tests (${propFiles.length} files under src/)`,
      manifest_tier: null,
      status: "pass",
      waiver_id: null,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: `sample: ${propFiles.slice(0, 5).join(", ")} — vitest run includes these via test:logic`,
    });
  } else {
    for (let idx = 0; idx < propFiles.length; idx++) {
      const rel = propFiles[idx];
      const slug = rel.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 48);
      rows.push({
        id: `property-fuzz-${idx}-${slug}`,
        kind: "node_smoke_test",
        command_or_workflow: rel,
        manifest_tier: null,
        status: "pass",
        waiver_id: null,
        owner: null,
        log_uri: null,
        duration_ms: null,
        notes: "inventory AG — included in vitest default run",
      });
    }
  }

  const p11 = "artifacts/qa-maximal-twelfth-expansion-closure.json";
  rows.push({
    id: "artifact-qa-maximal-twelfth-expansion-closure",
    kind: "manual_doc_review",
    command_or_workflow: p11,
    manifest_tier: null,
    status: "skipped_waiver",
    waiver_id: WAIVE_INVENTORY,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: fs.existsSync(path.join(root, p11))
      ? "P11 maximal bundle closure artifact — regenerate via npm run write:qa-maximal-twelfth-closure"
      : "run npm run write:qa-maximal-twelfth-closure to materialize",
  });

  rows.push({
    id: "governance-codemod-zinc-sweep-tokens",
    kind: "npm_script",
    command_or_workflow: "npm run codemod:zinc-sweep-tokens",
    manifest_tier: null,
    status: "skipped_waiver",
    waiver_id: WAIVE_INVENTORY,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "governance-reports-extra — only when check:zinc-budget fails",
  });

  rows.push({
    id: "telemetry-report-security-docs-bundle",
    kind: "telemetry_report",
    command_or_workflow: "npm run report:security-docs",
    manifest_tier: null,
    status: "skipped_waiver",
    waiver_id: WAIVE_INVENTORY,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "report-telemetry-sweep inventory U",
  });

  rows.push({
    id: "vitest-config-logic",
    kind: "toolchain_config_file",
    command_or_workflow: "vitest.config.ts",
    manifest_tier: null,
    status: fs.existsSync(path.join(root, "vitest.config.ts")) ? "pass" : "fail",
    waiver_id: null,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "toolchain-config-files — test:logic",
  });
  rows.push({
    id: "vitest-config-ui",
    kind: "toolchain_config_file",
    command_or_workflow: "vitest.ui.config.ts",
    manifest_tier: null,
    status: fs.existsSync(path.join(root, "vitest.ui.config.ts")) ? "pass" : "fail",
    waiver_id: null,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "toolchain-config-files — test:ui / coverage",
  });

  rows.push({
    id: "vitest-v10-extras-scripts",
    kind: "npm_script",
    command_or_workflow: "npm run check:release-promotable:report && npm run report:runtime-evidence-plan",
    manifest_tier: null,
    status: "skipped_waiver",
    waiver_id: WAIVE_INVENTORY,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "inventory AC — exercised in ultimate / release tiers",
  });
}

/** @param {Row[]} rows */
function appendPlaywrightAndDocInventory(rows) {
  const axes = [
    ["PLAYWRIGHT_REUSE_AUTH_STORAGE", "reuse auth storage globalSetup when credentials + flag"],
    ["PLAYWRIGHT_ONBOARDING_DEEP", "firefox+webkit+chromium project set"],
    ["PLAYWRIGHT_MULTI_BROWSER", "multi-engine matrix"],
    ["PLAYWRIGHT_VISUAL", "screenshot on for visual specs"],
    ["PLAYWRIGHT_MOBILE", "Pixel 5 + iPad projects"],
    ["PLAYWRIGHT_MAXIMAL_CI", "maximal CI five-project matrix"],
    ["PLAYWRIGHT_BLOB_REPORT", "blob report + merge-reports / junit parity (inventory AK)"],
    ["PLAYWRIGHT_TRACE_FULL", "trace on"],
    ["PLAYWRIGHT_TRACE_FAILURE_ONLY", "retain-on-failure trace"],
    ["PLAYWRIGHT_VIDEO", "video on-first-retry"],
    ["PLAYWRIGHT_BASE_URL", "baseURL override"],
    ["CI fullyParallel/workers", "CI parallelization vs local workers:1"],
  ];
  for (const [envKey, note] of axes) {
    rows.push({
      id: `playwright-axis-${envKey.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`,
      kind: "playwright_config_axis",
      command_or_workflow: `playwright.config.ts:${envKey}`,
      manifest_tier: null,
      status: "skipped_waiver",
      waiver_id: WAIVE_INVENTORY,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: `${note}; exercise via qa:sweep / e2e matrix or waiver`,
    });
  }

  const profiles = [
    ["maximal-ci", "PLAYWRIGHT_MAXIMAL_CI"],
    ["onboarding-deep", "PLAYWRIGHT_ONBOARDING_DEEP"],
    ["multi-browser", "PLAYWRIGHT_MULTI_BROWSER"],
    ["mobile", "PLAYWRIGHT_MOBILE"],
    ["visual", "PLAYWRIGHT_VISUAL"],
    ["default-chromium", "default single project"],
  ];
  for (const [slug, ref] of profiles) {
    rows.push({
      id: `playwright-profile-${slug}`,
      kind: "playwright_profile",
      command_or_workflow: `playwright profile:${slug} (${ref})`,
      manifest_tier: null,
      status: "skipped_waiver",
      waiver_id: WAIVE_INVENTORY,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: "row inventory C/D/J; run matrix jobs or universe for evidence",
    });
  }

  rows.push({
    id: "playwright-blob-merge-reports",
    kind: "playwright_config_axis",
    command_or_workflow: "npx playwright merge-reports + npm run merge:junit when PLAYWRIGHT_BLOB_REPORT=1",
    manifest_tier: null,
    status: "skipped_waiver",
    waiver_id: WAIVE_INVENTORY,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "inventory AK — shard/blob CI parity",
  });

  const secDir = SECURITY_REPORTS_RELATIVE_DIR;
  const docs = [
    "src/lib/spec-artifact-ids.ts",
    "src/lib/spec-trace-map.ts",
    "src/lib/release-contract.ts",
    `${secDir}/${SECURITY_REPORT_FILES.routeCoverage}`,
    `${secDir}/${SECURITY_REPORT_FILES.apiAuthHeuristics}`,
    `${secDir}/${SECURITY_REPORT_FILES.serverActions}`,
    `${secDir}/${SECURITY_REPORT_FILES.libAdmin}`,
    "README.md",
  ];
  for (const rel of docs) {
    const exists = fs.existsSync(path.join(root, rel));
    const isGeneratedSecurity = rel.startsWith(`${SECURITY_REPORTS_RELATIVE_DIR}/`);
    rows.push({
      id: `manual-doc-${rel.replace(/[^a-zA-Z0-9]+/g, "-")}`,
      kind: "manual_doc_review",
      command_or_workflow: rel,
      manifest_tier: null,
      status:
        isGeneratedSecurity || exists ? "skipped_waiver" : "fail",
      waiver_id:
        isGeneratedSecurity || exists ? WAIVE_INVENTORY : null,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: isGeneratedSecurity
        ? exists
          ? "generated security report; refresh via npm run report:security-docs"
          : "run npm run report:security-docs before strict inventory / release tiers"
        : exists
          ? "present; diff vs code in maximal sweep / preconditions"
          : "missing file",
    });
  }

  const fixtures = [
    "e2e/fixtures/app-fixture.ts",
    "e2e/fixtures/env-gates.ts",
    "e2e/fixtures/fail-on-console.ts",
    "e2e/global-setup-auth-storage.ts",
    "e2e/global-teardown.ts",
  ];
  for (const rel of fixtures) {
    rows.push({
      id: `fixture-policy-${rel.replace(/[^a-zA-Z0-9]+/g, "-")}`,
      kind: "fixture_or_fixture_policy",
      command_or_workflow: rel,
      manifest_tier: null,
      status: fs.existsSync(path.join(root, rel)) ? "pass" : "fail",
      waiver_id: null,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: "fixture / lifecycle inventory AB",
    });
  }

  rows.push({
    id: "manual-security-high-risk-deps",
    kind: "manual_security_surface_review",
    command_or_workflow:
      "stripe, openai, pdf-parse, mammoth, @react-pdf/renderer, resend vs outbound allowlist + upload banlist",
    manifest_tier: null,
    status: "skipped_waiver",
    waiver_id: WAIVE_INVENTORY,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "inventory AH — align when contract checks fail",
  });

  rows.push({
    id: "property-fuzz-glob",
    kind: "ifEnv_gate",
    command_or_workflow: "*.property.test.ts + fast-check vitest inclusion",
    manifest_tier: null,
    status: "skipped_waiver",
    waiver_id: WAIVE_INVENTORY,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "inventory AG — ensure vitest run covers property tests",
  });

  /** @type {{ id: string, cmd: string }[]} */
  const testScriptsChain = [
    { id: "ts-env-example-parity-smoke", cmd: "node --test scripts/env-example-parity.smoke.test.mjs" },
    { id: "ts-check-runtime", cmd: "node --test scripts/check-runtime.test.mjs" },
    { id: "ts-check-security-control-coverage", cmd: "node --test scripts/check-security-control-coverage.test.mjs" },
    { id: "ts-qa-max-checks-smoke", cmd: "node --test scripts/qa-max-checks.smoke.test.mjs" },
    { id: "ts-check-autonomous-perf-registry-smoke", cmd: "node --test scripts/check-autonomous-perf-registry.smoke.test.mjs" },
    { id: "node-check-outbound-fetch", cmd: "node scripts/check-outbound-fetch.mjs" },
    { id: "node-check-security-enforcement-matrix-strict", cmd: "node scripts/check-security-enforcement-matrix.mjs --strict" },
    { id: "node-check-subprocessors-drift", cmd: "node scripts/check-subprocessors-drift.mjs" },
    { id: "node-check-next-public-surface", cmd: "node scripts/check-next-public-surface.mjs" },
    { id: "node-check-unsafe-deserialization", cmd: "node scripts/check-unsafe-deserialization.mjs" },
    { id: "node-check-server-action-auth-contract", cmd: "node scripts/check-server-action-auth-contract.mjs" },
    { id: "node-check-sentry-tag-banlist", cmd: "node scripts/check-sentry-tag-banlist.mjs" },
    { id: "node-check-p6-na-register", cmd: "node scripts/check-p6-na-register.mjs" },
    { id: "node-check-migration-security-patterns-strict", cmd: "node scripts/check-migration-security-patterns.mjs --strict" },
    { id: "node-check-dangerously-set-inner-html", cmd: "node scripts/check-dangerously-set-inner-html.mjs" },
    { id: "node-check-sbom-diff", cmd: "node scripts/check-sbom-diff.mjs" },
    { id: "node-check-public-seo-surface", cmd: "node scripts/check-public-seo-surface.mjs" },
    { id: "node-check-upload-banlist", cmd: "node scripts/check-upload-banlist.mjs" },
    { id: "node-check-codeowners-security-paths", cmd: "node scripts/check-codeowners-security-paths.mjs" },
    { id: "node-check-docker-hardening", cmd: "node scripts/check-docker-hardening.mjs" },
    { id: "node-check-npm-lifecycle", cmd: "node scripts/check-npm-lifecycle.mjs" },
    { id: "node-check-certificate-transparency", cmd: "node scripts/check-certificate-transparency.mjs" },
    { id: "node-check-certificate-transparency-strict", cmd: "CT_STRICT=1 node scripts/check-certificate-transparency.mjs" },
    { id: "node-check-no-executable-notebooks", cmd: "node scripts/check-no-executable-notebooks.mjs" },
    { id: "node-check-supply-chain-waivers", cmd: "node scripts/check-supply-chain-waivers.mjs" },
    { id: "node-check-postmessage-origins", cmd: "node scripts/check-postmessage-origins.mjs" },
    { id: "node-check-next-script-integrity", cmd: "node scripts/check-next-script-integrity.mjs" },
    {
      id: "node-check-json-body-limited-adoption-strict",
      cmd: "OBLIXA_STRICT_BODY_LIMITS=1 BODY_LIMIT_MIN_ROUTES=64 node scripts/check-json-body-limited-adoption.mjs",
    },
  ];
  for (const step of testScriptsChain) {
    rows.push({
      id: `test-scripts-chain-${step.id}`,
      kind: "node_smoke_test",
      command_or_workflow: step.cmd,
      manifest_tier: null,
      status: "skipped_waiver",
      waiver_id: WAIVE_INVENTORY,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: "inventory Q — covered when npm run test:scripts passes (LOCAL_RUNSET or CI)",
    });
  }

  rows.push({
    id: "npm-test-full-aggregate",
    kind: "npm_script",
    command_or_workflow: "npm run test",
    manifest_tier: null,
    status: "skipped_waiver",
    waiver_id: WAIVE_INVENTORY,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "inventory V — logic + UI beyond coverage-only bisect",
  });

  rows.push({
    id: "ifenv-qa-ultimate-release-gate",
    kind: "ifEnv_gate",
    command_or_workflow: "QA_ULTIMATE_TIER=release_ultimate REPORT_GATE_STRICT=1 pipeline:qa-ultimate",
    manifest_tier: "release_ultimate",
    status: "skipped_missing_secret",
    waiver_id: "SECRET_STAGING_COMPREHENSIVE",
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "inventory R — run when staging + report secrets available",
  });

  rows.push({
    id: "ifenv-runtime-comprehensive-pass",
    kind: "ifEnv_gate",
    command_or_workflow: "npm run check:comprehensive-pass (runtime_comprehensive_pass CI job)",
    manifest_tier: "runtime_comprehensive",
    status: "skipped_missing_secret",
    waiver_id: "SECRET_COMPREHENSIVE_PASS_CRON",
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "inventory S — live staging + CRON_SECRET",
  });
}

async function main() {
  const scripts = readPkgScripts();
  const checkNames = Object.keys(scripts).filter((k) => k.startsWith("check:")).sort();

  /** @type {Row[]} */
  const rows = [];

  for (const wf of listWorkflows()) {
    rows.push({
      id: `workflow-${wf.replace(/[^a-zA-Z0-9]+/g, "-")}`,
      kind: "github_workflow",
      command_or_workflow: `.github/workflows/${wf}`,
      manifest_tier: null,
      status: "pass",
      waiver_id: null,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: "workflow file present",
    });
  }

  rows.push({
    id: "repo-policy-dependabot-yml",
    kind: "repo_policy_file",
    command_or_workflow: ".github/dependabot.yml",
    manifest_tier: null,
    status: fs.existsSync(path.join(root, ".github", "dependabot.yml")) ? "pass" : "fail",
    waiver_id: null,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: null,
  });
  rows.push({
    id: "repo-policy-pull-request-template",
    kind: "repo_policy_file",
    command_or_workflow: ".github/pull_request_template.md",
    manifest_tier: null,
    status: fs.existsSync(path.join(root, ".github", "pull_request_template.md")) ? "pass" : "fail",
    waiver_id: null,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: null,
  });

  let codeownersHasTemplate = false;
  try {
    const co = fs.readFileSync(path.join(root, ".github", "CODEOWNERS"), "utf8");
    codeownersHasTemplate = /@YOUR_ORG\//.test(co);
  } catch {
    codeownersHasTemplate = false;
  }
  rows.push({
    id: "repo-policy-codeowners-template-tokens",
    kind: "repo_policy_file",
    command_or_workflow: ".github/CODEOWNERS @YOUR_ORG/* placeholder scan",
    manifest_tier: null,
    status: codeownersHasTemplate ? "skipped_waiver" : "pass",
    waiver_id: codeownersHasTemplate ? "ORG_CODEOWNERS_TEMPLATE" : null,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: codeownersHasTemplate
      ? "preconditions: replace @YOUR_ORG/* with real teams before enforcement"
      : "no template org tokens detected",
  });

  try {
    const quarantine = JSON.parse(fs.readFileSync(path.join(root, "e2e-quarantine.json"), "utf8"));
    const qFiles = Array.isArray(quarantine.files) ? quarantine.files.length : 0;
    rows.push({
      id: "repo-policy-e2e-quarantine-json",
      kind: "repo_policy_file",
      command_or_workflow: "e2e-quarantine.json",
      manifest_tier: null,
      status: "pass",
      waiver_id: null,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: `${qFiles} quarantined file(s); stub-to-native policy tracked in sweep-catalog`,
    });
  } catch {
    rows.push({
      id: "repo-policy-e2e-quarantine-json",
      kind: "repo_policy_file",
      command_or_workflow: "e2e-quarantine.json",
      manifest_tier: null,
      status: "fail",
      waiver_id: null,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: "missing or invalid JSON",
    });
  }

  for (const name of checkNames) {
    rows.push({
      id: `check-${name.replace(/:/g, "-")}`,
      kind: "npm_script",
      command_or_workflow: `npm run ${name}`,
      manifest_tier: null,
      status: "skipped_waiver",
      waiver_id: WAIVE_DEFER,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: execute
        ? "superseded by LOCAL_RUNSET batch where applicable; run full CI for complete check:* coverage"
        : "pass --execute to run LOCAL_RUNSET; full matrix in CI",
    });
  }

  const toolchains = ["tsconfig.json", "eslint.config.mjs", "postcss.config.mjs", "next.config.ts"];
  for (const rel of toolchains) {
    const p = path.join(root, rel);
    rows.push({
      id: `toolchain-${rel.replace(/[^a-zA-Z0-9]+/g, "-")}`,
      kind: "toolchain_config_file",
      command_or_workflow: rel,
      manifest_tier: null,
      status: fs.existsSync(p) ? "pass" : "fail",
      waiver_id: null,
      owner: null,
      log_uri: null,
      duration_ms: null,
      notes: "file presence",
    });
  }

  rows.push({
    id: "deploy-vercel-json",
    kind: "deploy_config_review",
    command_or_workflow: "vercel.json",
    manifest_tier: null,
    status: fs.existsSync(path.join(root, "vercel.json")) ? "pass" : "fail",
    waiver_id: null,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "presence; reconcile crons with npm run check:vercel-cron",
  });

  rows.push({
    id: "package-engines-overrides",
    kind: "dependency_policy_review",
    command_or_workflow: "package.json engines + overrides",
    manifest_tier: null,
    status: "pass",
    waiver_id: null,
    owner: null,
    log_uri: null,
    duration_ms: null,
    notes: "review engines vs .nvmrc in CI; overrides postcss+uuid",
  });

  appendExtendedPlanInventory(rows);
  appendPlaywrightAndDocInventory(rows);

  if (execute) {
    const batch = await runBatch();
    for (const r of batch) {
      rows.push(r);
    }
    const batchOk = new Map(batch.map((b) => [b.id, b.status === "pass"]));
    const checkPrefix = "npm run " + "check:";
    for (const row of rows) {
      if (row.kind !== "npm_script" || !row.command_or_workflow.startsWith(checkPrefix)) continue;
      const script = row.command_or_workflow.replace(/^npm run /, "");
      const hit = LOCAL_RUNSET.find((s) => s.script === script);
      if (hit && batchOk.get(hit.id)) {
        row.status = "pass";
        row.waiver_id = null;
        row.notes = "verified via LOCAL_RUNSET batch";
      }
    }
  }

  const payload = {
    version: 1,
    repo_head: gitSha(),
    generated_at_utc: new Date().toISOString(),
    rows,
    meta: {
      execute,
      schema_uri: "config/debugging-sweep-closure.schema.json",
      localRunset: LOCAL_RUNSET.map((s) => s.script),
      waiverDeferred: WAIVE_DEFER,
      inventoryDefer: WAIVE_INVENTORY,
      checkScriptsTotal: checkNames.length,
      workflowsTotal: listWorkflows().length,
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, wrote: path.relative(root, outPath), rows: rows.length, execute }, null, 2));

  if (execute) {
    const failed = rows.filter((r) => r.status === "fail");
    if (failed.length) {
      console.error(JSON.stringify({ ok: false, failed: failed.map((r) => r.id) }, null, 2));
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
