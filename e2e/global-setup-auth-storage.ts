import { chromium, type FullConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import * as fs from "node:fs";
import * as path from "node:path";
import { ensureAuthenticatedSession } from "./login-test-user";

loadEnvConfig(process.cwd());

const AUTH_DIR = path.join(process.cwd(), "e2e", ".auth");
const AUTH_FILE = path.join(AUTH_DIR, "user.json");

async function waitForAppHttpReady(baseURL: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseURL.replace(/\/$/, "")}/login`, {
        redirect: "manual",
        signal: AbortSignal.timeout(5_000),
      });
      if (res.status >= 200 && res.status < 500) {
        return;
      }
    } catch {
      // Server still booting or TCP not bound yet.
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`Timed out waiting for app at ${baseURL} (login probe).`);
}

/**
 * Runs before tests when PLAYWRIGHT_REUSE_AUTH_STORAGE=1.
 * Logs in once and saves storage state so authenticated specs avoid repeated sign-ins.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const email = process.env.E2E_TEST_EMAIL?.trim();
  const password = process.env.E2E_TEST_PASSWORD?.trim();
  if (!email || !password) {
    return;
  }

  const baseURL =
    (config.projects[0]?.use?.baseURL as string | undefined) ??
    process.env.PLAYWRIGHT_BASE_URL ??
    "http://127.0.0.1:3000";

  fs.mkdirSync(AUTH_DIR, { recursive: true });

  await waitForAppHttpReady(baseURL, 120_000);

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    await ensureAuthenticatedSession(page, email, password, { onRateLimit: "throw" });
    await context.storageState({ path: AUTH_FILE });
  } finally {
    await browser.close();
  }
}
