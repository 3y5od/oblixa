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
