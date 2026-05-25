import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GUARD = join(process.cwd(), "src/lib/product-surface/api-workspace-guard.ts");

describe("API workspace gate JSON for Core-ineligible callers (V7 §20.2)", () => {
  it("uses a neutral error body without Advanced/Assurance upsell", () => {
    const raw = readFileSync(GUARD, "utf8");
    expect(raw).toContain("Feature not available in workspace mode");
    expect(raw).not.toMatch(/Advanced/);
    expect(raw).not.toMatch(/Assurance/);
  });
});
