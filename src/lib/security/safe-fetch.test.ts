import dns from "node:dns/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SAFE_FETCH_MAX_TIMEOUT_MS,
  createPinnedDnsLookupForSafeFetch,
  isAllowedDevLocalhostUrl,
  isBlockedOutboundIpv4,
  isBlockedOutboundIp,
  safeFetch,
} from "@/lib/security/safe-fetch";

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn(),
  },
}));

describe("safe-fetch IP guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.mocked(dns.lookup).mockReset();
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

  it("blocks IPv6 documentation, compatibility, and translation ranges", () => {
    expect(isBlockedOutboundIp("2001:db8::1")).toBe(true);
    expect(isBlockedOutboundIp("fe90::1")).toBe(true);
    expect(isBlockedOutboundIp("64:ff9b::0808:0808")).toBe(true);
    expect(isBlockedOutboundIp("::ffff:8.8.8.8")).toBe(true);
    expect(isBlockedOutboundIp("2002:0808:0808::1")).toBe(true);
    expect(isBlockedOutboundIp("2606:4700:4700::1111")).toBe(false);
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

  it("rejects DNS resolution to blocked IPs before fetch", async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: "169.254.169.254", family: 4 }] as unknown as Awaited<
      ReturnType<typeof dns.lookup>
    >);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetch("https://metadata.example.test/path")).rejects.toThrow("resolved to blocked IP");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects bracketed IPv6 loopback before DNS resolution", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetch("http://[::1]/internal")).rejects.toThrow("disallowed host");
    expect(dns.lookup).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects DNS resolution to blocked IPv6 ranges before fetch", async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: "2001:db8::1", family: 6 }] as unknown as Awaited<
      ReturnType<typeof dns.lookup>
    >);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetch("https://ipv6-doc.example.test/path")).rejects.toThrow("resolved to blocked IP");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pins DNS result for dispatcher lookup to prevent rebinding", () => {
    const lookup = createPinnedDnsLookupForSafeFetch([{ address: "93.184.216.34", family: 4 }]);
    const allCallback = vi.fn();
    lookup("api.example.test", { all: true }, allCallback);
    expect(allCallback).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);

    const oneCallback = vi.fn();
    lookup("api.example.test", {}, oneCallback);
    expect(oneCallback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
  });

  it("forces manual redirects and rejects explicit redirect following", async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as unknown as Awaited<
      ReturnType<typeof dns.lookup>
    >);
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    await safeFetch("https://api.example.test/path");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ dispatcher: expect.any(Object), redirect: "manual" })
    );
    await expect(safeFetch("https://api.example.test/path", { redirect: "follow" })).rejects.toThrow(
      "redirect following is disabled"
    );
  });

  it("rejects redirect responses with Location headers", async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as unknown as Awaited<
      ReturnType<typeof dns.lookup>
    >);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }))
    );

    await expect(safeFetch("https://api.example.test/path")).rejects.toThrow("redirect response blocked");
  });

  it("aborts outbound calls after the configured timeout", async () => {
    vi.useFakeTimers();
    vi.mocked(dns.lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as unknown as Awaited<
      ReturnType<typeof dns.lookup>
    >);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (_url: unknown, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            if (init?.signal?.aborted) {
              reject(new Error("aborted"));
              return;
            }
            init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
          })
      )
    );

    try {
      const pending = expect(safeFetch("https://api.example.test/path", { timeoutMs: 5 })).rejects.toThrow("aborted");
      await vi.advanceTimersByTimeAsync(5);
      await pending;
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects invalid timeouts and caps excessive timeouts", async () => {
    await expect(safeFetch("https://api.example.test/path", { timeoutMs: Number.POSITIVE_INFINITY })).rejects.toThrow(
      "invalid timeout"
    );

    vi.mocked(dns.lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as unknown as Awaited<
      ReturnType<typeof dns.lookup>
    >);
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    await safeFetch("https://api.example.test/path", { timeoutMs: SAFE_FETCH_MAX_TIMEOUT_MS + 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
