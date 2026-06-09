// Server-friendly surface capture for the defect-pass surface sweeps.
// ONE browser context + ONE page, sequential navigation with retry-on-reset,
// color-scheme via emulateMedia (no extra contexts) — gentle on the turbopack
// dev server, which resets connections when hit by parallel heavy renders.
//
// Usage: node tmp-surface-shot.mjs [--dark] [route ...]
//   default routes = the 7 Core surfaces; default scheme = light.
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
const E2E_EMAIL = process.env.E2E_TEST_EMAIL?.trim();
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD?.trim();

const argv = process.argv.slice(2);
const scheme = argv.includes("--dark") ? "dark" : "light";
const routeArgs = argv.filter((a) => !a.startsWith("--"));
const ROUTES = routeArgs.length
  ? routeArgs
  : ["/dashboard", "/contracts", "/work", "/renewals", "/evidence", "/reports", "/settings"];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  baseURL: BASE,
  viewport: { width: 1440, height: 1000 },
  colorScheme: scheme,
  ...(fs.existsSync(AUTH) ? { storageState: AUTH } : {}),
});
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(90000); // turbopack cold-compile headroom
page.setDefaultTimeout(30000);

async function gotoWithRetry(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      return true;
    } catch (e) {
      console.log(`goto ${url} attempt ${i + 1}: ${String(e).split("\n")[0]}`);
      await page.waitForTimeout(3000); // let the dev server recover from a reset
    }
  }
  return false;
}

async function ensureAuth() {
  if (!(await gotoWithRetry("/dashboard"))) return false;
  if (!new URL(page.url()).pathname.startsWith("/login")) return true;
  if (!E2E_EMAIL || !E2E_PASSWORD) return false;
  await gotoWithRetry("/login");
  await page.locator("input[type='email']").fill(E2E_EMAIL);
  await page.locator("input[type='password']").fill(E2E_PASSWORD);
  await page.locator("button[type='submit']").first().click();
  await page
    .waitForURL((u) => !/\/login/.test(new URL(u).pathname), { timeout: 60000, waitUntil: "domcontentloaded" })
    .catch(() => {});
  return !new URL(page.url()).pathname.startsWith("/login");
}

function slug(route) {
  return route.replace(/^\//, "").replace(/\//g, "-").replace(/[^a-z0-9-]/gi, "") || "root";
}

if (!(await ensureAuth())) {
  console.log("AUTH_FAILED");
} else {
  await ctx.storageState({ path: AUTH });
  for (const route of ROUTES) {
    if (!(await gotoWithRetry(route))) {
      console.log(`SKIP ${route}`);
      continue;
    }
    await page.waitForTimeout(1500);
    const name = `surface-${slug(route)}-${scheme}.png`;
    await page
      .screenshot({ path: path.join(OUT, name), fullPage: true })
      .then(() => console.log(`shot ${name}`))
      .catch((e) => console.log(`shot ${route}: ${String(e).split("\n")[0]}`));
    await page.waitForTimeout(500); // breathe between heavy renders
  }
}
await browser.close();
console.log("DONE");
