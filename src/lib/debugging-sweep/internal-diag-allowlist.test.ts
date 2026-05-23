import { describe, expect, it } from "vitest";
import { clientIpMatchesAllowlist, parseInternalDiagAllowlist } from "./internal-diag-allowlist";

describe("internal diagnostics IP allowlist", () => {
  it("parses empty as allow-all", () => {
    expect(parseInternalDiagAllowlist(undefined)).toEqual({ ok: true, rules: [] });
    expect(parseInternalDiagAllowlist("   ")).toEqual({ ok: true, rules: [] });
  });

  it("fails closed on empty token list", () => {
    expect(parseInternalDiagAllowlist(",,").ok).toBe(false);
  });

  it("matches exact IPv4 and IPv4 CIDR", () => {
    const p = parseInternalDiagAllowlist("10.0.0.1,192.168.0.0/24");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(clientIpMatchesAllowlist("10.0.0.1", p.rules)).toBe(true);
    expect(clientIpMatchesAllowlist("192.168.0.44", p.rules)).toBe(true);
    expect(clientIpMatchesAllowlist("192.168.1.44", p.rules)).toBe(false);
  });

  it("matches exact IPv6 addresses", () => {
    const p = parseInternalDiagAllowlist("2001:db8::10");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(clientIpMatchesAllowlist("2001:db8::10", p.rules)).toBe(true);
    expect(clientIpMatchesAllowlist("2001:db8::11", p.rules)).toBe(false);
  });

  it("fails closed on malformed addresses and CIDR prefixes", () => {
    expect(parseInternalDiagAllowlist("999.999.999.999").ok).toBe(false);
    expect(parseInternalDiagAllowlist("10.0.0.0/99").ok).toBe(false);
    expect(parseInternalDiagAllowlist("2001:db8::/64").ok).toBe(false);
    expect(parseInternalDiagAllowlist("10.0.0.1;127.0.0.1").ok).toBe(false);
  });
});
