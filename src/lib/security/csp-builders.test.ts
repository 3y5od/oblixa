import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  buildStrictCspReportOnly,
} from "@/lib/security/csp-builders";

describe("csp-builders", () => {
  it("dev CSP allows unsafe-eval in script-src", () => {
    const csp = buildContentSecurityPolicy(false);
    expect(csp).toContain("'unsafe-eval'");
  });

  it("prod CSP omits unsafe-eval in main policy", () => {
    const csp = buildContentSecurityPolicy(true);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("https://api.stripe.com");
  });

  it("CSP allows workers from same origin and blob URLs", () => {
    for (const isProd of [true, false]) {
      const csp = buildContentSecurityPolicy(isProd);
      expect(csp, `prod=${isProd}`).toMatch(/worker-src[^;]*'self'[^;]*blob:/);
    }
  });

  it("report-only CSP uses the same worker-src as enforcing policy", () => {
    for (const isProd of [true, false]) {
      const enforcing = buildContentSecurityPolicy(isProd);
      const ro = buildStrictCspReportOnly(isProd);
      const workerEnf = /worker-src ([^;]+)/.exec(enforcing)?.[1];
      const workerRo = /worker-src ([^;]+)/.exec(ro)?.[1];
      expect(workerEnf, `prod=${isProd}`).toBeTruthy();
      expect(workerRo, `prod=${isProd}`).toBe(workerEnf);
    }
  });

  it("report-only omits unsafe-inline on styles in prod-like strict block", () => {
    const strict = buildStrictCspReportOnly(true);
    expect(strict).toContain("style-src 'self'");
    expect(strict).not.toContain("'unsafe-inline'");
  });

  it("buildSecurityHeaders adds HSTS only on Vercel", () => {
    const noHsts = buildSecurityHeaders({ isProd: true, isVercel: false });
    expect(noHsts.some((h) => h.key === "Strict-Transport-Security")).toBe(false);
    const withHsts = buildSecurityHeaders({ isProd: true, isVercel: true });
    expect(withHsts.find((h) => h.key === "Strict-Transport-Security")?.value).toContain(
      "max-age="
    );
  });
});
