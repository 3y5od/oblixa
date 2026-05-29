import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("seedDemoWorkspace", () => {
  const prev = process.env.ENABLE_DEMO_SEED;

  beforeEach(() => {
    vi.resetModules();
    process.env.ENABLE_DEMO_SEED = "false";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.ENABLE_DEMO_SEED = prev;
  });

  it("returns error when demo seed is disabled", async () => {
    const { seedDemoWorkspace } = await import("@/actions/demo");
    const res = await seedDemoWorkspace();
    expect(res).toEqual({
      error: "Demo seed is disabled (set ENABLE_DEMO_SEED=true).",
    });
  });

  it("refuses demo seed in production-like environments even when enabled", async () => {
    process.env.ENABLE_DEMO_SEED = "true";
    vi.stubEnv("VERCEL_ENV", "production");
    const { seedDemoWorkspace } = await import("@/actions/demo");
    const res = await seedDemoWorkspace();
    expect(res).toEqual({
      error: "Demo seed is not available in production environments.",
    });
  });
});
