import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class AuthPO {
  constructor(private readonly page: Page) {}

  async gotoLogin() {
    await this.page.goto("/login", { waitUntil: "domcontentloaded" });
  }

  async expectLoginLoaded() {
    await expect(this.page.getByRole("heading", { name: /sign in to your account/i })).toBeVisible();
  }
}

