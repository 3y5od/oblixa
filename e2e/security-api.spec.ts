import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=security_smokes_conditionally_skip_on_secret_presence

const UNAUTHENTICATED_PRIVATE_API_READS = [
  "/api/workspace/v6-settings",
  "/api/export/contracts",
  "/api/campaigns",
  "/api/decisions",
  "/api/assurance/findings",
  "/api/events",
] as const;

const CRON_FAIL_CLOSED_STATUSES = [401, 403, 404, 405, 503] as const;
const CRON_PREFLIGHT_SAFE_STATUSES = [204, ...CRON_FAIL_CLOSED_STATUSES] as const;

function expectPrivateApiDenied(status: number, label: string) {
  expect(status, label).toBeGreaterThanOrEqual(400);
  expect(status, label).toBeLessThan(500);
}

function expectCronFailClosed(status: number, label: string) {
  expect(CRON_FAIL_CLOSED_STATUSES, label).toContain(status);
}

function expectCronPreflightSafe(status: number, label: string) {
  expect(CRON_PREFLIGHT_SAFE_STATUSES, label).toContain(status);
}

/**
 * Lightweight security smokes: unauthenticated API calls must fail closed. Cron probes
 * also accept 503 when the local runtime is intentionally missing CRON_SECRET.
 */
test.describe("security API smokes", () => {
  test("representative private API reads without auth fail closed", async ({ request }) => {
    for (const path of UNAUTHENTICATED_PRIVATE_API_READS) {
      const res = await request.get(path);
      expectPrivateApiDenied(res.status(), path);
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

  test("POST /api/extract without session returns 401 (not 5xx)", async ({ request }) => {
    const res = await request.post("/api/extract", {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ contractId: "00000000-0000-0000-0000-000000000000" }),
    });
    expect(res.status()).toBe(401);
    expect(res.status()).toBeLessThan(500);
  });

  test("external action status with garbage token returns 4xx (not 500)", async ({ request }) => {
    const res = await request.get("/api/external-actions/00000000-0000-0000-0000-000000000000/status");
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("cron route without credentials fails closed", async ({ request }) => {
    const res = await request.get("/api/cron/v6/assurance-checks");
    expectCronFailClosed(res.status(), "/api/cron/v6/assurance-checks");
  });

  test.describe("@onboarding security-api cron methods", () => {
    const staleCron = "/api/cron/v6/onboarding-calibration-stale";

    test("onboarding-calibration-stale GET without credentials fails closed", async ({ request }) => {
      const res = await request.get(staleCron);
      expectCronFailClosed(res.status(), `${staleCron} GET no credentials`);
    });

    test("onboarding-calibration-stale wrong CRON_SECRET fails closed", async ({ request }) => {
      const res = await request.get(staleCron, {
        headers: { Authorization: "Bearer definitely-not-the-real-secret" },
      });
      expectCronFailClosed(res.status(), `${staleCron} GET wrong credentials`);
    });

    test("onboarding-calibration-stale POST/OPTIONS/HEAD without valid cron auth do not execute", async ({
      request,
    }) => {
      const post = await request.post(staleCron);
      expectCronFailClosed(post.status(), `${staleCron} POST no credentials`);
      const head = await request.head(staleCron);
      expectCronFailClosed(head.status(), `${staleCron} HEAD no credentials`);
      const options = await request.fetch(staleCron, { method: "OPTIONS" });
      expectCronPreflightSafe(options.status(), `${staleCron} OPTIONS no credentials`);
    });

    test("POST /onboarding/calibration is not 5xx", async ({ request }) => {
      const res = await request.post("/onboarding/calibration");
      expect(res.status()).toBeLessThan(500);
    });
  });
});
