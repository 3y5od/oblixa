import { beforeEach, describe, expect, it, vi } from "vitest";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const resolveFinding = vi.fn();
const dismissFinding = vi.fn();
const enforceIdempotency = vi.fn();
const recordApiMutationAuditEvent = vi.fn();

vi.mock("@/lib/assurance/feature-guards", () => ({
  requireV6ApiFeature: (...args: unknown[]) => requireV6ApiFeature(...args),
}));

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

vi.mock("@/lib/security/api-mutation-audit", () => ({
  recordApiMutationAuditEvent,
}));

vi.mock("@/lib/assurance/telemetry", () => ({
  incrementAssuranceQualityCounter: vi.fn(async () => {}),
}));

vi.mock("@/lib/assurance/assurance", () => ({
  resolveFinding: (...args: unknown[]) => resolveFinding(...args),
  dismissFinding: (...args: unknown[]) => dismissFinding(...args),
}));

describe("POST /api/assurance/findings/[id]/resolve", () => {
  const ORG = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    requireV6ApiFeature.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    getApiAuthContext.mockResolvedValue({
      admin: {},
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    resolveFinding.mockResolvedValue({ data: { id: "f1" }, error: null });
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("v10-audit-1");
  });

  it("passes session orgId into resolveFinding", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "find-1" }) }
    );
    expect(res.status).toBe(200);
    expect(resolveFinding).toHaveBeenCalledWith(expect.anything(), ORG, "user-1", "find-1", undefined, null);
  });

  it("returns duplicate response before resolving or dismissing the finding", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    enforceIdempotency.mockResolvedValueOnce(duplicate);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "finding-resolve-replay-0001" },
        body: JSON.stringify({ action: "resolve" }),
      }),
      { params: Promise.resolve({ id: "find-1" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(
      expect.any(Request),
      {
        scope: "api.assurance.findings.id.resolve",
        actorKey: `${ORG}:user-1`,
      }
    );
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(resolveFinding).not.toHaveBeenCalled();
    expect(dismissFinding).not.toHaveBeenCalled();
  });
});
