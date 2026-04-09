import { describe, expect, it } from "vitest";
import { getFeatureFlags, isFeatureEnabled } from "@/lib/feature-flags";

describe("feature flags", () => {
  it("defaults to disabled when unset", () => {
    delete process.env.ENABLE_V3_TASKS_ENGINE;
    expect(isFeatureEnabled("v3TasksEngine")).toBe(false);
  });

  it("parses explicit false values", () => {
    process.env.ENABLE_V3_TASKS_ENGINE = "false";
    expect(isFeatureEnabled("v3TasksEngine")).toBe(false);
  });

  it("returns a full snapshot map", () => {
    const flags = getFeatureFlags();
    expect(flags).toHaveProperty("v3TasksEngine");
    expect(flags).toHaveProperty("v3ReportingHistory");
  });
});
