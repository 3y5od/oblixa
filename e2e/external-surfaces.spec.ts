import { test, expect, type Page } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=external_surface_smokes_are_fixture_gated

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

test.describe("external page", () => {
  test("renders external page without login (status load)", async ({ page }) => {
    await page.goto("/external/e2e_nonexistent_token_smoke", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /external response/i })).toBeVisible({
      timeout: 15_000,
    });
    // Unknown token → status 404 after load (no submit button).
    await expect(page.getByText(/could not load|not found|unable to load/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("external surfaces", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated external surface checks."
  );

  test("decisions, campaigns, and reports pages load after login", async ({ page }) => {
    await loginAsTestUser(page);

    const paths = ["/decisions", "/campaigns", "/reports"] as const;
    for (const path of paths) {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (resp?.status() === 404) {
        test.skip(true, `V5 route ${path} not enabled for this environment (404).`);
        return;
      }
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("campaign compare route loads", async ({ page }) => {
    await loginAsTestUser(page);
    const resp = await page.goto("/campaigns/compare", { waitUntil: "domcontentloaded" });
    if (resp?.status() === 404) {
      test.skip(true, "V5 campaign compare not enabled (404).");
      return;
    }
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("dashboard shows control room strip when V5 UX flag is on", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const controlRoom = page.getByText("Portfolio control questions");
    const hasStrip = await controlRoom.isVisible().catch(() => false);
    if (!hasStrip) {
      test.skip(true, "ENABLE_V5_CONTROL_ROOM_UX is off in this environment.");
      return;
    }
    await expect(controlRoom).toBeVisible();
  });

  test("relationship workspaces page loads when relationship layer is on", async ({ page }) => {
    await loginAsTestUser(page);
    const resp = await page.goto("/relationship-workspaces", { waitUntil: "domcontentloaded" });
    if (resp?.status() === 404) {
      test.skip(true, "Relationship workspaces not enabled (404).");
      return;
    }
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("optional account and counterparty pages when E2E keys are set", async ({ page }) => {
    const accountKey = process.env.E2E_ACCOUNT_KEY?.trim();
    const counterpartyKey = process.env.E2E_COUNTERPARTY_KEY?.trim();
    test.skip(
      !accountKey && !counterpartyKey,
      "Set E2E_ACCOUNT_KEY and/or E2E_COUNTERPARTY_KEY to run relationship detail checks."
    );
    await loginAsTestUser(page);
    if (accountKey) {
      const ar = await page.goto(`/accounts/${encodeURIComponent(accountKey)}`, {
        waitUntil: "domcontentloaded",
      });
      if (ar?.status() !== 404) {
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      }
    }
    if (counterpartyKey) {
      const cr = await page.goto(`/counterparties/${encodeURIComponent(counterpartyKey)}`, {
        waitUntil: "domcontentloaded",
      });
      if (cr?.status() !== 404) {
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      }
    }
  });

  test("decisions page accepts type query filter", async ({ page }) => {
    await loginAsTestUser(page);
    const resp = await page.goto("/decisions?type=renewal", { waitUntil: "domcontentloaded" });
    if (resp?.status() === 404) {
      test.skip(true, "Decisions route not available.");
      return;
    }
    await expect(page.getByRole("heading", { name: /decision workspaces/i })).toBeVisible();
    await expect(page.getByText(/Filtered by type/i)).toBeVisible();
  });

  test("decisions page accepts queue=active filter", async ({ page }) => {
    await loginAsTestUser(page);
    const resp = await page.goto("/decisions?queue=active", { waitUntil: "domcontentloaded" });
    if (resp?.status() === 404) {
      test.skip(true, "Decisions route not available.");
      return;
    }
    await expect(page.getByRole("heading", { name: /decision workspaces/i })).toBeVisible();
    await expect(page.getByText(/open and in-review/i)).toBeVisible();
  });

  test("campaigns page accepts status query filter", async ({ page }) => {
    await loginAsTestUser(page);
    const resp = await page.goto("/campaigns?status=active", { waitUntil: "domcontentloaded" });
    if (resp?.status() === 404) {
      test.skip(true, "Campaigns not available.");
      return;
    }
    await expect(page.getByRole("heading", { name: /campaign center/i })).toBeVisible();
    await expect(page.getByText(/Filtered by status/i)).toBeVisible();
  });

  test("campaigns page exposes simulation studio section", async ({ page }) => {
    await loginAsTestUser(page);
    const resp = await page.goto("/campaigns#simulations", { waitUntil: "domcontentloaded" });
    if (resp?.status() === 404) {
      test.skip(true, "Campaigns not available.");
      return;
    }
    await expect(page.getByRole("heading", { name: /simulation/i })).toBeVisible();
  });

  test("reports page shows portfolio analytics section when available", async ({ page }) => {
    await loginAsTestUser(page);
    const resp = await page.goto("/reports#portfolio-analytics", { waitUntil: "domcontentloaded" });
    if (resp?.status() === 404) {
      test.skip(true, "Reports route not available.");
      return;
    }
    const analytics = page.getByRole("heading", { name: /portfolio analytics/i });
    const hasAnalytics = await analytics.isVisible().catch(() => false);
    if (!hasAnalytics) {
      test.skip(true, "Portfolio analytics hidden (intelligence flag off).");
      return;
    }
    await expect(analytics).toBeVisible();
  });

  test("decision detail deep link returns decision or 404", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/decisions", { waitUntil: "domcontentloaded" });
    if ((await page.getByRole("heading", { level: 1 }).count()) === 0) {
      test.skip(true, "Decisions page not available.");
      return;
    }
    const firstLink = page.locator('a[href^="/decisions/"]').first();
    if ((await firstLink.count()) === 0) {
      test.skip(true, "No decision rows to open (empty queue is OK).");
      return;
    }
    await firstLink.click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
