import { test as base, expect, type Page } from "@playwright/test";
import { loginWithCredentials } from "../login-test-user";
import { attachFailOnConsole } from "./fail-on-console";
import { attachFailOnRequestErrors } from "./fail-on-request-errors";
import { annotateRouteState } from "./route-state-fixture";
import { applyTheme } from "./theme-fixture";
import { annotateWorkspaceMode } from "./workspace-mode-fixture";

type AppFixture = {
  app: {
    loginAsDefaultUser(): Promise<void>;
    gotoAndWait(path: string): Promise<void>;
  };
};

async function attachClientErrorGuards(page: Page) {
  const consoleGuard = await attachFailOnConsole(page);
  const requestGuard = await attachFailOnRequestErrors(page);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  return {
    assertHealthy() {
      consoleGuard.assertNoConsoleErrors();
      requestGuard.assertNoRequestFailures();
      if (pageErrors.length > 0) {
        throw new Error(`Unexpected page errors:\n${pageErrors.join("\n")}`);
      }
    },
  };
}

export const test = base.extend<AppFixture>({
  app: async ({ page }, runAppFixture) => {
    await applyTheme(page, "light");
    await annotateWorkspaceMode(page, "default");
    await annotateRouteState(page, "default");
    const guards = await attachClientErrorGuards(page);

    await runAppFixture({
      async loginAsDefaultUser() {
        const email = process.env.E2E_TEST_EMAIL?.trim();
        const password = process.env.E2E_TEST_PASSWORD?.trim();
        test.skip(!email || !password, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated E2E.");
        await loginWithCredentials(page, email!, password!);
      },
      async gotoAndWait(path: string) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("body")).toBeVisible();
      },
    });

    guards.assertHealthy();
  },
});

export { expect } from "@playwright/test";

