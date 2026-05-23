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

describe("createContractObligation", () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  it("returns not authenticated when user is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { createContractObligation } = await import("@/actions/obligations");
    const result = await createContractObligation({
      contractId: "11111111-1111-1111-1111-111111111111",
      title: "Submit insurance cert",
    });
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("rejects invalid contract ids before querying contract state", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { createContractObligation } = await import("@/actions/obligations");
    const result = await createContractObligation({
      contractId: "bad-id",
      title: "Submit insurance cert",
    });
    expect(result).toEqual({ error: "Invalid contract" });
  });

  it("rejects invalid ISO due dates before querying contract state", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { createContractObligation } = await import("@/actions/obligations");
    const result = await createContractObligation({
      contractId: "11111111-1111-1111-1111-111111111111",
      title: "Submit insurance cert",
      dueDate: "2026-02-30",
    });
    expect(result).toEqual({ error: "Invalid due date" });
  });
});
