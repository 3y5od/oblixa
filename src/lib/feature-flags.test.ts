import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("feature flags", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.ENABLE_TASKS_ENGINE;
    delete process.env.ENABLE_V3_TASKS_ENGINE;
    delete process.env.ENABLE_ASSURANCE_CORE;
    delete process.env.ENABLE_V6_ASSURANCE_CORE;
    delete process.env.ENABLE_AUTOPILOT_ALLOW_EXECUTION;
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

  it("fails closed for invalid explicit and bypass-shaped flag values", async () => {
    process.env.ENABLE_V6_ASSURANCE_CORE = "enabled";
    process.env.ENABLE_V6_AUTOPILOT_ALLOW_EXECUTION = "bypass";
    const { isFeatureEnabled } = await import("@/lib/feature-flags");
    expect(isFeatureEnabled("v6AssuranceCore")).toBe(false);
    expect(isFeatureEnabled("v6AutopilotAllowExecution")).toBe(false);
  });

  it("accepts only explicit safe true values when an env flag is set", async () => {
    process.env.ENABLE_V6_ASSURANCE_CORE = "yes";
    const { isFeatureEnabled } = await import("@/lib/feature-flags");
    expect(isFeatureEnabled("v6AssuranceCore")).toBe(true);
  });

  it("prefers neutral env aliases over legacy feature flag keys", async () => {
    process.env.ENABLE_ASSURANCE_CORE = "0";
    process.env.ENABLE_V6_ASSURANCE_CORE = "yes";
    const { isFeatureEnabled, readFeatureFlagEnvValue, FEATURE_FLAG_ENV_ALIASES } = await import("@/lib/feature-flags");
    expect(FEATURE_FLAG_ENV_ALIASES.v6AssuranceCore).toEqual({
      neutral: "ENABLE_ASSURANCE_CORE",
      legacy: "ENABLE_V6_ASSURANCE_CORE",
    });
    expect(readFeatureFlagEnvValue("v6AssuranceCore")).toBe("0");
    expect(isFeatureEnabled("v6AssuranceCore")).toBe(false);
  });

  it("falls back to legacy feature flag keys during compatibility", async () => {
    process.env.ENABLE_V3_TASKS_ENGINE = "0";
    const { isFeatureEnabled, readFeatureFlagEnvValue } = await import("@/lib/feature-flags");
    expect(readFeatureFlagEnvValue("v3TasksEngine")).toBe("0");
    expect(isFeatureEnabled("v3TasksEngine")).toBe(false);
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
