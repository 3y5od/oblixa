import { describe, expect, it } from "vitest";

/** Tier 15 — Sentry `captureClientException` is a no-op when DSN is missing (dev/test default). */
describe("Sentry client capture (shape)", () => {
  it("export exists and is callable", async () => {
    const { captureClientException } = await import("@/lib/observability/sentry");
    expect(typeof captureClientException).toBe("function");
    expect(() => captureClientException(new Error("x"))).not.toThrow();
  });
});
