import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("seedDemoWorkspace", () => {
  const prev = process.env.ENABLE_DEMO_SEED;

  beforeEach(() => {
    vi.resetModules();
    process.env.ENABLE_DEMO_SEED = "false";
  });

  afterEach(() => {
    process.env.ENABLE_DEMO_SEED = prev;
  });

  it("returns error when demo seed is disabled", async () => {
    const { seedDemoWorkspace } = await import("@/actions/demo");
    const res = await seedDemoWorkspace();
    expect(res).toEqual({
      error: "Demo seed is disabled (set ENABLE_DEMO_SEED=true).",
    });
  });
});
