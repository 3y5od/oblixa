import { describe, expect, it } from "vitest";
import {
  buildApiNoStoreHeaders,
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  buildStrictCspReportOnly,
  normalizeCoepMode,
  normalizeCspScriptNonce,
  normalizeCspScriptHashSources,
  normalizeTrustedTypesMode,
} from "@/lib/security/csp-builders";

describe("csp-builders", () => {
  it("dev CSP allows unsafe-eval in script-src", () => {
    const csp = buildContentSecurityPolicy(false);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("http://127.0.0.1:54321");
    expect(csp).toContain("ws://127.0.0.1:54321");
  });

  it("prod CSP omits unsafe-eval in main policy", () => {
    const csp = buildContentSecurityPolicy(true);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("http://127.0.0.1:54321");
    expect(csp).toContain("https://api.stripe.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("CSP can suppress mixed-content upgrades for local HTTP smoke environments", () => {
    const csp = buildContentSecurityPolicy(false);
    expect(csp).toContain("upgrade-insecure-requests");
    const localHttpCsp = buildContentSecurityPolicy(true, { upgradeInsecureRequests: false });
    expect(localHttpCsp).not.toContain("upgrade-insecure-requests");
  });

  it("production CSP does not broaden script or frame sources", () => {
    const csp = buildContentSecurityPolicy(true);
    const scriptSrc = /script-src ([^;]+)/.exec(csp)?.[1] ?? "";
    const frameSrc = /frame-src ([^;]+)/.exec(csp)?.[1] ?? "";
    expect(scriptSrc).not.toContain("*");
    expect(scriptSrc).not.toContain("http:");
    expect(frameSrc).not.toContain("*");
    expect(frameSrc).not.toContain("http:");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("manifest-src 'self'");
    expect(csp).toContain("media-src 'self' blob:");
    expect(csp).toContain("child-src https://js.stripe.com");
  });

  it("prod style-src drops unsafe-inline on enforcing CSP by default", () => {
    const csp = buildContentSecurityPolicy(true);
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toMatch(/style-src[^;]*'unsafe-inline'/);
  });

  it("prod script-src drops unsafe-inline on enforcing CSP by default", () => {
    const csp = buildContentSecurityPolicy(true);
    const scriptSrc = /script-src ([^;]+)/.exec(csp)?.[1] ?? "";
    expect(scriptSrc).toBe("'self'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("prod enforcing CSP supports explicit unsafe-inline rollback flags", () => {
    const csp = buildContentSecurityPolicy(true, {
      strictEnforcingScriptSrc: false,
      strictEnforcingStyleSrc: false,
    });
    expect(csp).toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
  });

  it("strict prod script-src accepts configured hashes for inline rollout", () => {
    const hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const csp = buildContentSecurityPolicy(true, {
      strictEnforcingScriptSrc: true,
      enforcingScriptHashes: hash,
    });
    const scriptSrc = /script-src ([^;]+)/.exec(csp)?.[1] ?? "";
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain(`'${hash}'`);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("invalid configured CSP script hash sources fail closed", () => {
    expect(() => normalizeCspScriptHashSources("nonce-static-value")).toThrow(
      /Invalid CSP script hash source/
    );
  });

  it("invalid report-only CSP nonce sources fail closed", () => {
    expect(normalizeCspScriptNonce("deadbeef")).toBe("deadbeef");
    expect(() => normalizeCspScriptNonce("short")).toThrow(/Invalid CSP script nonce source/);
    expect(() => normalizeCspScriptNonce("deadbeef; report-uri https://evil.test")).toThrow(
      /Invalid CSP script nonce source/
    );
    expect(() => normalizeCspScriptNonce("deadbeef\r\nX-Bad: yes")).toThrow(
      /Invalid CSP script nonce source/
    );
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

  it("report-only CSP carries script attribute and mixed-content protections", () => {
    const strict = buildStrictCspReportOnly(true);
    expect(strict).toContain("script-src-attr 'none'");
    expect(strict).toContain("upgrade-insecure-requests");
    expect(strict).toContain("manifest-src 'self'");
    expect(strict).toContain("media-src 'self' blob:");
  });

  it("report-only omits unsafe-inline on styles in prod-like strict block", () => {
    const strict = buildStrictCspReportOnly(true);
    expect(strict).toContain("style-src 'self'");
    expect(strict).not.toContain("'unsafe-inline'");
  });

  it("buildSecurityHeaders adds HSTS only on Vercel by default", () => {
    const noHsts = buildSecurityHeaders({ isProd: true, isVercel: false });
    expect(noHsts.some((h) => h.key === "Strict-Transport-Security")).toBe(false);
    expect(noHsts.find((h) => h.key === "Content-Security-Policy")?.value).not.toContain(
      "upgrade-insecure-requests"
    );
    const withHsts = buildSecurityHeaders({ isProd: true, isVercel: true });
    expect(withHsts.find((h) => h.key === "Strict-Transport-Security")?.value).toContain(
      "max-age="
    );
    expect(withHsts.find((h) => h.key === "Content-Security-Policy")?.value).toContain(
      "upgrade-insecure-requests"
    );
  });

  it("buildSecurityHeaders includes browser isolation and anti-sniffing headers", () => {
    const headers = buildSecurityHeaders({ isProd: true, isVercel: true });
    const byKey = new Map(headers.map((h) => [h.key, h.value]));
    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
    expect(byKey.get("X-Frame-Options")).toBe("DENY");
    expect(byKey.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(byKey.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(byKey.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("buildSecurityHeaders rejects unsafe header values sourced from nonce input", () => {
    expect(() =>
      buildSecurityHeaders({
        isProd: true,
        isVercel: true,
        cspReportOnlyScriptNonce: "deadbeef\r\nX-Bad: yes",
      })
    ).toThrow(/Invalid CSP script nonce source/);
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
    expect(pp).toContain("accelerometer=()");
    expect(pp).toContain("browsing-topics=()");
    expect(pp).toContain("xr-spatial-tracking=()");
  });

  it("optional Trusted Types directive appended to report-only CSP when enabled", () => {
    const h = buildSecurityHeaders({
      isProd: true,
      isVercel: true,
      trustedTypesMode: "report-only",
    });
    const ro = h.find((x) => x.key === "Content-Security-Policy-Report-Only")?.value ?? "";
    const enforcing = h.find((x) => x.key === "Content-Security-Policy")?.value ?? "";
    expect(ro).toContain("require-trusted-types-for 'script'");
    expect(ro).toContain("trusted-types oblixa default");
    expect(enforcing).not.toContain("require-trusted-types-for 'script'");
  });

  it("Trusted Types can be enforced on the main CSP with an explicit mode", () => {
    const h = buildSecurityHeaders({
      isProd: true,
      isVercel: true,
      trustedTypesMode: "enforce",
    });
    const enforcing = h.find((x) => x.key === "Content-Security-Policy")?.value ?? "";
    const ro = h.find((x) => x.key === "Content-Security-Policy-Report-Only")?.value ?? "";
    expect(enforcing).toContain("trusted-types oblixa default");
    expect(enforcing).toContain("require-trusted-types-for 'script'");
    expect(ro).not.toContain("require-trusted-types-for 'script'");
  });

  it("Trusted Types mode rejects unsupported values", () => {
    expect(normalizeTrustedTypesMode("off")).toBe("off");
    expect(normalizeTrustedTypesMode("report-only")).toBe("report-only");
    expect(normalizeTrustedTypesMode("enforce")).toBe("enforce");
    expect(() => normalizeTrustedTypesMode("monitor")).toThrow(/Invalid Trusted Types mode/);
  });

  it("COEP compatibility gate supports off, credentialless, and require-corp", () => {
    expect(normalizeCoepMode("off")).toBe("off");
    expect(normalizeCoepMode("credentialless")).toBe("credentialless");
    expect(normalizeCoepMode("require-corp")).toBe("require-corp");
    expect(() => normalizeCoepMode("same-origin")).toThrow(/Invalid COEP mode/);

    const off = buildSecurityHeaders({ isProd: true, isVercel: true, coepMode: "off" });
    expect(off.some((x) => x.key === "Cross-Origin-Embedder-Policy")).toBe(false);
    const credentialless = buildSecurityHeaders({ isProd: true, isVercel: true, coepMode: "credentialless" });
    expect(credentialless.find((x) => x.key === "Cross-Origin-Embedder-Policy")?.value).toBe("credentialless");
    const requireCorp = buildSecurityHeaders({ isProd: true, isVercel: true, coepMode: "require-corp" });
    expect(requireCorp.find((x) => x.key === "Cross-Origin-Embedder-Policy")?.value).toBe("require-corp");
  });

  it("buildApiNoStoreHeaders emits CDN-resistant private API cache headers", () => {
    const headers = buildApiNoStoreHeaders();
    const byKey = new Map(headers.map((h) => [h.key, h.value]));
    expect(byKey.get("Cache-Control")).toBe("private, no-store, max-age=0, must-revalidate");
    expect(byKey.get("Pragma")).toBe("no-cache");
    expect(byKey.get("Expires")).toBe("0");
    expect(byKey.get("Surrogate-Control")).toBe("no-store");
    expect(byKey.get("Vary")).toBe("Cookie, Authorization");
  });
});
