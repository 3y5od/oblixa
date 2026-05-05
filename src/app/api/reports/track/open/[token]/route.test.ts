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

describe("GET /api/reports/track/open/[token]", () => {
  beforeEach(() => {
    vi.resetModules();
    rateLimitCheck.mockResolvedValue({ ok: true });
    createAdminClient.mockResolvedValue({
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(async () => ({ error: null })),
          })),
        })),
      })),
    });
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

  it("returns a degraded pixel when the tracking write fails", async () => {
    createAdminClient.mockResolvedValueOnce({
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(async () => ({ error: { message: "write failed" } })),
          })),
        })),
      })),
    });

    const { GET } = await import("@/app/api/reports/track/open/[token]/route");
    const req = new Request("http://localhost:3000/api/reports/track/open/abcdefgh");
    const res = await GET(req, { params: Promise.resolve({ token: "abcdefgh" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("x-oblixa-tracking-status")).toBe("degraded");
    expect(res.headers.get("x-oblixa-diagnostic-id")).toBe("report_track_open_write_failed");
  });
});
