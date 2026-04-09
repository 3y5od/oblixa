import { describe, expect, it } from "vitest";
import { getFeatureFlags, isFeatureEnabled } from "@/lib/feature-flags";

describe("feature flags", () => {
  it("defaults to enabled when unset (V4 launch default)", () => {
    delete process.env.ENABLE_V3_TASKS_ENGINE;
    expect(isFeatureEnabled("v3TasksEngine")).toBe(true);
  });

  it("parses explicit false values", () => {
    process.env.ENABLE_V3_TASKS_ENGINE = "false";
    expect(isFeatureEnabled("v3TasksEngine")).toBe(false);
    process.env.ENABLE_V3_TASKS_ENGINE = "0";
    expect(isFeatureEnabled("v3TasksEngine")).toBe(false);
    process.env.ENABLE_V3_TASKS_ENGINE = "off";
    expect(isFeatureEnabled("v3TasksEngine")).toBe(false);
  });

  it("parses explicit true and other non-disable values as enabled", () => {
    process.env.ENABLE_V3_TASKS_ENGINE = "true";
    expect(isFeatureEnabled("v3TasksEngine")).toBe(true);
    process.env.ENABLE_V3_TASKS_ENGINE = "1";
    expect(isFeatureEnabled("v3TasksEngine")).toBe(true);
  });

  it("returns a full snapshot map", () => {
    const flags = getFeatureFlags();
    expect(flags).toHaveProperty("v3TasksEngine");
    expect(flags).toHaveProperty("v3ReportingHistory");
  });
});
