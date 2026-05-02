// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=privacy_sandbox_optional_apis
import { test, expect } from "@playwright/test";

test.describe("privacy sandbox stubs @nightly", () => {
  test("document is available for future Topics / PA probes", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const ok = await page.evaluate(() => typeof document !== "undefined");
    expect(ok).toBe(true);
  });
});
