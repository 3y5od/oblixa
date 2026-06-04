import { test as base, expect, type Page } from "@playwright/test";
import { ensureAuthenticatedSession } from "../login-test-user";
import { attachFailOnConsole } from "./fail-on-console";
import { attachFailOnRequestErrors } from "./fail-on-request-errors";
import { annotateRouteState } from "./route-state-fixture";
import { applyTheme } from "./theme-fixture";
import { annotateWorkspaceMode } from "./workspace-mode-fixture";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=fixture_auth_secrets_gate

type AppFixture = {
  app: {
    loginAsDefaultUser(): Promise<void>;
    gotoAndWait(path: string): Promise<void>;
  };
};

const browserDiagnosticRun =
  process.env.PLAYWRIGHT_DEVICE_MATRIX === "1" ||
  process.env.PLAYWRIGHT_DEVICE_MATRIX === "true" ||
  process.env.PLAYWRIGHT_V10_MATRIX === "1" ||
  process.env.PLAYWRIGHT_V10_MATRIX === "true" ||
  process.env.PLAYWRIGHT_MULTI_BROWSER === "1" ||
  process.env.PLAYWRIGHT_MULTI_BROWSER === "true";

const BROWSER_DIAGNOSTIC_PAGE_ERROR_ALLOWLIST = [
  /^Failed to load chunk \/_next\/static\/chunks\/[\w.~/-]+\.js from module \d+$/i,
  /^ChunkLoadError: Failed to load chunk \/_next\/static\/chunks\/[\w.~/-]+\.js from module \d+$/i,
  /^ChunkLoadError: Failed to load chunk \/_next\/static\/chunks\/[\w.~/-]+\.js from module \d+\s+\/127\.0\.0\.1:3000\/api\/workspace\/nav-badges due to access control checks\.$/i,
  /^\/127\.0\.0\.1:3000\/api\/workspace\/nav-badges due to access control checks\.$/i,
  /^\/127\.0\.0\.1:3000\/(?:[^\s?]+)?\?_rsc=[\w-]+ due to access control checks\.$/i,
  /^\/127\.0\.0\.1:3000\/[^\s?]+\?[^\s]*\b_rsc=[\w-]+[^\s]* due to access control checks\.$/i,
  /^\/127\.0\.0\.1:3000\/search\?q=[\w-]+ due to access control checks\.$/i,
  /^TypeError: Load failed$/i,
  /^h?ttp:\/\/127\.0\.0\.1:3000\/[0-9a-f-]{36} due to access control checks\.$/i,
  /^\/?o\d+\.ingest(?:\.us)?\.sentry\.io\/api\/\d+\/envelope\/.* due to access control checks\.$/i,
];

function isAllowedBrowserDiagnosticPageError(message: string): boolean {
  if (!browserDiagnosticRun) return false;
  return BROWSER_DIAGNOSTIC_PAGE_ERROR_ALLOWLIST.some((pattern) => pattern.test(message));
}

async function stubExternalTelemetry(page: Page) {
  await page.route(/https:\/\/[^/]*sentry\.io\/api\/\d+\/envelope\/.*/i, async (route) => {
    await route.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "content-type": "text/plain",
      },
      body: "",
    });
  });
}

async function attachClientErrorGuards(page: Page) {
  const consoleGuard = await attachFailOnConsole(page);
  const requestGuard = await attachFailOnRequestErrors(page);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    const message = error.message;
    if (isAllowedBrowserDiagnosticPageError(message)) return;
    pageErrors.push(message);
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
    await stubExternalTelemetry(page);
    await applyTheme(page, "light");
    await annotateWorkspaceMode(page, "default");
    await annotateRouteState(page, "default");
    const guards = await attachClientErrorGuards(page);

    await runAppFixture({
      async loginAsDefaultUser() {
        const email = process.env.E2E_TEST_EMAIL?.trim();
        const password = process.env.E2E_TEST_PASSWORD?.trim();
        test.skip(!email || !password, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated E2E.");
        await ensureAuthenticatedSession(page, email!, password!);
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
