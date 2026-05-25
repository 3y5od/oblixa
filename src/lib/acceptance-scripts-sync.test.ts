/**
 * V9 Appendix I — package.json scripts stay aligned with v9-acceptance-criteria script order (single source).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 acceptance script order ↔ package.json", () => {
  it("every script name in v9-acceptance-criteria exists in package.json with non-empty command", () => {
    const criteriaSrc = readFileSync(
      join(process.cwd(), "src/lib/acceptance-criteria.test.ts"),
      "utf8"
    );
    const m = criteriaSrc.match(/const V9_ACCEPTANCE_SCRIPT_ORDER = \[([\s\S]*?)\]\s+as const/);
    expect(m?.[1], "V9_ACCEPTANCE_SCRIPT_ORDER block").toBeTruthy();
    const order = [...m![1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!);
    expect(order.length).toBeGreaterThan(5);
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    for (const name of order) {
      expect(typeof pkg.scripts[name], name).toBe("string");
      expect(pkg.scripts[name]!.length).toBeGreaterThan(0);
    }
  });
});
