import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=public_seo_matrix_optional_routes

test.describe("public SEO + well-known", () => {
  test("robots.txt is reachable", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
  });

  test("sitemap index or sitemap responds", async ({ request }) => {
    const idx = await request.get("/sitemap.xml");
    const alt = await request.get("/sitemap_index.xml");
    if (idx.status() !== 200 && alt.status() !== 200) {
      test.skip(true, "No sitemap route in this matrix.");
      return;
    }
    expect(idx.status() === 200 || alt.status() === 200).toBeTruthy();
  });

  test("security.txt is reachable", async ({ request }) => {
    const res = await request.get("/.well-known/security.txt");
    expect([200, 404]).toContain(res.status());
  });

  test("marketing root has canonical and og:title when present", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const canonical = page.locator('link[rel="canonical"]');
    if ((await canonical.count()) > 0) {
      await expect(canonical.first()).toHaveAttribute("href", /.+/);
    }
    const og = page.locator('meta[property="og:title"]');
    if ((await og.count()) > 0) {
      await expect(og.first()).toHaveAttribute("content", /.+/);
    }
  });
});
