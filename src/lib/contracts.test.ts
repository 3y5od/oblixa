import { describe, expect, it, vi } from "vitest";
import { attachOwnerProfiles } from "@/lib/contracts";

function buildAdminMock(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(async () => result),
  };
  const from = vi.fn(() => query);
  const admin = { from } as unknown as Parameters<typeof attachOwnerProfiles>[0];
  return { admin, from, query };
}

describe("attachOwnerProfiles", () => {
  it("attaches only owners returned through org membership", async () => {
    const { admin, query } = buildAdminMock({
      data: [
        {
          user_id: "user-1",
          profiles: { full_name: "Alice Owner", email: "alice@example.com" },
        },
      ],
      error: null,
    });

    const contracts = await attachOwnerProfiles(admin, "org-1", [
      { id: "c-1", owner_id: "user-1" },
      { id: "c-2", owner_id: "user-2" },
      { id: "c-3", owner_id: null },
    ]);

    expect(query.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(query.in).toHaveBeenCalledWith("user_id", ["user-1", "user-2"]);
    expect(contracts).toEqual([
      {
        id: "c-1",
        owner_id: "user-1",
        owner: { full_name: "Alice Owner", email: "alice@example.com" },
      },
      { id: "c-2", owner_id: "user-2" },
      { id: "c-3", owner_id: null },
    ]);
  });

  it("skips the membership lookup when the contracts have no owners", async () => {
    const { admin, from } = buildAdminMock({ data: [], error: null });

    const contracts = await attachOwnerProfiles(admin, "org-1", [{ id: "c-1", owner_id: null }]);

    expect(contracts).toEqual([{ id: "c-1", owner_id: null }]);
    expect(from).not.toHaveBeenCalled();
  });
});