import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getV6OrgSettingsJson = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const filterAuditEventsForWorkspaceMode = vi.fn((rows) => rows);

vi.mock("@/lib/v6/org-settings", () => ({
  getV6OrgSettingsJson,
}));

vi.mock("@/lib/product-surface/context", () => ({
  parseWorkspaceMode: vi.fn(() => "core"),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/product-surface/audit-events-filter", () => ({
  filterAuditEventsForWorkspaceMode,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
}));

describe("GET /api/events", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getV6OrgSettingsJson.mockResolvedValue({});
    requireApiWorkspaceEligibility.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated and no API key", async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn(),
    });

    const { GET } = await import("@/app/api/events/route");
    const req = new Request("http://localhost:3000/api/events");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Not authenticated" });
  });

  it("returns 401 for invalid API keys", async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      })),
    });

    const { GET } = await import("@/app/api/events/route");
    const req = new Request("http://localhost:3000/api/events", {
      headers: { "x-api-key": "not-a-real-key" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Invalid API key" });
  });

  it("returns filtered events for valid API keys", async () => {
    const eventQuery = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ id: "evt_1", action: "approval.requested", created_at: "2026-01-01T00:00:00.000Z" }],
        error: null,
      }),
      gte: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    };
    const apiKeyQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "key_1",
          organization_id: "org_1",
          active: true,
          key_hash: createHash("sha256").update("aaaaaaaaaaaazzzz").digest("hex"),
          key_prefix: "aaaaaaaaaaaa",
          scopes: ["events:read"],
          expires_at: null,
          revoked_at: null,
        },
      }),
      update: vi.fn().mockReturnThis(),
    };
    const orgSettingsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: {} }),
    };

    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_api_keys") return apiKeyQuery;
        if (table === "audit_events") return eventQuery;
        if (table === "organizations") return orgSettingsQuery;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: {} }),
          update: vi.fn().mockReturnThis(),
        };
      }),
    });

    const { GET } = await import("@/app/api/events/route");
    const req = new Request("http://localhost:3000/api/events?limit=10", {
      headers: { "x-api-key": "aaaaaaaaaaaazzzz" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({
      events: [{ id: "evt_1", action: "approval.requested", created_at: "2026-01-01T00:00:00.000Z" }],
      count: 1,
    });
    expect(requireApiWorkspaceEligibility).toHaveBeenCalled();
    expect(filterAuditEventsForWorkspaceMode).toHaveBeenCalled();
  });
});

