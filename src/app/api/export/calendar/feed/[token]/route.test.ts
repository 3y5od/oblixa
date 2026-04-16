import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const buildOrganizationCalendarIcs = vi.fn(async () => "BEGIN:VCALENDAR\nEND:VCALENDAR");
const requireApiWorkspaceEligibility = vi.fn(async () => null);

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/integrations/calendar", () => ({
  buildOrganizationCalendarIcs,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
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

  it("returns ICS body and cache headers for a valid token", async () => {
    const feedQuery = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: "feed_1",
            organization_id: "org_1",
            active: true,
            token: "tok",
            token_hash: null,
            expires_at: null,
            revoked_at: null,
          },
        ],
      }),
      update: vi.fn().mockReturnThis(),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "calendar_feeds") return feedQuery;
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      }),
    });

    const { GET } = await import("@/app/api/export/calendar/feed/[token]/route");
    const req = new Request("http://localhost:3000/api/export/calendar/feed/tok");
    const res = await GET(req, { params: Promise.resolve({ token: "tok" }) });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("BEGIN:VCALENDAR");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=300");
    expect(requireApiWorkspaceEligibility).toHaveBeenCalled();
    expect(buildOrganizationCalendarIcs).toHaveBeenCalledWith(expect.anything(), "org_1");
  });
});

