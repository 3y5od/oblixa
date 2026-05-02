import { describe, expect, it } from "vitest";
import { isBlockedOutboundIpv4, isBlockedOutboundIp } from "@/lib/security/safe-fetch";

describe("safe-fetch IP guards", () => {
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
});
