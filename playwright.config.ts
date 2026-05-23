import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

loadEnvConfig(process.cwd());

const hasE2eCredentials =
  Boolean(process.env.E2E_TEST_EMAIL?.trim()) && Boolean(process.env.E2E_TEST_PASSWORD?.trim());

const reuseAuthStorageRequested =
  process.env.PLAYWRIGHT_REUSE_AUTH_STORAGE === "1" ||
  process.env.PLAYWRIGHT_REUSE_AUTH_STORAGE === "true";

/** One login before tests when credentials exist — avoids auth-provider rate limits across specs. */
const reuseAuthStorage = hasE2eCredentials && reuseAuthStorageRequested;

const authStorageStateFile = path.join(process.cwd(), "e2e", ".auth", "user.json");

const onboardingDeep =
  process.env.PLAYWRIGHT_ONBOARDING_DEEP === "1" || process.env.PLAYWRIGHT_ONBOARDING_DEEP === "true";

/** Opt-in: run marketing + perf smokes on Firefox/WebKit (same matrix shape as onboarding-deep). */
const multiBrowser =
  process.env.PLAYWRIGHT_MULTI_BROWSER === "1" || process.env.PLAYWRIGHT_MULTI_BROWSER === "true";

const visualMode =
  process.env.PLAYWRIGHT_VISUAL === "1" || process.env.PLAYWRIGHT_VISUAL === "true";

const mobile =
  process.env.PLAYWRIGHT_MOBILE === "1" || process.env.PLAYWRIGHT_MOBILE === "true";

/** CI maximal: chromium + firefox + webkit + Pixel 5 + iPad without duplicating full suite elsewhere. */
const maximalProfile =
  process.env.PLAYWRIGHT_MAXIMAL_PROFILE === "1" || process.env.PLAYWRIGHT_MAXIMAL_PROFILE === "true";

const maximalCi =
  process.env.PLAYWRIGHT_MAXIMAL_CI === "1" ||
  process.env.PLAYWRIGHT_MAXIMAL_CI === "true" ||
  maximalProfile;

const blobReport =
  process.env.PLAYWRIGHT_BLOB_REPORT === "1" ||
  process.env.PLAYWRIGHT_BLOB_REPORT === "true" ||
  (!!process.env.CI && process.env.PLAYWRIGHT_BLOB_REPORT !== "0");

if (process.env.E2E_RANDOM_SEED) {
  process.stderr.write(`[playwright] E2E_RANDOM_SEED=${process.env.E2E_RANDOM_SEED}\n`);
}

function buildProjects() {
  const out = [];
  if (maximalCi) {
    out.push(
      { name: "chromium", use: { ...devices["Desktop Chrome"] } },
      { name: "firefox", use: { ...devices["Desktop Firefox"] } },
      { name: "webkit", use: { ...devices["Desktop Safari"] } },
      { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
      { name: "iPad", use: { ...devices["iPad Pro"] } }
    );
    return out;
  }
  if (onboardingDeep || multiBrowser) {
    out.push(
      { name: "chromium", use: { ...devices["Desktop Chrome"] } },
      { name: "firefox", use: { ...devices["Desktop Firefox"] } },
      { name: "webkit", use: { ...devices["Desktop Safari"] } }
    );
  } else {
    out.push({ name: "chromium", use: { ...devices["Desktop Chrome"] } });
  }
  if (mobile) {
    out.push(
      { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
      { name: "iPad", use: { ...devices["iPad Pro"] } }
    );
  }
  return out;
}

export default defineConfig({
  testDir: "./e2e",
  globalTimeout: 2_700_000,
  globalSetup: reuseAuthStorage ? "./e2e/global-setup-auth-storage.ts" : undefined,
  globalTeardown: "./e2e/global-teardown.ts",
  // Local: serialized for stability. CI: parallelize against a production `next start` server.
  fullyParallel: !!process.env.CI,
  workers: process.env.CI ? undefined : 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace:
      process.env.PLAYWRIGHT_TRACE_FULL === "1" || process.env.PLAYWRIGHT_TRACE_FULL === "true"
        ? "on"
        : process.env.PLAYWRIGHT_TRACE_FAILURE_ONLY === "1" ||
            process.env.PLAYWRIGHT_TRACE_FAILURE_ONLY === "true"
          ? "retain-on-failure"
          : "on-first-retry",
    video:
      process.env.PLAYWRIGHT_VIDEO === "1" || process.env.PLAYWRIGHT_VIDEO === "true"
        ? "on-first-retry"
        : "off",
    screenshot: visualMode ? "on" : "off",
    ...(reuseAuthStorage ? { storageState: authStorageStateFile } : {}),
    ...(process.env.PLAYWRIGHT_CORRELATION_ID || process.env.E2E_RANDOM_SEED
      ? {
          extraHTTPHeaders: {
            ...(process.env.PLAYWRIGHT_CORRELATION_ID
              ? { "x-correlation-id": process.env.PLAYWRIGHT_CORRELATION_ID }
              : {}),
            ...(process.env.E2E_RANDOM_SEED
              ? { "x-playwright-e2e-seed": process.env.E2E_RANDOM_SEED }
              : {}),
          },
        }
      : {}),
  },
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        [
          "junit",
          {
            outputFile: process.env.PLAYWRIGHT_JUNIT_OUTPUT ?? "test-results/junit.xml",
          },
        ],
        ...(blobReport ? [["blob", { outputDir: "blob-report" }]] as const : []),
        ["json", { outputFile: process.env.PLAYWRIGHT_JSON_REPORT ?? "test-results/playwright-report.json" }],
      ]
    : blobReport
      ? ([["list"], ["blob", { outputDir: "blob-report" }]] as const)
      : [["list"]],
  projects: buildProjects(),
  webServer: process.env.PLAYWRIGHT_BASE_URL
      ? undefined
      : {
        // Use production runtime instead of dev compilation to avoid flaky
        // navigation aborts while routes compile in parallel.
        command: "npm run start",
        env: {
          ...process.env,
          OBLIXA_TRUST_FORWARDED_IP: process.env.OBLIXA_TRUST_FORWARDED_IP ?? "1",
        },
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
