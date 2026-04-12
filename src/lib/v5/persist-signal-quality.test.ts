import { describe, expect, it, vi } from "vitest";
import { incrementOrgV5SignalQuality } from "@/lib/v5/persist-signal-quality";

describe("incrementOrgV5SignalQuality", () => {
  it("no-ops when increments empty", async () => {
    const admin = { from: vi.fn() };
    await incrementOrgV5SignalQuality({
      admin: admin as never,
      organizationId: "org-1",
      increments: {},
    });
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("inserts when no existing row", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "org_behavior_metrics") {
          return {
            select: vi.fn(() => selectChain),
            insert,
            update: vi.fn(),
          };
        }
        return {};
      }),
    };
    await incrementOrgV5SignalQuality({
      admin: admin as never,
      organizationId: "org-1",
      increments: { foo: 1 },
    });
    expect(insert).toHaveBeenCalled();
    const arg = insert.mock.calls[0][0] as { organization_id: string };
    expect(arg.organization_id).toBe("org-1");
  });
});
