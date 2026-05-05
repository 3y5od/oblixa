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
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
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

  it("returns 404 when feed is expired or revoked", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: "feed_expired",
            organization_id: "org_1",
            active: true,
            token: "tok",
            token_hash: null,
            expires_at: new Date(Date.now() - 60_000).toISOString(),
            revoked_at: null,
          },
          {
            id: "feed_revoked",
            organization_id: "org_1",
            active: true,
            token: "tok",
            token_hash: null,
            expires_at: null,
            revoked_at: new Date().toISOString(),
          },
        ],
        error: null,
      }),
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
    expect(buildOrganizationCalendarIcs).not.toHaveBeenCalled();
  });

  it("returns ICS body and cache headers for a valid token", async () => {
    const feedLookupQuery = {
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
        error: null,
      }),
    };
    const updateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    const from = vi
      .fn()
      .mockImplementationOnce(() => feedLookupQuery)
      .mockImplementationOnce(() => updateQuery);
    createAdminClient.mockResolvedValue({
      from,
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

  it("returns 500 when feed lookup fails", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
    };
    createAdminClient.mockResolvedValue({ from: vi.fn(() => query) });

    const { GET } = await import("@/app/api/export/calendar/feed/[token]/route");
    const res = await GET(new Request("http://localhost:3000/api/export/calendar/feed/tok"), {
      params: Promise.resolve({ token: "tok" }),
    });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toMatchObject({ diagnostic_id: "calendar_feed_lookup_failed" });
  });

  it("returns degraded ICS headers when last_accessed_at persistence fails", async () => {
    const feedLookupQuery = {
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
        error: null,
      }),
    };
    const updateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: "write failed" } }),
    };
    const from = vi
      .fn()
      .mockImplementationOnce(() => feedLookupQuery)
      .mockImplementationOnce(() => updateQuery);
    createAdminClient.mockResolvedValue({
      from,
    });

    const { GET } = await import("@/app/api/export/calendar/feed/[token]/route");
    const res = await GET(new Request("http://localhost:3000/api/export/calendar/feed/tok"), {
      params: Promise.resolve({ token: "tok" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("x-oblixa-export-status")).toBe("degraded");
    expect(res.headers.get("x-oblixa-diagnostic-id")).toBe("calendar_feed_last_access_update_failed");
  });
});

