import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const appendCasefileEvent = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v4/casefile", () => ({
  appendCasefileEvent,
}));

function createAdminClientMock() {
  const from = vi.fn((table: string) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      update: vi.fn(() => chain),
      insert: vi.fn(async () => ({ error: null })),
      maybeSingle: vi.fn(async () => {
        if (table === "contract_approvals") {
          return {
            data: {
              id: "approval-1",
              organization_id: "org-1",
              status: "pending",
              contract_id: "contract-1",
            },
            error: null,
          };
        }
        if (table === "organization_members") {
          return { data: null, error: null };
        }
        return { data: null, error: null };
      }),
    };
    return chain;
  });

  return { from };
}

describe("POST /api/approvals/[id]/[action]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getApiAuthContext.mockResolvedValue({
      admin: createAdminClientMock(),
      userId: "user-1",
      orgId: "org-1",
      role: "owner",
    });
    canManageCapability.mockResolvedValue(true);
  });

  it("rejects delegation to a user outside the organization", async () => {
    const { POST } = await import("@/app/api/approvals/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/approvals/approval-1/delegate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ delegateUserId: "external-user" }),
      }),
      { params: Promise.resolve({ id: "approval-1", action: "delegate" }) }
    );

    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "delegateUserId must belong to your organization" });
    expect(appendCasefileEvent).not.toHaveBeenCalled();
  });
});
