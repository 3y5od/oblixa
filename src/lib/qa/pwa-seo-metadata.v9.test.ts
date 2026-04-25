import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Tier 27 — root `app/layout` exports `metadata` (title template / defaults). */
describe("PWA/SEO: root layout metadata", () => {
  it("reads `metadata` from app/layout.tsx", () => {
    const p = path.join(process.cwd(), "src", "app", "layout.tsx");
    const src = fs.readFileSync(p, "utf8");
    expect(src).toMatch(/export\s+const\s+metadata/);
  });
});
