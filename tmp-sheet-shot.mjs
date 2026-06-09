// Focused visual check for the mobile "Filters N" bottom sheet (FilterBar).
// Captures, at a 390px mobile viewport: the closed trigger, the open sheet, and
// a pill's dropdown opening ABOVE the sheet (z-order check), light + dark.
import { chromium } from "@playwright/test";
import nextEnv from "@next/env";
import fs from "node:fs";
import path from "node:path";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = "http://127.0.0.1:3000";
const OUT = path.join(process.cwd(), ".tmp-shots");
fs.mkdirSync(OUT, { recursive: true });
const AUTH = path.join(process.cwd(), "e2e", ".auth", "user.json");
// Fall back to the documented dev login when env creds aren't set.
const E2E_EMAIL = process.env.E2E_TEST_EMAIL?.trim() || "dev@oblixa.local";
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD?.trim() || "dev-password-12345";

const browser = await chromium.launch();

async function ensureAuth(page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  if (!new URL(page.url()).pathname.startsWith("/login")) return true;
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500); // let React hydrate so submit is a client action, not a native GET
  await page.locator("input[type='email']").fill(E2E_EMAIL);
  await page.locator("input[type='password']").fill(E2E_PASSWORD);
  await page.locator("button[type='submit']").first().click();
  await page
    .waitForURL((u) => !/\/login/.test(new URL(u).pathname), { timeout: 30000, waitUntil: "domcontentloaded" })
    .catch(() => {});
  return !new URL(page.url()).pathname.startsWith("/login");
}

async function run(scheme) {
  const ctx = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 390, height: 850 },
    colorScheme: scheme,
    isMobile: true,
    hasTouch: true,
    ...(fs.existsSync(AUTH) ? { storageState: AUTH } : {}),
  });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(90000);
  if (!(await ensureAuth(page))) {
    console.log(`AUTH_FAILED(${scheme})`);
    await ctx.close();
    return false;
  }
  await ctx.storageState({ path: AUTH });

  await page.goto("/work", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000); // hydration + first-hit turbopack compile

  // 1) Closed mobile state — the "Filters N" trigger replaces the pill row.
  await page.screenshot({ path: path.join(OUT, `sheet-closed-${scheme}.png`) });

  const trigger = page.getByRole("button", { name: /^filters/i }).first();
  await trigger.click().catch((e) => console.log("trigger:", String(e)));
  await page.waitForTimeout(600);
  // 2) Open sheet — stacked full-width controls + footer Clear.
  await page.screenshot({ path: path.join(OUT, `sheet-open-${scheme}.png`) });

  // 3) Open the Status pill inside the sheet — its dropdown (dots + counts)
  //    should render ABOVE the sheet, proving the z-order.
  const statusPill = page
    .locator('[role="dialog"]')
    .getByRole("button", { name: /status/i })
    .first();
  await statusPill.click().catch((e) => console.log("pill:", String(e)));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `sheet-pill-open-${scheme}.png`) });

  await ctx.close();
  return true;
}

const ok = await run("light");
if (ok) await run("dark");
await browser.close();
console.log("DONE");
