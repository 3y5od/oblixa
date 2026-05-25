import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const appendCasefileEvent = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const recordV10AuditEvent = vi.fn();
const refreshV10ReadModelsForOrganization = vi.fn();
const emitProductTelemetryEvent = vi.fn();

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/contract-operations/casefile", () => ({
  appendCasefileEvent,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("@/lib/product-telemetry", () => ({
  PRODUCT_TELEMETRY_ACTIONS: [],
  emitProductTelemetryEvent,
}));

vi.mock("@/lib/server-contracts", () => ({
  executeV10IdempotentMutation: async (_admin: unknown, _input: unknown, execute: () => Promise<unknown>) => ({
    response: await execute(),
    replayed: false,
  }),
  getV10IdempotencyKeyFromRequest: (request: Request) => request.headers.get("x-idempotency-key")?.trim() || null,
  getV10ExpectedVersionFromRequest: (request: Request) => request.headers.get("x-v10-expected-version")?.trim() || undefined,
  recordV10AuditEvent,
}));

vi.mock("@/lib/read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization,
}));

function createAdminClientMock() {
  const from = vi.fn((table: string) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      update: vi.fn(() => chain),
      insert: vi.fn(async () => ({ error: null })),
      maybeSingle: vi.fn(async () => {
        if (table === "contract_approvals") {
          return {
            data: {
              id: "approval-1",
              organization_id: "org-1",
              status: "pending",
              contract_id: "contract-1",
            },
            error: null,
          };
        }
        if (table === "organization_members") {
          return { data: null, error: null };
        }
        return { data: null, error: null };
      }),
    };
    return chain;
  });

  return { from };
}

describe("POST /api/approvals/[id]/[action]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    recordV10AuditEvent.mockResolvedValue("v10-audit-1");
    refreshV10ReadModelsForOrganization.mockResolvedValue({ ok: true, counts: {} });
    getApiAuthContext.mockResolvedValue({
      admin: createAdminClientMock(),
      userId: "user-1",
      orgId: "org-1",
      role: "owner",
    });
    canManageCapability.mockResolvedValue(true);
  });

  it("rejects delegation to a user outside the organization", async () => {
    const { POST } = await import("@/app/api/approvals/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/approvals/approval-1/delegate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "test-key-approval-delegate" },
        body: JSON.stringify({ delegateUserId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }),
      }),
      { params: Promise.resolve({ id: "approval-1", action: "delegate" }) }
    );

    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      outcome: "validation_failed",
      diagnostic_id: "v10_approval_delegate_wrong_org",
    });
    expect(appendCasefileEvent).not.toHaveBeenCalled();
    expect(recordV10AuditEvent).not.toHaveBeenCalled();
  });

  it("approves an approval through the V10 mutation envelope", async () => {
    const { POST } = await import("@/app/api/approvals/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/approvals/approval-1/approve", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "test-key-approval-approve" },
        body: JSON.stringify({ note: "Looks good" }),
      }),
      { params: Promise.resolve({ id: "approval-1", action: "approve" }) }
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      outcome: "success",
      changed_object_type: "approval",
      changed_object_id: "approval-1",
      audit_event_id: "v10-audit-1",
    });
    expect(appendCasefileEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "approval.approved",
        entityId: "approval-1",
      })
    );
    expect(recordV10AuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "approval.approved",
        afterStateHash: "approved",
      })
    );
    expect(refreshV10ReadModelsForOrganization).toHaveBeenCalled();
    expect(emitProductTelemetryEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "product.v10.approval_decision_recorded",
        details: expect.objectContaining({ action: "approve", outcome: "approved" }),
      })
    );
  });

  it("requires a note before request-changes", async () => {
    const { POST } = await import("@/app/api/approvals/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/approvals/approval-1/request-changes", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "test-key-approval-request-changes" },
        body: JSON.stringify({ note: "" }),
      }),
      { params: Promise.resolve({ id: "approval-1", action: "request-changes" }) }
    );

    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      outcome: "validation_failed",
      diagnostic_id: "v10_approval_decision_note_required",
    });
    expect(appendCasefileEvent).not.toHaveBeenCalled();
    expect(recordV10AuditEvent).not.toHaveBeenCalled();
  });
});
