import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.hoisted(() => vi.fn());
const rateLimitCheck = vi.hoisted(() => vi.fn<typeof import("@/lib/rate-limit").rateLimitCheck>());
const buildOrganizationCalendarIcs = vi.hoisted(() => vi.fn());
const validateOutboundHttpUrl = vi.hoisted(() => vi.fn());
const safeFetch = vi.hoisted(() => vi.fn());
const enqueueOutboundEvent = vi.hoisted(() => vi.fn());
const pingCronHealthcheck = vi.hoisted(() => vi.fn());
const forEachSupabaseRangePage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return { ...actual, rateLimitCheck };
});

vi.mock("@/lib/integrations/calendar", () => ({
  buildOrganizationCalendarIcs,
}));

vi.mock("@/lib/security/url-policy", () => ({
  validateOutboundHttpUrl,
}));

vi.mock("@/lib/security/safe-fetch", () => ({
  safeFetch,
}));

vi.mock("@/lib/integrations/events", () => ({
  enqueueOutboundEvent,
}));

vi.mock("@/lib/observability/cron-healthcheck", () => ({
  pingCronHealthcheck,
}));

vi.mock("@/lib/supabase/range-pagination", () => ({
  forEachSupabaseRangePage,
}));

function createCalendarAdmin(rows: Array<Record<string, unknown>>) {
  const integrationUpdateEq = vi.fn(async () => ({ error: null }));
  const auditInsert = vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null }));
  return {
    admin: {
      from: vi.fn((table: string) => {
        if (table === "integration_connections") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                limit: vi.fn(async () => ({ data: rows })),
              })),
            })),
            update: vi.fn(() => ({ eq: integrationUpdateEq })),
          };
        }
        if (table === "audit_events") {
          return { insert: auditInsert };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    },
    auditInsert,
  };
}

