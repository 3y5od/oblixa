import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureRequestError: vi.fn(),
}));

describe("instrumentation", () => {
  it("re-exports Sentry captureRequestError as onRequestError", async () => {
    const Sentry = await import("@sentry/nextjs");
    const mod = await import("./instrumentation");
    expect(mod.onRequestError).toBe(Sentry.captureRequestError);
  });
});
