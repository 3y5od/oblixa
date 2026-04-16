import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { surfaceTestIds } from "@/lib/qa/test-ids";

export class WorkQueuePO {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/work", { waitUntil: "domcontentloaded" });
  }

  summary() {
    return this.page.getByTestId(surfaceTestIds.workPageSummary);
  }

  async expectLoaded() {
    await expect(this.page.getByRole("heading", { name: /work queue/i })).toBeVisible();
    await expect(this.summary()).toBeVisible();
  }
}

