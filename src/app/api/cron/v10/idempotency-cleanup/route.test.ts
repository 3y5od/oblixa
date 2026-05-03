import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const rateLimitCheck = vi.fn();
const pingCronHealthcheck = vi.fn();

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

describe("GET /api/cron/v10/idempotency-cleanup", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = "cronsecret";
    createAdminClient.mockReset();
    rateLimitCheck.mockReset();
    pingCronHealthcheck.mockReset();
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("calls the service-role cleanup RPC and returns deleted counts", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 7, error: null });
    createAdminClient.mockResolvedValue({ rpc });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://oblixa.test/api/cron/v10/idempotency-cleanup", {
        headers: { Authorization: "Bearer cronsecret" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toMatchObject({ ok: true, deleted_count: 7 });
    expect(rpc).toHaveBeenCalledWith(
      "cleanup_expired_v10_mutation_idempotency",
      expect.objectContaining({ retention_cutoff: expect.any(String) })
    );
  });

  it("fails closed when cleanup cannot run", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "rpc failed" } });
    createAdminClient.mockResolvedValue({ rpc });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://oblixa.test/api/cron/v10/idempotency-cleanup", {
        headers: { Authorization: "Bearer cronsecret" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      error: "V10 idempotency cleanup failed",
      diagnostic_id: "v10_idempotency_cleanup_failed",
    });
    expect(pingCronHealthcheck).toHaveBeenCalledWith(
      "cron/v10/idempotency-cleanup",
      expect.objectContaining({ ok: false, status: 500, reason: "cleanup_failed" })
    );
  });

  it("returns 401 when the cron secret is not accepted", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("https://oblixa.test/api/cron/v10/idempotency-cleanup"));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "Unauthorized", code: "cron_unauthorized" });
  });
});
