import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(script) {
  const r = spawnSync(process.execPath, [join(root, "scripts", script)], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `${script}: ${r.stdout}\n${r.stderr}`);
}

test("QA max check scripts exit 0", () => {
  run("check-tier-coverage.mjs");
  run("check-workflow-tier-coverage.mjs");
  run("check-qa-maximal-sweep-track-registry.mjs");
  run("report-qa-coverage-tier.mjs");
  run("check-playwright-tag-coverage.mjs");
  run("check-e2e-generated-drift.mjs");
  run("check-e2e-quarantine.mjs");
  run("check-openapi-route-coverage.mjs");
  run("check-dockerfile-presence.mjs");
  run("check-graphql-surface.mjs");
  run("check-web3-surface-absent.mjs");
  run("check-sar-surface-absent.mjs");
  run("check-qa-maximal-twelfth-expansion-closure.mjs");
  run("check-supply-chain-security-matrix.mjs");
  run("verify-ofac-sample-hash.mjs");
  run("reproducible-build-report.mjs");
  run("check-wasm-csp-thirdparty.mjs");
  run("check-graphql-cost-surface.mjs");
  run("validate-mta-sts-bimi.mjs");
  run("sbom-diff-stub.mjs");
  run("k6-smoke-runner.mjs");
  run("e2e-teardown.mjs");
  run("check-qa-workflow-fleet.mjs");
  run("check-merge-queue-canary-parity.mjs");
  run("check-synthetic-slo-env.mjs");
  run("check-e2e-env-matrix.mjs");
  run("check-absent-protocol-evidence.mjs");
  run("check-ofac-screening-stub-parity.mjs");
  run("check-suppress-hydration-warning.mjs");
  run("check-kyb-beneficial-owner-schema.mjs");
  run("rebuild-v10-read-models-nightly-gate.mjs");
  run("reproducible-build-hash.mjs");
  run("eslint-custom-rules-optional.mjs");
  run("knip-supply-chain-stub.mjs");
  run("jscpd-supply-chain-stub.mjs");
  run("carbon-wallclock-stub.mjs");
  run("k8s-conftest-stub.mjs");
  run("check-sharp-svgo-versions.mjs");
  run("check-src-tree-coverage.mjs");
  run("check-subprocessor-change-sla.mjs");
  run("check-pr-body-json.mjs");
});
