import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("§9.6 + §25.3 contract table row model (no windowing)", () => {
  it("uses a plain tbody map without virtualized row windowing helpers", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/contracts/contract-table.tsx"),
      "utf8"
    );
    expect(raw).toContain("contracts.map(");
    expect(raw).not.toMatch(/@tanstack\/react-virtual|react-window|virtua|useVirtual/i);
  });
});
