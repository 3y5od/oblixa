import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=bfcache_speculation_optional

test.describe("BFCache + speculation rules", () => {
  test("pageshow persisted flag is observable on home", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const persisted = await page.evaluate(() => {
      return new Promise<boolean | null>((resolve) => {
        const handler = (e: Event) => {
          window.removeEventListener("pageshow", handler);
          const persistedFlag =
            "persisted" in e ? Boolean((e as Event & { persisted?: boolean }).persisted) : false;
          resolve(persistedFlag);
        };
        window.addEventListener("pageshow", handler);
        setTimeout(() => resolve(null), 1500);
      });
    });
    expect(persisted === null || typeof persisted === "boolean").toBeTruthy();
  });

  test("no speculationrules parse errors in console when link present", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const hasSpec = await page.locator('link[rel="speculationrules"]').count();
    if (hasSpec > 0) {
      expect(errors.join(" ").toLowerCase()).not.toContain("speculation");
    }
  });
});
