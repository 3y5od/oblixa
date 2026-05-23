import { beforeEach, describe, expect, it, vi } from "vitest";

const automationMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getOrEnsureDeterministicMembership: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: automationMocks.createClient,
  createAdminClient: automationMocks.createAdminClient,
  getOrEnsureDeterministicMembership: automationMocks.getOrEnsureDeterministicMembership,
}));

describe("automation server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    automationMocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    automationMocks.createClient.mockResolvedValue({ auth: { getUser: automationMocks.getUser } });
    automationMocks.createAdminClient.mockResolvedValue({ from: automationMocks.from });
  });

  it("createTaskAutomationRule rejects unsafe names before membership lookup", async () => {
    const { createTaskAutomationRule } = await import("@/actions/automation");
    const result = await createTaskAutomationRule({
      name: "Rule\u202Ehidden",
      triggerType: "field_missing",
      configJson: {},
    });
    expect(result).toEqual({ error: "Rule name contains unsupported characters" });
    expect(automationMocks.getOrEnsureDeterministicMembership).not.toHaveBeenCalled();
    expect(automationMocks.from).not.toHaveBeenCalled();
  });

  it("createTaskAutomationRuleForm rejects unsafe FormData text before auth or writes", async () => {
    const { createTaskAutomationRuleForm } = await import("@/actions/automation");
    const fd = new FormData();
    fd.set("name", "Rule");
    fd.set("triggerType", "field_missing");
    fd.set("taskDetails", "looks normal\u202Ehidden");
    const result = await createTaskAutomationRuleForm(fd);
    expect(result).toBeUndefined();
    expect(automationMocks.createClient).not.toHaveBeenCalled();
    expect(automationMocks.from).not.toHaveBeenCalled();
  });

  it("createTaskAutomationRuleForm clamps malformed numeric fields into bounded config", async () => {
    automationMocks.getOrEnsureDeterministicMembership.mockResolvedValue({
      organization_id: "org-1",
      role: "editor",
    });
    const insert = vi.fn(async () => ({ error: null }));
    automationMocks.from.mockReturnValue({ insert });

    const { createTaskAutomationRuleForm } = await import("@/actions/automation");
    const fd = new FormData();
    fd.set("name", "Rule");
    fd.set("triggerType", "date_window");
    fd.set("windowDays", "999999");
    fd.set("lookbackDays", "not-a-number");
    fd.set("dueInDays", "-10");
    fd.set("stallHours", "999999");
    fd.set("minCompleteness", "999");
    await createTaskAutomationRuleForm(fd);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        config_json: expect.objectContaining({
          windowDays: 3650,
          lookbackDays: 2,
          dueInDays: 0,
          stallHours: 8760,
          minCompleteness: 100,
        }),
      })
    );
  });
});
