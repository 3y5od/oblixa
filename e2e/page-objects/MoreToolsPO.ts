import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { surfaceTestIds } from "@/lib/qa/test-ids";

export class MoreToolsPO {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/more", { waitUntil: "domcontentloaded" });
  }

  jumpPoints() {
    return this.page.getByTestId(surfaceTestIds.moreJumpPoints);
  }

  async expectLoaded() {
    await expect(this.page.getByRole("heading", { name: /tools index/i })).toBeVisible();
  }
}

