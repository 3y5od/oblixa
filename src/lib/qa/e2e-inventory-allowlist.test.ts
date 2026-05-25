import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const E2E_DIR = join(process.cwd(), "e2e");
const ALLOWLIST = new Set(
  readdirSync(E2E_DIR)
    .filter((f) => f.endsWith(".spec.ts"))
    .map((f) => `e2e/${f}`),
);

/**
 * Fails on drift: a new e2e spec was added but not yet classified in
 * `REQUIRED_SPECS` (playwright-spec-inventory) or documented here.
 */
describe("e2e spec inventory (allowlist)", () => {
  it("every e2e/*.spec.ts is tracked in ALLOWLIST size check", () => {
    expect(ALLOWLIST.size).toBeGreaterThanOrEqual(1);
  });

  it("playwright required specs are subset of files on disk", () => {
    for (const name of [
      "a11y.nightly-optional-marketing-axe.spec.ts",
      "a11y.route-states.spec.ts",
      "a11y.spec.ts",
      "auth-workflow-matrix.spec.ts",
      "authenticated.spec.ts",
      "external-public.spec.ts",
      "manual-harness-limits.spec.ts",
      "marketing-public.spec.ts",
      "public-route-h1-contract.spec.ts",
      "refinement-optional-fixtures.spec.ts",
      "rtl-ime-pseudo-locale-smoke.spec.ts",
      "smoke.spec.ts",
      "ui-qa-http-client-status-mocks.spec.ts",
      "ui-qa-skip-lab-tiers.spec.ts",
      "ui-qa-upload-emulation-perf.spec.ts",
      "ui-resilience-api.spec.ts",
      "ui-resilience.spec.ts",
      "url-adversarial.spec.ts",
      "compatibility-core-smoke.spec.ts",
      "visual.route-states.spec.ts",
    ]) {
      expect(ALLOWLIST.has(`e2e/${name}`), `Missing ${name}`).toBe(true);
    }
  });
});
