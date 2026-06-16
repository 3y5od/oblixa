import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CORE_DASHBOARD = join(process.cwd(), "src/components/dashboard/core-dashboard.tsx");
const CORE_DASHBOARD_SHELL = join(process.cwd(), "src/components/dashboard/core-dashboard-shell.tsx");

describe("dashboard Core header actions", () => {
  it("keeps Upload contract and Import contracts stable in the page header", () => {
    const raw = `${readFileSync(CORE_DASHBOARD, "utf8")}\n${readFileSync(CORE_DASHBOARD_SHELL, "utf8")}`;
    expect(raw.includes("DASHBOARD_PRIMARY_CTA")).toBe(true);
    expect(raw.includes("DASHBOARD_SECONDARY_CTA")).toBe(true);
    expect(raw.includes('href="/contracts/new"')).toBe(true);
    expect(raw.includes('href="/contracts/bulk"')).toBe(true);
    expect(raw.includes("metrics.pendingReview > 0")).toBe(false);
  });
});