describe("GET /api/integrations/calendar/sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cronsecret";
    rateLimitCheck.mockResolvedValue({ ok: true });
    buildOrganizationCalendarIcs.mockResolvedValue("BEGIN:VCALENDAR\r\nEND:VCALENDAR");
    validateOutboundHttpUrl.mockImplementation((url: string) => new URL(url));
    safeFetch.mockResolvedValue(new Response("ok", { status: 200 }));
    enqueueOutboundEvent.mockResolvedValue(true);
    forEachSupabaseRangePage.mockImplementation(async (_fetchPage, consume) => {
      await consume([]);
      return { error: null, stoppedByOffsetCap: false, rowsSeen: 0, nextOffset: null };
    });
    const { admin } = createCalendarAdmin([]);
    createAdminClient.mockResolvedValue(admin as never);
  });

  it("returns 401 when auth header is missing", async () => {
    const { GET } = await import("@/app/api/integrations/calendar/sync/route");
    const req = new Request("http://localhost:3000/api/integrations/calendar/sync");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 503 when cron auth env is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/integrations/calendar/sync/route");
    const req = new Request("http://localhost:3000/api/integrations/calendar/sync");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });

  it("sends a schema-compatible calendar payload and records sync_ok metadata", async () => {
    const row = {
      id: "conn_1",
      organization_id: "org_1",
      provider: "google_calendar",
      status: "connected",
      config_json: {
        pushUrl: "https://calendar.example.com/push",
        authHeader: "Bearer calendar-token",
        timeoutMs: 5000,
        includeReminders: false,
        includeObligations: true,
        includeRenewalCheckpoints: false,
        includeRenewalDecisions: true,
      },
    };
    const { admin, auditInsert } = createCalendarAdmin([row]);
    createAdminClient.mockResolvedValue(admin as never);
    forEachSupabaseRangePage.mockImplementationOnce(async (_fetchPage, consume) => {
      await consume([row]);
      return { error: null, stoppedByOffsetCap: false, rowsSeen: 1, nextOffset: null };
    });

    const { GET } = await import("@/app/api/integrations/calendar/sync/route");
    const res = await GET(
      new Request("http://localhost:3000/api/integrations/calendar/sync", {
        headers: { authorization: "Bearer cronsecret" },
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      route: "/api/integrations/calendar/sync",
      scanned: 1,
      attempted: 1,
      updated: 1,
      failed: 0,
    });
    expect(buildOrganizationCalendarIcs).toHaveBeenCalledWith(
      admin,
      "org_1",
      expect.objectContaining({
        includeReminders: false,
        includeObligations: true,
        includeRenewalCheckpoints: false,
        includeRenewalDecisions: true,
      })
    );
    expect(safeFetch).toHaveBeenCalledWith(
      "https://calendar.example.com/push",
      expect.objectContaining({
        method: "POST",
        body: "BEGIN:VCALENDAR\r\nEND:VCALENDAR",
        timeoutMs: 5000,
        headers: expect.objectContaining({
          "Content-Type": "text/calendar; charset=utf-8",
          Authorization: "Bearer calendar-token",
        }),
      })
    );
    expect(enqueueOutboundEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        eventType: "calendar.sync_ok",
        entityType: "integration_connection",
        entityId: "conn_1",
        schemaVersion: "v1",
        payload: expect.objectContaining({ synced_at: expect.any(String) }),
      })
    );
    expect(auditInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          organization_id: "org_1",
          action: "integration.calendar_sync_run",
          details: expect.objectContaining({ scanned: 1, attempted: 1, updated: 1, failed: 0 }),
        }),
      ])
    );
  });

  it("blocks duplicate replay of calendar sync cron runs with x-idempotency-key", async () => {
    let idempotencySeen = false;
    rateLimitCheck.mockImplementation(async (key: string, config: unknown) => {
      void config;
      if (key.startsWith("idem:cron:/api/integrations/calendar/sync:cron:")) {
        if (idempotencySeen) return { ok: false, retryAfterMs: 6000 };
        idempotencySeen = true;
      }
      return { ok: true };
    });
    const row = {
      id: "conn_1",
      organization_id: "org_1",
      provider: "google_calendar",
      status: "connected",
      config_json: {
        pushUrl: "https://calendar.example.com/push",
      },
    };
    const { admin } = createCalendarAdmin([row]);
    createAdminClient.mockResolvedValue(admin as never);
    forEachSupabaseRangePage.mockImplementation(async (_fetchPage, consume) => {
      await consume([row]);
      return { error: null, stoppedByOffsetCap: false, rowsSeen: 1, nextOffset: null };
    });

    const { GET } = await import("@/app/api/integrations/calendar/sync/route");
    const buildRequest = () =>
      new Request("http://localhost:3000/api/integrations/calendar/sync", {
        headers: {
          authorization: "Bearer cronsecret",
          "x-idempotency-key": "calendar-sync-replay-0001",
        },
      });

    const first = await GET(buildRequest());
    const second = await GET(buildRequest());

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({
      error: "Duplicate request blocked by idempotency key",
      retryAfterMs: 6000,
    });
    expect(safeFetch).toHaveBeenCalledTimes(1);
  });

  it("returns 207 when audit persistence fails after calendar sync succeeds", async () => {
    const row = {
      id: "conn_1",
      organization_id: "org_1",
      provider: "google_calendar",
      status: "connected",
      config_json: { pushUrl: "https://calendar.example.com/push" },
    };
    const { admin, auditInsert } = createCalendarAdmin([row]);
    auditInsert.mockResolvedValueOnce({ error: { message: "audit failed" } });
    createAdminClient.mockResolvedValue(admin as never);
    forEachSupabaseRangePage.mockImplementationOnce(async (_fetchPage, consume) => {
      await consume([row]);
      return { error: null, stoppedByOffsetCap: false, rowsSeen: 1, nextOffset: null };
    });

    const { GET } = await import("@/app/api/integrations/calendar/sync/route");
    const res = await GET(
      new Request("http://localhost:3000/api/integrations/calendar/sync", {
        headers: { authorization: "Bearer cronsecret" },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(207);
    expect(body).toMatchObject({ partial: true, errors_count: 1 });
    expect(body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ diagnostic_id: "integrations_calendar_audit_write_failed" })])
    );
  });
});

