import { describe, it, expect, vi, afterEach } from "vitest";

describe("feature flag kill switch", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("treats explicit false env as disabled", async () => {
    vi.stubEnv("ENABLE_V3_TASKS_ENGINE", "false");
    const { isFeatureEnabled } = await import("./feature-flags");
    expect(isFeatureEnabled("v3TasksEngine")).toBe(false);
  });

  it("treats deleted env as enabled (default-on contract)", async () => {
    vi.unstubAllEnvs();
    delete process.env.ENABLE_V3_TASKS_ENGINE;
    vi.resetModules();
    const { isFeatureEnabled } = await import("./feature-flags");
    expect(isFeatureEnabled("v3TasksEngine")).toBe(true);
  });
});
