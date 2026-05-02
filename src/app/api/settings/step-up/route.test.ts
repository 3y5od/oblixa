import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitCheck = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  rateLimitCheck: (...args: unknown[]) => rateLimitCheck(...args),
  RATE_LIMITS: {
    stepUpPassword: { max: 30, windowMs: 60_000 },
    dsrSelfExport: { max: 10, windowMs: 60_000 },
  },
  getClientIpFromRequest: () => "127.0.0.1",
}));

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getDeterministicMembership = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
  getDeterministicMembership,
}));

describe("POST /api/settings/step-up", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("returns 401 when not authenticated", async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://127.0.0.1/api/settings/step-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "x" }),
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Not authenticated" });
  });
});
