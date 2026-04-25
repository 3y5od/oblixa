import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tier 14 — `loading.tsx` and error boundaries present for dashboard group (import smoke).
 */
describe("Next.js App Router shell files (import smoke)", () => {
  it("keeps (dashboard) loading and error near root", () => {
    const dashboard = path.join(process.cwd(), "src", "app", "(dashboard)", "loading.tsx");
    const error = path.join(process.cwd(), "src", "app", "(dashboard)", "error.tsx");
    expect(fs.existsSync(dashboard)).toBe(true);
    expect(fs.existsSync(error)).toBe(true);
  });
});
