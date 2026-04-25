import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { surfaceTestIds } from "@/lib/qa/test-ids";

export class ExternalSurfacePO {
  constructor(private readonly page: Page) {}

  async gotoInvalidToken() {
    await this.page.goto("/external/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
    });
  }

  async expectInvalidSurfaceLoaded() {
    await expect(this.page.getByText(/loading request/i)).toBeHidden({ timeout: 15_000 });
    await expect(
      this.page.getByText(/could not load|not found|unable to load|external action not found/i)
    ).toBeVisible({ timeout: 15_000 });
  }

  form() {
    return this.page.getByTestId(surfaceTestIds.externalSubmitForm);
  }
}

