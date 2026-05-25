import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("exception ledger resolved visibility (V9 §14.5)", () => {
  it("keeps resolved/closed queryable via filters without hiding the control", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contracts/exceptions/page.tsx"),
      "utf8"
    );
    expect(src).toContain('option value="resolved"');
    expect(src).toContain('option value="closed"');
    expect(src).toContain("/contracts/exceptions?status=open");
  });
});
