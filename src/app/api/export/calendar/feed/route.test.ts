import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getDeterministicMembership = vi.fn();
const requireApiWorkspaceEligibility = vi.fn(async () => null);

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
  getDeterministicMembership,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

describe("GET /api/export/calendar/feed", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    getDeterministicMembership.mockResolvedValue({ organization_id: "org-1", role: "admin" });
  });

  it("returns 401 when unauthenticated", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });

    const { GET } = await import("@/app/api/export/calendar/feed/route");
    const req = new Request("http://localhost:3000/api/export/calendar/feed");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Not authenticated" });
  });

  it("returns 500 when feed lookup fails", async () => {
    createAdminClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  gt: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
      })),
    });

    const { GET } = await import("@/app/api/export/calendar/feed/route");
    const res = await GET(new Request("http://localhost:3000/api/export/calendar/feed"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toMatchObject({ diagnostic_id: "calendar_feed_lookup_failed" });
  });

  it("returns 500 when feed creation persistence fails", async () => {
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "calendar_feeds") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    is: vi.fn(() => ({
                      gt: vi.fn(() => ({
                        limit: vi.fn(() => ({
                          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
            insert: vi.fn().mockResolvedValue({ error: { message: "insert failed" } }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const { GET } = await import("@/app/api/export/calendar/feed/route");
    const res = await GET(new Request("http://localhost:3000/api/export/calendar/feed"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toMatchObject({ diagnostic_id: "calendar_feed_create_failed" });
  });
});

