import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
}));

describe("POST /api/import/contracts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
});

