import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

describe("GET /api/export/calendar/feed/[token]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 404 when token is not found", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn(() => query),
    });

    const { GET } = await import("@/app/api/export/calendar/feed/[token]/route");
    const req = new Request("http://localhost:3000/api/export/calendar/feed/tok");
    const res = await GET(req, { params: Promise.resolve({ token: "tok" }) });
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Feed not found" });
  });
});

