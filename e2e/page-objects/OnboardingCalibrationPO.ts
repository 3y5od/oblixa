import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class OnboardingCalibrationPO {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
  }

  async expectLoaded() {
    await expect(
      this.page.getByText(/step 1 of 9|no questionnaire to complete/i).first()
    ).toBeVisible();
  }
}

