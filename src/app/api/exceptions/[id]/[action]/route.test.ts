import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const recordV10AuditEvent = vi.fn();
const refreshV10ReadModelsForOrganization = vi.fn();
const emitProductTelemetryEvent = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v4/casefile", () => ({
  appendCasefileEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/integrations/events", () => ({
  enqueueOutboundEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("@/lib/product-telemetry", () => ({
  PRODUCT_TELEMETRY_ACTIONS: [],
  emitProductTelemetryEvent,
}));

vi.mock("@/lib/v10-server-contracts", () => ({
  executeV10IdempotentMutation: async (_admin: unknown, _input: unknown, execute: () => Promise<unknown>) => ({
    response: await execute(),
    replayed: false,
  }),
  getV10IdempotencyKeyFromRequest: (request: Request) => request.headers.get("x-idempotency-key")?.trim() || null,
  getV10ExpectedVersionFromRequest: (request: Request) => request.headers.get("x-v10-expected-version")?.trim() || undefined,
  recordV10AuditEvent,
}));

vi.mock("@/lib/v10-read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization,
}));

function adminExceptions(row: Record<string, unknown> | null, ownerExists: boolean) {
  return {
    from: vi.fn((table: string) => {
      if (table === "exceptions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: row, error: null })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          })),
        };
      }
      if (table === "organization_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: ownerExists ? { id: "m1" } : null,
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === "exception_events") {
        return {
          insert: vi.fn(async () => ({ error: null })),
        };
      }
      return {};
    }),
  };
}

describe("POST /api/exceptions/[id]/[action]", () => {
  const exceptionRow = {
    id: "ex-1",
    contract_id: "c1",
    status: "open",
    severity: "high",
    reopen_count: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    recordV10AuditEvent.mockResolvedValue("v10-audit-1");
    refreshV10ReadModelsForOrganization.mockResolvedValue({ ok: true, counts: {} });
    emitProductTelemetryEvent.mockResolvedValue(undefined);
    getApiAuthContext.mockResolvedValue({
      admin: adminExceptions(exceptionRow, true),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    canManageCapability.mockResolvedValue(true);
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/exceptions/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/exceptions/ex-1/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownerId: "owner-1" }),
      }),
      { params: Promise.resolve({ id: "ex-1", action: "assign" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 without maintenance_manage", async () => {
    canManageCapability.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/exceptions/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/exceptions/ex-1/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownerId: "owner-1" }),
      }),
      { params: Promise.resolve({ id: "ex-1", action: "assign" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when exception not in org", async () => {
    getApiAuthContext.mockResolvedValueOnce({
      admin: adminExceptions(null, true),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    const { POST } = await import("@/app/api/exceptions/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/exceptions/missing/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownerId: "owner-1" }),
      }),
      { params: Promise.resolve({ id: "missing", action: "assign" }) }
    );
    expect(res.status).toBe(404);
  });

  it("assign returns 400 when ownerId is missing", async () => {
    const { POST } = await import("@/app/api/exceptions/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/exceptions/ex-1/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "ex-1", action: "assign" }) }
    );
    expect(res.status).toBe(400);
  });

  it("assign succeeds", async () => {
    const { POST } = await import("@/app/api/exceptions/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/exceptions/ex-1/assign", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "test-key-exception-assign" },
        body: JSON.stringify({ ownerId: "owner-1" }),
      }),
      { params: Promise.resolve({ id: "ex-1", action: "assign" }) }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      outcome: "success",
      changed_object_type: "exception",
      changed_object_id: "ex-1",
      audit_event_id: "v10-audit-1",
    });
    expect(recordV10AuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "exception.owner_changed",
        targetType: "exception",
        targetId: "ex-1",
        safeMetadata: expect.objectContaining({ owner_assigned: true }),
      })
    );
  });

  it("resolve requires a note for high-risk exceptions", async () => {
    const { POST } = await import("@/app/api/exceptions/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/exceptions/ex-1/resolve", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "test-key-exception-resolve-note" },
        body: JSON.stringify({ resolutionAction: "fixed", resolutionNote: "" }),
      }),
      { params: Promise.resolve({ id: "ex-1", action: "resolve" }) }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      outcome: "validation_failed",
      diagnostic_id: "v10_exception_resolution_note_required",
    });
    expect(recordV10AuditEvent).not.toHaveBeenCalled();
  });

  it("resolve persists the selected resolution action in the V10 envelope path", async () => {
    const { POST } = await import("@/app/api/exceptions/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/exceptions/ex-1/resolve", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "test-key-exception-resolve-success" },
        body: JSON.stringify({
          resolutionAction: "accepted_risk",
          resolutionNote: "Risk accepted until the next renewal checkpoint.",
        }),
      }),
      { params: Promise.resolve({ id: "ex-1", action: "resolve" }) }
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      outcome: "success",
      changed_object_type: "exception",
      changed_object_id: "ex-1",
      audit_event_id: "v10-audit-1",
    });
    expect(recordV10AuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "exception.resolved",
        safeMetadata: expect.objectContaining({ resolution_action: "accepted_risk" }),
      })
    );
  });

  it("returns 404 for unsupported action", async () => {
    const { POST } = await import("@/app/api/exceptions/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/exceptions/ex-1/unknown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "ex-1", action: "unknown" }) }
    );
    expect(res.status).toBe(404);
  });
});
