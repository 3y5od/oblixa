import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const rateLimitCheck = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, rateLimitCheck };
});

describe("POST /api/import/contracts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("returns 401 when unauthenticated", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/import/contracts/route");
    const req = new Request("http://localhost:3000/api/import/contracts", {
      method: "POST",
      headers: { "content-type": "text/csv" },
      body: "title\nA",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Not authenticated" });
  });

  it("returns 429 when rate limited", async () => {
    rateLimitCheck.mockResolvedValue({ ok: false, retryAfterMs: 4000 });
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/import/contracts/route");
    const req = new Request("http://localhost:3000/api/import/contracts", {
      method: "POST",
      headers: { "content-type": "text/csv" },
      body: "title\nA",
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 400 when authenticated but Content-Type is not CSV or JSON", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/import/contracts/route");
    const req = new Request("http://localhost:3000/api/import/contracts", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "nope",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Expected CSV body." });
  });
});

