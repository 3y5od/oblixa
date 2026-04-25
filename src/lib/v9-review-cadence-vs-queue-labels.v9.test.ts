/**
 * V9 §24.1–24.2 — Review queue vs Review cadence remain distinct IA labels and destinations.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("review queue vs review cadence labels (V9)", () => {
  it("navigation exposes separate entries for field review queue and cadence workspace", () => {
    const nav = readFileSync(join(process.cwd(), "src/lib/navigation.ts"), "utf8");
    expect(nav).toMatch(/name:\s*"Review"/);
    expect(nav).toContain('href: "/contracts/review"');
    expect(nav).toMatch(/name:\s*"Review cadence"/);
    expect(nav).toContain('href: "/contracts/review-cadence"');
  });
});
