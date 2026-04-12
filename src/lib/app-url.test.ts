import { beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

describe("resolveAppBaseUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.VERCEL_URL;
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
});
