import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
}));

describe("GET /api/import/contracts/[jobId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });

    const { GET } = await import("@/app/api/import/contracts/[jobId]/route");
    const res = await GET(new Request("http://localhost:3000/api/import/contracts/abc"), {
      params: Promise.resolve({ jobId: "abc" }),
    });
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Not authenticated" });
  });
});

