import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const from = vi.fn();
const getDeterministicMembership = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
  createAdminClient: vi.fn(async () => ({ from })),
  getDeterministicMembership,
}));

describe("getApiAuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns null when there is no user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { getApiAuthContext } = await import("@/lib/contract-operations/api-auth");
    const ctx = await getApiAuthContext();
    expect(ctx).toBeNull();
    expect(getDeterministicMembership).not.toHaveBeenCalled();
  });

  it("returns null when membership is missing", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    getDeterministicMembership.mockResolvedValue(null);
    const { getApiAuthContext } = await import("@/lib/contract-operations/api-auth");
    const ctx = await getApiAuthContext();
    expect(ctx).toBeNull();
  });

  it("returns admin context when user and membership exist", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    getDeterministicMembership.mockResolvedValue({
      organization_id: "org-1",
      role: "admin",
    });
    const { getApiAuthContext } = await import("@/lib/contract-operations/api-auth");
    const ctx = await getApiAuthContext();
    expect(ctx).toMatchObject({
      userId: "u-1",
      orgId: "org-1",
      role: "admin",
    });
    expect(ctx?.admin).toBeDefined();
  });
});

describe("canManageCapability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("queries org workflow settings and returns capability from role policy", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: { role_policy_json: { admin: { settings_manage: false } } },
      error: null,
    }));
    from.mockReturnValue({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    });
    const { canManageCapability } = await import("@/lib/contract-operations/api-auth");
    const ok = await canManageCapability(
      {
        admin: { from } as never,
        userId: "u1",
        orgId: "org-1",
        role: "admin",
      },
      "settings_manage"
    );
    expect(ok).toBe(false);
    expect(from).toHaveBeenCalledWith("organization_workflow_settings");
  });
});
