import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { v9DisplayOrUnknown } from "./sparse-records";

describe("V9 sparse records — explicit unknown labels", () => {
  it("v9DisplayOrUnknown trims and falls back", () => {
    expect(v9DisplayOrUnknown(null)).toBe("Unknown");
    expect(v9DisplayOrUnknown("   ")).toBe("Unknown");
    expect(v9DisplayOrUnknown("Acme")).toBe("Acme");
    expect(v9DisplayOrUnknown("", "—")).toBe("—");
  });

  it("renewals model uses helper for counterparty display", () => {
    const model = readFileSync(
      join(process.cwd(), "src/lib/renewals/model.ts"),
      "utf8"
    );
    expect(model).toContain("displayOrUnknown(contract.counterparty");
  });
});
