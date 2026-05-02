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
    expect(csp).toContain("frame-ancestors 'self'");
  });

  it("optional prod strict style-src drops unsafe-inline on enforcing CSP", () => {
    const csp = buildContentSecurityPolicy(true, { strictEnforcingStyleSrc: true });
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toMatch(/style-src[^;]*'unsafe-inline'/);
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

  it("buildSecurityHeaders adds HSTS only on Vercel by default", () => {
    const noHsts = buildSecurityHeaders({ isProd: true, isVercel: false });
    expect(noHsts.some((h) => h.key === "Strict-Transport-Security")).toBe(false);
    const withHsts = buildSecurityHeaders({ isProd: true, isVercel: true });
    expect(withHsts.find((h) => h.key === "Strict-Transport-Security")?.value).toContain(
      "max-age="
    );
  });

  it("buildSecurityHeaders adds HSTS for self-hosted prod when selfHostedHsts is true", () => {
    const h = buildSecurityHeaders({ isProd: true, isVercel: false, selfHostedHsts: true });
    expect(h.find((x) => x.key === "Strict-Transport-Security")?.value).toContain("max-age=");
  });

  it("does not add HSTS for self-hosted flag in non-prod", () => {
    const h = buildSecurityHeaders({ isProd: false, isVercel: false, selfHostedHsts: true });
    expect(h.some((x) => x.key === "Strict-Transport-Security")).toBe(false);
  });

  it("report-only CSP can use script nonce when provided (staged)", () => {
    const ro = buildStrictCspReportOnly(true, "deadbeef");
    expect(ro).toContain("'nonce-deadbeef'");
    expect(ro).not.toContain("'unsafe-inline'");
  });

  it("reuses memoized CSP strings for identical security header inputs", () => {
    const input = { isProd: true, isVercel: false, cspReportOnlyScriptNonce: null as string | null };
    const a = buildSecurityHeaders(input);
    const b = buildSecurityHeaders(input);
    expect(a.map((x) => `${x.key}:${x.value}`).join("\n")).toBe(b.map((x) => `${x.key}:${x.value}`).join("\n"));
  });

  it("Permissions-Policy disables payment and capture surfaces unless product opts in later", () => {
    const h = buildSecurityHeaders({ isProd: true, isVercel: true });
    const pp = h.find((x) => x.key === "Permissions-Policy")?.value ?? "";
    expect(pp).toContain("payment=()");
    expect(pp).toContain("display-capture=()");
  });

  it("optional Trusted Types directive appended to report-only CSP when enabled", () => {
    const h = buildSecurityHeaders({
      isProd: true,
      isVercel: true,
      trustedTypesReportOnly: true,
    });
    const ro = h.find((x) => x.key === "Content-Security-Policy-Report-Only")?.value ?? "";
    expect(ro).toContain("require-trusted-types-for 'script'");
  });
});
