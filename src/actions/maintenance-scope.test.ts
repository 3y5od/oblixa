import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
  createAdminClient: vi.fn(async () => ({ from })),
}));

describe("maintenance server actions (scope)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: null } });
  });

  it("returns before querying when fileId is not a uuid", async () => {
    const { deleteOrphanFileRecordForm } = await import("@/actions/maintenance");
    const fd = new FormData();
    fd.set("fileId", "not-a-uuid");
    await deleteOrphanFileRecordForm(fd);
    expect(getUser).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("does not mutate when user is not authenticated (logContractChangeEventForm)", async () => {
    const { logContractChangeEventForm } = await import("@/actions/maintenance");
    const fd = new FormData();
    fd.set("contractId", "550e8400-e29b-41d4-a716-446655440000");
    fd.set("eventType", "other");
    fd.set("impactLevel", "low");
    fd.set("summary", "summary text");
    await logContractChangeEventForm(fd);
    expect(from).not.toHaveBeenCalled();
  });
});
