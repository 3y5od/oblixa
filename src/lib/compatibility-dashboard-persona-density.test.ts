import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard Core density", () => {
  it("Core dashboard composes the shared page header without persona presets", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/dashboard/core-dashboard.tsx"),
      "utf8"
    );
    expect(raw).toContain("DashboardPageHeader");
    expect(raw).not.toContain("DashboardPersonaPresets");
    expect(raw).not.toContain("showPersonaPresets");
  });

  it("Core dashboard keeps recent activity as a compact activity list", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/dashboard/core-dashboard.tsx"),
      "utf8"
    );
    expect(raw).toContain("function ActivityRows");
    expect(raw).not.toContain("ContractTable");
  });
});
