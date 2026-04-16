import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const insertData = vi.fn().mockResolvedValue({ error: null });
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
  createAdminClient: vi.fn(async () => ({ from })),
  getOrEnsureDeterministicMembership: vi.fn(),
}));

import { getOrEnsureDeterministicMembership } from "@/lib/supabase/server";

describe("createTaskAutomationRule (org scope)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrEnsureDeterministicMembership).mockReset();
    from.mockImplementation((table: string) => {
      if (table === "task_automation_rules") {
        return { insert: (payload: unknown) => insertData(payload) };
      }
      return {};
    });
  });

  it("returns not authenticated when there is no user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { createTaskAutomationRule } = await import("@/actions/automation");
    const res = await createTaskAutomationRule({
      name: "R",
      triggerType: "field_missing",
      configJson: {},
    });
    expect(res).toEqual({ error: "Not authenticated" });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns access denied when membership is missing", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    vi.mocked(getOrEnsureDeterministicMembership).mockResolvedValue(null);
    const { createTaskAutomationRule } = await import("@/actions/automation");
    const res = await createTaskAutomationRule({
      name: "R",
      triggerType: "field_missing",
      configJson: {},
    });
    expect(res).toEqual({ error: "Access denied" });
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts with organization_id from deterministic membership", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    vi.mocked(getOrEnsureDeterministicMembership).mockResolvedValue({
      organization_id: "org-aaa",
      role: "admin",
    } as never);
    const { createTaskAutomationRule } = await import("@/actions/automation");
    const res = await createTaskAutomationRule({
      name: "Rule A",
      triggerType: "field_missing",
      configJson: { k: 1 },
    });
    expect(res).toEqual({ success: true });
    expect(insertData).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-aaa",
        name: "Rule A",
        created_by: "u1",
      })
    );
  });
});
