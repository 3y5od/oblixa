import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildV10MutationResponse } from "@/lib/v10-mutation-envelope";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const executeV10AuditedMutation = vi.fn();
const refreshV10ReadModelsForOrganization = vi.fn();
const recordV10AuditEvent = vi.fn();
const emitProductTelemetryEvent = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/v10-server-contracts", () => ({
  executeV10AuditedMutation,
  getV10ExpectedVersionFromRequest: (request: Request) => request.headers.get("if-match") ?? undefined,
  getV10IdempotencyKeyFromRequest: (request: Request) => request.headers.get("x-idempotency-key"),
  recordV10AuditEvent,
}));

vi.mock("@/lib/v10-read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization,
}));

vi.mock("@/lib/product-telemetry", () => ({
  PRODUCT_TELEMETRY_ACTIONS: [],
  emitProductTelemetryEvent,
}));

function makeAdmin() {
  return {
    from(table: string) {
      if (table !== "contracts") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: "contract_1", updated_at: "version_1" }, error: null }),
            }),
          }),
        }),
      };
    },
  };
}

describe("POST /api/evidence/requests", () => {
  beforeEach(() => {
    getApiAuthContext.mockReset();
    canManageCapability.mockReset();
    requireApiWorkspaceEligibility.mockReset();
    executeV10AuditedMutation.mockReset();
    refreshV10ReadModelsForOrganization.mockReset();
    recordV10AuditEvent.mockReset();
    emitProductTelemetryEvent.mockReset();
    getApiAuthContext.mockResolvedValue({
      admin: makeAdmin(),
      orgId: "org_1",
      userId: "user_1",
      role: "editor",
    });
    canManageCapability.mockResolvedValue(true);
    requireApiWorkspaceEligibility.mockResolvedValue(null);
  });

  it("returns a v10 validation envelope when the contract is missing", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://oblixa.test/api/evidence/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requiredNote: "Need SOC 2 evidence" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      outcome: "validation_failed",
      diagnostic_id: "v10_evidence_request_contract_required",
    });
    expect(executeV10AuditedMutation).not.toHaveBeenCalled();
  });

  it("returns a v10 validation envelope when dueAt is not a bounded UTC ISO timestamp", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://oblixa.test/api/evidence/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractId: "contract_1",
          dueAt: "2026-05-01",
          requiredNote: "Need SOC 2 evidence",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      outcome: "validation_failed",
      diagnostic_id: "v10_evidence_request_due_at_invalid",
    });
    expect(executeV10AuditedMutation).not.toHaveBeenCalled();
  });

  it("returns v10 envelopes for auth and capability denials", async () => {
    const { POST } = await import("./route");

    getApiAuthContext.mockResolvedValueOnce(null);
    const unauthorized = await POST(
      new Request("https://oblixa.test/api/evidence/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractId: "contract_1", requiredNote: "Need SOC 2 evidence" }),
      })
    );
    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toMatchObject({
      outcome: "unauthorized",
      diagnostic_id: "v10_evidence_request_unauthorized",
    });

    canManageCapability.mockResolvedValueOnce(false);
    const forbidden = await POST(
      new Request("https://oblixa.test/api/evidence/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractId: "contract_1", requiredNote: "Need SOC 2 evidence" }),
      })
    );
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toMatchObject({
      outcome: "forbidden",
      diagnostic_id: "v10_evidence_request_forbidden",
    });
  });

  it("uses the canonical create_evidence_request mutation contract", async () => {
    const dueAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    executeV10AuditedMutation.mockResolvedValue({
      replayed: false,
      response: buildV10MutationResponse({
        outcome: "success",
        message: "Evidence request created.",
        changedObjectType: "evidence_request",
        changedObjectId: "evreq_1",
        auditEventId: "audit_1",
      }),
    });
    const { POST } = await import("./route");

    const response = await POST(
      new Request("https://oblixa.test/api/evidence/requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "evidence-request-key",
          "if-match": "version_1",
        },
        body: JSON.stringify({
          contractId: "contract_1",
          sourceType: "obligation",
          sourceId: "obligation_1",
          responderEmail: "external@example.com",
          dueAt,
          requiredNote: "Need SOC 2 evidence",
          allowedFileTypes: ["pdf"],
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(executeV10AuditedMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        mutationName: "create_evidence_request",
        targetType: "evidence_request",
        targetId: "contract_1",
        idempotencyKey: "evidence-request-key",
        expectedVersion: "version_1",
        auditAction: "evidence_request.created",
        payload: expect.objectContaining({
          due_at: dueAt,
        }),
      }),
      expect.any(Function)
    );
  });

  it("surfaces stale expected-version failures as retryable v10 conflicts", async () => {
    executeV10AuditedMutation.mockResolvedValue({
      replayed: false,
      response: buildV10MutationResponse({
        outcome: "stale_version",
        message: "The contract changed before the evidence request was saved.",
        diagnosticId: "v10_evidence_request_stale_version",
      }),
    });
    const { POST } = await import("./route");

    const response = await POST(
      new Request("https://oblixa.test/api/evidence/requests", {
        method: "POST",
        headers: { "content-type": "application/json", "if-match": "older_version" },
        body: JSON.stringify({
          contractId: "contract_1",
          requiredNote: "Need SOC 2 evidence",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      outcome: "stale_version",
      diagnostic_id: "v10_evidence_request_stale_version",
    });
  });

  it("emits privacy-safe v10 telemetry when the mutation callback creates a request", async () => {
    const dueAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const admin = {
      from(table: string) {
        if (table === "contracts") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { id: "contract_1", updated_at: "version_1" }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "evidence_requirements") {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: "evreq_1",
                    contract_id: "contract_1",
                    status: "required",
                    due_at: dueAt,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
    getApiAuthContext.mockResolvedValue({
      admin,
      orgId: "org_1",
      userId: "user_1",
      role: "editor",
    });
    recordV10AuditEvent.mockResolvedValue("audit_1");
    refreshV10ReadModelsForOrganization.mockResolvedValue({ ok: true });
    emitProductTelemetryEvent.mockResolvedValue(undefined);
    executeV10AuditedMutation.mockImplementation(async (_admin, _contract, callback) => ({
      replayed: false,
      ...(await callback()),
    }));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://oblixa.test/api/evidence/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractId: "contract_1",
          responderEmail: "external@example.com",
          dueAt,
          requiredNote: "Need SOC 2 evidence",
          allowedFileTypes: ["pdf", "png"],
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(emitProductTelemetryEvent).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        organizationId: "org_1",
        userId: "user_1",
        contractId: "contract_1",
        action: "product.v10.evidence_request_created",
        details: {
          evidence_request_id: "evreq_1",
          due_state: "provided",
          allowed_file_type_count: 2,
          responder_email_state: "provided",
        },
      })
    );
  });
});
