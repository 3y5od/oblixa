import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §8.1–8.4 dashboard upper + persona + lower density", () => {
  it("upper lane composes StatsCards and gated persona presets", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/dashboard/dashboard-upper.tsx"),
      "utf8"
    );
    expect(raw).toContain("StatsCards");
    expect(raw).toContain("DashboardPersonaPresets");
    expect(raw).toContain("showPersonaPresets");
    expect(raw).toContain("isHrefEligibleForProductSurface");
  });

  it("lower lane composes operational queues plus role metrics density", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/dashboard/dashboard-lower.tsx"),
      "utf8"
    );
    expect(raw).toContain("ContractTable");
    expect(raw).toContain("CommandCenterRoleMetrics");
    expect(raw).toContain("isHrefEligibleForProductSurface");
  });
});
