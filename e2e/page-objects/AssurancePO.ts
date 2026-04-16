import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class AssurancePO {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/assurance", { waitUntil: "domcontentloaded" });
  }

  async expectLoadedOrSkipped() {
    const url = this.page.url();
    if (/\/assurance/.test(url)) {
      await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible();
      return;
    }
    await expect(this.page).toHaveURL(/\/dashboard|\/login/);
  }
}

