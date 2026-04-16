import { test, expect } from "./fixtures/app-fixture";
import { ExternalSurfacePO } from "./page-objects/ExternalSurfacePO";

test.describe("external token surface", () => {
  test("invalid token path returns a non-5xx response", async ({ page }) => {
    const external = new ExternalSurfacePO(page);
    const res = await page.goto("/external/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status() ?? 0).toBeGreaterThanOrEqual(200);
    expect(res?.status() ?? 0).toBeLessThan(500);
    await external.expectInvalidSurfaceLoaded();
  });
});
