import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const upsert = vi.fn();
const from = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
  createAdminClient: vi.fn(async () => ({ from })),
}));

describe("createSavedView (org scope via membership)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsert.mockImplementation(async () => ({ error: null }));
    from.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              }),
            }),
          }),
        };
      }
      if (table === "saved_views") {
        return { upsert };
      }
      return {};
    });
  });

  it("does not upsert when user is not a member of the submitted organization", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { createSavedView } = await import("@/actions/saved-views");
    const fd = new FormData();
    fd.set("name", "My view");
    fd.set("organizationId", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    await createSavedView(fd, "contracts");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts saved_views scoped to org when membership exists", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    from.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn(async () => ({ data: { id: "m1" }, error: null })),
              }),
            }),
          }),
        };
      }
      if (table === "saved_views") {
        return { upsert };
      }
      return {};
    });
    const orgId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const { createSavedView } = await import("@/actions/saved-views");
    const fd = new FormData();
    fd.set("name", "Scoped");
    fd.set("organizationId", orgId);
    await createSavedView(fd, "contracts");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: orgId,
        user_id: "u1",
      }),
      expect.any(Object)
    );
  });
});
