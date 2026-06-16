import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("exception ledger resolved visibility (V9 §14.5)", () => {
  it("keeps resolved/closed queryable via filters without hiding the control", () => {
    const src = [
      "src/app/(dashboard)/contracts/exceptions/exceptions-page-config.ts",
      "src/app/(dashboard)/contracts/exceptions/exceptions-page-view.tsx",
    ]
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");
    // resolved/closed remain queryable via the visible status filter
    // (UiRadioGroup over STATUS_FILTERS) — no longer via a hidden native <select>.
    expect(src).toContain('value: "resolved"');
    expect(src).toContain('value: "closed"');
    expect(src).toContain("/contracts/exceptions?status=open");
  });
});
