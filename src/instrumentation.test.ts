import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureRequestError: vi.fn(),
}));

vi.mock("../sentry.server.config", () => ({}));
vi.mock("../sentry.edge.config", () => ({}));

describe("instrumentation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("forwards request errors to Sentry when enabled", async () => {
    vi.stubEnv("OBLIXA_ENABLE_SENTRY_DEV", "1");
    const Sentry = await import("@sentry/nextjs");
    const mod = await import("./instrumentation");
    await (mod.onRequestError as (...args: unknown[]) => Promise<void>)(
      new Error("boom"),
      { path: "/dashboard", method: "GET", headers: {} },
      {
        routerKind: "App Router",
        routePath: "/dashboard",
        routeType: "render",
        revalidateReason: undefined,
      }
    );
    expect(Sentry.captureRequestError).toHaveBeenCalled();
  });

  it("keeps request error reporting disabled in local dev unless opted in", async () => {
    const Sentry = await import("@sentry/nextjs");
    const mod = await import("./instrumentation");
    await (mod.onRequestError as (...args: unknown[]) => Promise<void>)(
      new Error("boom"),
      { path: "/dashboard", method: "GET", headers: {} },
      {
        routerKind: "App Router",
        routePath: "/dashboard",
        routeType: "render",
        revalidateReason: undefined,
      }
    );
    expect(Sentry.captureRequestError).not.toHaveBeenCalled();
  });

  it("exposes register as an async function", async () => {
    const mod = await import("./instrumentation");
    expect(typeof mod.register).toBe("function");
    expect(mod.register.constructor.name).toBe("AsyncFunction");
  });

  it("register resolves for nodejs runtime (Sentry config import path)", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("OBLIXA_ENABLE_SENTRY_DEV", "1");
    vi.resetModules();
    const mod = await import("./instrumentation");
    await expect(mod.register()).resolves.toBeUndefined();
  });
});
