import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

function adminMock(opts: { listError?: boolean; insertError?: boolean }) {
  return {
    from: vi.fn((table: string) => {
      if (table !== "report_packs") {
        return {};
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () =>
              opts.listError
                ? { data: null, error: { message: "list failed" } }
                : {
                    data: [
                      {
                        id: "p1",
                        name: "A",
                        description: null,
                        report_type: "weekly_execution_health",
                        schedule: null,
                        active: true,
                        updated_at: null,
                      },
                    ],
                    error: null,
                  }
            ),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () =>
              opts.insertError
                ? { data: null, error: { message: "insert failed" } }
                : {
                    data: {
                      id: "pack-1",
                      name: "Weekly",
                      report_type: "weekly_execution_health",
                      schedule: null,
                      active: true,
                    },
                    error: null,
                  }
            ),
          })),
        })),
      };
    }),
  };
}

describe("/api/report-packs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiAuthContext.mockResolvedValue({
      admin: adminMock({}),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    canManageCapability.mockResolvedValue(true);
  });

  it("GET returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/report-packs/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET returns report packs for org", async () => {
    const { GET } = await import("@/app/api/report-packs/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reportPacks).toHaveLength(1);
    expect(body.reportPacks[0].id).toBe("p1");
  });

  it("POST returns 403 without capability", async () => {
    canManageCapability.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/report-packs/route");
    const res = await POST(
      new Request("http://localhost:3000/api/report-packs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "N" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("POST returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/report-packs/route");
    const res = await POST(
      new Request("http://localhost:3000/api/report-packs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });

  it("POST creates report pack", async () => {
    const { POST } = await import("@/app/api/report-packs/route");
    const res = await POST(
      new Request("http://localhost:3000/api/report-packs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Weekly health" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.reportPack.id).toBe("pack-1");
  });
});
