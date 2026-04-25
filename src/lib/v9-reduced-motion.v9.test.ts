import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 prefers-reduced-motion (§25)", () => {
  it("globals define reduced-motion fallbacks for interactive polish", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("motion-safe:");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ui-skeleton[\s\S]*animation:\s*none/);
  });

  it("dashboard segment loading pairs aria-busy with a polite status announcement", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/(dashboard)/loading.tsx"), "utf8");
    expect(raw).toMatch(/role="status"/);
    expect(raw).toMatch(/aria-live="polite"/);
    expect(raw).toMatch(/aria-busy="true"/);
  });
});
