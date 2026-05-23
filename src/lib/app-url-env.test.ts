import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isSafeExtractionWorkerOriginMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    void url;
    return true;
  })
);

vi.mock("@/lib/security/worker-url", () => ({
  isSafeExtractionWorkerOrigin: (url: string) => isSafeExtractionWorkerOriginMock(url),
}));

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe("app-url env helpers", () => {
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;
  const prevWorker = process.env.EXTRACTION_WORKER_BASE_URL;
  const prevTrusted = process.env.OBLIXA_TRUSTED_APP_ORIGINS;
  const prevNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
    isSafeExtractionWorkerOriginMock.mockReturnValue(true);
    restoreEnv("NODE_ENV", prevNodeEnv);
  });

  afterEach(() => {
    restoreEnv("NEXT_PUBLIC_APP_URL", prevApp);
    restoreEnv("EXTRACTION_WORKER_BASE_URL", prevWorker);
    restoreEnv("OBLIXA_TRUSTED_APP_ORIGINS", prevTrusted);
    restoreEnv("NODE_ENV", prevNodeEnv);
    vi.resetModules();
  });

  it("getAppBaseUrlFromEnv trims trailing slashes and defaults host", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://oblixa.test/";
    const { getAppBaseUrlFromEnv } = await import("@/lib/app-url");
    expect(getAppBaseUrlFromEnv()).toBe("https://oblixa.test");
    delete process.env.NEXT_PUBLIC_APP_URL;
    vi.resetModules();
    const { getAppBaseUrlFromEnv: g2 } = await import("@/lib/app-url");
    expect(g2()).toBe("http://localhost:3000");
  });

  it("getRequestOrigin uses request URL", async () => {
    const { getRequestOrigin } = await import("@/lib/app-url");
    expect(getRequestOrigin(new Request("https://edge.test/path"))).toBe("https://edge.test");
  });

  it("resolveExtractionWorkerOrigin rejects unsafe explicit base", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    isSafeExtractionWorkerOriginMock.mockReturnValue(false);
    process.env.EXTRACTION_WORKER_BASE_URL = "https://evil.example/";
    const { resolveExtractionWorkerOrigin } = await import("@/lib/app-url");
    const origin = resolveExtractionWorkerOrigin(new Request("https://app.test/x"));
    expect(origin).toBe("https://app.test");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns null for localhost canonical origin in production-like env", async () => {
    restoreEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.OBLIXA_TRUSTED_APP_ORIGINS = "";
    const { getCanonicalAppBaseUrlFromEnv } = await import("@/lib/app-url");
    expect(getCanonicalAppBaseUrlFromEnv()).toBeNull();
  });
});
