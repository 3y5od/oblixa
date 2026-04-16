import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { surfaceTestIds } from "@/lib/qa/test-ids";

export class ContractsPO {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/contracts", { waitUntil: "domcontentloaded" });
  }

  table() {
    return this.page.getByTestId(surfaceTestIds.contractsTable);
  }

  snapshot() {
    return this.page.getByTestId(surfaceTestIds.contractsPageSnapshot);
  }

  async expectLoaded() {
    await expect(this.page.getByRole("heading", { name: /^Contracts$/i })).toBeVisible();
    await expect(this.table()).toBeVisible();
  }
}

