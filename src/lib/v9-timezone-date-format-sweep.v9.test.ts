import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatBusinessDateAtNoon } from "@/lib/v9-business-dates";

describe("V9 timezone date format sweep", () => {
  it("formats stable business dates via the noon-normalized helper", () => {
    expect(formatBusinessDateAtNoon("2026-04-18")).toBe("Apr 18, 2026");
    expect(formatBusinessDateAtNoon("2026-04-18T00:00:00Z")).toBe("Apr 18, 2026");
    expect(formatBusinessDateAtNoon(null)).toBe("—");
  });

  it("reuses the shared helper across core list/detail/dashboard surfaces", () => {
    for (const file of [
      "src/components/dashboard/upcoming-actions.tsx",
      "src/components/dashboard/my-tasks.tsx",
      "src/components/dashboard/my-obligations.tsx",
      "src/components/contracts/contract-table.tsx",
      "src/app/(dashboard)/contracts/renewals/page.tsx",
      "src/app/(dashboard)/contracts/[id]/page.tsx",
    ]) {
      const raw = readFileSync(join(process.cwd(), file), "utf8");
      expect(raw, file).toContain("formatBusinessDateAtNoon");
    }
  });

  it("normalizes contract list horizon calculations with parseBusinessDateAtNoon", () => {
    const raw = readFileSync(join(process.cwd(), "src/lib/contract-list-row-signals.ts"), "utf8");
    expect(raw).toContain("parseBusinessDateAtNoon");
  });
});
