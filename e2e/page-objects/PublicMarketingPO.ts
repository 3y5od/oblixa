import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class PublicMarketingPO {
  constructor(private readonly page: Page) {}

  async goto(path = "/") {
    await this.page.goto(path, { waitUntil: "domcontentloaded" });
  }

  async expectLoaded() {
    await expect(this.page.locator("h1")).toBeVisible();
  }
}

