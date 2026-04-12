import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DASHBOARD_UPPER = join(process.cwd(), "src/components/dashboard/dashboard-upper.tsx");

describe("dashboard upper core promotion gating", () => {
  it("filters maintenance campaign shortcuts from core surfaces", () => {
    const raw = readFileSync(DASHBOARD_UPPER, "utf8");
    expect(raw.includes("visibleCommandCenterCards")).toBe(true);
    expect(raw.includes("card.href.startsWith(\"/contracts/maintenance\")")).toBe(true);
    expect(raw.includes("isHrefEligible(card.href)")).toBe(true);
  });
});
