// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=quarantined_optional_stripe_elements
import { test, expect } from "@playwright/test";

const stripePk =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || "";

test.describe("Stripe Payment Element (env-gated)", () => {
  test("skips Elements mount unless a publishable key is present", async ({ page }) => {
    test.skip(!stripePk, "Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (or STRIPE_PUBLISHABLE_KEY) for Elements E2E.");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });
});
