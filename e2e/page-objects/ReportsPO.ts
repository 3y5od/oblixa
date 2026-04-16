import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class ReportsPO {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/reports", { waitUntil: "domcontentloaded" });
  }

  async expectLoaded() {
    await expect(this.page.getByRole("heading", { name: /reports/i })).toBeVisible();
  }
}

