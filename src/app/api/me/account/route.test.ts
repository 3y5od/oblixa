import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const createAdminClient = vi.fn();
const getDeterministicMembership = vi.fn();
const hasSensitiveActionProof = vi.fn();
const rateLimitCheck = vi.fn();
const enforceIdempotency = vi.fn();
const recordSecurityAuditEvent = vi.fn();
const recordSecurityAuditEventStrict = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
  createAdminClient,
  getDeterministicMembership,
}));

vi.mock("@/lib/security/sensitive-action-proof", () => ({
  hasSensitiveActionProof,
}));

vi.mock("@/lib/rate-limit", () => ({
  getClientIpFromRequest: () => "127.0.0.1",
  rateLimitCheck,
  RATE_LIMITS: {
    stepUpPassword: { max: 5, windowMs: 60_000 },
  },
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

vi.mock("@/lib/security/audit-write", () => ({
  recordSecurityAuditEvent,
  recordSecurityAuditEventStrict,
}));

describe("DELETE /api/me/account", () => {
  const prev = process.env.OBLIXA_DSR_ACCOUNT_DELETE;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.OBLIXA_DSR_ACCOUNT_DELETE = "1";
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    getDeterministicMembership.mockResolvedValue({
      organization_id: "00000000-0000-0000-0000-000000000001",
      role: "admin",
    });
    hasSensitiveActionProof.mockResolvedValue(true);
    rateLimitCheck.mockResolvedValue({ ok: true });
    enforceIdempotency.mockResolvedValue(null);
    recordSecurityAuditEvent.mockResolvedValue("audit-1");
    recordSecurityAuditEventStrict.mockResolvedValue("audit-1");
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.OBLIXA_DSR_ACCOUNT_DELETE;
    else process.env.OBLIXA_DSR_ACCOUNT_DELETE = prev;
  });

  it("returns 403 when account deletion API is not enabled", async () => {
    delete process.env.OBLIXA_DSR_ACCOUNT_DELETE;
    vi.resetModules();
    const { DELETE } = await import("./route");
    const res = await DELETE(new Request("http://127.0.0.1/api/me/account", { method: "DELETE" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Forbidden", code: "forbidden" });
  });

  it("requires step-up or AAL2 before recording account deletion requests", async () => {
    hasSensitiveActionProof.mockResolvedValueOnce(false);
    const admin = { from: vi.fn() };
    createAdminClient.mockResolvedValueOnce(admin);

    const { DELETE } = await import("./route");
    const res = await DELETE(new Request("http://127.0.0.1/api/me/account", { method: "DELETE" }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toMatchObject({
      code: "step_up_required",
      diagnostic_id: "account_delete_step_up_required",
    });
    expect(rateLimitCheck).toHaveBeenCalledWith(
      "dsr-delete:user-1:127.0.0.1",
      expect.any(Object)
    );
    expect(enforceIdempotency).toHaveBeenCalledWith(
      expect.any(Request),
      {
        scope: "account.delete.request",
        actorKey: "user-1",
      }
    );
    expect(admin.from).not.toHaveBeenCalled();
    expect(recordSecurityAuditEvent).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        action: "security.dsr_account_delete_requested",
        outcome: "forbidden",
        safeMetadata: { reason: "sensitive_action_proof_required" },
      })
    );
  });

  it("accepts sensitive-action proof before recording account deletion requests", async () => {
    const maybeSingle = vi.fn(async () => ({ data: { legal_hold: false } }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const admin = { from: vi.fn(() => ({ select })) };
    createAdminClient.mockResolvedValueOnce(admin);

    const { DELETE } = await import("./route");
    const res = await DELETE(
      new Request("http://127.0.0.1/api/me/account", {
        method: "DELETE",
        headers: { "x-idempotency-key": "account-delete-0001" },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body).toMatchObject({ ok: true, status: "accepted" });
    expect(hasSensitiveActionProof).toHaveBeenCalledWith(expect.anything(), "user-1");
    expect(enforceIdempotency).toHaveBeenCalledWith(
      expect.any(Request),
      {
        scope: "account.delete.request",
        actorKey: "user-1",
      }
    );
    expect(recordSecurityAuditEventStrict).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        action: "security.dsr_account_delete_requested",
        outcome: "success",
      })
    );
  });

  it("fails closed when account deletion request audit cannot be recorded", async () => {
    const maybeSingle = vi.fn(async () => ({ data: { legal_hold: false } }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const admin = { from: vi.fn(() => ({ select })) };
    createAdminClient.mockResolvedValueOnce(admin);
    recordSecurityAuditEventStrict.mockRejectedValueOnce(new Error("audit unavailable"));

    const { DELETE } = await import("./route");
    const res = await DELETE(
      new Request("http://127.0.0.1/api/me/account", {
        method: "DELETE",
        headers: { "x-idempotency-key": "account-delete-0001" },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toMatchObject({
      code: "audit_write_failed",
      diagnostic_id: "account_delete_audit_write_failed",
    });
  });
});
