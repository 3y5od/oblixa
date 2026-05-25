import { test, expect, type Page } from "@playwright/test";
import { shouldTreat404AsOptionalMatrix } from "./fixtures/surface-availability";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=workflow_smokes_are_fixture_gated

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

async function loginAsTestUser(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("input[type='email']").fill(E2E_EMAIL!);
  await page.locator("input[type='password']").fill(E2E_PASSWORD!);
  await page.locator("button[type='submit']").first().click();
  const reachedDashboard = await page
    .waitForURL(/\/dashboard/, {
      timeout: 15_000,
      waitUntil: "domcontentloaded",
    })
    .then(() => true)
    .catch(() => false);
  if (reachedDashboard) {
    return;
  }
  const rateLimited = await page
    .getByText(/too many sign-in attempts/i)
    .isVisible()
    .catch(() => false);
  if (rateLimited) {
    test.skip(true, "Auth provider rate-limited this test account.");
  }
  throw new Error("Login did not reach /dashboard and was not rate-limited.");
}

/**
 * §10 workflow depth: UI navigation plus cookie-authenticated API lifecycle
 * (create → recommend → close). Vitest covers route guards; this verifies
 * end-to-end wiring when E2E credentials and workflow flags are available.
 */
test.describe("workflow smoke", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated workflow checks."
  );

  test("operator can traverse decisions, campaigns, and reports in one session", async ({ page }) => {
    await loginAsTestUser(page);

    const steps = [
      { path: "/decisions", label: /decision workspaces/i },
      { path: "/campaigns", label: /campaign center/i },
      { path: "/reports", label: /reports and intelligence/i },
    ] as const;

    for (const { path, label } of steps) {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (resp?.status() === 404) {
        if (shouldTreat404AsOptionalMatrix(path)) {
          test.skip(true, `V5 route ${path} not mounted in this matrix (fixture).`);
          return;
        }
        throw new Error(`Unexpected 404 for ${path}`);
      }
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("heading", { name: label })).toBeVisible();
    }
  });

  test("manager review and decision compare routes load when V5 UX is on", async ({ page }) => {
    await loginAsTestUser(page);
    for (const path of ["/decisions/review", "/decisions/compare"] as const) {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (resp?.status() === 404) {
        if (shouldTreat404AsOptionalMatrix(path)) {
          test.skip(true, `Route ${path} not mounted in this matrix (fixture).`);
          return;
        }
        throw new Error(`Unexpected 404 for ${path}`);
      }
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("decision API lifecycle: create, recommend, close", async ({ page }) => {
    await loginAsTestUser(page);
    const title = `E2E lifecycle ${Date.now()}`;
    const createRes = await page.request.post("/api/decisions", {
      data: { title, decisionType: "renewal" },
    });
    if (createRes.status() === 403) {
      test.skip(true, "Test user lacks renewals_manage / decisions API access.");
      return;
    }
    if (createRes.status() === 404) {
      test.skip(true, "Decisions API not mounted (404).");
      return;
    }
    expect(createRes.ok()).toBeTruthy();
    const created = (await createRes.json()) as { decision?: { id?: string } };
    const id = created.decision?.id;
    expect(id).toBeTruthy();

    const recRes = await page.request.post(`/api/decisions/${id}/recommend`, {
      data: {
        recommendationText: "E2E: proceed with renewal review.",
        recommendationType: "review_priority_suggestion",
      },
    });
    if (recRes.status() === 403) {
      test.skip(true, "Test user lacks permission to add recommendations.");
      return;
    }
    if (recRes.status() === 404) {
      test.skip(true, "Recommendation route not mounted (404).");
      return;
    }
    expect(recRes.ok()).toBeTruthy();

    const closeRes = await page.request.post(`/api/decisions/${id}/close`, {
      data: {
        finalDisposition: { outcome: "e2e_workflow_closed" },
        postActions: [],
      },
    });
    if (closeRes.status() === 403) {
      test.skip(true, "Test user lacks permission to close decisions.");
      return;
    }
    if (closeRes.status() === 404) {
      test.skip(true, "Close route not mounted (404).");
      return;
    }
    expect(closeRes.ok()).toBeTruthy();

    await page.goto(`/decisions/${id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Type: renewal · Status: closed/i)).toBeVisible({ timeout: 15_000 });
  });
});
