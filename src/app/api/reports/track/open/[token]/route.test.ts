import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitCheck = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    rateLimitCheck,
  };
});

describe("GET /api/reports/track/open/[token]", () => {
  beforeEach(() => {
    vi.resetModules();
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns tracking pixel even for short token", async () => {
    const { GET } = await import("@/app/api/reports/track/open/[token]/route");
    const req = new Request("http://localhost:3000/api/reports/track/open/abc");
    const res = await GET(req, { params: Promise.resolve({ token: "abc" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/gif");
  });

  it("returns 429 pixel when rate limited", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 3000 });
    const { GET } = await import("@/app/api/reports/track/open/[token]/route");
    const req = new Request("http://localhost:3000/api/reports/track/open/abc");
    const res = await GET(req, { params: Promise.resolve({ token: "abc" }) });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("3");
    expect(res.headers.get("content-type")).toContain("image/gif");
  });
});
