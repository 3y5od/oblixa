// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=memory_budget_env_gated
import { readFile } from "node:fs/promises";
import path from "node:path";

import { test, expect } from "@playwright/test";

const measure =
  process.env.PLAYWRIGHT_MEASURE_MEMORY === "1" || process.env.PLAYWRIGHT_MEASURE_MEMORY === "true";

test.describe("memory budget smoke", () => {
  test.skip(!measure, "Set PLAYWRIGHT_MEASURE_MEMORY=1 to run");

  test("loads budgets file and home without crash", async ({ page }) => {
    const raw = await readFile(path.join(process.cwd(), "artifacts", "memory-budgets.json"), "utf8").catch(
      () => "{}"
    );
    const budgets = JSON.parse(raw) as { playwrightHeapMbWarn?: number };
    expect(typeof budgets.playwrightHeapMbWarn).toBe("number");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });
});
