import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.hoisted(() => vi.fn());
const rateLimitCheck = vi.hoisted(() => vi.fn<typeof import("@/lib/rate-limit").rateLimitCheck>());
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

function createCrmAdmin({
  connections,
  contracts,
  renewalScenarios,
  openExceptions,
}: {
  connections: Array<Record<string, unknown>>;
  contracts: Array<Record<string, unknown>>;
  renewalScenarios: Array<Record<string, unknown>>;
  openExceptions: Array<Record<string, unknown>>;
}) {
  const integrationUpdateEq = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  const contractUpdateEq = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  const auditInsert = vi.fn(async () => ({ error: null }));
  return {
    admin: {
      from: vi.fn((table: string) => {
        if (table === "integration_connections") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(async () => ({ data: connections })),
                })),
              })),
            })),
            update: vi.fn(() => ({ eq: integrationUpdateEq })),
          };
        }
        if (table === "contracts") {
          return {
            select: vi.fn(() => ({
              not: vi.fn(() => ({
                not: vi.fn(() => ({
                  in: vi.fn(() => ({
                    limit: vi.fn(async () => ({ data: contracts })),
                  })),
                })),
              })),
            })),
            update: vi.fn(() => ({ eq: contractUpdateEq })),
          };
        }
        if (table === "contract_renewal_scenarios") {
          return {
            select: vi.fn(() => ({ in: vi.fn(async () => ({ data: renewalScenarios })) })),
          };
        }
        if (table === "exceptions") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({ in: vi.fn(async () => ({ data: openExceptions })) })),
            })),
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

