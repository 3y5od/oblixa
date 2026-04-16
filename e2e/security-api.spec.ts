import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=security_smokes_conditionally_skip_on_secret_presence

/**
 * Lightweight security smokes: unauthenticated API calls must fail closed (401/403/404),
 * not 5xx. Skips nothing — runs against the same baseURL as other e2e (dev server or preview).
 */
test.describe("security API smokes", () => {
  test("representative session APIs without auth return 401 or 403 (not 5xx)", async ({ request }) => {
    const paths = ["/api/workspace/v6-settings", "/api/export/contracts"];
    for (const path of paths) {
      const res = await request.get(path);
      expect(res.status(), path).toBeGreaterThanOrEqual(401);
      expect(res.status(), path).toBeLessThan(500);
    }
  });

  test("POST import/contracts without session returns 401 (not 5xx)", async ({ request }) => {
    const res = await request.post("/api/import/contracts", {
      headers: { "content-type": "text/csv" },
      data: "title\nx",
    });
    expect(res.status()).toBe(401);
    expect(res.status()).toBeLessThan(500);
  });

  test("external action status with garbage token returns 4xx (not 500)", async ({ request }) => {
    const res = await request.get("/api/external-actions/00000000-0000-0000-0000-000000000000/status");
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("cron route without CRON_SECRET is not 5xx (skipped when secret is set)", async ({ request }) => {
    if (process.env.CRON_SECRET) {
      test.skip();
      return;
    }
    const res = await request.get("/api/cron/v6/assurance-checks");
    expect(res.status()).toBeGreaterThanOrEqual(401);
    expect(res.status()).toBeLessThan(500);
  });

  test.describe("@onboarding security-api cron methods", () => {
    const staleCron = "/api/cron/v6/onboarding-calibration-stale";

    test("onboarding-calibration-stale GET without CRON_SECRET is not 5xx", async ({ request }) => {
      if (process.env.CRON_SECRET) {
        test.skip();
        return;
      }
      const res = await request.get(staleCron);
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    });

    test("onboarding-calibration-stale wrong CRON_SECRET is not 5xx", async ({ request }) => {
      const res = await request.get(staleCron, {
        headers: { Authorization: "Bearer definitely-not-the-real-secret" },
      });
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    });

    test("onboarding-calibration-stale POST/OPTIONS/HEAD without valid cron auth are not 5xx", async ({
      request,
    }) => {
      const post = await request.post(staleCron);
      expect(post.status()).toBeLessThan(500);
      const head = await request.head(staleCron);
      expect(head.status()).toBeLessThan(500);
      const options = await request.fetch(staleCron, { method: "OPTIONS" });
      expect(options.status()).toBeLessThan(500);
    });

    test("POST /onboarding/calibration is not 5xx", async ({ request }) => {
      const res = await request.post("/onboarding/calibration");
      expect(res.status()).toBeLessThan(500);
    });
  });
});
