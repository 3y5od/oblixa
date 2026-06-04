import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class WorkQueuePO {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/work", { waitUntil: "domcontentloaded" });
  }

  surface() {
    return this.page.getByRole("region", { name: /^Work$/ });
  }

  async expectLoaded() {
    await expect(this.page.getByRole("heading", { level: 1, name: /^Work$/ })).toBeVisible();
    await expect(this.surface()).toBeVisible();
    await expect(this.surface().getByText("Active work")).toBeVisible();
  }
}
