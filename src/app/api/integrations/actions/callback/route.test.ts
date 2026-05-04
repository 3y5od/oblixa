import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const rateLimitCheck = vi.fn();
const getClientIpFromRequest = vi.fn();

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
      from: vi.fn(() => ({
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
      })),
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
    expect(body).toEqual({ error: "Unauthorized" });
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
        organizationId: "11111111-1111-1111-1111-111111111111",
        action: "ack_complete",
        contractId: "22222222-2222-2222-2222-222222222222",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
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
        organizationId: "org-1",
        action: "approve_evidence",
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "id is required" });
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
        organizationId: "org-1",
        action: "approve_evidence",
        id: "submission-1",
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Evidence submission not found for organization" });
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
    expect(body).toEqual({ error: "Unauthorized" });
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
    expect(body).toEqual({ error: "Too many requests", retryAfterMs: 2500 });
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
        organizationId: "22222222-2222-2222-2222-222222222222",
        action: "create_task",
      }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error).toMatch(/not permitted/);
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
        organizationId: "org-1",
        action: "create_exception",
        contractId: "contract-1",
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
        organization_id: "org-1",
        contract_id: "contract-1",
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
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "submission-1" }, error: null });
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
          organizationId: "org-1",
          action: "approve_evidence",
          id: "submission-1",
        }),
      });

    const first = await POST(buildRequest());
    const second = await POST(buildRequest());

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ ok: true, submissionId: "submission-1" });
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({ ok: true, submissionId: "submission-1" });
    expect(update).toHaveBeenCalledTimes(2);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });
});
