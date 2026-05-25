#!/usr/bin/env node
/**
 * Maximal QA closure manifest — deterministic path + pipeline snapshot JSON.
 * @see plan: Maximal QA (eighteenth/nineteenth expansion) — application-surface-manifest + pipeline-step-lists
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { p10 as qaMaxP10Steps } from "./lib/qa-tier-steps.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const METADATA_SPECIAL = [
  "src/app/apple-icon.tsx",
  "src/app/icon.tsx",
  "src/app/opengraph-image.tsx",
  "src/app/robots.ts",
  "src/app/sitemap.ts",
  "src/app/twitter-image.tsx",
];

const VERIFY_PIPELINE = {
  firstPass: [
    "check:migrations:strict",
    "check:migration-smoke:current:strict",
    "check:release-evidence",
    "check:release-privacy-scan",
    "check:complete-closure",
    "check:release-suite-current",
    "check:api-route-tests",
    "check:api-route-auth-contract",
    "check:api-route-admin-org-scope",
    "check:owner-metadata",
    "check:checks-integrity-meta",
    "check:config-drift",
    "check:branch-protection-drift",
  ],
  domainPass: [
    "check:performance-static:strict",
    "check:frontend-component-complexity",
    "check:server-action-complexity",
    "check:bundle-budget",
    "check:hardening-debt-ratchet",
    "check:integration-contract-resilience",
    "check:concurrency-hotspots-ratchet",
    "check:api-workspace-eligibility:strict",
    "check:incident-readiness:strict",
    "check:artifact-integrity",
    "check:ci-verify-extras",
    "check:qa-loading-routes",
    "check:qa-route-coverage-tsv",
    "check:qa-bug-log",
    "check:test-skip-governance",
    "check:refinement-acceptance-commands",
    "check:server-action-auth-contract",
    "check:server-action-org-scope",
    "check:server-action-exports",
    "check:type-lint-ratchet",
    "lint",
    "typecheck",
  ],
  finalPass: ["test:coverage", "check:surface:suite", "build"],
  parity: ["pipeline:ci-parity"],
};

const CI_STATIC_PIPELINE = {
  mustPass: [
    "check:migrations",
    "check:api-route-tests",
    "check:api-route-auth-contract",
    "check:api-route-admin-org-scope",
    "check:server-action-exports",
    "check:server-action-auth-contract",
    "check:server-action-org-scope",
    "check:vercel-cron",
    "check:cron-route-auth",
  ],
  parallel: [
    "check:security-static:strict:grep",
    "check:performance-static:strict",
    "check:bundle-budget",
    "check:server-action-complexity",
    "check:test-skip-governance",
    "check:type-lint-ratchet",
    "lint",
    "typecheck",
  ],
};

const CI_PARITY_PIPELINE = [
  "check:github-workflows-security",
  "check:e2e:skip-baseline",
  "check:semgrep-rulepack-integrity",
  "check:wrapper-reintroduction",
];

const SECURITY_COMPREHENSIVE_PIPELINE = [
  "check:api-route-auth-contract",
  "check:api-route-admin-org-scope",
  "check:cron-route-auth",
  "check:api-route-rate-limit-coverage",
  "check:security-static:strict:grep",
  "check:github-workflows-security",
  "check:incident-readiness:strict",
  "check:artifact-integrity",
  "check:required-security-checkset",
  "check:security-env-contract",
  "check:server-action-auth-contract",
  "check:server-action-org-scope",
  "check:server-action-exports",
  "check:ai-context-redaction",
  "check:ai-prompt-injection-guards",
  "check:ai-tool-call-authz",
  "check:token-security-quality",
  "check:report-redaction-contract",
  "check:outbound-domain-allowlist",
  "check:ssrf-guards",
  "check:security-headers",
  "report:security-route-matrix",
  "report:security-proxy-matrix",
  "build:security-control-coverage-matrix",
  "check:autonomous-security-program",
  "check:security-control-coverage",
  "check:security-fetch-sinks:strict",
  "check:dependency-policy",
  "check:lockfile-integrity-drift",
  "check:sbom-integrity",
  "check:release-artifact-provenance",
  "check:feature-flag-security-bypass",
  "check:security-fallback-paths",
  "check:rate-limit-key-cardinality",
  "check:rate-limit-distribution-safety",
  "check:idempotency-policy",
  "check:job-lock-guards",
  "check:timeout-budget-guards",
  "check:circuit-breaker-policy",
  "check:sensitive-cache-controls",
  "check:stream-payload-sensitivity",
  "check:concurrency-cap-guards",
  "check:checks-integrity-meta",
  "report:security-scorecard",
  "lint",
  "typecheck",
  "test",
];

const RELEASE_CHECKLIST_PIPELINE = [
  "preflight:release",
  "check:release-evidence",
  "check:release-suite-current",
  "verify",
  "check:comprehensive-pass",
  "test:e2e:current-product",
  "test:e2e",
];

const SURFACE_SUITE_PIPELINE_STEPS = [
  "check:surface:hrefs:strict",
  "check:surface:vocabulary",
  "check:surface:page-inventory",
  "check:surface:api-inventory",
  "check:surface:action-inventory",
  "check:surface:api-eligibility",
  "check:surface:action-eligibility",
  "check:surface:denial-mapping",
  "check:surface:diagnostics-contract",
  "check:surface:supplemental-contracts",
  "check:route-inventory",
  "check:plan-ia",
  "check:refinement-api-coverage",
  "check:surface:acceptance-matrix",
  "check:surface:acceptance-criteria",
  "report:surface-inventory",
  "check:api-route-tests",
  "check:api-route-auth-contract",
  "check:api-route-auth-route-index",
  "check:api-route-rate-limit-coverage",
  "check:server-lib-admin",
  "check:cron-route-auth",
  "check:previous-release-suite",
  "check:release-suite-current",
];

const CODE_MAXIMAL_PLAYWRIGHT_LEGS = [
  "test:e2e:resilience:all",
  "test:e2e:adversarial",
  "test:e2e:current-product",
  "test:e2e:compatibility",
  "test:e2e:i18n-matrix",
  "test:e2e:maximal-playwright-bundle",
  "test:e2e:shard",
];

const AUTONOMOUS_PERF_TIER_A_DEFAULT = [
  "check:performance-static",
  "check:bundle-budget",
  "check:autonomous-perf-registry",
  "check:autonomous-perf-phase-closure",
  "check:duplicate-deps-react",
  "build",
];

const QA_UNIVERSE_FAST_STEPS = [
  "report:qa-coverage-tier",
  "qa:sweep:max:p4",
  "pipeline:ci-parity",
  "check:command-reference-integrity",
];

const QA_UNIVERSE_FULL_STEPS = [
  ...QA_UNIVERSE_FAST_STEPS,
  "qa:sweep:ultimate:nightly",
  "qa:sweep:ultimate:release",
  "qa:sweep:ultimate:postmerge",
  "qa:sweep:code:maximal",
  "pipeline:verify",
  "merge:junit",
];

const COMPREHENSIVE_PASS_REQUIRED_ENV = [
  "COMPREHENSIVE_PASS_BASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "COMPREHENSIVE_PASS_EMAIL",
  "COMPREHENSIVE_PASS_PASSWORD",
];

const COMPREHENSIVE_PASS_OPTIONAL_ENV = ["COMPREHENSIVE_PASS_TRACE_ID", "NEXT_PUBLIC_APP_URL"];

const COMPREHENSIVE_PASS_RLS_LABELS = [
  "organization_members",
  "notification_deliveries",
  "contract_tasks",
  "contract_obligations",
  "contract_approvals",
  "decision_workspaces",
  "portfolio_campaigns",
];

const COMPREHENSIVE_PASS_NESTED_CHECKS = ["check:onboarding-qa-matrix", "check:onboarding-stale-env-parity"];

const PLAYWRIGHT_MAXIMAL_CI_VARS = ["PLAYWRIGHT_MAXIMAL_CI", "PLAYWRIGHT_MAXIMAL_PROFILE"];

function gitLsFiles(root) {
  try {
    const out = execFileSync("git", ["-c", "core.quotepath=false", "ls-files"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((p) => p.replace(/\\/g, "/"))
      .sort();
  } catch {
    throw new Error("report-qa-closure-manifest requires git and a git worktree");
  }
}

function pick(files, pred) {
  return files.filter(pred).sort();
}

function readUseServerActionModules(files) {
  const actionTs = pick(files, (f) => f.startsWith("src/actions/") && f.endsWith(".ts") && !f.endsWith(".test.ts"));
  const out = [];
  for (const rel of actionTs) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const head = fs.readFileSync(abs, "utf8").split(/\r?\n/).slice(0, 5).join("\n");
    if (/^\s*["']use server["'];/m.test(head) || head.trimStart().startsWith('"use server"') || head.trimStart().startsWith("'use server'")) {
      out.push(rel);
    }
  }
  return out.sort();
}

function loadPackageJsonScriptsKeys(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  return Object.keys(pkg.scripts || {}).sort();
}

function loadUltimateTierKeys(root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "config", "qa-tier-manifest.json"), "utf8"));
  return Object.keys(manifest.tiers || {}).sort();
}

function parseE2eQuarantine(root, files) {
  const rel = "e2e-quarantine.json";
  if (!files.includes(rel)) return { path: rel, parsed: null, error: "not_tracked" };
  try {
    const raw = fs.readFileSync(path.join(root, rel), "utf8");
    return { path: rel, parsed: JSON.parse(raw), error: null };
  } catch (e) {
    return { path: rel, parsed: null, error: String(e?.message || e) };
  }
}

function nextMiddlewarePath(files) {
  if (files.includes("middleware.ts")) return "middleware.ts";
  if (files.includes("src/middleware.ts")) return "src/middleware.ts";
  return null;
}

function buildManifest() {
  const files = gitLsFiles(ROOT);
  const has = (p) => files.includes(p);

  const apiRoutes = pick(files, (f) => f.startsWith("src/app/api/") && f.endsWith("/route.ts"));
  const appRouterNonApiRouteFiles = pick(
    files,
    (f) => f.endsWith("/route.ts") && f.startsWith("src/app/") && !f.startsWith("src/app/api/")
  );
  const appRouterMetadataSpecialFiles = METADATA_SPECIAL.filter(has);
  const appRouterGlobalErrorFiles = pick(files, (f) => f === "src/app/global-error.tsx");
  const appRouterRootDepth1TestFiles = pick(files, (f) => /^src\/app\/[^/]+\.test\.ts$/.test(f));
  const appRouterFaviconIcoFiles = pick(files, (f) => f === "src/app/favicon.ico");
  const srcTypesAmbientFiles = pick(files, (f) => /^src\/types\/[^/]+\.d\.ts$/.test(f));
  const srcTestUtilsFiles = pick(
    files,
    (f) => f.startsWith("src/test-utils/") && (f.endsWith(".ts") || f.endsWith(".tsx"))
  );
  const scriptsCodemodMjsFiles = pick(files, (f) => /^scripts\/codemods\/[^/]+\.mjs$/.test(f));
  const srcLibInternalTestFiles = pick(files, (f) => /^src\/lib\/__tests__\/.+\.test\.ts$/.test(f));
  const gitleaksConfigPaths = [".gitleaks.toml", ".gitleaksignore"].filter(has).sort();
  const scriptsPipelineMjsFiles = pick(files, (f) => /^scripts\/pipelines\/[^/]+\.mjs$/.test(f));
  const productSurfaceConfigJsonFiles = pick(
    files,
    (f) => /^src\/lib\/product-surface\/[^/]+\.json$/.test(f)
  );
  const instrumentationTsFiles = ["src/instrumentation-client.ts", "src/instrumentation.ts"].filter(has).sort();
  const scriptsCheckMjsFiles = pick(files, (f) => /^scripts\/check-[^/]+\.mjs$/.test(f));
  const scriptsTopLevelSmokeTestMjsFiles = pick(files, (f) => /^scripts\/[^/]+\.test\.mjs$/.test(f));
  const githubPrTemplatePath = has(".github/pull_request_template.md") ? ".github/pull_request_template.md" : null;
  const debuggingSweepLibFiles = pick(files, (f) => f.startsWith("src/lib/debugging-sweep/"));
  const scriptsTopLevelNonCheckMjsFiles = pick(
    files,
    (f) => /^scripts\/[^/]+\.mjs$/.test(f) && !/^scripts\/check-/.test(f)
  );
  const repoRootToolingDotfiles = [".editorconfig", ".npmrc", "next-env.d.ts"].filter(has).sort();
  const apiFolderSupportTsFiles = pick(
    files,
    (f) => f.startsWith("src/app/api/") && f.endsWith(".ts") && !f.endsWith("/route.ts")
  );
  const scriptsJsonFiles = pick(files, (f) => f.startsWith("scripts/") && f.endsWith(".json"));
  const sentrySdkConfigFiles = ["sentry.edge.config.ts", "sentry.server.config.ts"].filter(has).sort();
  const chromaticConfigPath = has("chromatic.config.cjs") ? "chromatic.config.cjs" : null;
  const vercelJsonPath = has("vercel.json") ? "vercel.json" : null;
  const strykerConfigFiles = ["stryker.conf.json", "stryker.config.json"].filter(has).sort();
  const dockerfilePaths = pick(files, (f) => /(^|\/)Dockerfile[^/]*$/.test(f) && !f.includes("node_modules"));
  const chaosComposePath = has("docker-compose.chaos.yml") ? "docker-compose.chaos.yml" : null;
  const actionsAllTsFiles = pick(files, (f) => f.startsWith("src/actions/") && f.endsWith(".ts"));
  const packageJsonScriptsKeys = loadPackageJsonScriptsKeys(ROOT);
  const quarantine = parseE2eQuarantine(ROOT, files);
  const cssPostcssGlobalPaths = ["postcss.config.mjs", "src/app/globals.css"].filter(has).sort();
  const harnessRunVerifyScripts = pick(
    files,
    (f) => /^scripts\/(run|verify)-[^/]+\.mjs$/.test(f)
  );
  const scriptsLibMjsFiles = pick(files, (f) => /^scripts\/lib\/[^/]+\.mjs$/.test(f));
  const k6RunnerScriptPaths = pick(files, (f) => /^scripts\/k6-[^/]+-runner\.mjs$/.test(f));
  const lighthouseSmokeScriptPath = has("scripts/lighthouse-smoke.mjs") ? "scripts/lighthouse-smoke.mjs" : null;
  const componentsUiFiles = pick(
    files,
    (f) => f.startsWith("src/components/ui/") && (f.endsWith(".tsx") || f.endsWith(".ts"))
  );
  const githubWorkflowYamlFiles = pick(files, (f) => /^\.github\/workflows\/[^/]+\.yml$/.test(f));
  const appRouterLayoutFiles = pick(
    files,
    (f) => f.endsWith("/layout.tsx") && f.startsWith("src/app/") && !f.startsWith("src/app/api/")
  );
  const appRouterLoadingFiles = pick(
    files,
    (f) => f.endsWith("/loading.tsx") && f.startsWith("src/app/") && !f.startsWith("src/app/api/")
  );
  const appRouterErrorFiles = pick(
    files,
    (f) => f.endsWith("/error.tsx") && f.startsWith("src/app/") && !f.startsWith("src/app/api/")
  );
  const appRouterNotFoundFiles = pick(
    files,
    (f) => f.endsWith("/not-found.tsx") && f.startsWith("src/app/") && !f.startsWith("src/app/api/")
  );
  const dependabotYamlPath = has(".github/dependabot.yml") ? ".github/dependabot.yml" : null;
  const supabaseMigrationFiles = pick(files, (f) => /^supabase\/migrations\/[^/]+\.sql$/.test(f));
  const appRouterPageFiles = pick(
    files,
    (f) => f.endsWith("/page.tsx") && f.startsWith("src/app/") && !f.startsWith("src/app/api/")
  );
  const openapiSpecPath = has("openapi.yaml") ? "openapi.yaml" : null;
  const semgrepConfigFiles = pick(files, (f) => /^semgrep\/[^/]+\.yml$/.test(f));
  const e2eGeneratedTsFiles = pick(files, (f) => f.startsWith("e2e/generated/") && f.endsWith(".ts"));
  const productSurfaceTestFiles = pick(files, (f) => /^src\/lib\/product-surface\/[^/]+\.test\.ts$/.test(f));
  const e2ePlaywrightSpecFiles = pick(files, (f) => f.startsWith("e2e/") && f.endsWith(".spec.ts"));
  const e2ePageObjectFiles = pick(files, (f) => f.startsWith("e2e/page-objects/") && f.endsWith(".ts"));
  const e2eSupportingTsFiles = pick(
    files,
    (f) =>
      f.startsWith("e2e/") &&
      f.endsWith(".ts") &&
      !f.endsWith(".spec.ts") &&
      !f.startsWith("e2e/fixtures/") &&
      !f.startsWith("e2e/page-objects/") &&
      !f.startsWith("e2e/generated/")
  );
  const publicStaticFiles = pick(files, (f) => f.startsWith("public/"));
  const serverActionModules = readUseServerActionModules(files);

  const verifyPipelineOrdered = [
    ...VERIFY_PIPELINE.firstPass,
    ...VERIFY_PIPELINE.domainPass,
    ...VERIFY_PIPELINE.finalPass,
    ...VERIFY_PIPELINE.parity,
  ];

  const ciStaticPipelineOrdered = [...CI_STATIC_PIPELINE.mustPass, ...CI_STATIC_PIPELINE.parallel];

  const generatedAt = new Date().toISOString();
  const ultimateTierKeys = loadUltimateTierKeys(ROOT);

  return {
    schemaVersion: 1,
    generatedAt,
    verifyPipeline: verifyPipelineOrdered,
    verifyPipelinePhases: VERIFY_PIPELINE,
    ciStaticPipeline: ciStaticPipelineOrdered,
    ciStaticPipelinePhases: CI_STATIC_PIPELINE,
    ciParityPipeline: CI_PARITY_PIPELINE,
    securityComprehensivePipeline: SECURITY_COMPREHENSIVE_PIPELINE,
    releaseChecklistPipeline: RELEASE_CHECKLIST_PIPELINE,
    qaMaxP10Steps: [...qaMaxP10Steps],
    surfaceSuitePipelineSteps: SURFACE_SUITE_PIPELINE_STEPS,
    codeMaximalPlaywrightLegs: CODE_MAXIMAL_PLAYWRIGHT_LEGS,
    codeMaximalPlaywrightOptionalEnv: [
      "QA_MAXIMAL_MULTI_BROWSER",
      "PLAYWRIGHT_VISUAL_CONTINUE",
      "QA_MAXIMAL_EXTENDED_LEGS",
      "GITHUB_EVENT_NAME",
    ],
    playwrightMaximalCiVars: PLAYWRIGHT_MAXIMAL_CI_VARS,
    autonomousPerfTierADefault: AUTONOMOUS_PERF_TIER_A_DEFAULT,
    autonomousPerfTierASkipBuild: AUTONOMOUS_PERF_TIER_A_DEFAULT.filter((s) => s !== "build"),
    ultimateTierKeys,
    qaUniverseFastSteps: QA_UNIVERSE_FAST_STEPS,
    qaUniverseFullSteps: QA_UNIVERSE_FULL_STEPS,
    comprehensivePassContract: {
      requiredEnv: COMPREHENSIVE_PASS_REQUIRED_ENV,
      optionalEnv: COMPREHENSIVE_PASS_OPTIONAL_ENV,
      rlsLabels: COMPREHENSIVE_PASS_RLS_LABELS,
      nestedChecks: COMPREHENSIVE_PASS_NESTED_CHECKS,
    },
    apiRoutes,
    appRouterNonApiRouteFiles,
    appRouterMetadataSpecialFiles,
    appRouterGlobalErrorFiles,
    appRouterRootDepth1TestFiles,
    appRouterFaviconIcoFiles,
    srcTypesAmbientFiles,
    srcTestUtilsFiles,
    scriptsCodemodMjsFiles,
    srcLibInternalTestFiles,
    gitleaksConfigPaths,
    scriptsPipelineMjsFiles,
    productSurfaceConfigJsonFiles,
    instrumentationTsFiles,
    scriptsCheckMjsFiles,
    scriptsTopLevelSmokeTestMjsFiles,
    githubPrTemplatePath,
    debuggingSweepLibFiles,
    scriptsTopLevelNonCheckMjsFiles,
    repoRootToolingDotfiles,
    apiFolderSupportTsFiles,
    scriptsJsonFiles,
    sentrySdkConfigFiles,
    chromaticConfigPath,
    vercelJsonPath,
    strykerConfigFiles,
    dockerfilePaths,
    chaosComposePath,
    actionsAllTsFiles,
    packageJsonScriptsKeys,
    e2eQuarantinePath: quarantine.path,
    e2eQuarantineJson: quarantine.parsed,
    e2eQuarantineParseError: quarantine.error,
    cssPostcssGlobalPaths,
    harnessRunVerifyScripts,
    scriptsLibMjsFiles,
    k6RunnerScriptPaths,
    lighthouseSmokeScriptPath,
    componentsUiFiles,
    githubWorkflowYamlFiles,
    appRouterLayoutFiles,
    appRouterLoadingFiles,
    appRouterErrorFiles,
    appRouterNotFoundFiles,
    dependabotYamlPath,
    nextMiddlewarePath: nextMiddlewarePath(files),
    supabaseMigrationFiles,
    appRouterPageFiles,
    openapiSpecPath,
    semgrepConfigFiles,
    e2eGeneratedTsFiles,
    productSurfaceTestFiles,
    e2ePlaywrightSpecFiles,
    e2ePageObjectFiles,
    e2eSupportingTsFiles,
    publicStaticFiles,
    serverActionModules,
    counts: {
      apiRoutes: apiRoutes.length,
      appRouterNonApiRouteFiles: appRouterNonApiRouteFiles.length,
      appRouterMetadataSpecialFiles: appRouterMetadataSpecialFiles.length,
      appRouterGlobalErrorFiles: appRouterGlobalErrorFiles.length,
      appRouterRootDepth1TestFiles: appRouterRootDepth1TestFiles.length,
      appRouterFaviconIcoFiles: appRouterFaviconIcoFiles.length,
      srcTestUtilsFiles: srcTestUtilsFiles.length,
      scriptsCodemodMjsFiles: scriptsCodemodMjsFiles.length,
      srcLibInternalTestFiles: srcLibInternalTestFiles.length,
      scriptsCheckMjsFiles: scriptsCheckMjsFiles.length,
      scriptsTopLevelSmokeTestMjsFiles: scriptsTopLevelSmokeTestMjsFiles.length,
      scriptsTopLevelNonCheckMjsFiles: scriptsTopLevelNonCheckMjsFiles.length,
      scriptsPipelineMjsFiles: scriptsPipelineMjsFiles.length,
      debuggingSweepLibFiles: debuggingSweepLibFiles.length,
      apiFolderSupportTsFiles: apiFolderSupportTsFiles.length,
      actionsAllTsFiles: actionsAllTsFiles.length,
      packageJsonScriptsKeys: packageJsonScriptsKeys.length,
      githubWorkflowYamlFiles: githubWorkflowYamlFiles.length,
      componentsUiFiles: componentsUiFiles.length,
      scriptsLibMjsFiles: scriptsLibMjsFiles.length,
      e2ePlaywrightSpecFiles: e2ePlaywrightSpecFiles.length,
      productSurfaceTestFiles: productSurfaceTestFiles.length,
      serverActionModules: serverActionModules.length,
    },
  };
}

function stripVolatile(obj) {
  const { generatedAt, ...rest } = obj;
  return rest;
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function stableStringify(obj) {
  return `${JSON.stringify(sortKeysDeep(obj))}\n`;
}

function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");
  const manifest = buildManifest();
  const outPath = path.join(ROOT, "artifacts", "qa-closure-manifest.json");
  const text = `${JSON.stringify(manifest, null, 2)}\n`;

  if (check) {
    if (!fs.existsSync(outPath)) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            error: "missing_baseline",
            hint: "Run: npm run report:qa-closure-manifest",
            path: path.relative(ROOT, outPath),
          },
          null,
          2
        )
      );
      process.exit(1);
    }
    const baseline = JSON.parse(fs.readFileSync(outPath, "utf8"));
    const a = stableStringify(stripVolatile(baseline));
    const b = stableStringify(stripVolatile(manifest));
    if (a !== b) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            error: "qa_closure_manifest_drift",
            hint: "Regenerate: npm run report:qa-closure-manifest && commit artifacts/qa-closure-manifest.json",
          },
          null,
          2
        )
      );
      process.exit(1);
    }
    console.log(JSON.stringify({ ok: true, check: "qa-closure-manifest", drift: false }, null, 2));
    process.exit(0);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, text, "utf8");
  process.stdout.write(text);
}

main();
