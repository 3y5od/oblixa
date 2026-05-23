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

describe("createContractTask", () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  it("returns not authenticated when user is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { createContractTask } = await import("@/actions/tasks");
    const result = await createContractTask({
      contractId: "11111111-1111-1111-1111-111111111111",
      title: "Follow up",
    });
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("rejects invalid contract ids before data writes", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { createContractTask } = await import("@/actions/tasks");
    const result = await createContractTask({
      contractId: "bad-id",
      title: "Follow up",
    });
    expect(result).toEqual({ error: "Invalid contract" });
  });

  it("rejects invalid ISO due dates before data writes", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { createContractTask } = await import("@/actions/tasks");
    const result = await createContractTask({
      contractId: "11111111-1111-1111-1111-111111111111",
      title: "Follow up",
      dueDate: "2026-02-30",
    });
    expect(result).toEqual({ error: "Invalid due date" });
  });
});
