import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=broadcast_channel_optional

test.describe("BroadcastChannel session hint", () => {
  test("BroadcastChannel constructor exists when API available", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const has = await page.evaluate(() => typeof BroadcastChannel === "function");
    if (!has) {
      test.skip(true, "BroadcastChannel not exposed in this runtime.");
      return;
    }
    const name = `oblixa-auth-hint-${Date.now()}`;
    const ok = await page.evaluate((channelName) => {
      try {
        const ch = new BroadcastChannel(channelName);
        ch.close();
        return true;
      } catch {
        return false;
      }
    }, name);
    expect(ok).toBe(true);
  });
});
