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
      vi.doMock("@/lib/assurance/feature-guards", () => ({
        requireV6CronFeature,
      }));
      vi.doMock("@/lib/assurance/cron", () => ({
        listOrganizationIds,
        logV6Cron,
        v6CronRunMetadata: (orgsProcessed: number, _startedAtMs: number, errorsCount = 0) => ({
          duration_ms: 1,
          orgs_processed: orgsProcessed,
          errors_count: errorsCount,
        }),
      }));
      vi.doMock("@/lib/assurance/cron-jobs", () => ({
        [input.jobExportName]: jobHandler,
      }));

      createAdminClient.mockResolvedValue({});
      rateLimitCheck.mockResolvedValue({ ok: true });
      requireV6CronFeature.mockReturnValue(null);
      listOrganizationIds.mockResolvedValue({
        orgIds: input.orgIds ?? ["org-a"],
        error: null,
        stoppedByOffsetCap: false,
        nextOffset: null,
      });
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

    it("returns 207 with structured error details when the job degrades", async () => {
      jobHandler.mockResolvedValueOnce({
        ...input.jobResult,
        orgsSucceeded: 0,
        orgsFailed: 1,
        orgsSkipped: 0,
        errors: [
          {
            scope: `${(input.orgIds ?? ["org-a"])[0]}`,
            phase: "source_query",
            diagnostic_id: "v6_cron_job_failed",
            message: "job failed",
          },
        ],
      });

      const { GET } = await import(input.routeImportPath);
      const response = await GET(
        new Request(`https://oblixa.test${input.route}`, {
          headers: { Authorization: "Bearer cronsecret" },
        })
      );
      const body = await response.json();

      expect(response.status).toBe(207);
      expect(body).toMatchObject({
        ok: false,
        partial: true,
        phase: "source_query",
        errors_count: 1,
        error_details: [expect.objectContaining({ diagnostic_id: "v6_cron_job_failed" })],
      });
    });

    it("returns a typed failure when organization discovery fails", async () => {
      listOrganizationIds.mockResolvedValueOnce({
        orgIds: [],
        error: { message: "organizations query failed" },
        stoppedByOffsetCap: false,
        nextOffset: 0,
      });

      const { GET } = await import(input.routeImportPath);
      const response = await GET(
        new Request(`https://oblixa.test${input.route}`, {
          headers: { Authorization: "Bearer cronsecret" },
        })
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toMatchObject({
        ok: false,
        code: "v6_cron_organization_query_failed",
        diagnostic_id: "v6_cron_organization_query_failed",
        phase: "source_query",
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