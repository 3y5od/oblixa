import { describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
  createAdminClient: vi.fn(async () => ({ from })),
}));

describe("deleteContract (auth / validation)", () => {
  it("returns not authenticated without a user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { deleteContract } = await import("@/actions/contracts");
    const res = await deleteContract("550e8400-e29b-41d4-a716-446655440000");
    expect(res).toEqual({ error: "Not authenticated" });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns invalid contract for non-uuid ids", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { deleteContract } = await import("@/actions/contracts");
    const res = await deleteContract("not-a-uuid");
    expect(res).toEqual({ error: "Invalid contract" });
    expect(from).not.toHaveBeenCalled();
  });
});
