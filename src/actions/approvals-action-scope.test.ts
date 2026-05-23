import { beforeEach, describe, expect, it, vi } from "vitest";

const approvalsMocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: approvalsMocks.createAdminClient,
  createClient: approvalsMocks.createClient,
}));

vi.mock("@/actions/tasks", () => ({
  autoTransitionTasksForApproval: vi.fn(),
}));

vi.mock("@/lib/integrations/events", () => ({
  enqueueOutboundEvent: vi.fn(),
}));

vi.mock("@/lib/notification-policy", () => ({
  isNotificationTypeAllowedForWorkspace: vi.fn(),
}));

vi.mock("@/lib/product-telemetry", () => ({
  emitVisibleMutationErrorTelemetry: vi.fn(),
  emitWorkActionTelemetry: vi.fn(),
}));

vi.mock("@/lib/v10-server-contracts", () => ({
  recordV10AuditEvent: vi.fn(),
}));

vi.mock("@/lib/v10-read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization: vi.fn(),
}));

describe("approval server action input safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    approvalsMocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    approvalsMocks.createClient.mockResolvedValue({ auth: { getUser: approvalsMocks.getUser } });
    approvalsMocks.createAdminClient.mockResolvedValue({ from: approvalsMocks.from });
  });

  it("requestContractApproval rejects unsafe notes before auth or contract lookup", async () => {
    const { requestContractApproval } = await import("@/actions/approvals");
    const result = await requestContractApproval({
      contractId: "550e8400-e29b-41d4-a716-446655440000",
      approvalType: "renewal_decision",
      notes: "looks normal\u202Ehidden",
    });

    expect(result).toEqual({ error: "Notes contain unsupported characters" });
    expect(approvalsMocks.createClient).not.toHaveBeenCalled();
    expect(approvalsMocks.from).not.toHaveBeenCalled();
  });

  it("updateContractApprovalStatus rejects unsafe decision notes before auth or approval lookup", async () => {
    const { updateContractApprovalStatus } = await import("@/actions/approvals");
    const result = await updateContractApprovalStatus({
      approvalId: "550e8400-e29b-41d4-a716-446655440000",
      status: "rejected",
      notes: "rejecting\u202Ehidden",
    });

    expect(result).toEqual({ error: "Notes contain unsupported characters" });
    expect(approvalsMocks.createClient).not.toHaveBeenCalled();
    expect(approvalsMocks.from).not.toHaveBeenCalled();
  });

  it("delegateContractApproval rejects unsafe reasons before auth or approval lookup", async () => {
    const { delegateContractApproval } = await import("@/actions/approvals");
    const result = await delegateContractApproval({
      approvalId: "550e8400-e29b-41d4-a716-446655440000",
      delegateToUserId: "550e8400-e29b-41d4-a716-446655440001",
      reason: "handoff\u202Ehidden",
    });

    expect(result).toEqual({ error: "Delegation reason contains unsupported characters" });
    expect(approvalsMocks.createClient).not.toHaveBeenCalled();
    expect(approvalsMocks.from).not.toHaveBeenCalled();
  });

  it("upsertRenewalScenario rejects unsafe commercial context before auth or contract lookup", async () => {
    const { upsertRenewalScenario } = await import("@/actions/approvals");
    const result = await upsertRenewalScenario({
      contractId: "550e8400-e29b-41d4-a716-446655440000",
      scenario: "renew",
      commercialContext: "context\u202Ehidden",
    });

    expect(result).toEqual({ error: "Commercial context contains unsupported characters" });
    expect(approvalsMocks.createClient).not.toHaveBeenCalled();
    expect(approvalsMocks.from).not.toHaveBeenCalled();
  });

  it("upsertRenewalScenarioForm rejects unsafe blockers before auth or writes", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { upsertRenewalScenarioForm } = await import("@/actions/approvals");
    const fd = new FormData();
    fd.set("contractId", "550e8400-e29b-41d4-a716-446655440000");
    fd.set("scenario", "renew");
    fd.set("blocker", "blocked\u202Ehidden");

    const result = await upsertRenewalScenarioForm(fd);

    expect(result).toBeUndefined();
    expect(approvalsMocks.createClient).not.toHaveBeenCalled();
    expect(approvalsMocks.from).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
