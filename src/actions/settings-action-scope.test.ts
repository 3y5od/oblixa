import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
  createAdminClient: vi.fn(async () => ({ from: vi.fn() })),
}));

describe("settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("updateProfile returns not authenticated without a user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { updateProfile } = await import("@/actions/settings");
    const fd = new FormData();
    fd.set("fullName", "A");
    const res = await updateProfile(fd);
    expect(res).toEqual({ error: "Not authenticated" });
  });

  it("updateOrganization rejects invalid organization id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { updateOrganization } = await import("@/actions/settings");
    const fd = new FormData();
    fd.set("organizationId", "not-a-uuid");
    fd.set("name", "Org");
    const res = await updateOrganization(fd);
    expect(res).toEqual({ error: "Invalid organization" });
  });

  it("updateOrganization requires name", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { updateOrganization } = await import("@/actions/settings");
    const fd = new FormData();
    fd.set("organizationId", "550e8400-e29b-41d4-a716-446655440000");
    fd.set("name", "");
    const res = await updateOrganization(fd);
    expect(res).toEqual({ error: "Organization name is required" });
  });
});
