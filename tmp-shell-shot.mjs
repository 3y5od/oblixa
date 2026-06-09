// Focused visual check for the app-shell defect pass increment 1.
// Captures: expanded sidebar, collapsed rail (badge collision check),
// account menu (wrap + width), and the legal footer (notice wrap), light + dark.
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

const browser = await chromium.launch();

function ctxFor(colorScheme, width = 1440) {
  return browser.newContext({
    baseURL: BASE,
    viewport: { width, height: 1000 },
    colorScheme,
    ...(fs.existsSync(AUTH) ? { storageState: AUTH } : {}),
  });
}

const E2E_EMAIL = process.env.E2E_TEST_EMAIL?.trim();
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD?.trim();

// Reuse the saved session when valid; otherwise sign in via /login (the saved
// session expires, so the harness self-heals instead of bailing).
async function ensureAuth(page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  if (!new URL(page.url()).pathname.startsWith("/login")) return true;
  if (!E2E_EMAIL || !E2E_PASSWORD) return false;
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("input[type='email']").fill(E2E_EMAIL);
  await page.locator("input[type='password']").fill(E2E_PASSWORD);
  await page.locator("button[type='submit']").first().click();
  await page
    .waitForURL((u) => !/\/login/.test(new URL(u).pathname), { timeout: 30000, waitUntil: "domcontentloaded" })
    .catch(() => {});
  return !new URL(page.url()).pathname.startsWith("/login");
}

async function captureShell(scheme) {
  const ctx = await ctxFor(scheme);
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(90000); // turbopack cold-compiles /dashboard on first hit
  if (!(await ensureAuth(page))) {
    console.log(`AUTH_FAILED(${scheme})`);
    await ctx.close();
    return false;
  }
  await ctx.storageState({ path: AUTH });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  // Wait for the async nav-badge fetch so the rail badges are present in shots.
  await page.waitForResponse((r) => r.url().includes("/api/workspace/nav-badges"), { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Normalize to EXPANDED first — the collapsed pref persists in localStorage, so
  // a blind toggle is non-deterministic. aria-expanded on the toggle = sidebar state.
  const toggle = page.locator('[data-testid="sidebar-collapse-toggle"]');
  if ((await toggle.getAttribute("aria-expanded").catch(() => null)) === "false") {
    await toggle.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // 1) Expanded sidebar — full chrome
  await page.screenshot({ path: path.join(OUT, `shell-expanded-${scheme}.png`) });
  await page.locator("header.ui-topbar").screenshot({ path: path.join(OUT, `topbar-wide-${scheme}.png`) }).catch((e) => console.log("topbarwide:", String(e)));

  // 2) Account menu open (wrap + clamped width)
  await page.getByRole("button", { name: /account menu for/i }).click().catch((e) => console.log("acct:", String(e)));
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, `shell-account-${scheme}.png`) });
  await page.locator('[role="menu"]').screenshot({ path: path.join(OUT, `shell-account-crop-${scheme}.png`) }).catch((e) => console.log("acctcrop:", String(e)));
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(200);

  // 3) Collapse the rail → badge collision check
  await page.locator('[data-testid="sidebar-collapse-toggle"]').click().catch((e) => console.log("collapse:", String(e)));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `shell-collapsed-${scheme}.png`) });
  // Tight crop of the rail so the Contracts "19" badge is clearly inspectable
  await page.screenshot({ path: path.join(OUT, `shell-collapsed-rail-${scheme}.png`), clip: { x: 0, y: 0, width: 120, height: 480 } });
  // Restore expanded
  await page.locator('[data-testid="sidebar-collapse-toggle"]').click().catch(() => {});
  await page.waitForTimeout(300);

  // 4) Footer notice (wrap) — element screenshot
  const footer = page.locator("#legal-footer");
  await footer.scrollIntoViewIfNeeded().catch(() => {});
  await footer.screenshot({ path: path.join(OUT, `footer-${scheme}-1440.png`) }).catch((e) => console.log("footer:", String(e)));

  await ctx.close();
  return true;
}

// Narrow pass: footer wrap + no truncation when the row is constrained.
async function captureFooterNarrow(scheme) {
  const ctx = await ctxFor(scheme, 760);
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(90000); // turbopack cold-compiles /dashboard on first hit
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  if (new URL(page.url()).pathname.startsWith("/login")) {
    await ctx.close();
    return;
  }
  await page.waitForTimeout(900);
  const footer = page.locator("#legal-footer");
  await footer.scrollIntoViewIfNeeded().catch(() => {});
  await footer.screenshot({ path: path.join(OUT, `footer-${scheme}-760.png`) }).catch((e) => console.log("footer-narrow:", String(e)));
  await ctx.close();
}

// Tight topbar: confirms the placeholder shortens to "Search workspace" and the
// ⌘K badge drops when the committed-search width falls below the threshold.
async function captureTopbarTight(scheme) {
  const ctx = await ctxFor(scheme, 440);
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(90000); // turbopack cold-compiles /dashboard on first hit
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  if (new URL(page.url()).pathname.startsWith("/login")) {
    await ctx.close();
    return;
  }
  await page.waitForTimeout(1200);
  await page.locator("header.ui-topbar").screenshot({ path: path.join(OUT, `topbar-tight-${scheme}.png`) }).catch((e) => console.log("topbartight:", String(e)));
  await ctx.close();
}

// Breadcrumb parent/leaf case (Contracts › Review fields) — the user's exact view.
async function captureBreadcrumb(scheme) {
  const ctx = await ctxFor(scheme);
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(90000);
  if (!(await ensureAuth(page))) {
    await ctx.close();
    return;
  }
  await page.goto("/contracts/review", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1600);
  await page.locator("header.ui-topbar").screenshot({ path: path.join(OUT, `topbar-breadcrumb-${scheme}.png`) }).catch((e) => console.log("bc:", String(e)));
  await ctx.close();
}

const ok = await captureShell("light");
if (ok) {
  await captureShell("dark");
  await captureFooterNarrow("light");
  await captureTopbarTight("light");
  await captureBreadcrumb("light");
}
await browser.close();
console.log("DONE");
