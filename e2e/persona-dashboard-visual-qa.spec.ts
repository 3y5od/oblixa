import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures/app-fixture";
import { VISUAL_ADVANCED_ENABLED, VISUAL_AUTH_ENABLED, snapshotName } from "./visual-helpers";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=visual_persona_baselines_feature_flag_gated

const CORE_PERSONA_STATES = [
  {
    name: "core-ops",
    path: "/dashboard/persona?persona=ops",
    heading: "Ops lead",
    activePreset: "Ops Daily",
  },
  {
    name: "core-legal",
    path: "/dashboard/persona?persona=legal",
    heading: "Legal reviewer",
    activePreset: "Legal Approvals",
  },
  {
    name: "core-finance",
    path: "/dashboard/persona?persona=finance",
    heading: "Finance",
    activePreset: "Finance Renewals",
  },
  {
    name: "core-manager",
    path: "/dashboard/persona?persona=manager",
    heading: "Founder / manager",
    activePreset: "Manager Weekly",
  },
] as const;

const describePersonaVisualQa = VISUAL_AUTH_ENABLED ? test.describe : test.describe.skip;
const describeAdvancedPersonaVisualQa = VISUAL_ADVANCED_ENABLED ? test.describe : test.describe.skip;

async function expectPersonaFirstFold(page: import("@playwright/test").Page) {
  const positions = await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll("section"));
    const queue = sections.find((section) => section.textContent?.includes("Work queue"));
    const workViews = document.querySelector('nav[aria-label="Work views"]');
    const queueSignal = queue?.querySelector('[role="status"], a[href^="/contracts/"]');
    return {
      queueTop: queue?.getBoundingClientRect().top ?? Number.NaN,
      workViewsTop: workViews?.getBoundingClientRect().top ?? Number.NaN,
      queueSignalTop: queueSignal?.getBoundingClientRect().top ?? Number.NaN,
      viewportHeight: window.innerHeight,
    };
  });

  expect(Number.isFinite(positions.queueTop)).toBe(true);
  expect(Number.isFinite(positions.workViewsTop)).toBe(true);
  expect(Number.isFinite(positions.queueSignalTop)).toBe(true);
  expect(positions.workViewsTop).toBeLessThan(positions.queueTop);
  expect(positions.queueSignalTop).toBeLessThan(Math.min(positions.viewportHeight, 720));
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const widths = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(widths.documentWidth).toBeLessThanOrEqual(widths.viewportWidth + 1);
}

async function expectPersonaHeaderControlsFit(page: import("@playwright/test").Page) {
  const layout = await page.evaluate(() => {
    const header = document.querySelector("header");
    const select = document.querySelector<HTMLSelectElement>('select[name="persona"]');
    const button = Array.from(document.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes("Apply persona"));
    const headerBox = header?.getBoundingClientRect();
    const selectBox = select?.getBoundingClientRect();
    const buttonBox = button?.getBoundingClientRect();
    return {
      headerLeft: headerBox?.left ?? Number.NaN,
      headerRight: headerBox?.right ?? Number.NaN,
      selectLeft: selectBox?.left ?? Number.NaN,
      selectRight: selectBox?.right ?? Number.NaN,
      buttonLeft: buttonBox?.left ?? Number.NaN,
      buttonRight: buttonBox?.right ?? Number.NaN,
      viewportWidth: window.innerWidth,
    };
  });

  expect(Number.isFinite(layout.headerLeft)).toBe(true);
  expect(Number.isFinite(layout.selectLeft)).toBe(true);
  expect(Number.isFinite(layout.buttonLeft)).toBe(true);
  expect(layout.selectLeft).toBeGreaterThanOrEqual(layout.headerLeft - 1);
  expect(layout.buttonLeft).toBeGreaterThanOrEqual(layout.headerLeft - 1);
  expect(layout.selectRight).toBeLessThanOrEqual(Math.min(layout.headerRight, layout.viewportWidth) + 1);
  expect(layout.buttonRight).toBeLessThanOrEqual(Math.min(layout.headerRight, layout.viewportWidth) + 1);
}

async function expectCompactWideComposition(page: import("@playwright/test").Page) {
  const layout = await page.evaluate(() => {
    const headerText = document.querySelector("header h1")?.parentElement;
    const workViews = document.querySelector('nav[aria-label="Work views"]');
    const workViewBand = workViews?.closest("section");
    const headerTextBox = headerText?.getBoundingClientRect();
    const workViewsBox = workViews?.getBoundingClientRect();
    const workViewBandBox = workViewBand?.getBoundingClientRect();
    return {
      headerTextWidth: headerTextBox?.width ?? Number.NaN,
      workViewsLeft: workViewsBox?.left ?? Number.NaN,
      workViewBandLeft: workViewBandBox?.left ?? Number.NaN,
      workViewBandRight: workViewBandBox?.right ?? Number.NaN,
      viewportWidth: window.innerWidth,
    };
  });

  expect(Number.isFinite(layout.headerTextWidth)).toBe(true);
  expect(Number.isFinite(layout.workViewsLeft)).toBe(true);
  expect(layout.headerTextWidth).toBeLessThanOrEqual(800);
  expect(layout.workViewsLeft - layout.workViewBandLeft).toBeLessThan(layout.viewportWidth * 0.35);
  expect(layout.workViewBandRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
}

async function expectWorkViewAccessibility(page: import("@playwright/test").Page, activePreset: string) {
  const workViews = page.getByRole("navigation", { name: "Work views" });
  await expect(workViews).toBeVisible();
  await expect(page.getByRole("link", { name: activePreset })).toHaveAttribute("aria-current", "page");

  const results = await new AxeBuilder({ page }).include('nav[aria-label="Work views"]').analyze();
  const blocking = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""));
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

describePersonaVisualQa("persona dashboard visual QA", () => {
  for (const state of CORE_PERSONA_STATES) {
    test(`${state.name} desktop first fold and work views`, async ({ page, app }) => {
      await app.loginAsDefaultUser();
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(state.path, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: state.heading })).toBeVisible({ timeout: 20_000 });
      await expectNoHorizontalOverflow(page);
      await expectPersonaFirstFold(page);
      await expectCompactWideComposition(page);
      await expectWorkViewAccessibility(page, state.activePreset);
      await expect(page).toHaveScreenshot(snapshotName("persona", state.name), { fullPage: true });
    });
  }

  for (const state of CORE_PERSONA_STATES) {
    test(`${state.name} mobile first fold`, async ({ page, app }) => {
      await app.loginAsDefaultUser();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(state.path, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: state.heading })).toBeVisible({ timeout: 20_000 });
      await expectNoHorizontalOverflow(page);
      await expectPersonaHeaderControlsFit(page);
      await expectPersonaFirstFold(page);
      await expect(page).toHaveScreenshot(snapshotName("persona-mobile", state.name), { fullPage: true });
    });
  }
});

describeAdvancedPersonaVisualQa("persona dashboard Advanced visual QA", () => {
  test("finance advanced metrics remain below active queue work", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard/persona?persona=finance", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Finance" })).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);
    await expectPersonaFirstFold(page);
    await expectCompactWideComposition(page);
    await expectWorkViewAccessibility(page, "Finance Renewals");
    await expect(page).toHaveScreenshot(snapshotName("persona-advanced", "finance"), { fullPage: true });
  });
});
