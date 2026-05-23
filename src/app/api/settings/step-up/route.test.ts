import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitCheck = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  rateLimitCheck: (...args: unknown[]) => rateLimitCheck(...args),
  RATE_LIMITS: {
    stepUpPassword: { max: 30, windowMs: 60_000 },
    dsrSelfExport: { max: 10, windowMs: 60_000 },
  },
  getClientIpFromRequest: () => "127.0.0.1",
}));

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getDeterministicMembership = vi.fn();
const enforceIdempotency = vi.fn();
const safeFetch = vi.fn();
const recordSecurityAuditEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
  getDeterministicMembership,
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

vi.mock("@/lib/security/safe-fetch", () => ({
  safeFetch,
}));

vi.mock("@/lib/security/audit-write", () => ({
  recordSecurityAuditEvent,
}));

describe("POST /api/settings/step-up", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    rateLimitCheck.mockResolvedValue({ ok: true });
    enforceIdempotency.mockResolvedValue(null);
    safeFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    getDeterministicMembership.mockResolvedValue({
      organization_id: "00000000-0000-0000-0000-000000000001",
    });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("returns 401 when not authenticated", async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://127.0.0.1/api/settings/step-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "x" }),
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Unauthorized", code: "unauthorized" });
  });

  it("blocks duplicate step-up attempts before password verification", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    enforceIdempotency.mockResolvedValueOnce(duplicate);
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "user@example.test" } },
        }),
      },
    });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://127.0.0.1/api/settings/step-up", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "step-up-replay-0001",
        },
        body: JSON.stringify({ password: "correct horse battery staple" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(
      expect.any(Request),
      {
        scope: "api.settings.step-up",
        actorKey: "user:user-1",
      }
    );
    expect(safeFetch).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rate limits authenticated step-up attempts by user and IP before password verification", async () => {
    rateLimitCheck
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, retryAfterMs: 30_000 });
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "user@example.test" } },
        }),
      },
    });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://127.0.0.1/api/settings/step-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "correct horse battery staple" }),
      })
    );

    expect(res.status).toBe(429);
    expect(rateLimitCheck).toHaveBeenNthCalledWith(1, "step-up:127.0.0.1", expect.any(Object));
    expect(rateLimitCheck).toHaveBeenNthCalledWith(2, "step-up:user-1:127.0.0.1", expect.any(Object));
    expect(safeFetch).not.toHaveBeenCalled();
    expect(enforceIdempotency).not.toHaveBeenCalled();
  });

  it("audits failed password step-up attempts without storing password material", async () => {
    safeFetch.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "user@example.test" } },
        }),
      },
    });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://127.0.0.1/api/settings/step-up", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "step-up-failure-0001",
        },
        body: JSON.stringify({ password: "wrong password" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toMatchObject({
      code: "password_verification_failed",
    });
    expect(recordSecurityAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "security.step_up_password_verified",
        outcome: "failure",
        safeMetadata: { reason: "password_verification_failed" },
      })
    );
    expect(JSON.stringify(recordSecurityAuditEvent.mock.calls)).not.toContain("wrong password");
  });
});
