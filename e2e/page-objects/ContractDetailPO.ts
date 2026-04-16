import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class ContractDetailPO {
  constructor(private readonly page: Page) {}

  async goto(id: string) {
    await this.page.goto(`/contracts/${id}`, { waitUntil: "domcontentloaded" });
  }

  async expectLoaded() {
    await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible();
  }
}

