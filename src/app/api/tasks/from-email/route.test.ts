import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_ORG_ID = "22222222-2222-2222-2222-222222222222";
const CONTRACT_ID = "33333333-3333-3333-3333-333333333333";
const createAdminClient = vi.fn();
const rateLimitCheck = vi.fn();
const recordApiMutationAuditEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, rateLimitCheck };
});

vi.mock("@/lib/security/api-mutation-audit", () => ({
  recordApiMutationAuditEvent,
}));

describe("POST /api/tasks/from-email", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.INBOUND_AUTOMATION_TOKEN;
    delete process.env.INBOUND_EMAIL_AUTOMATION_TOKEN;
    delete process.env.INBOUND_AUTOMATION_ORG_ALLOWLIST;
    delete process.env.EMAIL_INBOUND_HMAC_SECRET;
    delete process.env.OBLIXA_KILL_INBOUND_AUTOMATION;
    rateLimitCheck.mockResolvedValue({ ok: true });
    recordApiMutationAuditEvent.mockResolvedValue("v10-audit-1");
  });

  it("returns 401 when inbound token is not configured", async () => {
    process.env.OBLIXA_KILL_INBOUND_AUTOMATION = "1";
    const { POST } = await import("@/app/api/tasks/from-email/route");
    const req = new Request("http://localhost:3000/api/tasks/from-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", code: "unauthorized" });
  });

  it("returns 503 kill-switch response only after bearer authorization", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    process.env.OBLIXA_KILL_INBOUND_AUTOMATION = "1";
    const { POST } = await import("@/app/api/tasks/from-email/route");
    const req = new Request("http://localhost:3000/api/tasks/from-email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({ organizationId: ORG_ID, contractId: CONTRACT_ID, subject: "hello" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body).toMatchObject({
      code: "service_temporarily_unavailable",
      diagnostic_id: "kill_switch_active",
      details: { subsystem: "inbound_automation" },
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 401 when bearer token does not match", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const { POST } = await import("@/app/api/tasks/from-email/route");
    const req = new Request("http://localhost:3000/api/tasks/from-email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer wrong",
      },
      body: JSON.stringify({ organizationId: ORG_ID, contractId: CONTRACT_ID, subject: "hello" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", code: "unauthorized" });
  });

  it("returns 401 for stale email HMAC timestamp", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    process.env.EMAIL_INBOUND_HMAC_SECRET = "email-hmac-secret";
    const raw = JSON.stringify({ organizationId: ORG_ID, contractId: CONTRACT_ID, subject: "hello" });
    const timestamp = String(Math.floor(Date.now() / 1000) - 1_000);
    const signature = `sha256=${createHmac("sha256", process.env.EMAIL_INBOUND_HMAC_SECRET)
      .update(`${timestamp}.${raw}`)
      .digest("hex")}`;
    const { POST } = await import("@/app/api/tasks/from-email/route");
    const req = new Request("http://localhost:3000/api/tasks/from-email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
        "x-oblixa-email-signature": signature,
        "x-oblixa-email-timestamp": timestamp,
      },
      body: raw,
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toMatchObject({
      error: "Invalid email inbound signature",
      code: "invalid_signature",
      diagnostic_id: "email_inbound_signature_invalid",
    });
  });

  it("returns 429 when organization rate limit is exceeded", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    rateLimitCheck
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, retryAfterMs: 3500 });
    const { POST } = await import("@/app/api/tasks/from-email/route");
    const req = new Request("http://localhost:3000/api/tasks/from-email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({ organizationId: ORG_ID, contractId: CONTRACT_ID, subject: "hello" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body).toMatchObject({ error: "Too many requests", code: "rate_limited", details: { retryAfterMs: 3500 } });
    expect(rateLimitCheck).toHaveBeenNthCalledWith(2, `tasks-email:org:${ORG_ID}`, expect.anything());
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 403 when organization is not in INBOUND_AUTOMATION_ORG_ALLOWLIST", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    process.env.INBOUND_AUTOMATION_ORG_ALLOWLIST = ORG_ID;
    const { POST } = await import("@/app/api/tasks/from-email/route");
    const req = new Request("http://localhost:3000/api/tasks/from-email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({ organizationId: OTHER_ORG_ID, contractId: CONTRACT_ID, subject: "hello" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toMatch(/not permitted/);
  });

  it("returns 400 for invalid body when authorized", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const { POST } = await import("@/app/api/tasks/from-email/route");
    const req = new Request("http://localhost:3000/api/tasks/from-email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({ organizationId: "abc", contractId: "def", subject: "" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      error: "organizationId, contractId, and subject are required.",
      code: "validation_failed",
    });
  });

  it("returns 400 for invalid dueDate and externalMessageId", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const { POST } = await import("@/app/api/tasks/from-email/route");
    const req = new Request("http://localhost:3000/api/tasks/from-email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({
        organizationId: "00000000-0000-0000-0000-000000000001",
        contractId: "00000000-0000-0000-0000-000000000002",
        subject: "hello",
        dueDate: "2026-13-01",
        externalMessageId: "bad id with spaces",
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({ error: "dueDate must be ISO date (YYYY-MM-DD)", code: "validation_failed" });
  });

  it("returns 400 for malformed JSON when authorized", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const { POST } = await import("@/app/api/tasks/from-email/route");
    const req = new Request("http://localhost:3000/api/tasks/from-email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: "{",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      code: "invalid_request",
      diagnostic_id: "route_invalid_request",
      details: { reason: "invalid_json" },
    });
  });

  it("returns 400 when subject exceeds inbound limit", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const { POST } = await import("@/app/api/tasks/from-email/route");
    const req = new Request("http://localhost:3000/api/tasks/from-email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({
        organizationId: "00000000-0000-0000-0000-000000000001",
        contractId: "00000000-0000-0000-0000-000000000002",
        subject: "s".repeat(241),
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/subject must be 240/);
  });

  it("returns 400 when body exceeds inbound limit", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const { POST } = await import("@/app/api/tasks/from-email/route");
    const req = new Request("http://localhost:3000/api/tasks/from-email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({
        organizationId: "00000000-0000-0000-0000-000000000001",
        contractId: "00000000-0000-0000-0000-000000000002",
        subject: "ok",
        body: "b".repeat(10_001),
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/body must be 10000/);
  });

  it("returns 400 when from exceeds inbound limit", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const { POST } = await import("@/app/api/tasks/from-email/route");
    const req = new Request("http://localhost:3000/api/tasks/from-email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({
        organizationId: "00000000-0000-0000-0000-000000000001",
        contractId: "00000000-0000-0000-0000-000000000002",
        subject: "ok",
        from: "f".repeat(321),
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/from must be 320/);
  });

  it("dedupes replayed email task creation by externalMessageId without inserting again", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const insertTask = vi.fn();
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "contracts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: CONTRACT_ID, organization_id: ORG_ID },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        if (table === "contract_tasks") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    ilike: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { id: "task-existing-email" },
                          error: null,
                        }),
                      })),
                    })),
                  })),
                })),
              })),
            })),
            insert: insertTask,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const { POST } = await import("@/app/api/tasks/from-email/route");
    const res = await POST(
      new Request("http://localhost:3000/api/tasks/from-email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer token",
        },
        body: JSON.stringify({
          organizationId: ORG_ID,
          contractId: CONTRACT_ID,
          subject: "Follow up",
          externalMessageId: "email-message-123",
        }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, deduped: true, taskId: "task-existing-email" });
    expect(recordApiMutationAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: ORG_ID,
        actorType: "system",
        route: "/api/tasks/from-email",
        method: "POST",
      })
    );
    expect(insertTask).not.toHaveBeenCalled();
  });
});
