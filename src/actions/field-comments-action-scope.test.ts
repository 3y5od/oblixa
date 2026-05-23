import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
  createAdminClient: vi.fn(async () => ({ from: vi.fn() })),
}));

describe("addFieldComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns not authenticated without a user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { addFieldComment } = await import("@/actions/field-comments");
    const res = await addFieldComment({
      contractId: "550e8400-e29b-41d4-a716-446655440000",
      comment: "hi",
    });
    expect(res).toEqual({ error: "Not authenticated" });
  });

  it("rejects invalid contract id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { addFieldComment } = await import("@/actions/field-comments");
    const res = await addFieldComment({ contractId: "nope", comment: "hi" });
    expect(res).toEqual({ error: "Invalid contract" });
  });

  it("rejects invalid field id when provided", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { addFieldComment } = await import("@/actions/field-comments");
    const res = await addFieldComment({
      contractId: "550e8400-e29b-41d4-a716-446655440000",
      fieldId: "not-uuid",
      comment: "hi",
    });
    expect(res).toEqual({ error: "Invalid field" });
  });

  it("rejects unsafe comment text before contract lookup", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const adminFrom = vi.fn();
    const { createAdminClient } = await import("@/lib/supabase/server");
    vi.mocked(createAdminClient).mockResolvedValue({ from: adminFrom } as never);
    const { addFieldComment } = await import("@/actions/field-comments");
    const res = await addFieldComment({
      contractId: "550e8400-e29b-41d4-a716-446655440000",
      comment: "safe text\u202Ehidden",
    });
    expect(res).toEqual({ error: "Comment contains unsupported characters." });
    expect(adminFrom).not.toHaveBeenCalled();
  });
});
