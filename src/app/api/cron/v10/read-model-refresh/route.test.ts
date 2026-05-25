import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const rateLimitCheck = vi.fn();
const pingCronHealthcheck = vi.fn();
const refreshV10ReadModelsForOrganization = vi.fn();
const recordV10AuditEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimitCheck,
  };
});

vi.mock("@/lib/observability/cron-healthcheck", () => ({
  pingCronHealthcheck,
}));

vi.mock("@/lib/read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization,
}));

vi.mock("@/lib/server-contracts", () => ({
  recordV10AuditEvent,
}));

function makeAdmin(rows = [{ id: "org_1" }, { id: "org_2" }]) {
  return {
    from(table: string) {
      expect(table).toBe("organizations");
      return {
        select: () => {
          const query = {
            gt: () => query,
            order: () => query,
            limit: async () => ({ data: rows, error: null }),
          };
          return query;
        },
      };
    },
  };
}

describe("GET /api/cron/v10/read-model-refresh", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = "cronsecret";
    createAdminClient.mockReset();
    rateLimitCheck.mockReset();
    pingCronHealthcheck.mockReset();
    refreshV10ReadModelsForOrganization.mockReset();
    recordV10AuditEvent.mockReset();
    createAdminClient.mockResolvedValue(makeAdmin());
    rateLimitCheck.mockResolvedValue({ ok: true });
    refreshV10ReadModelsForOrganization.mockResolvedValue({
      ok: true,
      failures: [],
      diagnostics: { refresh_job_id: "refresh_1", model_freshness_state: "fresh" },
    });
    recordV10AuditEvent.mockResolvedValue("audit_1");
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("refreshes each distinct organization and records system audit evidence", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://oblixa.test/api/cron/v10/read-model-refresh?limit=10", {
        headers: { Authorization: "Bearer cronsecret" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toMatchObject({ ok: true, scanned_organizations: 2 });
    expect(refreshV10ReadModelsForOrganization).toHaveBeenCalledTimes(2);
    expect(refreshV10ReadModelsForOrganization).toHaveBeenCalledWith(
      expect.anything(),
      "org_1",
      expect.objectContaining({ reason: "scheduled_v10_read_model_refresh", refreshScope: "full" })
    );
    expect(recordV10AuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: "org_1",
        actorType: "system",
        action: "v10_read_models.scheduled_refresh",
      })
    );
  });

  it("surfaces partial refresh diagnostics without hiding completed organizations", async () => {
    refreshV10ReadModelsForOrganization
      .mockResolvedValueOnce({
        ok: true,
        failures: [],
        diagnostics: { refresh_job_id: "refresh_1", model_freshness_state: "fresh" },
      })
      .mockResolvedValueOnce({
        ok: false,
        failures: ["contract_tasks failed"],
        diagnostics: { refresh_job_id: "refresh_2", model_freshness_state: "partial" },
      });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://oblixa.test/api/cron/v10/read-model-refresh", {
        headers: { Authorization: "Bearer cronsecret" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(207);
    expect(body.ok).toBe(false);
    expect(body.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ organization_id: "org_2", ok: false, drift_state: "partial", failure_count: 1 }),
      ])
    );
    expect(pingCronHealthcheck).toHaveBeenCalledWith(
      "cron/v10/read-model-refresh",
      expect.objectContaining({ ok: false, status: 207, reason: "partial" })
    );
  });

  it("runs operator repair scope through the same audited refresh path", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://oblixa.test/api/cron/v10/read-model-refresh?scope=repair&limit=1", {
        headers: { Authorization: "Bearer cronsecret" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, refresh_scope: "repair" });
    expect(refreshV10ReadModelsForOrganization).toHaveBeenCalledWith(
      expect.anything(),
      "org_1",
      expect.objectContaining({ reason: "operator_v10_read_model_repair", refreshScope: "repair" })
    );
    expect(recordV10AuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        safeMetadata: expect.objectContaining({ refresh_scope: "repair" }),
      })
    );
  });

  it("passes scoped repair options through for one-contract and one-model refreshes", async () => {
    const recentChangedSince = new Date(Date.now() - 7 * 86_400_000).toISOString();
    refreshV10ReadModelsForOrganization.mockResolvedValue({
      ok: true,
      failures: [],
      diagnostics: {
        refresh_job_id: "refresh_scoped",
        model_freshness_state: "fresh",
        selected_model_keys: ["work_items"],
        scoped_contract_id: "contract_123",
        changed_since: recentChangedSince,
      },
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request(
        `https://oblixa.test/api/cron/v10/read-model-refresh?scope=one_contract&contract_id=contract_123&model_keys=work_items,unknown&changed_since=${encodeURIComponent(recentChangedSince)}&reason=operator_scoped_repair`,
        {
          headers: { Authorization: "Bearer cronsecret" },
        }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results[0]).toMatchObject({
      refresh_scope: "one_contract",
      selected_model_keys: ["work_items"],
      scoped_contract_id: "contract_123",
      changed_since: recentChangedSince,
    });
    expect(refreshV10ReadModelsForOrganization).toHaveBeenCalledWith(
      expect.anything(),
      "org_1",
      expect.objectContaining({
        reason: "operator_scoped_repair",
        refreshScope: "one_contract",
        contractId: "contract_123",
        modelKeys: ["work_items"],
        changedSince: new Date(recentChangedSince),
      })
    );
    expect(recordV10AuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        safeMetadata: expect.objectContaining({
          selected_model_keys: ["work_items"],
          scoped_contract_id: "contract_123",
          changed_since: recentChangedSince,
        }),
      })
    );
  });

  it("rejects malformed changed_since timestamps before refreshing read models", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://oblixa.test/api/cron/v10/read-model-refresh?changed_since=2026-04-25", {
        headers: { Authorization: "Bearer cronsecret" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      code: "invalid_changed_since",
      diagnostic_id: "v10_read_model_refresh_changed_since_invalid",
    });
    expect(refreshV10ReadModelsForOrganization).not.toHaveBeenCalled();
  });

  it("isolates unhandled organization refresh failures and keeps scanning", async () => {
    refreshV10ReadModelsForOrganization
      .mockRejectedValueOnce(new Error("private provider failure"))
      .mockResolvedValueOnce({
        ok: true,
        failures: [],
        diagnostics: { refresh_job_id: "refresh_2", model_freshness_state: "fresh" },
      });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://oblixa.test/api/cron/v10/read-model-refresh", {
        headers: { Authorization: "Bearer cronsecret" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(207);
    expect(body.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          organization_id: "org_1",
          ok: false,
          refresh_job_id: null,
          drift_state: "failed",
          failure_count: 1,
        }),
        expect.objectContaining({ organization_id: "org_2", ok: true }),
      ])
    );
    expect(recordV10AuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: "org_1",
        diagnosticId: "v10_read_model_refresh_unhandled_error",
        safeMetadata: expect.objectContaining({ error_class: "Error" }),
      })
    );
  });
});
