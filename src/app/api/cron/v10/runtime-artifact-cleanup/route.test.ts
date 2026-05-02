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

describe("GET /api/cron/v10/runtime-artifact-cleanup", () => {
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

  it("calls the service-role cleanup RPCs and returns archived counts", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: 3, error: null })
      .mockResolvedValueOnce({ data: 2, error: null });
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
    });
    createAdminClient.mockResolvedValue({ rpc, from });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://oblixa.test/api/cron/v10/runtime-artifact-cleanup", {
        headers: { Authorization: "Bearer cronsecret" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toMatchObject({
      ok: true,
      archived_count: 3,
      refresh_jobs_deleted_count: 2,
      legal_hold_profile_count: 1,
    });
    expect(rpc).toHaveBeenCalledWith(
      "cleanup_expired_v10_runtime_artifacts",
      expect.objectContaining({ retention_cutoff: expect.any(String) })
    );
    expect(rpc).toHaveBeenCalledWith(
      "cleanup_old_v10_read_model_refresh_jobs",
      expect.objectContaining({ retention_cutoff: expect.any(String) })
    );
  });

  it("fails closed when cleanup cannot run", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "rpc failed" } });
    createAdminClient.mockResolvedValue({ rpc });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://oblixa.test/api/cron/v10/runtime-artifact-cleanup", {
        headers: { Authorization: "Bearer cronsecret" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      error: "V10 runtime artifact cleanup failed",
      diagnostic_id: "v10_runtime_artifact_cleanup_failed",
    });
    expect(pingCronHealthcheck).toHaveBeenCalledWith(
      "cron/v10/runtime-artifact-cleanup",
      expect.objectContaining({ ok: false, status: 500, reason: "cleanup_failed" })
    );
  });

  it("returns 401 when the cron secret is not accepted", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("https://oblixa.test/api/cron/v10/runtime-artifact-cleanup"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
});
