import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

describe("POST /api/decisions/[id]/stakeholders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
  });

  it("returns 403 when decision foundation disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { POST } = await import("@/app/api/decisions/[id]/stakeholders/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/d1/stakeholders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stakeholderUserId: "u2" }),
      }),
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when stakeholderUserId missing", async () => {
    getApiAuthContext.mockResolvedValue({
      userId: "u1",
      orgId: "o1",
      admin: { from: vi.fn() },
    } as never);
    const { POST } = await import("@/app/api/decisions/[id]/stakeholders/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/d1/stakeholders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("inserts stakeholder and event", async () => {
    const eventsInsert = vi.fn(async () => ({ error: null }));
    getApiAuthContext.mockResolvedValue({
      userId: "u1",
      orgId: "o1",
      admin: {
        from: vi.fn((table: string) => {
          if (table === "decision_workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: { id: "d1" }, error: null })),
                  })),
                })),
              })),
            };
          }
          if (table === "decision_workspace_stakeholders") {
            return {
              insert: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: {
                      id: "st-1",
                      stakeholder_user_id: "u2",
                      stakeholder_role: "reviewer",
                      status: "pending",
                      notes: null,
                      created_at: "2026-01-01T00:00:00Z",
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "decision_workspace_events") {
            return { insert: eventsInsert };
          }
          return {};
        }),
      },
    } as never);
    const { POST } = await import("@/app/api/decisions/[id]/stakeholders/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/d1/stakeholders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stakeholderUserId: "u2", stakeholderRole: "legal" }),
      }),
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.stakeholder.id).toBe("st-1");
    expect(eventsInsert).toHaveBeenCalled();
    const ev = eventsInsert.mock.calls.at(0)?.at(0) as unknown as { event_type: string };
    expect(ev.event_type).toBe("decision.stakeholder_added");
  });
});
