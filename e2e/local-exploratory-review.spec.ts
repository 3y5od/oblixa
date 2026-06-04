import type { Page, TestInfo } from "@playwright/test";
import { shellTestIds } from "@/lib/qa/test-ids";
import { GENERATED_PUBLIC_ROUTES } from "./generated/public-routes";
import { test, expect } from "./fixtures/app-fixture";
import { settleWebKitWorker } from "./fixtures/webkit-worker-teardown";
import { AuthPO } from "./page-objects/AuthPO";

const PUBLIC_EXPLORATORY_PATHS = GENERATED_PUBLIC_ROUTES.filter(({ routeFamily }) =>
  ["auth", "marketing"].includes(routeFamily)
).map(({ visitPath }) => visitPath);

const AUTHENTICATED_EXPLORATORY_PATHS = [
  "/dashboard",
  "/onboarding/calibration",
  "/settings",
  "/settings/operations",
  "/settings/billing",
  "/contracts",
  "/contracts/bulk",
  "/contracts/imports/00000000-0000-0000-0000-000000000005",
  "/contracts/renewals",
  "/contracts/tasks",
  "/reports",
  "/search?q=renewal",
  "/work",
] as const;

async function expectPageReady(page: Page) {
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("main").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 15_000 });
}

async function expectNoDocumentOverflow(page: Page, label: string) {
  const diagnostic = await page.evaluate(() => {
    const root = document.documentElement;
    const viewportWidth = root.clientWidth;
    function describeAncestors(element: HTMLElement) {
      const ancestors = [];
      let current: HTMLElement | null = element.parentElement;
      while (current && current !== document.body && ancestors.length < 5) {
        const rect = current.getBoundingClientRect();
        const style = getComputedStyle(current);
        ancestors.push({
          tagName: current.tagName.toLowerCase(),
          className: current.className?.toString().slice(0, 100) ?? "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          overflowX: style.overflowX,
          display: style.display,
        });
        current = current.parentElement;
      }
      return ancestors;
    }
    const offenders = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 1 || rect.right <= viewportWidth + 2) return null;
        const text = element.innerText?.replace(/\s+/g, " ").trim().slice(0, 80) ?? "";
        return {
          tagName: element.tagName.toLowerCase(),
          className: element.className?.toString().slice(0, 120) ?? "",
          text,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          ancestors: describeAncestors(element),
        };
      })
      .filter((offender): offender is NonNullable<typeof offender> => offender !== null)
      .slice(0, 8);
    const originalX = window.scrollX;
    const originalY = window.scrollY;
    window.scrollTo(10_000, originalY);
    const horizontalScroll = Math.max(0, window.scrollX);
    window.scrollTo(originalX, originalY);
    return {
      overflow: horizontalScroll,
      rootScrollOverflow: Math.max(0, root.scrollWidth - root.clientWidth),
      viewportWidth,
      scrollWidth: root.scrollWidth,
      offenders,
    };
  });
  expect(
    diagnostic.overflow,
    `${label} has horizontal document overflow: ${JSON.stringify(diagnostic)}`
  ).toBeLessThanOrEqual(2);
}

async function expectControlsStayInsideViewport(page: Page, label: string) {
  const issues = await page.evaluate(() => {
    function hasScrollableAncestor(element: HTMLElement) {
      let current = element.parentElement;
      while (current && current !== document.body && current !== document.documentElement) {
        const style = getComputedStyle(current);
        if (["auto", "scroll", "hidden", "clip"].includes(style.overflowX)) return true;
        current = current.parentElement;
      }
      return false;
    }

    const selectors = [
      "button",
      "a",
      "[role='button']",
      "[role='tab']",
      "[role='menuitem']",
      "[aria-label]",
      "[class*='badge']",
      "[class*='chip']",
      "[class*='card']",
      "aside",
      "nav",
      "td",
      "th",
    ];
    const viewportWidth = document.documentElement.clientWidth;
    return Array.from(document.querySelectorAll<HTMLElement>(selectors.join(",")))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 1 && rect.height <= 1) return null;
        if (hasScrollableAncestor(element)) return null;
        const text = element.innerText?.replace(/\s+/g, " ").trim().slice(0, 80) ?? "";
        return {
          tagName: element.tagName.toLowerCase(),
          text,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((issue): issue is NonNullable<typeof issue> => issue !== null)
      .filter(({ width }) => width > 0)
      .filter(({ left, right }) => left < -2 || right > viewportWidth + 2)
      .slice(0, 10);
  });
  expect(issues, `${label} has visible controls or text outside viewport`).toEqual([]);
}

