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
    await expect(this.page.getByTestId(surfaceTestIds.externalSubmitLoadError)).toBeVisible({
      timeout: 15_000,
    });
  }

  async expectOpenFormLoaded(actionLabel: RegExp = /submit evidence/i) {
    await expect(this.page.getByRole("heading", { name: "External response" })).toBeVisible({ timeout: 20_000 });
    await expect(this.form()).toBeVisible({ timeout: 20_000 });
    await expect(this.page.getByText(actionLabel)).toBeVisible();
    await expect(this.page.getByRole("button", { name: /^Submit$/i })).toBeVisible();
  }

  async expectExpiredSurfaceLoaded() {
    await expect(this.page.getByText(/This link has expired/i)).toBeVisible({ timeout: 20_000 });
    await expect(this.form()).toBeHidden();
  }

  form() {
    return this.page.getByTestId(surfaceTestIds.externalSubmitForm);
  }
}
