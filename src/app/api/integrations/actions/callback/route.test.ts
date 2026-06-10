import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";

const createAdminClient = vi.fn();
const rateLimitCheck = vi.fn();
const getClientIpFromRequest = vi.fn();

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_ORG_ID = "22222222-2222-2222-2222-222222222222";
const CONTRACT_ID = "33333333-3333-3333-3333-333333333333";
const SUBMISSION_ID = "44444444-4444-4444-4444-444444444444";
const DELEGATE_USER_ID = "55555555-5555-5555-5555-555555555555";

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    integrationsActionsInbound: { max: 60, windowMs: 60_000 },
  },
  rateLimitCheck,
  getClientIpFromRequest,
}));

function signedCallbackRequest(
  body: Record<string, unknown>,
  token = "callback-only",
  secret = "callback-hmac-secret"
) {
  const raw = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`;
  return new Request("http://localhost:3000/api/integrations/actions/callback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-oblixa-callback-signature": signature,
      "x-oblixa-callback-timestamp": timestamp,
    },
    body: raw,
  });
}

describe("POST /api/integrations/actions/callback", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    delete process.env.INBOUND_AUTOMATION_TOKEN;
    delete process.env.INBOUND_AUTOMATION_ORG_ALLOWLIST;
    delete process.env.INBOUND_INTEGRATIONS_CALLBACK_TOKEN;
    delete process.env.INBOUND_INTEGRATIONS_CALLBACK_HMAC_SECRET;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    getClientIpFromRequest.mockReturnValue("127.0.0.1");
    rateLimitCheck.mockResolvedValue({ ok: true });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        const statusByTable: Record<string, string> = {
          evidence_submissions: "submitted",
          contract_approvals: "pending",
          exceptions: "open",
        };
        const selectStatus = (status: string) => ({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: "row-1", status }, error: null }),
            }),
          }),
        });
        const updateOk = () => ({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "row-1" }, error: null }),
              }),
            }),
          }),
        });
        if (table === "contracts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: CONTRACT_ID }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "organization_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "member-1" }, error: null }),
                }),
              }),
            }),
          };
        }
        if (statusByTable[table]) {
          return {
            select: vi.fn().mockReturnValue(selectStatus(statusByTable[table])),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { id: "row-1" }, error: null }),
              })),
            })),
            update: vi.fn().mockReturnValue(updateOk()),
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockReturnValue(updateOk()),
        };
      }),
    });
  });

  it("returns 401 when no inbound secret is configured", async () => {
    delete process.env.INBOUND_AUTOMATION_TOKEN;
    delete process.env.INBOUND_INTEGRATIONS_CALLBACK_TOKEN;
    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const req = new Request("http://localhost:3000/api/integrations/actions/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", code: "unauthorized" });
    expect(rateLimitCheck).toHaveBeenCalled();
  });

  it("accepts INBOUND_INTEGRATIONS_CALLBACK_TOKEN instead of shared token", async () => {
    delete process.env.INBOUND_AUTOMATION_TOKEN;
    process.env.INBOUND_INTEGRATIONS_CALLBACK_TOKEN = "callback-only";
    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const req = new Request("http://localhost:3000/api/integrations/actions/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer callback-only",
      },
      body: JSON.stringify({
        organizationId: ORG_ID,
        action: "ack_complete",
        contractId: CONTRACT_ID,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("returns 503 in production when callback HMAC secret is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.INBOUND_INTEGRATIONS_CALLBACK_TOKEN = "callback-only";
    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const req = new Request("http://localhost:3000/api/integrations/actions/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer callback-only",
      },
      body: JSON.stringify({
        organizationId: ORG_ID,
        action: "ack_complete",
        contractId: CONTRACT_ID,
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body).toMatchObject({
      code: "server_misconfigured",
      details: { missing_env: "INBOUND_INTEGRATIONS_CALLBACK_HMAC_SECRET" },
    });
  });

  it("accepts a signed integration callback body", async () => {
    delete process.env.INBOUND_AUTOMATION_TOKEN;
    process.env.INBOUND_INTEGRATIONS_CALLBACK_TOKEN = "callback-only";
    process.env.INBOUND_INTEGRATIONS_CALLBACK_HMAC_SECRET = "callback-hmac-secret";
    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const res = await POST(
      signedCallbackRequest({
        organizationId: ORG_ID,
        action: "ack_complete",
        contractId: CONTRACT_ID,
      })
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 for malformed JSON when authorized", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const req = new Request("http://localhost:3000/api/integrations/actions/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: "{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "invalid_request",
      diagnostic_id: "route_invalid_request",
      details: { reason: "invalid_json" },
    });
  });

  it("returns 400 for malformed organizationId", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const req = new Request("http://localhost:3000/api/integrations/actions/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({ organizationId: "org-1", action: "create_task" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      error: "organizationId must be a valid UUID",
      code: "validation_failed",
      diagnostic_id: "integration_callback_org_id_invalid",
    });
  });

  it("validates missing id for approve_evidence action", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const req = new Request("http://localhost:3000/api/integrations/actions/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({
        organizationId: ORG_ID,
        action: "approve_evidence",
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({ error: "id is required", code: "validation_failed" });
  });

  it("returns 404 when approve_evidence update matches no row in the allowed org", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    createAdminClient.mockResolvedValueOnce({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      })),
    });
    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const req = new Request("http://localhost:3000/api/integrations/actions/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({
        organizationId: ORG_ID,
        action: "approve_evidence",
        id: SUBMISSION_ID,
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body).toMatchObject({ error: "Not found", code: "not_found" });
  });

  it("returns 401 when bearer token does not match", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const req = new Request("http://localhost:3000/api/integrations/actions/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer wrong",
      },
      body: JSON.stringify({ organizationId: "org-1", action: "create_task" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", code: "unauthorized" });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 2500 });
    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const req = new Request("http://localhost:3000/api/integrations/actions/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({ organizationId: "org-1", action: "create_task" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body).toMatchObject({ error: "Too many requests", code: "rate_limited", details: { retryAfterMs: 2500 } });
  });

  it("returns 429 when organization/action rate limit is exceeded", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    rateLimitCheck
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, retryAfterMs: 3500 });
    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const req = new Request("http://localhost:3000/api/integrations/actions/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({
        organizationId: ORG_ID,
        action: "create_task",
        contractId: CONTRACT_ID,
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body).toMatchObject({ error: "Too many requests", code: "rate_limited", details: { retryAfterMs: 3500 } });
    expect(rateLimitCheck).toHaveBeenNthCalledWith(
      2,
      `inbound:integrations-actions:org:${ORG_ID}:create_task`,
      { max: 60, windowMs: 60_000 }
    );
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 403 when organization is not in INBOUND_AUTOMATION_ORG_ALLOWLIST", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    process.env.INBOUND_AUTOMATION_ORG_ALLOWLIST = "11111111-1111-1111-1111-111111111111";
    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const req = new Request("http://localhost:3000/api/integrations/actions/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({
        organizationId: OTHER_ORG_ID,
        action: "create_task",
      }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error).toMatch(/not permitted/);
  });

  it("rejects create_task when contract is not in the claimed organization", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const taskInsert = vi.fn();
    createAdminClient.mockResolvedValueOnce({
      from: vi.fn((table: string) => {
        if (table === "contracts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "contract_tasks") {
          return { insert: taskInsert };
        }
        return { insert: vi.fn().mockResolvedValue({}) };
      }),
    });

    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const req = new Request("http://localhost:3000/api/integrations/actions/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({
        organizationId: ORG_ID,
        action: "create_task",
        contractId: CONTRACT_ID,
        title: "Wrong org task",
      }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json).toMatchObject({
      error: "Contract not found in organization",
      diagnostic_id: "integration_callback_contract_not_found",
    });
    expect(taskInsert).not.toHaveBeenCalled();
  });

  it("accepts create_exception payload shape and inserts normalized exception fields", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: { id: "exception-1" }, error: null }),
      })),
    }));
    createAdminClient.mockResolvedValueOnce({
      from: vi.fn((table: string) => {
        if (table === "contracts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: CONTRACT_ID }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "exceptions") {
          return { insert };
        }
        return {
          insert: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "row-1" }, error: null }),
                }),
              }),
            }),
          }),
        };
      }),
    });

    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const req = new Request("http://localhost:3000/api/integrations/actions/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({
        organizationId: ORG_ID,
        action: "create_exception",
        contractId: CONTRACT_ID,
        title: " Escalated issue ",
        details: " details from upstream ",
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, exceptionId: "exception-1" });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: ORG_ID,
        contract_id: CONTRACT_ID,
        title: "Escalated issue",
        details: "details from upstream",
        exception_type: "inbound_action",
        severity: "medium",
        status: "open",
      })
    );
  });

  it("handles duplicate replay of approve_evidence callback idempotently", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const statusMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: SUBMISSION_ID, status: "submitted" }, error: null })
      .mockResolvedValueOnce({ data: { id: SUBMISSION_ID, status: "approved" }, error: null });
    const updateMaybeSingle = vi.fn().mockResolvedValue({ data: { id: SUBMISSION_ID }, error: null });
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle }),
        }),
      }),
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: statusMaybeSingle,
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({}),
        update,
      })),
    });

    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const buildRequest = () =>
      new Request("http://localhost:3000/api/integrations/actions/callback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer token",
        },
        body: JSON.stringify({
          organizationId: ORG_ID,
          action: "approve_evidence",
          id: SUBMISSION_ID,
        }),
      });

    const first = await POST(buildRequest());
    const second = await POST(buildRequest());

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ ok: true, submissionId: SUBMISSION_ID });
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({ ok: true, submissionId: SUBMISSION_ID });
    expect(update).toHaveBeenCalledTimes(1);
    expect(statusMaybeSingle).toHaveBeenCalledTimes(2);
    expect(updateMaybeSingle).toHaveBeenCalledTimes(1);
  });

  it("rejects reject_evidence when the submission is already approved", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const update = vi.fn();
    createAdminClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: SUBMISSION_ID, status: "approved" },
                error: null,
              }),
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({}),
        update,
      })),
    });

    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const res = await POST(
      new Request("http://localhost:3000/api/integrations/actions/callback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer token",
        },
        body: JSON.stringify({
          organizationId: ORG_ID,
          action: "reject_evidence",
          id: SUBMISSION_ID,
          reason: "missing evidence",
        }),
      })
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      code: "conflict",
      details: { reason: "terminal_state", resource: "evidence_submission", status: "approved" },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects delegate_approval when delegateUserId is not an organization member", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const update = vi.fn();
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organization_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "approval-1", status: "pending" },
                  error: null,
                }),
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({}),
          update,
        };
      }),
    });

    const { POST } = await import("@/app/api/integrations/actions/callback/route");
    const res = await POST(
      new Request("http://localhost:3000/api/integrations/actions/callback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer token",
        },
        body: JSON.stringify({
          organizationId: ORG_ID,
          action: "delegate_approval",
          id: "66666666-6666-6666-6666-666666666666",
          delegateUserId: DELEGATE_USER_ID,
        }),
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      diagnostic_id: "integration_callback_delegate_user_not_member",
    });
    expect(update).not.toHaveBeenCalled();
  });
});
