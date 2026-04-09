import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v4/casefile", () => ({
  appendCasefileEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/integrations/events", () => ({
  enqueueOutboundEvent: vi.fn().mockResolvedValue(undefined),
}));

function adminExceptions(row: Record<string, unknown> | null, ownerExists: boolean) {
  return {
    from: vi.fn((table: string) => {
      if (table === "exceptions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: row, error: null })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          })),
        };
      }
      if (table === "organization_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: ownerExists ? { id: "m1" } : null,
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === "exception_events") {
        return {
          insert: vi.fn(async () => ({ error: null })),
        };
      }
      return {};
    }),
  };
}

describe("POST /api/exceptions/[id]/[action]", () => {
  const exceptionRow = {
    id: "ex-1",
    contract_id: "c1",
    status: "open",
    reopen_count: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getApiAuthContext.mockResolvedValue({
      admin: adminExceptions(exceptionRow, true),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    canManageCapability.mockResolvedValue(true);
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/exceptions/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/exceptions/ex-1/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownerId: "owner-1" }),
      }),
      { params: Promise.resolve({ id: "ex-1", action: "assign" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 without maintenance_manage", async () => {
    canManageCapability.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/exceptions/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/exceptions/ex-1/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownerId: "owner-1" }),
      }),
      { params: Promise.resolve({ id: "ex-1", action: "assign" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when exception not in org", async () => {
    getApiAuthContext.mockResolvedValueOnce({
      admin: adminExceptions(null, true),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    const { POST } = await import("@/app/api/exceptions/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/exceptions/missing/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownerId: "owner-1" }),
      }),
      { params: Promise.resolve({ id: "missing", action: "assign" }) }
    );
    expect(res.status).toBe(404);
  });

  it("assign returns 400 when ownerId is missing", async () => {
    const { POST } = await import("@/app/api/exceptions/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/exceptions/ex-1/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "ex-1", action: "assign" }) }
    );
    expect(res.status).toBe(400);
  });

  it("assign succeeds", async () => {
    const { POST } = await import("@/app/api/exceptions/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/exceptions/ex-1/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownerId: "owner-1" }),
      }),
      { params: Promise.resolve({ id: "ex-1", action: "assign" }) }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 404 for unsupported action", async () => {
    const { POST } = await import("@/app/api/exceptions/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/exceptions/ex-1/unknown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "ex-1", action: "unknown" }) }
    );
    expect(res.status).toBe(404);
  });
});
