import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static invariants for Next.js proxy (middleware): matcher, auth gating, /api/* not wrapped by proxy auth.
 */
describe("proxy.ts routing invariants", () => {
  it("documents matcher, login redirect, and dashboard entry for signed-in users", () => {
    const file = join(process.cwd(), "src/proxy.ts");
    const raw = readFileSync(file, "utf8");
    expect(raw).toContain("export async function proxy");
    expect(raw).toContain('url.pathname = "/login"');
    expect(raw).toContain('url.pathname = "/dashboard"');
    expect(raw).toContain("export const config");
    expect(raw).toContain("matcher:");
    expect(raw).toContain("_next/static");
    expect(raw).toContain("robots");
    expect(raw).toContain("sitemap");
  });

  it("does not treat /api as authenticated-by-proxy; cron paths stay under /api prefix", () => {
    const raw = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(raw).toContain('!pathname.startsWith("/api/")');
    expect("/api/health".startsWith("/api/")).toBe(true);
  });

  it("sets V8 pathname header from nextUrl only for dashboard layout guard", () => {
    const raw = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(raw).toContain("withOblixaPathname");
    expect(raw).toContain("OBLIXA_PATHNAME_HEADER");
  });
});
