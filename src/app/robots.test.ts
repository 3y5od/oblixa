import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/app-url", () => ({
  getAppBaseUrlFromEnv: vi.fn(() => "https://app.example.com"),
}));

describe("robots()", () => {
  const prevVercel = process.env.VERCEL_ENV;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.VERCEL_ENV = prevVercel;
    vi.resetModules();
  });

  it("disallows all crawlers on Vercel preview", async () => {
    process.env.VERCEL_ENV = "preview";
    const { default: robots } = await import("@/app/robots");
    const out = robots();
    expect(out).toEqual({
      rules: { userAgent: "*", disallow: "/" },
    });
  });

  it("production rules reference sitemap and block sensitive prefixes", async () => {
    process.env.VERCEL_ENV = "production";
    const { default: robots } = await import("@/app/robots");
    const out = robots();
    expect(Array.isArray(out.rules)).toBe(true);
    const rule0 = (out.rules as { disallow: string[] }[])[0];
    expect(rule0?.disallow).toContain("/api/");
    expect(out.rules).toContainEqual({ userAgent: "GPTBot", disallow: "/" });
    expect(out.rules).toContainEqual({ userAgent: "OAI-SearchBot", disallow: "/" });
    expect(out.rules).toContainEqual({ userAgent: "Google-Extended", disallow: "/" });
    expect(out.rules).toContainEqual({ userAgent: "PerplexityBot", disallow: "/" });
    expect(out.sitemap).toBe("https://app.example.com/sitemap.xml");
  });
});
