import { test, expect } from "./fixtures/app-fixture";

/**
 * Guards against /api/contact regressions:
 * - the marketing /contact page renders the form,
 * - submitting valid data hits the POST endpoint without 4xx/5xx,
 * - the success state replaces the form.
 *
 * The route returns 204 when RESEND_API_KEY / CONTACT_NOTIFY_EMAIL are
 * unconfigured (it logs and short-circuits), so the test works in CI.
 */
test.describe("public contact form", () => {
  test("renders, submits to /api/contact, and shows the success state", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "203.0.113.201" });
    await page.goto("/contact", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /book a setup call/i })).toBeVisible();

    await page.getByLabel(/^name$/i).fill("Test Submitter");
    await page.getByLabel(/work email/i).fill("test-submitter@example.com");
    await page.getByLabel(/company/i).fill("Acme Co");
    await page.getByLabel(/^role$/i).fill("COO");
    await page.getByLabel(/approximate number of contracts/i).selectOption("50-200");
    // Interested in defaults to "core" — leave as-is.

    const submit = page.getByRole("button", { name: /book setup call/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByText(/message received/i)).toBeVisible({ timeout: 10_000 });
  });

  test("rejects malformed POST /api/contact bodies with 4xx", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: { name: "missing fields" },
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.202" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("honeypot field silently 204s (no email sent, no error)", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: {
        name: "bot",
        email: "bot@example.com",
        company: "bot",
        role: "bot",
        contracts: "1",
        interested: "core",
        website: "https://spammer.example/affiliate",
      },
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.203" },
    });
    expect(res.status()).toBe(204);
  });
});
