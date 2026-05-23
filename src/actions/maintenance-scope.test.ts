import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const from = vi.fn();
const getOrEnsureDeterministicMembership = vi.fn();
const hasOrgCapability = vi.fn();
const hasSensitiveActionProof = vi.fn();
const recordSecurityAuditEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
  createAdminClient: vi.fn(async () => ({ from })),
  getOrEnsureDeterministicMembership,
}));

vi.mock("@/lib/actions/access", () => ({
  hasOrgCapability,
}));

vi.mock("@/lib/security/sensitive-action-proof", () => ({
  hasSensitiveActionProof,
}));

vi.mock("@/lib/security/audit-write", () => ({
  recordSecurityAuditEvent,
}));

describe("maintenance server actions (scope)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: null } });
    getOrEnsureDeterministicMembership.mockResolvedValue({
      organization_id: "org-1",
      role: "admin",
    });
    hasOrgCapability.mockResolvedValue(true);
    hasSensitiveActionProof.mockResolvedValue(true);
    recordSecurityAuditEvent.mockResolvedValue("audit-1");
  });

  it("returns before querying when fileId is not a uuid", async () => {
    const { deleteOrphanFileRecordForm } = await import("@/actions/maintenance");
    const fd = new FormData();
    fd.set("fileId", "not-a-uuid");
    const result = await deleteOrphanFileRecordForm(fd);
    expect(result).toEqual({ error: "Invalid file" });
    expect(getUser).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("does not mutate when user is not authenticated (logContractChangeEventForm)", async () => {
    const { logContractChangeEventForm } = await import("@/actions/maintenance");
    const fd = new FormData();
    fd.set("contractId", "550e8400-e29b-41d4-a716-446655440000");
    fd.set("eventType", "other");
    fd.set("impactLevel", "low");
    fd.set("summary", "summary text");
    const result = await logContractChangeEventForm(fd);
    expect(result).toEqual({ error: "Not authenticated" });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects unsafe change summaries before auth or data writes", async () => {
    const { logContractChangeEventForm } = await import("@/actions/maintenance");
    const fd = new FormData();
    fd.set("contractId", "550e8400-e29b-41d4-a716-446655440000");
    fd.set("eventType", "other");
    fd.set("impactLevel", "low");
    fd.set("summary", "normal text\u202Ehidden");
    const result = await logContractChangeEventForm(fd);
    expect(result).toEqual({ error: "Summary contains unsupported characters" });
    expect(getUser).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects unsafe archive reasons before auth or data writes", async () => {
    const { archiveContractAsDuplicateForm } = await import("@/actions/maintenance");
    const fd = new FormData();
    fd.set("contractId", "550e8400-e29b-41d4-a716-446655440000");
    fd.set("reason", "duplicate\u202Ehidden");
    const result = await archiveContractAsDuplicateForm(fd);
    expect(result).toEqual({ error: "Reason contains unsupported characters" });
    expect(getUser).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("requires step-up or AAL2 before deleting orphan file records", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    hasSensitiveActionProof.mockResolvedValueOnce(false);
    const { deleteOrphanFileRecordForm } = await import("@/actions/maintenance");
    const fd = new FormData();
    fd.set("fileId", "550e8400-e29b-41d4-a716-446655440000");

    const result = await deleteOrphanFileRecordForm(fd);

    expect(result).toEqual({
      error: "Confirm your password or complete MFA before running maintenance actions.",
      needStepUp: true,
    });
    expect(recordSecurityAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "security.maintenance_destructive_action_blocked",
        outcome: "forbidden",
        safeMetadata: expect.objectContaining({
          reason: "sensitive_action_proof_required",
          maintenance_action: "delete_orphan_file_record",
        }),
      })
    );
    expect(from).not.toHaveBeenCalled();
  });

  it("requires step-up or AAL2 before running bulk correction campaigns", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    hasSensitiveActionProof.mockResolvedValueOnce(false);
    const { runCorrectionCampaignForm } = await import("@/actions/maintenance");
    const fd = new FormData();
    fd.set("campaignType", "clear_stale_next_steps");

    const result = await runCorrectionCampaignForm(fd);

    expect(result).toEqual({
      error: "Confirm your password or complete MFA before running maintenance actions.",
      needStepUp: true,
    });
    expect(recordSecurityAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "security.maintenance_destructive_action_blocked",
        outcome: "forbidden",
        safeMetadata: expect.objectContaining({
          reason: "sensitive_action_proof_required",
          maintenance_action: "run_correction_campaign",
        }),
      })
    );
    expect(from).not.toHaveBeenCalled();
  });
});
