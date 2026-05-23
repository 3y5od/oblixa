import { test, expect } from "@playwright/test";

/** Aligns with check:cron-route-auth — unauthenticated cron must not succeed. */
const CRON_PATHS = [
  "/api/cron/v10/read-model-refresh",
  "/api/cron/v10/idempotency-cleanup",
  "/api/cron/v6/assurance-checks",
  "/api/cron/v6/external-workflow-deadlines",
] as const;

const CRON_GET_REJECT_STATUSES = [401, 403, 503] as const;
const CRON_MUTATION_REJECT_STATUSES = [401, 403, 404, 405, 503] as const;

test.describe("cron route auth smoke", () => {
  test("rejects request without cron credentials", async ({ request }) => {
    for (const path of CRON_PATHS) {
      const res = await request.get(path);
      expect(CRON_GET_REJECT_STATUSES, path).toContain(res.status());
    }
  });

  test("rejects wrong bearer secret", async ({ request }) => {
    for (const path of CRON_PATHS) {
      const res = await request.get(path, {
        headers: { Authorization: "Bearer not-the-real-cron-secret" },
      });
      expect(CRON_GET_REJECT_STATUSES, path).toContain(res.status());
    }
  });

  test("rejects wrong x-cron-secret header", async ({ request }) => {
    for (const path of CRON_PATHS) {
      const res = await request.get(path, {
        headers: { "x-cron-secret": "wrong" },
      });
      expect(CRON_GET_REJECT_STATUSES, path).toContain(res.status());
    }
  });

  test("rejects replay-style POST without valid cron credentials", async ({ request }) => {
    for (const path of CRON_PATHS) {
      const res = await request.post(path, {
        data: { ping: 1 },
        headers: { "content-type": "application/json" },
      });
      expect(CRON_MUTATION_REJECT_STATUSES, path).toContain(res.status());
    }
  });
});
