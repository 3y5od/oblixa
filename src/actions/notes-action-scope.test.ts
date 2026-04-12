import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
  createAdminClient: vi.fn(async () => ({ from })),
}));

describe("createContractNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns not authenticated without a user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { createContractNote } = await import("@/actions/notes");
    const res = await createContractNote({
      contractId: "550e8400-e29b-41d4-a716-446655440000",
      note: "hello",
    });
    expect(res).toEqual({ error: "Not authenticated" });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects invalid contract id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { createContractNote } = await import("@/actions/notes");
    const res = await createContractNote({ contractId: "bad", note: "x" });
    expect(res).toEqual({ error: "Invalid contract" });
  });

  it("rejects empty note", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { createContractNote } = await import("@/actions/notes");
    const res = await createContractNote({
      contractId: "550e8400-e29b-41d4-a716-446655440000",
      note: "   ",
    });
    expect(res).toEqual({ error: "Note cannot be empty" });
  });
});
