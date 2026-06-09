import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("exception ledger resolved visibility (V9 §14.5)", () => {
  it("keeps resolved/closed queryable via filters without hiding the control", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contracts/exceptions/page.tsx"),
      "utf8"
    );
    // resolved/closed remain queryable via the visible status filter
    // (UiRadioGroup over STATUS_FILTERS) — no longer via a hidden native <select>.
    expect(src).toContain('value: "resolved"');
    expect(src).toContain('value: "closed"');
    expect(src).toContain("/contracts/exceptions?status=open");
  });
});
