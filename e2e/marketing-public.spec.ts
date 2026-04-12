import { test, expect } from "@playwright/test";

const PUBLIC_MARKETING_PATHS = [
  "/",
  "/privacy",
  "/terms",
  "/security",
  "/accessibility",
  "/cookies",
  "/login",
  "/signup",
];

test.describe("public marketing surfaces", () => {
  test("unauthenticated pages return 200", async ({ page }) => {
    for (const path of PUBLIC_MARKETING_PATHS) {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.ok(), `${path} status`).toBeTruthy();
    }
  });

  test("390×844 viewport: home has no horizontal document overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth, "document scrollWidth").toBeLessThanOrEqual(clientWidth + 1);
  });

  test("home page does not surface primary CTAs to advanced or assurance hubs", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const bad = page.locator('a[href="/decisions"], a[href="/campaigns"], a[href^="/assurance"]');
    await expect(bad).toHaveCount(0);
  });

  test("opengraph-image and twitter-image return image responses", async ({ request }) => {
    for (const path of ["/opengraph-image", "/twitter-image"]) {
      const res = await request.get(path);
      expect(res.ok(), `${path} status`).toBeTruthy();
      const ct = res.headers()["content-type"] ?? "";
      expect(ct.includes("image"), `${path} content-type ${ct}`).toBeTruthy();
    }
  });

  test("icon route returns an image response", async ({ request }) => {
    const res = await request.get("/icon");
    expect(res.ok(), "/icon status").toBeTruthy();
    const ct = res.headers()["content-type"] ?? "";
    expect(ct.includes("image"), `/icon content-type ${ct}`).toBeTruthy();
  });

  test("robots.txt and sitemap.xml return OK with expected content types", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok(), "/robots.txt status").toBeTruthy();
    const robotsCt = robots.headers()["content-type"] ?? "";
    expect(robotsCt.includes("text/plain"), `/robots.txt content-type ${robotsCt}`).toBeTruthy();

    const sm = await request.get("/sitemap.xml");
    expect(sm.ok(), "/sitemap.xml status").toBeTruthy();
    const smCt = sm.headers()["content-type"] ?? "";
    expect(
      smCt.includes("xml") || smCt.includes("application"),
      `/sitemap.xml content-type ${smCt}`
    ).toBeTruthy();
  });
});
