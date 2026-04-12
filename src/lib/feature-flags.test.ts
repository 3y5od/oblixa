import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("feature flags", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.ENABLE_V3_TASKS_ENGINE;
    delete process.env.ENABLE_V6_ASSURANCE_CORE;
    delete process.env.ENABLE_V6_AUTOPILOT_ALLOW_EXECUTION;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("treats unset env as enabled (v4 default)", async () => {
    const { isFeatureEnabled } = await import("@/lib/feature-flags");
    expect(isFeatureEnabled("v3TasksEngine")).toBe(true);
  });

  it("parses falsey string variants as disabled", async () => {
    process.env.ENABLE_V6_ASSURANCE_CORE = "0";
    const { isFeatureEnabled } = await import("@/lib/feature-flags");
    expect(isFeatureEnabled("v6AssuranceCore")).toBe(false);
    process.env.ENABLE_V6_ASSURANCE_CORE = "false";
    vi.resetModules();
    const { isFeatureEnabled: is2 } = await import("@/lib/feature-flags");
    expect(is2("v6AssuranceCore")).toBe(false);
  });

  it("getFeatureFlags returns every key", async () => {
    const { getFeatureFlags } = await import("@/lib/feature-flags");
    const all = getFeatureFlags();
    expect(Object.keys(all).sort()).toEqual(
      expect.arrayContaining([
        "v5PortfolioCampaigns",
        "v6Segments",
        "v6AutopilotAllowExecution",
      ])
    );
    expect(Object.keys(all).length).toBeGreaterThan(15);
  });
});
