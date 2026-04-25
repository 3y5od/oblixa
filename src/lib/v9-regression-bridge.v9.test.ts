import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * §29.2 — V8 gate scripts referenced by surface pipeline must remain discoverable
 * so V9 work cannot silently drop workspace / auth / hidden-family regression coverage.
 */
describe("V9 regression bridge to V8 gates", () => {
  it("check:v8-suite echo list still names required gate scripts", () => {
    const raw = readFileSync(join(process.cwd(), "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { scripts: Record<string, string> };
    const v8 = pkg.scripts["check:v8-suite"];
    expect(v8).toContain("check:v8-page-inventory");
    expect(v8).toContain("check:v8-api-eligibility");
    expect(v8).toContain("check:v8-action-eligibility");
    expect(v8).toContain("check:v8-hrefs:strict");
    expect(v8).toContain("check:v8-supplemental-contracts");
    expect(v8).toContain("refinement-contract.test.ts");
  });

  it("v9 security guard stays in default logic test surface", () => {
    const raw = readFileSync(join(process.cwd(), "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { scripts: Record<string, string> };
    expect(pkg.scripts["test:logic"]).toContain("vitest run");
  });

  it("v9 security surface guard remains the Core hidden-family regression anchor (§29.2)", () => {
    expect(existsSync(join(process.cwd(), "src/lib/v9-security-surface-guard.v9.test.ts"))).toBe(true);
  });

  it("refinement contract script remains available for nav/registry co-gates", () => {
    const raw = readFileSync(join(process.cwd(), "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { scripts: Record<string, string> };
    expect(pkg.scripts["check:refinement-contract"]).toContain("refinement-contract.test.ts");
  });
});
