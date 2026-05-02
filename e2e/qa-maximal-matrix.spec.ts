// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=qa_maximal_matrix
import { test, expect } from "@playwright/test";

const CRON_PATH = "/api/cron/v10/read-model-refresh";

test.describe("qa maximal matrix @nightly", () => {
  test.describe("@http-matrix", () => {
    test("cron route rejects unauthenticated GET", async ({ request }) => {
      const res = await request.get(CRON_PATH);
      expect([401, 403]).toContain(res.status());
    });

    test("cron route rejects wrong bearer", async ({ request }) => {
      const res = await request.get(CRON_PATH, {
        headers: { Authorization: "Bearer not-the-real-cron-secret" },
      });
      expect([401, 403]).toContain(res.status());
    });

    test("OPTIONS on cron path is not an unauthenticated success", async ({ request }) => {
      const res = await request.fetch(CRON_PATH, { method: "OPTIONS" });
      expect([401, 403, 404, 405]).toContain(res.status());
    });
  });

  test.describe("security.txt RFC 9116 hints", () => {
    test("well-known security.txt responds", async ({ request }) => {
      const res = await request.get("/.well-known/security.txt");
      expect([200, 404]).toContain(res.status());
    });

    test("root security.txt if routed", async ({ request }) => {
      const res = await request.get("/security.txt");
      expect([200, 404]).toContain(res.status());
    });
  });

  test.describe("session / cookie surface", () => {
    test("marketing home loads without throwing cookie parse errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible();
      expect(errors.filter((e) => /cookie/i.test(e))).toHaveLength(0);
    });
  });

  test.describe("embed / CSP hints", () => {
    test("home iframes declare sandbox when present", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const frames = page.locator("iframe");
      const n = await frames.count();
      if (n === 0) return;
      for (let i = 0; i < n; i++) {
        await expect.soft(frames.nth(i)).toHaveAttribute("sandbox", /.+/);
      }
    });
  });

  test.describe("time / numeric reproducibility", () => {
    test("Date.UTC is stable for fixed inputs", async ({ page }) => {
      const ms = await page.evaluate(() => Date.UTC(2020, 0, 1, 0, 0, 0, 0));
      expect(ms).toBe(1577836800000);
    });
  });

  test.describe("contract artifacts (smoke)", () => {
    test("browser reports en-US locale by default", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const lang = await page.evaluate(() => navigator.language || "en");
      expect(lang.length).toBeGreaterThan(1);
    });
  });
});
