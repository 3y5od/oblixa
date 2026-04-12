import { defineConfig, devices } from "@playwright/test";

const onboardingDeep =
  process.env.PLAYWRIGHT_ONBOARDING_DEEP === "1" || process.env.PLAYWRIGHT_ONBOARDING_DEEP === "true";

/** Opt-in: run marketing + perf smokes on Firefox/WebKit (same matrix shape as onboarding-deep). */
const multiBrowser =
  process.env.PLAYWRIGHT_MULTI_BROWSER === "1" || process.env.PLAYWRIGHT_MULTI_BROWSER === "true";

export default defineConfig({
  testDir: "./e2e",
  // Local: serialized for stability. CI: parallelize against a production `next start` server.
  fullyParallel: !!process.env.CI,
  workers: process.env.CI ? undefined : 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: onboardingDeep || multiBrowser
    ? [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
      ]
    : [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        // Use production runtime instead of dev compilation to avoid flaky
        // navigation aborts while routes compile in parallel.
        command: "npm run start",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
