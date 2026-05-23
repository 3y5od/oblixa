import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe("resolveAppBaseUrl", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevTrusted = process.env.OBLIXA_TRUSTED_APP_ORIGINS;
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.VERCEL_URL;
    restoreEnv("NODE_ENV", prevNodeEnv);
    restoreEnv("OBLIXA_TRUSTED_APP_ORIGINS", prevTrusted);
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("prefers x-forwarded-host and x-forwarded-proto when present", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        "x-forwarded-host": "app.example.com",
        "x-forwarded-proto": "https",
      })
    );
    const { resolveAppBaseUrl } = await import("@/lib/app-url");
    await expect(resolveAppBaseUrl()).resolves.toBe("https://app.example.com");
  });

  it("builds an origin from forwarded headers as provided (edge must validate host trust)", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        "x-forwarded-host": "untrusted-host.example",
        "x-forwarded-proto": "https",
      })
    );
    const { resolveAppBaseUrl } = await import("@/lib/app-url");
    await expect(resolveAppBaseUrl()).resolves.toBe("https://untrusted-host.example");
  });

  it("rejects untrusted forwarded hosts in production and falls back to canonical origin", async () => {
    restoreEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    process.env.OBLIXA_TRUSTED_APP_ORIGINS = "https://app.example.com";
    headersMock.mockResolvedValue(
      new Headers({
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      })
    );
    const { resolveAppBaseUrl } = await import("@/lib/app-url");
    await expect(resolveAppBaseUrl()).resolves.toBe("https://app.example.com");
  });

  it("accepts allowlisted forwarded hosts in production", async () => {
    restoreEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    process.env.OBLIXA_TRUSTED_APP_ORIGINS = "https://app.example.com";
    headersMock.mockResolvedValue(
      new Headers({
        "x-forwarded-host": "app.example.com",
        "x-forwarded-proto": "https",
      })
    );
    const { resolveAppBaseUrl } = await import("@/lib/app-url");
    await expect(resolveAppBaseUrl()).resolves.toBe("https://app.example.com");
  });

  afterEach(() => {
    restoreEnv("NODE_ENV", prevNodeEnv);
    restoreEnv("OBLIXA_TRUSTED_APP_ORIGINS", prevTrusted);
    restoreEnv("NEXT_PUBLIC_APP_URL", prevAppUrl);
  });
});
