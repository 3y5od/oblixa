import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
  })),
  createAdminClient: vi.fn(async () => ({})),
}));

describe("requestContractApproval", () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  it("returns not authenticated when user is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { requestContractApproval } = await import("@/actions/approvals");
    const result = await requestContractApproval({
      contractId: "11111111-1111-1111-1111-111111111111",
      approvalType: "renewal_decision",
    });
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("rejects invalid contract ids before policy lookups", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { requestContractApproval } = await import("@/actions/approvals");
    const result = await requestContractApproval({
      contractId: "bad-id",
      approvalType: "renewal_decision",
    });
    expect(result).toEqual({ error: "Invalid contract" });
  });
});
