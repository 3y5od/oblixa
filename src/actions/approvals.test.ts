import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const createAdminClientMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
  })),
  createAdminClient: vi.fn(async () => createAdminClientMock()),
}));

function makeMaybeSingleBuilder<T>(data: T) {
  return {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe("requestContractApproval", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    createAdminClientMock.mockReset();
    adminFromMock.mockReset();
    createAdminClientMock.mockReturnValue({});
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

  it("requires a decision note before requesting changes", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    createAdminClientMock.mockReturnValue({ from: adminFromMock });
    adminFromMock.mockImplementation((table: string) => {
      if (table === "contract_approvals") {
        return {
          select: vi.fn(() =>
            makeMaybeSingleBuilder({
              id: "550e8400-e29b-41d4-a716-446655440000",
              contract_id: "550e8400-e29b-41d4-a716-446655440010",
              organization_id: "550e8400-e29b-41d4-a716-446655440020",
              approver_id: "user-1",
              status: "pending",
            })
          ),
        };
      }
      return { insert: vi.fn(async () => ({ error: null })) };
    });

    const { updateContractApprovalStatus } = await import("@/actions/approvals");
    const result = await updateContractApprovalStatus({
      approvalId: "550e8400-e29b-41d4-a716-446655440000",
      status: "changes_requested",
    });

    expect(result).toEqual({ error: "Add a decision note before rejecting this approval or requesting changes." });
  });
});
