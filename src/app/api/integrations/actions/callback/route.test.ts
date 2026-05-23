import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const rateLimitCheck = vi.fn();
const getClientIpFromRequest = vi.fn();

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_ORG_ID = "22222222-2222-2222-2222-222222222222";
const CONTRACT_ID = "33333333-3333-3333-3333-333333333333";
const SUBMISSION_ID = "44444444-4444-4444-4444-444444444444";

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

describe("POST /api/integrations/actions/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.INBOUND_AUTOMATION_ORG_ALLOWLIST;
    delete process.env.INBOUND_INTEGRATIONS_CALLBACK_TOKEN;
    getClientIpFromRequest.mockReturnValue("127.0.0.1");
    rateLimitCheck.mockResolvedValue({ ok: true });
    createAdminClient.mockResolvedValue({
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
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: SUBMISSION_ID }, error: null });
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn(() => ({
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
    expect(update).toHaveBeenCalledTimes(2);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });
});
