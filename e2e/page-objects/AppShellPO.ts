import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { MAIN_CONTENT_ID, shellTestIds } from "@/lib/qa/test-ids";

export class AppShellPO {
  constructor(private readonly page: Page) {}

  primaryNav() {
    return this.page.getByTestId(shellTestIds.primaryNav);
  }

  headerSearch() {
    return this.page.getByTestId(shellTestIds.headerSearch);
  }

  mainContent() {
    return this.page.locator(`#${MAIN_CONTENT_ID}`);
  }

  commandPalette() {
    return this.page.getByTestId(shellTestIds.commandPaletteRoot);
  }

  async expectShellVisible() {
    await expect(this.mainContent()).toBeVisible();
    await expect(this.primaryNav()).toBeVisible();
  }

  async openCommandPalette() {
    const mod = process.platform === "darwin" ? "Meta" : "Control";
    await this.page.keyboard.press(`${mod}+KeyK`);
    await expect(this.commandPalette()).toBeVisible();
  }
}