describe("GET /api/integrations/crm/sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cronsecret";
    rateLimitCheck.mockResolvedValue({ ok: true });
    validateOutboundHttpUrl.mockImplementation((url: string) => new URL(url));
    safeFetch.mockResolvedValue(new Response("ok", { status: 200 }));
    enqueueOutboundEvent.mockResolvedValue(true);
    forEachSupabaseRangePage.mockImplementation(async (_fetchPage, consume) => {
      await consume([]);
      return { error: null, stoppedByOffsetCap: false, rowsSeen: 0, nextOffset: null };
    });
    const { admin } = createCrmAdmin({ connections: [], contracts: [], renewalScenarios: [], openExceptions: [] });
    createAdminClient.mockResolvedValue(admin as never);
  });

  it("returns 401 when auth header is missing", async () => {
    const { GET } = await import("@/app/api/integrations/crm/sync/route");
    const req = new Request("http://localhost:3000/api/integrations/crm/sync");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 503 when cron auth env is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/integrations/crm/sync/route");
    const req = new Request("http://localhost:3000/api/integrations/crm/sync");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });

  it("posts an additive payload shape with schema_version v1 for CRM sync", async () => {
    const connection = {
      id: "crm_conn_1",
      organization_id: "org_1",
      status: "connected",
      config_json: {
        endpointUrl: "https://crm.example.com/sync",
        authHeader: "Bearer crm-token",
        timeoutMs: 4000,
      },
    };
    const contract = {
      id: "contract_1",
      organization_id: "org_1",
      title: "MSA",
      counterparty: "Vendor Inc",
      contract_type: "msa",
      status: "active",
      health_status: "green",
      required_next_step: "review",
      annual_value: 1000,
      external_reference_id: "ext-1",
      source_system: "salesforce",
      region: "us",
      updated_at: "2026-05-04T00:00:00.000Z",
    };
    const { admin, auditInsert } = createCrmAdmin({
      connections: [connection],
      contracts: [contract],
      renewalScenarios: [{ contract_id: "contract_1", scenario: "renew", workspace_status: "healthy" }],
      openExceptions: [{ contract_id: "contract_1", severity: "critical" }],
    });
    createAdminClient.mockResolvedValue(admin as never);
    forEachSupabaseRangePage
      .mockImplementationOnce(async (_fetchPage, consume) => {
        await consume([connection]);
        return { error: null, stoppedByOffsetCap: false, rowsSeen: 1, nextOffset: null };
      })
      .mockImplementationOnce(async (_fetchPage, consume) => {
        await consume([contract]);
        return { error: null, stoppedByOffsetCap: false, rowsSeen: 1, nextOffset: null };
      });

    const { GET } = await import("@/app/api/integrations/crm/sync/route");
    const res = await GET(
      new Request("http://localhost:3000/api/integrations/crm/sync", {
        headers: { authorization: "Bearer cronsecret" },
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      route: "/api/integrations/crm/sync",
      scanned: 1,
      attempted: 1,
      synced: 1,
      failed: 0,
    });
    expect(safeFetch).toHaveBeenCalledWith(
      "https://crm.example.com/sync",
      expect.objectContaining({
        method: "POST",
        timeoutMs: 4000,
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer crm-token",
        }),
      })
    );
    const sentBody = JSON.parse(String(safeFetch.mock.calls[0]?.[1]?.body ?? "{}")) as Record<string, unknown>;
    expect(sentBody).toMatchObject({
      source: "oblixa",
      event: "contract.sync",
      schema_version: "v1",
      contract: expect.objectContaining({ id: "contract_1", external_reference_id: "ext-1" }),
      renewal: expect.objectContaining({ scenario: "renew", workspace_status: "healthy" }),
      risk_signals: { openExceptions: 1, criticalExceptions: 1 },
      execution_summary: expect.objectContaining({
        health_status: "green",
        required_next_step: "review",
        status: "active",
      }),
    });
    expect(enqueueOutboundEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        eventType: "crm.sync_ok",
        entityType: "contract",
        entityId: "contract_1",
        schemaVersion: "v1",
        payload: expect.objectContaining({
          synced_at: expect.any(String),
          source_system: "salesforce",
          external_reference_id: "ext-1",
        }),
      })
    );
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org_1",
        contract_id: "contract_1",
        action: "crm.sync_ok",
        details: expect.objectContaining({ synced_at: expect.any(String) }),
      })
    );
  });

  it("blocks duplicate replay of CRM sync cron runs with x-idempotency-key", async () => {
    let idempotencySeen = false;
    rateLimitCheck.mockImplementation(async (key: string, config: unknown) => {
      void config;
      if (key.startsWith("idem:cron:/api/integrations/crm/sync:cron:")) {
        if (idempotencySeen) return { ok: false, retryAfterMs: 6000 };
        idempotencySeen = true;
      }
      return { ok: true };
    });
    const connection = {
      id: "crm_conn_1",
      organization_id: "org_1",
      status: "connected",
      config_json: {
        endpointUrl: "https://crm.example.com/sync",
      },
    };
    const contract = {
      id: "contract_1",
      organization_id: "org_1",
      title: "MSA",
      counterparty: "Vendor Inc",
      contract_type: "msa",
      status: "active",
      health_status: "green",
      required_next_step: "review",
      annual_value: 1000,
      external_reference_id: "ext-1",
      source_system: "salesforce",
      region: "us",
      updated_at: "2026-05-04T00:00:00.000Z",
    };
    const { admin } = createCrmAdmin({
      connections: [connection],
      contracts: [contract],
      renewalScenarios: [],
      openExceptions: [],
    });
    createAdminClient.mockResolvedValue(admin as never);
    forEachSupabaseRangePage
      .mockImplementationOnce(async (_fetchPage, consume) => {
        await consume([connection]);
        return { error: null, stoppedByOffsetCap: false, rowsSeen: 1, nextOffset: null };
      })
      .mockImplementationOnce(async (_fetchPage, consume) => {
        await consume([contract]);
        return { error: null, stoppedByOffsetCap: false, rowsSeen: 1, nextOffset: null };
      });

    const { GET } = await import("@/app/api/integrations/crm/sync/route");
    const buildRequest = () =>
      new Request("http://localhost:3000/api/integrations/crm/sync", {
        headers: {
          authorization: "Bearer cronsecret",
          "x-idempotency-key": "crm-sync-replay-0001",
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

  it("returns 500 when CRM connections cannot be loaded", async () => {
    forEachSupabaseRangePage.mockImplementationOnce(async () => ({
      error: { message: "boom" },
      stoppedByOffsetCap: false,
      rowsSeen: 0,
      nextOffset: 0,
    }));

    const { GET } = await import("@/app/api/integrations/crm/sync/route");
    const res = await GET(
      new Request("http://localhost:3000/api/integrations/crm/sync", {
        headers: { authorization: "Bearer cronsecret" },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toMatchObject({ diagnostic_id: "integrations_crm_connections_load_failed" });
  });
});

