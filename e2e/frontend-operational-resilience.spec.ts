import { test, expect } from "@playwright/test";
import { surfaceTestIds } from "@/lib/qa/test-ids";

const statusPayload = (overrides: Record<string, unknown> = {}) => ({
  externalAction: {
    action_type: "structured_request_response",
    status: "open",
    expired: false,
    requires_passcode: false,
    submitTicket: "frontend-resilience-ticket",
    ...overrides,
  },
});

test.describe("@resilience frontend operational recovery", () => {
  test("offline status read keeps a visible retry path and reloads the form", async ({ page }) => {
    let statusCalls = 0;
    await page.route("**/api/external-actions/frontend-resilience-retry/status", async (route) => {
      statusCalls += 1;
      if (statusCalls === 1) {
        await route.abort("internetdisconnected");
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statusPayload()),
      });
    });

    await page.goto("/external/frontend-resilience-retry", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(surfaceTestIds.externalSubmitLoadError)).toBeVisible({ timeout: 20_000 });

    await page.getByTestId(surfaceTestIds.externalSubmitRetryButton).click();
    await expect(page.getByTestId(surfaceTestIds.externalSubmitForm)).toBeVisible({ timeout: 20_000 });
    expect(statusCalls).toBeGreaterThanOrEqual(2);
  });

  test("refetches status on focus without losing typed input", async ({ page }) => {
    let statusCalls = 0;
    await page.route("**/api/external-actions/frontend-resilience-focus/status", async (route) => {
      statusCalls += 1;
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          statusPayload(statusCalls > 1 ? { correction_message: "Status refreshed after focus." } : {})
        ),
      });
    });

    await page.goto("/external/frontend-resilience-focus", { waitUntil: "domcontentloaded" });
    const response = page.getByLabel("Your response");
    await expect(response).toBeVisible({ timeout: 20_000 });
    await response.fill("Typed response survives a focus refetch.");

    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(() => statusCalls).toBeGreaterThanOrEqual(2);
    await expect(response).toHaveValue("Typed response survives a focus refetch.");
    await expect(page.getByText("Status refreshed after focus.")).toBeVisible();
  });

  test("prevents duplicate submit while surfacing conflict recovery copy", async ({ page }) => {
    await page.route("**/api/external-actions/frontend-resilience-conflict/status", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statusPayload()),
      });
    });

    let submitCalls = 0;
    let releaseSubmit!: () => void;
    const submitGate = new Promise<void>((resolve) => {
      releaseSubmit = resolve;
    });
    await page.route("**/api/external-actions/frontend-resilience-conflict/submit", async (route) => {
      submitCalls += 1;
      await submitGate;
      await route.fulfill({
        status: 409,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Conflict: refresh before trying again." }),
      });
    });

    await page.goto("/external/frontend-resilience-conflict", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Your response").fill("One response only.");
    const submit = page.getByRole("button", { name: "Submit" });
    await submit.click();
    await expect(submit).toBeDisabled();
    await submit.evaluate((button) => (button as HTMLButtonElement).click());
    expect(submitCalls).toBe(1);

    releaseSubmit();
    await expect(page.locator(".ui-alert-error")).toContainText(/refresh before trying again/i, { timeout: 20_000 });
  });

  test("zoomed public shell has no horizontal overflow", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "html { font-size: 20px; }" });

    const horizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });

    expect(horizontalOverflow).toBeLessThanOrEqual(8);
  });
});
