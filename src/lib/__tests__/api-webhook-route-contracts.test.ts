import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

describe("API webhook route contracts (Phase 6c)", () => {
  it("each webhook route.ts has a colocated route.test.ts", () => {
    const api = join(process.cwd(), "src", "app", "api");
    const routes = walk(api).filter((f) => f.replace(/\\/g, "/").includes("/webhook/") && f.endsWith("route.ts"));
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const testPath = route.replace(/route\.ts$/, "route.test.ts");
      expect(existsSync(testPath), `missing test for ${route}`).toBe(true);
      const text = readFileSync(testPath, "utf8");
      expect(text.length).toBeGreaterThan(40);
    }
  });
});
