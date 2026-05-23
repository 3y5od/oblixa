import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.hoisted(() => vi.fn());
const rateLimitCheck = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
const pingCronHealthcheck = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    rateLimitCheck,
  };
});

vi.mock("@/lib/observability/cron-healthcheck", () => ({
  pingCronHealthcheck,
}));

describe("GET /api/cron/security/retention-cleanup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cronsecret";
  });

  it("runs the code-owned transient cleanup RPC through the shared cron wrapper", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        import_rows_redacted: 2,
        oauth_states_deleted: 1,
      },
      error: null,
    }));
    createAdminClient.mockResolvedValueOnce({ rpc } as never);
    const { GET } = await import("@/app/api/cron/security/retention-cleanup/route");

    const response = await GET(
      new Request("https://oblixa.test/api/cron/security/retention-cleanup", {
        headers: { Authorization: "Bearer cronsecret" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(rpc).toHaveBeenCalledWith("cleanup_code_owned_transient_data", {
      retention_cutoff: expect.any(String),
    });
    expect(body).toMatchObject({
      ok: true,
      policy_count: 7,
      cleanup_counts: {
        import_rows_redacted: 2,
        oauth_states_deleted: 1,
      },
    });
  });

  it("fails closed when retention cleanup cannot run", async () => {
    createAdminClient.mockResolvedValueOnce({
      rpc: vi.fn(async () => ({ data: null, error: { message: "boom" } })),
    } as never);
    const { GET } = await import("@/app/api/cron/security/retention-cleanup/route");

    const response = await GET(
      new Request("https://oblixa.test/api/cron/security/retention-cleanup", {
        headers: { Authorization: "Bearer cronsecret" },
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      diagnostic_id: "security_retention_cleanup_failed",
    });
    expect(pingCronHealthcheck).toHaveBeenCalledWith(
      "cron/security/retention-cleanup",
      expect.objectContaining({ ok: false, reason: "cleanup_failed" })
    );
  });
});
