import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitCheck = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    rateLimitCheck,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

describe("GET /api/reports/track/click/[token]", () => {
  beforeEach(() => {
    vi.resetModules();
    rateLimitCheck.mockResolvedValue({ ok: true });
    createAdminClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: { click_count: 1 }, error: null })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      })),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 when rate limited", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 5000 });
    const { GET } = await import("@/app/api/reports/track/click/[token]/route");
    const req = new Request(
      "http://localhost:3000/api/reports/track/click/abc?target=%2Fcontracts%2F123"
    );
    const res = await GET(req, { params: Promise.resolve({ token: "abc" }) });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("5");
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Too many requests");
  });

  it("redirects to dashboard fallback for invalid target", async () => {
    const { GET } = await import("@/app/api/reports/track/click/[token]/route");
    const req = new Request(
      "http://localhost:3000/api/reports/track/click/abc?target=not-a-url"
    );
    const res = await GET(req, { params: Promise.resolve({ token: "abc" }) });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("redirects to dashboard fallback for external absolute target", async () => {
    const { GET } = await import("@/app/api/reports/track/click/[token]/route");
    const req = new Request(
      "http://localhost:3000/api/reports/track/click/abc?target=https://evil.example/phish"
    );
    const res = await GET(req, { params: Promise.resolve({ token: "abc" }) });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("allows safe relative redirects", async () => {
    const { GET } = await import("@/app/api/reports/track/click/[token]/route");
    const req = new Request(
      "http://localhost:3000/api/reports/track/click/abc?target=%2Fcontracts%2F123"
    );
    const res = await GET(req, { params: Promise.resolve({ token: "abc" }) });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost:3000/contracts/123");
  });

  it("returns a degraded redirect when tracking persistence fails", async () => {
    createAdminClient.mockResolvedValueOnce({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: { message: "read failed" } })),
          })),
        })),
      })),
    });

    const { GET } = await import("@/app/api/reports/track/click/[token]/route");
    const req = new Request(
      "http://localhost:3000/api/reports/track/click/abcdefgh?target=%2Fcontracts%2F123"
    );
    const res = await GET(req, { params: Promise.resolve({ token: "abcdefgh" }) });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost:3000/contracts/123");
    expect(res.headers.get("x-oblixa-tracking-status")).toBe("degraded");
    expect(res.headers.get("x-oblixa-diagnostic-id")).toBe("report_track_click_read_failed");
  });
});
