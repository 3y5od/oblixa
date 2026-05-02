import { test, type Page } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=auth_provider_rate_limit_guard

export type LoginSubmitOutcome = "ok" | "rate_limited" | "failed";

/** Pathnames for unauthenticated marketing/legal surfaces (sign-in must leave these after submit). */
function isUnauthenticatedSurfacePath(pathname: string) {
  return (
    /^\/(login|signup|forgot-password|reset-password)(\/|$)/.test(pathname) ||
    pathname === "/" ||
    /^\/(privacy|terms|security)(\/|$)/.test(pathname)
  );
}

async function waitAfterLoginSubmit(page: Page): Promise<LoginSubmitOutcome> {
  // Sign-in redirects via server action → window.location.assign; destination may be calibration,
  // org default landing, or /dashboard — not always /dashboard.
  const reachedWorkspace = await page
    .waitForURL((url) => !isUnauthenticatedSurfacePath(new URL(url).pathname), {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    })
    .then(() => true)
    .catch(() => false);
  if (reachedWorkspace) {
    return "ok";
  }
  const rateLimited = await page
    .getByText(/too many sign-in attempts/i)
    .isVisible()
    .catch(() => false);
  if (rateLimited) {
    return "rate_limited";
  }
  return "failed";
}

/** Assumes the login form is already visible (e.g. after `goto /login`). */
export async function submitLoginFromLoginPage(
  page: Page,
  email: string,
  password: string,
): Promise<LoginSubmitOutcome> {
  await page.locator("input[type='email']").fill(email);
  await page.locator("input[type='password']").fill(password);
  await page.locator("button[type='submit']").first().click();
  return waitAfterLoginSubmit(page);
}

type EnsureAuthOptions = {
  /** Tests use `skip`; global setup should `throw` so the run fails fast. */
  onRateLimit: "skip" | "throw";
};

/**
 * Uses an existing session when present (e.g. Playwright `storageState`); otherwise signs in via /login.
 */
export async function ensureAuthenticatedSession(
  page: Page,
  email: string,
  password: string,
  options: EnsureAuthOptions = { onRateLimit: "skip" },
): Promise<void> {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  const pathname = new URL(page.url()).pathname;
  if (!pathname.startsWith("/login")) {
    return;
  }
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const outcome = await submitLoginFromLoginPage(page, email, password);
  if (outcome === "rate_limited") {
    if (options.onRateLimit === "throw") {
      throw new Error("Auth provider rate-limited this test account.");
    }
    test.skip(true, "Auth provider rate-limited this test account.");
  }
  if (outcome !== "ok") {
    const formError = await page.locator("#auth-form-error").textContent().catch(() => null);
    const alertText = await page.getByRole("alert").first().textContent().catch(() => null);
    const hint = [formError, alertText].map((s) => s?.trim()).filter(Boolean).join(" — ");
    throw new Error(
      `Login did not leave the auth surfaces (expected workspace redirect).${hint ? ` ${hint}` : ""} Check credentials or auth-provider rate limits.`,
    );
  }
}

export async function loginWithCredentials(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const outcome = await submitLoginFromLoginPage(page, email, password);
  if (outcome === "ok") {
    return;
  }
  if (outcome === "rate_limited") {
    test.skip(true, "Auth provider rate-limited this test account.");
  }
  throw new Error(
    "Login did not leave the auth surfaces (expected workspace redirect). Check credentials or auth-provider rate limits.",
  );
}
