import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const from = vi.fn();
const createClient = vi.fn(async () => ({
  auth: { getUser },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient: vi.fn(async () => ({ from })),
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

  it("updateProfile rejects unsafe profile names before data writes", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { updateProfile } = await import("@/actions/settings");
    const fd = new FormData();
    fd.set("fullName", "Ada\u202Ehidden");
    const res = await updateProfile(fd);
    expect(res).toEqual({ error: "Name contains unsupported characters" });
    expect(from).not.toHaveBeenCalled();
  });

  it("updateOrganization rejects unsafe organization names before membership lookup", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { updateOrganization } = await import("@/actions/settings");
    const fd = new FormData();
    fd.set("organizationId", "550e8400-e29b-41d4-a716-446655440000");
    fd.set("name", "Org\u202Ehidden");
    const res = await updateOrganization(fd);
    expect(res).toEqual({ error: "Organization name contains unsupported characters" });
    expect(from).not.toHaveBeenCalled();
  });

  it("inviteOrgMember rejects unsafe invite emails before auth or membership lookup", async () => {
    const { inviteOrgMember } = await import("@/actions/settings");
    const fd = new FormData();
    fd.set("organizationId", "550e8400-e29b-41d4-a716-446655440000");
    fd.set("email", "invitee@example.com\u202Ehidden");
    fd.set("role", "editor");
    const res = await inviteOrgMember(fd);
    expect(res).toEqual({ error: "Invalid email address" });
    expect(createClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("inviteOrgMember rejects unsupported invite roles before auth or membership lookup", async () => {
    const { inviteOrgMember } = await import("@/actions/settings");
    const fd = new FormData();
    fd.set("organizationId", "550e8400-e29b-41d4-a716-446655440000");
    fd.set("email", "invitee@example.com");
    fd.set("role", "owner");
    const res = await inviteOrgMember(fd);
    expect(res).toEqual({ error: "Invalid role" });
    expect(createClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});
