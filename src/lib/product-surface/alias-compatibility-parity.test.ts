import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V7 backward-compatible aliases (§27.2)", () => {
  it("keeps check:surface-suite:compatibility aligned with check:surface:suite", () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts["check:surface-suite:compatibility"]).toBe("npm run check:surface:suite");
    expect(pkg.scripts["check:surface:suite"]).toContain("check:surface:hrefs:strict");
    expect(pkg.scripts["check:surface-hrefs:compatibility:strict"]).toBe("npm run check:surface:hrefs:strict");
    expect(pkg.scripts["check:surface:hrefs:strict"]).toContain("audit-product-surface-cross-surface-hrefs.mjs");
  });

  it("keeps oblixa-v7-surface.yml present alongside v8 rules", () => {
    const v7 = readFileSync(join(process.cwd(), "semgrep/oblixa-v7-surface.yml"), "utf8");
    const v8 = readFileSync(join(process.cwd(), "semgrep/oblixa-v8-surface.yml"), "utf8");
    expect(v7.length).toBeGreaterThan(10);
    expect(v8.length).toBeGreaterThan(10);
  });
});
