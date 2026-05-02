import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function collectFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) collectFiles(p, acc);
    else acc.push(p);
  }
  return acc;
}

describe("webhook route enumeration", () => {
  it("lists app/api webhook route modules", () => {
    const root = join(process.cwd(), "src", "app", "api");
    const all = collectFiles(root);
    const normalized = all.filter((f) => f.replace(/\\/g, "/").includes("/webhook/route.ts"));
    expect(normalized.length).toBeGreaterThanOrEqual(1);
    expect(normalized.some((f) => f.includes("stripe"))).toBe(true);
  });
});
