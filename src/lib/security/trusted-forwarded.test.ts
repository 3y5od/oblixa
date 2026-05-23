import { afterEach, describe, expect, it } from "vitest";
import {
  getTrustedClientIpFromRequest,
  getTrustedPublicOriginFromRequest,
} from "@/lib/security/trusted-forwarded";

const prevNodeEnv = process.env.NODE_ENV;
const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const prevTrusted = process.env.OBLIXA_TRUSTED_APP_ORIGINS;
const prevVercel = process.env.VERCEL;
const prevTrustForwardedIp = process.env.OBLIXA_TRUST_FORWARDED_IP;

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe("trusted-forwarded", () => {
  afterEach(() => {
    restoreEnv("NODE_ENV", prevNodeEnv);
    restoreEnv("NEXT_PUBLIC_APP_URL", prevAppUrl);
    restoreEnv("OBLIXA_TRUSTED_APP_ORIGINS", prevTrusted);
    restoreEnv("VERCEL", prevVercel);
    restoreEnv("OBLIXA_TRUST_FORWARDED_IP", prevTrustForwardedIp);
  });

  it("prefers x-forwarded-proto and x-forwarded-host when present", () => {
    const req = new Request("http://internal/app/callback", {
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "app.example.com",
      },
    });
    expect(getTrustedPublicOriginFromRequest(req)).toBe("https://app.example.com");
  });

  it("falls back to request URL when forwards absent", () => {
    const req = new Request("https://oblixa.test/login");
    expect(getTrustedPublicOriginFromRequest(req)).toBe("https://oblixa.test");
  });

  it("ignores untrusted forwarded hosts in production", () => {
    restoreEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    process.env.OBLIXA_TRUSTED_APP_ORIGINS = "https://app.example.com";
    const req = new Request("https://app.example.com/login", {
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "evil.example",
      },
    });
    expect(getTrustedPublicOriginFromRequest(req)).toBe("https://app.example.com");
  });

  it("ignores client IP forwarding headers unless a trusted proxy is configured", () => {
    restoreEnv("VERCEL", undefined);
    restoreEnv("OBLIXA_TRUST_FORWARDED_IP", undefined);
    const req = new Request("https://app.example.com/login", {
      headers: {
        "x-forwarded-for": "198.51.100.44, 10.0.0.5",
        "x-real-ip": "198.51.100.45",
      },
    });
    expect(getTrustedClientIpFromRequest(req)).toBe("unknown");
  });

  it("fails closed in non-Vercel production when trusted client IP config is absent", () => {
    restoreEnv("NODE_ENV", "production");
    restoreEnv("VERCEL", undefined);
    restoreEnv("OBLIXA_TRUST_FORWARDED_IP", undefined);
    const req = new Request("https://app.example.com/login", {
      headers: {
        "x-forwarded-for": "198.51.100.44",
      },
    });
    expect(() => getTrustedClientIpFromRequest(req)).toThrow(/Missing OBLIXA_TRUST_FORWARDED_IP=1/);
  });

  it("uses the first forwarded client IP when running behind a trusted proxy", () => {
    process.env.OBLIXA_TRUST_FORWARDED_IP = "1";
    const req = new Request("https://app.example.com/login", {
      headers: {
        "x-forwarded-for": "198.51.100.44, 10.0.0.5",
      },
    });
    expect(getTrustedClientIpFromRequest(req)).toBe("198.51.100.44");
  });

  it("falls back safely when trusted forwarded IP headers are malformed", () => {
    process.env.VERCEL = "1";
    const req = new Request("https://app.example.com/login", {
      headers: {
        "x-forwarded-for": "not an ip",
        "x-real-ip": "203.0.113.9",
      },
    });
    expect(getTrustedClientIpFromRequest(req)).toBe("203.0.113.9");
  });
});
