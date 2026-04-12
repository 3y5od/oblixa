import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DASHBOARD_UPPER = join(process.cwd(), "src/components/dashboard/dashboard-upper.tsx");
const DASHBOARD_LOWER = join(process.cwd(), "src/components/dashboard/dashboard-lower.tsx");

describe("dashboard surface filtering tripwires", () => {
  it("filters shortcut cards and pinned views by href eligibility", () => {
    const raw = readFileSync(DASHBOARD_UPPER, "utf8");
    expect(raw.includes("isHrefEligibleForProductSurface")).toBe(true);
    expect(raw.includes(".filter((row) => isHrefEligible(row.href))")).toBe(true);
    expect(raw.includes("return isHrefEligible(card.href);")).toBe(true);
  });

  it("guards lower dashboard queue links with href eligibility checks", () => {
    const raw = readFileSync(DASHBOARD_LOWER, "utf8");
    expect(raw.includes("isHrefEligibleForProductSurface")).toBe(true);
    expect(raw.includes("isHrefEligible(\"/contracts/data-quality\")")).toBe(true);
    expect(raw.includes("isHrefEligible(\"/contracts/exceptions\")")).toBe(true);
  });
});
