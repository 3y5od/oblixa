import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class AdvancedPO {
  constructor(private readonly page: Page) {}

  async gotoDecisions() {
    await this.page.goto("/decisions", { waitUntil: "domcontentloaded" });
  }

  async expectDecisionsOrRedirect() {
    const url = this.page.url();
    if (/\/decisions/.test(url)) {
      await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible();
      return;
    }
    await expect(this.page).toHaveURL(/\/dashboard/);
  }
}

