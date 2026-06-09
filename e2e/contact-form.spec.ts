import { test, expect } from "./fixtures/app-fixture";

/**
 * Guards against /api/contact regressions:
 * - the marketing /request-access page renders the access request form,
 * - submitting valid data hits the POST endpoint without 4xx/5xx,
 * - the success state replaces the form.
 *
 * The route returns 204 when RESEND_API_KEY / CONTACT_NOTIFY_EMAIL are
 * unconfigured (it logs and short-circuits), so the test works in CI.
 */
test.describe("public contact form", () => {
  const appOrigin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

  test("renders, submits to /api/contact, and shows the success state", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "203.0.113.201" });
    await page.goto("/request-access", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^request access\.?$/i })).toBeVisible();

    await page.getByLabel(/^name$/i).fill("Test Submitter");
    await page.getByLabel(/work email/i).fill("test-submitter@example.com");
    await page.getByLabel(/company/i).fill("Acme Co");
    // "Role" label now carries an inline example hint, so match the start of
    // the accessible name rather than the exact string.
    await page.getByLabel(/^role/i).fill("COO");
    // Custom comboboxes (portaled listbox) now replace the native <select>s, so
    // drive them by opening the trigger and clicking the option. Target the
    // trigger by button role (the open listbox shares the field label via
    // aria-labelledby, so getByLabel would be ambiguous). The first click can
    // also land before the marketing page hydrates (native inputs fill without
    // JS), so retry the open if the listbox has not appeared yet.
    const pick = async (nameRe: RegExp, optionName: string) => {
      const trigger = page.getByRole("button", { name: nameRe });
      const option = page.getByRole("option", { name: optionName, exact: true });
      await trigger.click();
      try {
        await option.waitFor({ state: "visible", timeout: 2000 });
      } catch {
        await trigger.click();
        await option.waitFor({ state: "visible", timeout: 5000 });
      }
      await option.click();
    };
    await pick(/approx\. signed contracts/i, "50-200");
    await pick(/how tracked today/i, "Spreadsheet");
    // The yes/no answers are segmented radio groups (fieldset + legend), so
    // pick the radio by its group's accessible name rather than a combobox.
    const chooseSegment = async (groupName: RegExp, optionName: string) => {
      await page
        .getByRole("group", { name: groupName })
        .getByRole("radio", { name: optionName, exact: true })
        .check();
    };
    await chooseSegment(/current tracker available/i, "Yes");
    await chooseSegment(/can start with a small first set/i, "Yes");
    await chooseSegment(/can share a redacted sample/i, "Yes");
    await page.getByLabel(/main tracking pain/i).fill("Renewals and owner follow-up live in one shared tracker.");
    await pick(/accountable workspace owner/i, "I can be the owner");
    await pick(/follow-up preference/i, "Async questions first");

    const submit = page.getByRole("button", { name: /request access/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByText(/request received/i)).toBeVisible({ timeout: 10_000 });
  });

  test("rejects malformed POST /api/contact bodies with 4xx", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: { name: "missing fields" },
      headers: { "content-type": "application/json", origin: appOrigin, "x-forwarded-for": "203.0.113.202" },
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
        contracts: "under_20",
        interested: "request_access",
        trackingMethod: "spreadsheet",
        hasTracker: "yes",
        redactedSample: "unsure",
        preference: "async",
        pain: "spam",
        website: "https://spammer.example/affiliate",
      },
      headers: { "content-type": "application/json", origin: appOrigin, "x-forwarded-for": "203.0.113.203" },
    });
    expect(res.status()).toBe(204);
  });
});
