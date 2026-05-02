import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureRequestError: vi.fn(),
}));

vi.mock("../sentry.server.config", () => ({}));
vi.mock("../sentry.edge.config", () => ({}));

describe("instrumentation", () => {
  it("re-exports Sentry captureRequestError as onRequestError", async () => {
    const Sentry = await import("@sentry/nextjs");
    const mod = await import("./instrumentation");
    expect(mod.onRequestError).toBe(Sentry.captureRequestError);
  });

  it("exposes register as an async function", async () => {
    const mod = await import("./instrumentation");
    expect(typeof mod.register).toBe("function");
    expect(mod.register.constructor.name).toBe("AsyncFunction");
  });

  it("register resolves for nodejs runtime (Sentry config import path)", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.resetModules();
    const mod = await import("./instrumentation");
    await expect(mod.register()).resolves.toBeUndefined();
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
