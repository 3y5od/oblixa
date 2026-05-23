import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn();

const wlMocks = vi.hoisted(() => {
  const adminFrom = vi.fn();
  return {
    adminFrom,
    createAdminClient: vi.fn(async () => ({ from: adminFrom })),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
  createAdminClient: wlMocks.createAdminClient,
}));

describe("watchlists actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("removeWatchlistEntry returns early when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { removeWatchlistEntry } = await import("@/actions/watchlists");
    await removeWatchlistEntry("550e8400-e29b-41d4-a716-446655440000");
    expect(wlMocks.adminFrom).not.toHaveBeenCalled();
  });

  it("removeWatchlistEntry does not query watchlists for non-uuid contract id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const localFrom = vi.fn();
    const { createAdminClient } = await import("@/lib/supabase/server");
    vi.mocked(createAdminClient).mockResolvedValueOnce({ from: localFrom } as never);
    const { removeWatchlistEntry } = await import("@/actions/watchlists");
    await removeWatchlistEntry("bad-id");
    expect(localFrom).not.toHaveBeenCalled();
  });

  it("upsertWatchlistEntryForm rejects unsafe note text before access queries", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { upsertWatchlistEntryForm } = await import("@/actions/watchlists");
    const fd = new FormData();
    fd.set("contractId", "550e8400-e29b-41d4-a716-446655440000");
    fd.set("note", "safe-looking\u202Ehidden");
    await upsertWatchlistEntryForm(fd);
    expect(wlMocks.adminFrom).not.toHaveBeenCalled();
  });
});
