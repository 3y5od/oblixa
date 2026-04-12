import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppBaseUrlFromEnv } from "@/lib/app-url";
import { SITEMAP_PATHS } from "@/lib/marketing/public-paths";

describe("robots() runtime", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("preview VERCEL_ENV disallows all crawlers", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const { default: robots } = await import("@/app/robots");
    const out = robots();
    expect(out).toEqual({
      rules: { userAgent: "*", disallow: "/" },
    });
  });

  it("production rules disallow app shells and expose sitemap URL", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { default: robots } = await import("@/app/robots");
    const out = robots();
    expect(Array.isArray(out.rules)).toBe(true);
    const rule = (out.rules as { disallow: string[] }[])[0];
    expect(rule.disallow).toContain("/api/");
    expect(rule.disallow).toContain("/dashboard/");
    expect(typeof out.sitemap).toBe("string");
    expect(out.sitemap).toMatch(/sitemap\.xml$/);
  });
});

describe("sitemap() runtime", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("emits one entry per SITEMAP_PATHS with tiered priority", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = sitemap();
    expect(entries).toHaveLength(SITEMAP_PATHS.length);
    const base = getAppBaseUrlFromEnv();
    const home = entries.find((e) => e.url === base);
    expect(home?.priority).toBe(1);
    const signup = entries.find((e) => e.url === `${base}/signup`);
    expect(signup?.priority).toBe(0.9);
  });
});
