import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowedDevLocalhostUrl, isBlockedOutboundIpv4, isBlockedOutboundIp } from "@/lib/security/safe-fetch";

describe("safe-fetch IP guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks loopback and private IPv4", () => {
    expect(isBlockedOutboundIpv4("127.0.0.1")).toBe(true);
    expect(isBlockedOutboundIpv4("10.0.0.1")).toBe(true);
    expect(isBlockedOutboundIpv4("192.168.1.1")).toBe(true);
    expect(isBlockedOutboundIpv4("169.254.169.254")).toBe(true);
    expect(isBlockedOutboundIpv4("172.16.0.1")).toBe(true);
  });

  it("allows public IPv4", () => {
    expect(isBlockedOutboundIpv4("8.8.8.8")).toBe(false);
    expect(isBlockedOutboundIpv4("1.1.1.1")).toBe(false);
  });

  it("blocks IPv6 loopback and ULA", () => {
    expect(isBlockedOutboundIp("::1")).toBe(true);
    expect(isBlockedOutboundIp("fd12::1")).toBe(true);
    expect(isBlockedOutboundIp("fe80::1")).toBe(true);
  });

  it("allows localhost only in non-production dev when explicitly requested", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");
    expect(isAllowedDevLocalhostUrl(new URL("http://localhost:3000/api/extract"))).toBe(true);
    expect(isAllowedDevLocalhostUrl(new URL("http://127.0.0.1:3000/api/extract"))).toBe(true);
  });

  it("rejects localhost bypass in production-like env", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    expect(isAllowedDevLocalhostUrl(new URL("http://localhost:3000/api/extract"))).toBe(false);
  });
});

