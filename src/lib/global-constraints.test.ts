import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "./navigation";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("V9 §5 global constraints (gates + nav discipline)", () => {
  it("keeps V8 surface suite entrypoints in package.json (no silent regression)", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    const v8 = pkg.scripts["check:surface:suite"];
    expect(v8).toContain("check:surface:api-eligibility");
    expect(v8).toContain("check:surface:action-eligibility");
    expect(v8).toContain("check:surface:hrefs:strict");
    expect(pkg.scripts["check:api-workspace-eligibility"]).toBeDefined();
  });

  it("retains v9 security surface guard as a logic-test anchor", () => {
    expect(existsSync(join(process.cwd(), "src/lib/security-surface-guard.test.ts"))).toBe(true);
  });

  it("limits primary nav breadth: no surprise new top-level hrefs without trace review", () => {
    const primary = NAV_ITEMS.filter((i) => i.section === "primary");
    expect(primary.length).toBeGreaterThanOrEqual(6);
    expect(primary.length).toBeLessThanOrEqual(24);
    for (const item of primary) {
      expect(item.href.startsWith("/"), item.name).toBe(true);
    }
  });
});
