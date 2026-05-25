import { describe, expect, it, vi } from "vitest";
import { ensureAccountWorkspaceFromContracts } from "@/lib/decision-intelligence/relationship-bootstrap";

describe("ensureAccountWorkspaceFromContracts", () => {
  it("returns existing workspace without insert", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "ws-1", display_name: "Acme" },
    });
    const admin = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle }),
          }),
        }),
      })),
    };
    const out = await ensureAccountWorkspaceFromContracts(admin as never, "org-1", "acme");
    expect(out).toEqual({ id: "ws-1", display_name: "Acme" });
    expect(admin.from).toHaveBeenCalledWith("account_workspaces");
  });
});
