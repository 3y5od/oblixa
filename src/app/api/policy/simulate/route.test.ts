import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const enforceIdempotency = vi.fn();
const recordApiMutationAuditEvent = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

vi.mock("@/lib/security/api-mutation-audit", () => ({
  recordApiMutationAuditEvent,
}));

vi.mock("@/lib/missing-critical-fields", () => ({
  getContractsMissingCriticalFields: vi.fn().mockResolvedValue([]),
}));

function adminForPolicy(contractFound: boolean) {
  let table = "";
  const chain = {
    from: vi.fn((t: string) => {
      table = t;
      return chain;
    }),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => {
      if (table === "contracts") {
        return contractFound
          ? { data: { id: "c1", organization_id: "org-1", title: "Acme" }, error: null }
          : { data: null, error: null };
      }
      if (table === "organization_workflow_settings") {
        return { data: { v4_policy_registry_json: [] }, error: null };
      }
      return { data: null, error: null };
    }),
  };
  return { from: chain.from };
}

describe("POST /api/policy/simulate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    getApiAuthContext.mockResolvedValue({
      admin: adminForPolicy(true),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    canManageCapability.mockResolvedValue(true);
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("v10-audit-1");
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/policy/simulate/route");
    const res = await POST(
      new Request("http://localhost:3000/api/policy/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractId: "c1" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 without contracts_edit capability", async () => {
    canManageCapability.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/policy/simulate/route");
    const res = await POST(
      new Request("http://localhost:3000/api/policy/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractId: "c1" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when contractId is missing", async () => {
    const { POST } = await import("@/app/api/policy/simulate/route");
    const res = await POST(
      new Request("http://localhost:3000/api/policy/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when contract is outside org", async () => {
    getApiAuthContext.mockResolvedValueOnce({
      admin: adminForPolicy(false),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    const { POST } = await import("@/app/api/policy/simulate/route");
    const res = await POST(
      new Request("http://localhost:3000/api/policy/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractId: "foreign" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns simulation payload on success", async () => {
    const { POST } = await import("@/app/api/policy/simulate/route");
    const res = await POST(
      new Request("http://localhost:3000/api/policy/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractId: "c1" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.simulation).toMatchObject({
      contract_id: "c1",
      contract_title: "Acme",
    });
    expect(Array.isArray(body.warnings)).toBe(true);
  });

  it("returns duplicate response before reading simulation body", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    const admin = adminForPolicy(true);
    enforceIdempotency.mockResolvedValueOnce(duplicate);
    getApiAuthContext.mockResolvedValueOnce({
      admin,
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });

    const { POST } = await import("@/app/api/policy/simulate/route");
    const res = await POST(
      new Request("http://localhost:3000/api/policy/simulate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "policy-simulate-replay-0001" },
        body: JSON.stringify({ contractId: "c1" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(
      expect.any(Request),
      {
        scope: "api.policy.simulate",
        actorKey: "org-1:user-1",
      }
    );
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });
});
