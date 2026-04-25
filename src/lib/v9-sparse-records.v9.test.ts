import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { v9DisplayOrUnknown } from "./v9-sparse-records";

describe("V9 sparse records — explicit unknown labels", () => {
  it("v9DisplayOrUnknown trims and falls back", () => {
    expect(v9DisplayOrUnknown(null)).toBe("Unknown");
    expect(v9DisplayOrUnknown("   ")).toBe("Unknown");
    expect(v9DisplayOrUnknown("Acme")).toBe("Acme");
    expect(v9DisplayOrUnknown("", "—")).toBe("—");
  });

  it("renewals table uses helper for counterparty display", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contracts/renewals/page.tsx"),
      "utf8"
    );
    expect(page).toContain("v9DisplayOrUnknown");
  });
});
