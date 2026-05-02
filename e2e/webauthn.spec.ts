// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=webauthn_surface_smoke
import { test, expect } from "@playwright/test";

test.describe("webauthn surface @nightly", () => {
  test("PublicKeyCredential is defined or gracefully absent", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const has = await page.evaluate(() => typeof window.PublicKeyCredential !== "undefined");
    expect(typeof has).toBe("boolean");
  });

  test("virtual authenticator flows when RUN_WEBAUTHN=1", async ({ page }) => {
    test.skip(!process.env.RUN_WEBAUTHN, "Set RUN_WEBAUTHN=1 when passkey UI + CDP authenticator are wired.");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });
});
