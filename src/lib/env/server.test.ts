import { beforeEach, describe, expect, it, vi } from "vitest";

describe("server env contract", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("throws a clear error when required env var is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { requireServerEnv } = await import("@/lib/env/server");
    expect(() => requireServerEnv("STRIPE_SECRET_KEY")).toThrowError(
      "[env] Missing required server env var: STRIPE_SECRET_KEY"
    );
  });
});
