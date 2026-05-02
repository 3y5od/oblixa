import { test, expect } from "@playwright/test";

/** Aligns with check:cron-route-auth — unauthenticated cron must not succeed. */
const CRON_PATH = "/api/cron/v10/read-model-refresh";

test.describe("cron route auth smoke", () => {
  test("rejects request without cron credentials", async ({ request }) => {
    const res = await request.get(CRON_PATH);
    expect([401, 403]).toContain(res.status());
  });

  test("rejects wrong bearer secret", async ({ request }) => {
    const res = await request.get(CRON_PATH, {
      headers: { Authorization: "Bearer not-the-real-cron-secret" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("rejects wrong x-cron-secret header", async ({ request }) => {
    const res = await request.get(CRON_PATH, {
      headers: { "x-cron-secret": "wrong" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("rejects replay-style POST without valid cron credentials", async ({ request }) => {
    const res = await request.post(CRON_PATH, {
      data: { ping: 1 },
      headers: { "content-type": "application/json" },
    });
    expect([401, 403, 404, 405]).toContain(res.status());
  });
});
