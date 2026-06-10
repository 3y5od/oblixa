import { beforeEach, describe, expect, it, vi } from "vitest";

const approvalHelperMocks = vi.hoisted(() => ({
  hasOrgCapability: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: approvalHelperMocks.revalidatePath,
}));

vi.mock("@/lib/actions/access", () => ({
  hasOrgCapability: approvalHelperMocks.hasOrgCapability,
}));

import {
  appendApprovalEvent,
  approvalAuditActionForStatus,
  approvalDecisionMessage,
  canManageApprovalsForOrg,
  revalidateApprovalPaths,
} from "@/actions/approvals-helpers";

describe("approval helper action boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates approval management checks to the org capability guard", async () => {
    approvalHelperMocks.hasOrgCapability.mockResolvedValue(true);
    const admin = {};

    const result = await canManageApprovalsForOrg(admin as never, "org-1", "user-1");

    expect(result).toBe(true);
    expect(approvalHelperMocks.hasOrgCapability).toHaveBeenCalledWith({
      admin,
      organizationId: "org-1",
      userId: "user-1",
      capability: "approvals_manage",
      allowContractEditors: true,
    });
  });

  it("writes approval events with the caller organization and contract scope", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const admin = { from: vi.fn(() => ({ insert })) };

    await appendApprovalEvent(admin as never, {
      organizationId: "org-1",
      contractId: "contract-1",
      approvalId: "approval-1",
      actorId: "user-1",
      eventType: "status_changed",
    });

    expect(admin.from).toHaveBeenCalledWith("contract_approval_events");
    expect(insert).toHaveBeenCalledWith({
      organization_id: "org-1",
      contract_id: "contract-1",
      approval_id: "approval-1",
      actor_id: "user-1",
      event_type: "status_changed",
      details: {},
    });
  });

  it("keeps approval route revalidation scoped to approval surfaces", () => {
    revalidateApprovalPaths("contract-1");

    expect(approvalHelperMocks.revalidatePath).toHaveBeenCalledWith("/work");
    expect(approvalHelperMocks.revalidatePath).toHaveBeenCalledWith("/contracts/approvals");
    expect(approvalHelperMocks.revalidatePath).toHaveBeenCalledWith("/contracts/approvals/workload");
    expect(approvalHelperMocks.revalidatePath).toHaveBeenCalledWith("/contracts/approvals/sla-simulator");
    expect(approvalHelperMocks.revalidatePath).toHaveBeenCalledWith("/contracts/contract-1");
  });

  it("maps approval outcomes to stable audit actions and user messages", () => {
    expect(approvalAuditActionForStatus("approved")).toBe("approval.approved");
    expect(approvalAuditActionForStatus("rejected")).toBe("approval.rejected");
    expect(approvalAuditActionForStatus("changes_requested")).toBe("approval.changes_requested");
    expect(approvalDecisionMessage("approved")).toBe("Approval approved.");
  });
});