async function attachViewportEvidence(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

async function expectResponsiveSurface(page: Page, label: string) {
  await expectPageReady(page);
  await expectNoDocumentOverflow(page, label);
  await expectControlsStayInsideViewport(page, label);
}

test.describe("local exploratory review", () => {
  test.afterAll(async ({}, testInfo) => {
    await settleWebKitWorker(testInfo);
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "wait" });
    if (!page.isClosed()) {
      await page.close({ runBeforeUnload: false });
    }
  });

  test("walks public marketing, auth, and legal pages across responsive widths", async ({ page }, testInfo) => {
    test.setTimeout(120_000);

    const widths = [
      { name: "mobile", width: 390, height: 844 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "desktop", width: 1280, height: 900 },
    ] as const;

    for (const viewport of widths) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const visitPath of PUBLIC_EXPLORATORY_PATHS) {
        await page.goto(visitPath, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading").first(), `${visitPath} has a heading`).toBeVisible({ timeout: 15_000 });
        await expectResponsiveSurface(page, `${viewport.name} ${visitPath}`);
      }
    }

    await attachViewportEvidence(page, testInfo, "public-legal-desktop.png");
  });

  test("preserves deep links, query parameters, hash anchors, refresh, and history traversal", async ({
    page,
    app,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await app.loginAsDefaultUser();

    await page.goto("/dashboard?review=history#main-content", { waitUntil: "domcontentloaded" });
    await expectResponsiveSurface(page, "dashboard deep link");
    await expect
      .poll(() => page.evaluate(() => ({ pathname: location.pathname, search: location.search, hash: location.hash })))
      .toEqual({ pathname: "/dashboard", search: "?review=history", hash: "#main-content" });

    await page.goto("/search?q=renewal#main-content", { waitUntil: "domcontentloaded" });
    await expectResponsiveSurface(page, "search query deep link");
    await expect
      .poll(() => page.evaluate(() => ({ pathname: location.pathname, search: location.search, hash: location.hash })))
      .toEqual({ pathname: "/search", search: "?q=renewal", hash: "" });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectResponsiveSurface(page, "search query reload");
    await expect(page).toHaveURL(/\/search\?q=renewal$/);

    await page.goBack({ waitUntil: "domcontentloaded" });
    await expectResponsiveSurface(page, "dashboard after back");
    await expect(page).toHaveURL(/\/dashboard\?review=history#main-content$/);

    await page.goForward({ waitUntil: "domcontentloaded" });
    await expectResponsiveSurface(page, "search after forward");
    await expect(page).toHaveURL(/\/search\?q=renewal$/);

    await page.goto("/settings#profile", { waitUntil: "domcontentloaded" });
    await expectResponsiveSurface(page, "settings hash anchor");
    await expect
      .poll(() => page.evaluate(() => ({ pathname: location.pathname, search: location.search, hash: location.hash })))
      .toEqual({ pathname: "/settings", search: "", hash: "#profile" });
  });

  test("walks authenticated workflow pages on mobile and tablet with reduced-motion and forced-colors", async ({
    page,
    app,
  }, testInfo) => {
    test.setTimeout(180_000);

    await app.loginAsDefaultUser();
    await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });

    const viewports = [
      { name: "mobile", width: 390, height: 844 },
      { name: "tablet", width: 768, height: 1024 },
    ] as const;

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const path of AUTHENTICATED_EXPLORATORY_PATHS) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expectResponsiveSurface(page, `${viewport.name} ${path}`);
      }
    }

    const mod = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${mod}+KeyK`);
    const commandDialog = page.getByRole("dialog").first();
    await expect(commandDialog).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
    await expect(commandDialog).toBeHidden({ timeout: 10_000 });
    await page.keyboard.press("Tab");
    await expect.poll(() => page.evaluate(() => document.activeElement !== document.body)).toBe(true);

    await attachViewportEvidence(page, testInfo, "authenticated-forced-colors-tablet.png");
  });

  test.describe("touch affordances", () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

    test("uses touch and hover affordances without layout or navigation regressions", async ({ page }, testInfo) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expectResponsiveSurface(page, "public touch home");

      const pricingLink = page.getByRole("link", { name: /pricing/i }).first();
      await expect(pricingLink).toBeVisible({ timeout: 15_000 });
      await pricingLink.hover();
      const box = await pricingLink.boundingBox();
      expect(box).not.toBeNull();
      await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await expect(page).toHaveURL(/\/pricing$/);
      await expectResponsiveSurface(page, "public pricing after touch");

      await attachViewportEvidence(page, testInfo, "public-touch-pricing.png");
    });
  });

  test("checks multi-tab sign-out propagation after a local authenticated session", async ({ page, context, app }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await app.loginAsDefaultUser();
    await app.gotoAndWait("/dashboard");

    const secondTab = await context.newPage();
    const auth = new AuthPO(secondTab);

    try {
      await secondTab.goto("/work", { waitUntil: "domcontentloaded" });
      await expectPageReady(secondTab);

      const signOut = page
        .getByTestId(shellTestIds.sidebarSignOut)
        .filter({ hasText: /^Sign out$/i })
        .first();
      await expect(signOut).toBeVisible({ timeout: 30_000 });
      await signOut.click();
      await new AuthPO(page).expectLoginLoaded();

      await secondTab.reload({ waitUntil: "domcontentloaded" });
      await auth.expectLoginLoaded();
    } finally {
      await secondTab.close({ runBeforeUnload: false });
    }
  });
});
