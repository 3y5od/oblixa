import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type V6CronShellCase = {
  route: string;
  routeImportPath: string;
  jobExportName: string;
  jobResult: Record<string, unknown>;
  expectedBody: Record<string, unknown>;
  orgIds?: string[];
};

export function exerciseV6CronRouteShell(input: V6CronShellCase) {
  describe(`GET ${input.route}`, () => {
    const createAdminClient = vi.fn();
    const rateLimitCheck = vi.fn();
    const requireV6CronFeature = vi.fn();
    const listOrganizationIds = vi.fn();
    const logV6Cron = vi.fn();
    const jobHandler = vi.fn();
    const originalCronSecret = process.env.CRON_SECRET;

    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
      process.env.CRON_SECRET = "cronsecret";

      vi.doMock("@/lib/supabase/server", () => ({
        createAdminClient,
      }));
      vi.doMock("@/lib/rate-limit", async (importOriginal) => {
        const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
        return {
          ...actual,
          rateLimitCheck,
        };
      });
      vi.doMock("@/lib/v6/feature-guards", () => ({
        requireV6CronFeature,
      }));
      vi.doMock("@/lib/v6/cron", () => ({
        listOrganizationIds,
        logV6Cron,
        v6CronRunMetadata: (orgsProcessed: number, _startedAtMs: number, errorsCount = 0) => ({
          duration_ms: 1,
          orgs_processed: orgsProcessed,
          errors_count: errorsCount,
        }),
      }));
      vi.doMock("@/lib/v6/cron-jobs", () => ({
        [input.jobExportName]: jobHandler,
      }));

      createAdminClient.mockResolvedValue({});
      rateLimitCheck.mockResolvedValue({ ok: true });
      requireV6CronFeature.mockReturnValue(null);
      listOrganizationIds.mockResolvedValue(input.orgIds ?? ["org-a"]);
      jobHandler.mockResolvedValue(input.jobResult);
    });

    afterEach(() => {
      if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = originalCronSecret;
    });

    it("returns the expected JSON shape on success", async () => {
      const { GET } = await import(input.routeImportPath);
      const response = await GET(
        new Request(`https://oblixa.test${input.route}`, {
          headers: { Authorization: "Bearer cronsecret" },
        })
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(body).toMatchObject({
        ok: true,
        route: input.route,
        ...input.expectedBody,
        orgs_processed: (input.orgIds ?? ["org-a"]).length,
      });
    });

    it("returns a typed skip payload when the feature is disabled", async () => {
      requireV6CronFeature.mockReturnValueOnce(
        new Response(JSON.stringify({ ok: true, skipped: true, reason: "feature_disabled" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }) as never
      );

      const { GET } = await import(input.routeImportPath);
      const response = await GET(
        new Request(`https://oblixa.test${input.route}`, {
          headers: { Authorization: "Bearer cronsecret" },
        })
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(body).toMatchObject({ ok: true, skipped: true, reason: "feature_disabled" });
    });
  });
}