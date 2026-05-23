import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    getClientIpFromRequest: vi.fn(() => "198.51.100.10"),
    rateLimitCheck: vi.fn(async () => ({ ok: true })),
  };
});

describe("POST /api/security/csp-report", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts bounded CSP reports, logs redacted security event, and returns no-store 204", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { POST } = await import("./route");
    const res = await POST(
      new Request("https://app.example.com/api/security/csp-report", {
        method: "POST",
        headers: { "content-type": "application/csp-report" },
        body: JSON.stringify({
          "csp-report": {
            "document-uri": "https://app.example.com/dashboard?token=secret-token-value",
            "violated-directive": "script-src 'self'",
            "blocked-uri": "inline",
          },
        }),
      })
    );

    expect(res.status).toBe(204);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[security-event:csp-report]"));
    expect(warn.mock.calls[0]?.[0]).not.toContain("secret-token-value");
  });

  it("rejects unsupported content types", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("https://app.example.com/api/security/csp-report", {
        method: "POST",
        headers: { "content-type": "application/xml" },
        body: "<xml />",
      })
    );

    expect(res.status).toBe(415);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("rejects malformed report shapes", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("https://app.example.com/api/security/csp-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ "blocked-uri": "inline" }),
      })
    );

    expect(res.status).toBe(400);
  });
});
