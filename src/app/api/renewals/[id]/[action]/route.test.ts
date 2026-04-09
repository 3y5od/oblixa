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

vi.mock("@/lib/v4/renewal-decision-packet", () => ({
  buildRenewalDecisionPacketPayload: vi.fn(() => ({
    packet_json: { ok: true },
    assumptions_json: {},
  })),
}));

const checkpoint = {
  id: "chk-1",
  contract_id: "c1",
  organization_id: "org-1",
  label: "Renewal",
  due_date: "2026-06-01",
  status: "open",
  workspace_json: {},
  renewal_state: "preparing",
  scenario_id: null as string | null,
};

function adminRenewals(checkpointRow: typeof checkpoint | null) {
  return {
    from: vi.fn((table: string) => {
      if (table === "contract_renewal_checkpoints") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: checkpointRow, error: null })),
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
      if (table === "renewal_decision_packets" && checkpointRow) {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "pkt-1",
                  status: "draft",
                  summary: null,
                  created_at: new Date().toISOString(),
                },
                error: null,
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
      return {};
    }),
  };
}

describe("POST /api/renewals/[id]/[action]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiAuthContext.mockResolvedValue({
      admin: adminRenewals(checkpoint),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    canManageCapability.mockResolvedValue(true);
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/renewals/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/renewals/chk-1/generate-decision-packet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "chk-1", action: "generate-decision-packet" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 without renewals_manage", async () => {
    canManageCapability.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/renewals/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/renewals/chk-1/generate-decision-packet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "chk-1", action: "generate-decision-packet" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when checkpoint missing", async () => {
    getApiAuthContext.mockResolvedValueOnce({
      admin: adminRenewals(null),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    const { POST } = await import("@/app/api/renewals/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/renewals/missing/generate-decision-packet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "missing", action: "generate-decision-packet" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for unsupported action", async () => {
    const { POST } = await import("@/app/api/renewals/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/renewals/chk-1/unknown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "chk-1", action: "unknown" }) }
    );
    expect(res.status).toBe(404);
  });

  it("generates decision packet", async () => {
    const { POST } = await import("@/app/api/renewals/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/renewals/chk-1/generate-decision-packet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ summary: "Q2 review" }),
      }),
      { params: Promise.resolve({ id: "chk-1", action: "generate-decision-packet" }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.packet.id).toBe("pkt-1");
  });
});
