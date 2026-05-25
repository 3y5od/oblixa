import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REQUIRED_SPECS = new Set([
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
]);

function listE2eSpecs(): Set<string> {
  const dir = path.join(process.cwd(), "e2e");
  const out = new Set<string>();
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith(".spec.ts")) out.add(name);
  }
  return out;
}

describe("Playwright e2e spec inventory", () => {
  it("includes required spec files", () => {
    const found = listE2eSpecs();
    for (const req of REQUIRED_SPECS) {
      expect(found.has(req), `Missing e2e/${req}`).toBe(true);
    }
  });

  it("playwright.config.ts uses e2e testDir", () => {
    const raw = fs.readFileSync(path.join(process.cwd(), "playwright.config.ts"), "utf8");
    expect(raw).toMatch(/testDir:\s*["']\.\/e2e["']/);
  });
});
