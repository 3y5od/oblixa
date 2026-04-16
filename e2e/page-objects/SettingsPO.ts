import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class SettingsPO {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/settings", { waitUntil: "domcontentloaded" });
  }

  async expectLoaded() {
    await expect(this.page.getByRole("heading", { name: /^Settings$/i })).toBeVisible();
  }
}

