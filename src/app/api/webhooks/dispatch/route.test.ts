import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const rateLimitCheck = vi.fn();
const safeFetch = vi.fn();
const decryptIntegrationToken = vi.fn();
const encryptIntegrationToken = vi.fn();
const appendCasefileEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/security/safe-fetch", () => ({
  safeFetch,
}));

vi.mock("@/lib/security/token-crypto", () => ({
  decryptIntegrationToken,
  encryptIntegrationToken,
}));

vi.mock("@/lib/v4/casefile", () => ({
  appendCasefileEvent,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    webhooksDispatchCron: { max: 60, windowMs: 60_000 },
  },
  rateLimitCheck,
}));

beforeEach(() => {
  safeFetch.mockReset();
  decryptIntegrationToken.mockReset();
  encryptIntegrationToken.mockReset();
  appendCasefileEvent.mockReset();
  safeFetch.mockResolvedValue({ ok: true, status: 202 });
  decryptIntegrationToken.mockImplementation((value: string) => value);
  encryptIntegrationToken.mockImplementation((value: string) => value);
  appendCasefileEvent.mockResolvedValue(undefined);
});

describe("GET /api/webhooks/dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("returns 503 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/webhooks/dispatch/route");
    const req = new Request("http://localhost:3000/api/webhooks/dispatch");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });

  it("returns 401 when authorization header is missing", async () => {
    process.env.CRON_SECRET = "secret";
    const { GET } = await import("@/app/api/webhooks/dispatch/route");
    const req = new Request("http://localhost:3000/api/webhooks/dispatch");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", code: "cron_unauthorized" });
  });

  it("returns 429 with Retry-After when cron rate limited", async () => {
    process.env.CRON_SECRET = "secret";
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 4500 });

    const { GET } = await import("@/app/api/webhooks/dispatch/route");
    const req = new Request("http://localhost:3000/api/webhooks/dispatch", {
      headers: { Authorization: "Bearer secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Too many requests", code: "rate_limited", retryAfterMs: 4500 });
  });

  it("returns diagnostics payload when authorized with eventId", async () => {
    process.env.CRON_SECRET = "secret";
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(
          table === "outbound_events"
            ? { data: { id: "evt_1", delivered: false } }
            : { data: null }
        ),
        order: vi.fn().mockResolvedValue({
          data: table === "outbound_event_deliveries" ? [{ id: "del_1", delivered: false }] : [],
        }),
      })),
    });

    const { GET } = await import("@/app/api/webhooks/dispatch/route");
    const req = new Request("http://localhost:3000/api/webhooks/dispatch?eventId=evt_1", {
      headers: { Authorization: "Bearer secret" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      diagnostics: {
        event: { id: "evt_1", delivered: false },
        deliveries: [{ id: "del_1", delivered: false }],
      },
      ok: true,
    });
  });

  it("signs webhook deliveries with HMAC and dedupes delivery rows", async () => {
    process.env.CRON_SECRET = "secret";
    decryptIntegrationToken.mockReturnValue("plain-secret");
    encryptIntegrationToken.mockReturnValue("enc:v1:reencrypted");

    const event = {
      id: "evt_1",
      organization_id: "org_1",
      event_type: "contract.updated",
      entity_type: "contract",
      entity_id: "ctr_1",
      payload: { schema_version: "v2", contract_id: "ctr_1" },
      created_at: "2026-05-04T17:00:00.000Z",
    };
    const subscription = {
      id: "sub_1",
      organization_id: "org_1",
      url: "https://example.com/hooks",
      secret: "legacy-webhook-secret",
      events: ["contract.updated"],
    };
    const deliveryRow = {
      id: "del_1",
      subscription_id: "sub_1",
      attempt_count: 0,
      delivered: false,
      next_attempt_at: new Date(Date.now() - 1_000).toISOString(),
    };

    const deliverySeedUpsert = vi.fn().mockResolvedValue({ error: null });
    const deliveryPatchUpsert = vi.fn().mockResolvedValue({ error: null });
    const webhookSecretEq = vi.fn().mockResolvedValue({ error: null });
    const outboundEventEq = vi.fn().mockResolvedValue({ error: null });

    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "outbound_events") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [event] }),
            })),
            update: vi.fn(() => ({
              eq: outboundEventEq,
            })),
          };
        }
        if (table === "webhook_subscriptions") {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [subscription] }),
            })),
            update: vi.fn(() => ({
              eq: webhookSecretEq,
            })),
          };
        }
        if (table === "outbound_event_deliveries") {
          return {
            upsert: vi.fn((rows, options) => {
              if (options?.onConflict === "outbound_event_id,subscription_id") {
                return deliverySeedUpsert(rows, options);
              }
              return deliveryPatchUpsert(rows, options);
            }),
            select: vi.fn((_columns: string, options?: { count?: string; head?: boolean }) => {
              if (options?.count === "exact" && options.head) {
                const countQuery = {
                  eq: vi.fn(),
                };
                countQuery.eq
                  .mockImplementationOnce(() => countQuery)
                  .mockResolvedValueOnce({ count: 0 });
                return countQuery;
              }
              const deliveryQuery = {
                eq: vi.fn(),
                lte: vi.fn().mockResolvedValue({ data: [deliveryRow] }),
              };
              deliveryQuery.eq.mockImplementation(() => deliveryQuery);
              return deliveryQuery;
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const { GET } = await import("@/app/api/webhooks/dispatch/route");
    const req = new Request("http://localhost:3000/api/webhooks/dispatch", {
      headers: { Authorization: "Bearer secret" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, attempts: 1, delivered: 1 });

    const expectedPayload = JSON.stringify({
      id: event.id,
      type: event.event_type,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      occurred_at: event.created_at,
      schema_version: "v2",
      data: event.payload,
    });
    const expectedSignature = createHmac("sha256", "plain-secret").update(expectedPayload).digest("hex");

    expect(deliverySeedUpsert).toHaveBeenCalledWith(
      [
        {
          outbound_event_id: "evt_1",
          organization_id: "org_1",
          subscription_id: "sub_1",
        },
      ],
      { onConflict: "outbound_event_id,subscription_id", ignoreDuplicates: true }
    );
    expect(safeFetch).toHaveBeenCalledWith(
      "https://example.com/hooks",
      expect.objectContaining({
        method: "POST",
        body: expectedPayload,
      })
    );
    const [, init] = safeFetch.mock.calls[0] ?? [];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["x-oblixa-signature"]).toBe(expectedSignature);
    expect(headers["x-oblixa-event"]).toBe("contract.updated");
    expect(headers["x-oblixa-schema-version"]).toBe("v2");
    expect(webhookSecretEq).toHaveBeenCalledWith("id", "sub_1");
    expect(deliveryPatchUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: "del_1",
          delivered: true,
          attempt_count: 1,
        }),
      ],
      { onConflict: "id", ignoreDuplicates: false }
    );
  });
});

describe("POST /api/webhooks/dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("returns 503 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await import("@/app/api/webhooks/dispatch/route");
    const req = new Request("http://localhost:3000/api/webhooks/dispatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "replay_event", eventId: "evt_1" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });

  it("returns 400 for unsupported actions even when authorized", async () => {
    process.env.CRON_SECRET = "secret";
    const { POST } = await import("@/app/api/webhooks/dispatch/route");
    const req = new Request("http://localhost:3000/api/webhooks/dispatch", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer secret",
      },
      body: JSON.stringify({ action: "bad_action" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Unsupported action" });
  });
});

