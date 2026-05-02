import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=embed_iframe_matrix_optional

test.describe("embed / iframe surface", () => {
  test("home has no iframe without sandbox (soft)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const frames = page.locator("iframe");
    const n = await frames.count();
    if (n === 0) {
      test.skip(true, "No iframes on home in this build.");
      return;
    }
    for (let i = 0; i < n; i++) {
      const sandbox = await frames.nth(i).getAttribute("sandbox");
      expect.soft(sandbox, "iframe should declare sandbox when present").toBeTruthy();
    }
  });

  test("no positive tabindex on embed-heavy public home (postMessage UX surface)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const attrs = await page.$$eval("[tabindex]", (els) => els.map((e) => e.getAttribute("tabindex") || ""));
    for (const a of attrs) {
      const n = Number.parseInt(a, 10);
      if (!Number.isFinite(n)) continue;
      expect(n).toBeLessThanOrEqual(0);
    }
  });
});
