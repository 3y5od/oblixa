import { beforeEach, describe, expect, it, vi } from "vitest";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const approveAndContinuePlaybookRun = vi.fn();
const enforceIdempotency = vi.fn();
const recordApiMutationAuditEvent = vi.fn();
const incrementAssuranceQualityCounter = vi.fn();
const runIncrementalAssuranceChecks = vi.fn();

vi.mock("@/lib/assurance/feature-guards", () => ({
  requireV6ApiFeature,
}));

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/assurance/playbooks", () => ({
  approveAndContinuePlaybookRun,
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
  incrementAssuranceQualityCounter,
}));

vi.mock("@/lib/assurance/assurance-checks", () => ({
  runIncrementalAssuranceChecks,
}));

describe("POST /api/playbooks/runs/[id]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    requireV6ApiFeature.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("audit-1");
    incrementAssuranceQualityCounter.mockResolvedValue(undefined);
    runIncrementalAssuranceChecks.mockResolvedValue(undefined);
  });

  it("returns 403 when feature disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(new Response(null, { status: 403 }));
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(403);
  });

  it("returns duplicate response before approving a playbook run", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    const admin = {};
    getApiAuthContext.mockResolvedValueOnce({
      admin,
      userId: "u1",
      orgId: "o1",
      role: "admin",
    });
    enforceIdempotency.mockResolvedValueOnce(duplicate);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/playbooks/runs/r1/approve", {
        method: "POST",
        headers: { "x-idempotency-key": "playbook-approve-replay-0001" },
      }),
      { params: Promise.resolve({ id: "r1" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(expect.any(Request), {
      scope: "api.playbooks.runs.id.approve",
      actorKey: "o1:u1",
    });
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(approveAndContinuePlaybookRun).not.toHaveBeenCalled();
  });

  it("returns 200 when approval succeeds", async () => {
    getApiAuthContext.mockResolvedValue({
      admin: {},
      userId: "u1",
      orgId: "o1",
      role: "admin",
    });
    approveAndContinuePlaybookRun.mockResolvedValueOnce({ data: { id: "r1", status: "completed" }, error: null });
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(200);
    expect(approveAndContinuePlaybookRun).toHaveBeenCalledWith({}, "o1", "u1", "r1");
  });
});
