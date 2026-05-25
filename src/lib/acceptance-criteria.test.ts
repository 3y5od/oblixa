import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Ordered release verification scripts (§29 DoD rollup proxy). */
const V9_ACCEPTANCE_SCRIPT_ORDER = [
  "lint",
  "typecheck",
  "test:logic",
  "check:previous-release-suite",
  "test:ui",
  "test:e2e:smoke",
  "test:e2e",
  "check:surface:suite",
  "check:test-skip-governance",
  "check:refinement-api-coverage",
  "check:refinement-contract",
  "check:server-action-exports",
  "check:api-route-auth-contract",
  "check:migrations",
] as const;

describe("V9 acceptance criteria (CI rollup anchors)", () => {
  it("package.json defines each required script", () => {
    const raw = readFileSync(join(process.cwd(), "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { scripts: Record<string, string> };
    for (const name of V9_ACCEPTANCE_SCRIPT_ORDER) {
      expect(typeof pkg.scripts[name], name).toBe("string");
      expect(pkg.scripts[name]!.length).toBeGreaterThan(0);
    }
  });

  it("check:previous-release-suite script exists", () => {
    const raw = readFileSync(join(process.cwd(), "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { scripts: Record<string, string> };
    expect(pkg.scripts["check:previous-release-suite"]).toContain("check-previous-release-suite.mjs");
  });

  it("keeps dedicated compatibility Playwright entrypoints on package scripts", () => {
    const raw = readFileSync(join(process.cwd(), "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { scripts: Record<string, string> };
    expect(pkg.scripts["test:e2e:compatibility"]).toContain("@compatibility");
    expect(pkg.scripts["test:e2e:compatibility:visual"]).toContain("compatibility-visual-optional.spec.ts");
  });

  it("keeps Playwright a11y bridge specs on disk for CmdK / route-state regressions", () => {
    const roots = [
      "e2e/a11y.keyboard.spec.ts",
      "e2e/a11y.dialogs.spec.ts",
      "e2e/a11y.route-states.spec.ts",
      "e2e/authenticated.spec.ts",
    ];
    for (const r of roots) {
      expect(existsSync(join(process.cwd(), r)), r).toBe(true);
    }
  });
});
