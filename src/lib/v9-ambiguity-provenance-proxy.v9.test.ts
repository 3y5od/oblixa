import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §11.3 ambiguity / provenance anchors", () => {
  it("retains field provenance helper for non-silent approval semantics", () => {
    expect(existsSync(join(process.cwd(), "src/lib/v9-field-provenance.ts"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/lib/review-feedback.v9.test.ts"))).toBe(true);
  });

  it("field review blocks approve when AI row lacks citation snippet", () => {
    const ui = readFileSync(
      join(process.cwd(), "src/components/contracts/field-review.ui.test.tsx"),
      "utf8"
    );
    expect(ui).toMatch(/citation required/i);
    expect(ui).toMatch(/disabled/i);
  });
});
