// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=cron_secret_gated_header_parity_smoke
import { test, expect } from "@playwright/test";

/**
 * When CRON_SECRET and PLAYWRIGHT_BASE_URL (or config baseURL) point at a running app,
 * verifies Vercel-style Bearer and script-style x-cron-secret both authorize /api/reminders/send.
 * Skips when CRON_SECRET is unset (e.g. local dev without secrets).
 */
test.describe("cron auth header parity", () => {
  test.skip(
    !process.env.CRON_SECRET?.trim(),
    "Set CRON_SECRET to run cron bearer parity checks against the configured base URL."
  );

  test("GET /api/reminders/send accepts Authorization Bearer", async ({ request }) => {
    const res = await request.get("/api/reminders/send", {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const text = await res.text();
    expect(res.status(), text).toBe(200);
    const json = JSON.parse(text) as { candidates?: number };
    expect(json).toMatchObject({ candidates: expect.any(Number) });
  });

  test("GET /api/reminders/send accepts x-cron-secret", async ({ request }) => {
    const res = await request.get("/api/reminders/send", {
      headers: { "x-cron-secret": process.env.CRON_SECRET! },
    });
    const text = await res.text();
    expect(res.status(), text).toBe(200);
  });
});
