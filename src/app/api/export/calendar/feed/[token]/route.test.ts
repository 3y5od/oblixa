import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const buildOrganizationCalendarIcs = vi.fn(async () => "BEGIN:VCALENDAR\nEND:VCALENDAR");
const requireApiWorkspaceEligibility = vi.fn(async () => null);
const recordApiRouteAuditEvent = vi.fn();

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/integrations/calendar", () => ({
  buildOrganizationCalendarIcs,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/security/api-mutation-audit", () => ({
  recordApiRouteAuditEvent,
}));

describe("GET /api/export/calendar/feed/[token]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    recordApiRouteAuditEvent.mockResolvedValue("v10-audit-1");
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
    expect(body).toMatchObject({ error: "Not found", code: "not_found" });
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
            token_hash: sha256("tok"),
            expires_at: new Date(Date.now() - 60_000).toISOString(),
            revoked_at: null,
          },
          {
            id: "feed_revoked",
            organization_id: "org_1",
            active: true,
            token_hash: sha256("tok"),
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
    expect(body).toMatchObject({ error: "Not found", code: "not_found" });
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
            token_hash: sha256("tok"),
            expires_at: null,
            revoked_at: null,
          },
        ],
        error: null,
      }),
    };
    const updateQuery = {
      error: null,
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
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
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(requireApiWorkspaceEligibility).toHaveBeenCalled();
    expect(buildOrganizationCalendarIcs).toHaveBeenCalledWith(expect.anything(), "org_1");
    expect(recordApiRouteAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: "org_1",
        actorType: "external",
        route: "/api/export/calendar/feed/[token]",
        method: "GET",
        action: "api.sensitive_read_authorized",
      })
    );
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
            token_hash: sha256("tok"),
            expires_at: null,
            revoked_at: null,
          },
        ],
        error: null,
      }),
    };
    const updateQuery = {
      error: { message: "write failed" },
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
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
