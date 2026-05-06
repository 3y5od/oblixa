import { describe, expect, it, vi } from "vitest";
import { attachOwnerProfiles } from "@/lib/contracts";

function buildAdminMock(result: {
  members: { data: unknown; error: unknown };
  profiles?: { data: unknown; error: unknown };
}) {
  const membersQuery = {
    select: vi.fn(() => membersQuery),
    eq: vi.fn(() => membersQuery),
    in: vi.fn(async () => result.members),
  };
  const profilesQuery = {
    select: vi.fn(() => profilesQuery),
    in: vi.fn(async () => result.profiles ?? { data: [], error: null }),
  };
  const from = vi.fn((table: string) => (table === "profiles" ? profilesQuery : membersQuery));
  const admin = { from } as unknown as Parameters<typeof attachOwnerProfiles>[0];
  return { admin, from, membersQuery, profilesQuery };
}

describe("attachOwnerProfiles", () => {
  it("attaches only owners returned through org membership", async () => {
    const { admin, membersQuery, profilesQuery } = buildAdminMock({
      members: {
        data: [
          {
            user_id: "user-1",
          },
        ],
        error: null,
      },
      profiles: {
        data: [
        {
          id: "user-1",
          full_name: "Alice Owner",
          email: "alice@example.com",
        },
      ],
        error: null,
      },
    });

    const contracts = await attachOwnerProfiles(admin, "org-1", [
      { id: "c-1", owner_id: "user-1" },
      { id: "c-2", owner_id: "user-2" },
      { id: "c-3", owner_id: null },
    ]);

    expect(membersQuery.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(membersQuery.in).toHaveBeenCalledWith("user_id", ["user-1", "user-2"]);
    expect(profilesQuery.in).toHaveBeenCalledWith("id", ["user-1"]);
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

  it("degrades without console errors when owner profile hydration fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { admin } = buildAdminMock({
      members: { data: null, error: { code: "PGRST200" } },
    });

    const contracts = await attachOwnerProfiles(admin, "org-1", [{ id: "c-1", owner_id: "user-1" }]);

    expect(contracts).toEqual([{ id: "c-1", owner_id: "user-1" }]);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("skips the membership lookup when the contracts have no owners", async () => {
    const { admin, from } = buildAdminMock({ members: { data: [], error: null } });

    const contracts = await attachOwnerProfiles(admin, "org-1", [{ id: "c-1", owner_id: null }]);

    expect(contracts).toEqual([{ id: "c-1", owner_id: null }]);
    expect(from).not.toHaveBeenCalled();
  });
});