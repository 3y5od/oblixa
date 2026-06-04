import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { DASHBOARD_TITLE } from "@/lib/dashboard/spec-strings";
import { surfaceTestIds } from "@/lib/qa/test-ids";

export class DashboardPO {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  }

  stats() {
    return this.page.getByTestId(surfaceTestIds.dashboardStats);
  }

  async expectLoaded() {
    await expect(this.page.getByRole("heading", { level: 1, name: DASHBOARD_TITLE })).toBeVisible();
  }
}
