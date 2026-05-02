import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("saga / compensation orchestration (Phase 77)", () => {
  it("scans server actions for explicit saga helpers (none expected yet)", () => {
    const actions = join(process.cwd(), "src", "actions");
    const text = readFileSync(join(actions, "contracts.ts"), "utf8").slice(0, 2000);
    expect(text.includes("compensate") || text.includes("saga")).toBe(false);
  });
});
