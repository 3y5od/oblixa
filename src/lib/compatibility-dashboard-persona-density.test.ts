import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard Core density", () => {
  it("Core dashboard composes the shared page header without persona presets", () => {
    const raw = [
      "src/components/dashboard/core-dashboard.tsx",
      "src/components/dashboard/core-dashboard-shell.tsx",
      "src/components/dashboard/core-dashboard-sections.tsx",
    ]
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");
    expect(raw).toContain("DashboardPageHeader");
    expect(raw).not.toContain("DashboardPersonaPresets");
    expect(raw).not.toContain("showPersonaPresets");
  });

  it("Core dashboard keeps recent activity as a compact activity list", () => {
    const raw = [
      "src/components/dashboard/core-dashboard.tsx",
      "src/components/dashboard/core-dashboard-sections.tsx",
    ]
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");
    expect(raw).toContain("function ActivityRows");
    expect(raw).not.toContain("ContractTable");
  });
});
