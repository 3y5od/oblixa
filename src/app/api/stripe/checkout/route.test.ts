import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
}));

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_PRICE_ID = "price_123";
  });

  it("returns 401 when unauthenticated", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/stripe/checkout/route");
    const req = new Request("http://localhost:3000/api/stripe/checkout", {
      method: "POST",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Not authenticated" });
  });
});

