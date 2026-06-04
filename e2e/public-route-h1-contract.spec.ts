/**
 * Tier 8 / Tier 60 — public route generator ↔ visible primary heading parity.
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=public_heading_contract
import { test, expect } from "@playwright/test";
import { GENERATED_PUBLIC_ROUTES } from "./generated/public-routes";

function normalizeHeadingText(text: string) {
  return text.replace(/[\u2010-\u2015\u2212]/gu, "-");
}

for (const entry of GENERATED_PUBLIC_ROUTES) {
  test(`h1 matches generator for ${entry.route}`, async ({ page }) => {
    const res = await page.goto(entry.visitPath, { waitUntil: "domcontentloaded" });
    expect(res?.ok(), `${entry.visitPath} status`).toBeTruthy();
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible();
    const actualHeading = normalizeHeadingText(await h1.innerText());
    expect(actualHeading.toLocaleLowerCase()).toContain(
      normalizeHeadingText(entry.expectedHeading).toLocaleLowerCase()
    );
  });
}
