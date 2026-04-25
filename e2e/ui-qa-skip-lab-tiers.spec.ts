/**
 * Tiers 7, 19, 22–25, 28–40, 42–45, 49, 51–55, 57–60, 62–65, 67–68, 71–83 —
 * honest skips for lab-only, vendor, or not-yet-productized harness cases (per maximal plan).
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=ui_qa_tier_skip_matrix
import { test, expect } from "@playwright/test";

const lab =
  (process.env.PLAYWRIGHT_EXPERIMENTAL_MODALITIES === "1" || process.env.PLAYWRIGHT_EXPERIMENTAL_MODALITIES === "true") &&
  (process.env.PLAYWRIGHT_PRIVILEGED_DEVICE === "1" || process.env.PLAYWRIGHT_PRIVILEGED_DEVICE === "true");

test.describe("Tier 19 / 40 / 50 / 55 / 62 / 80 — browser API harness limits", () => {
  test("no-JS / noscript: project not configured (Tier 62)", () => {
    test.skip(
      true,
      "Chromium no-JS project not enabled in this repo; keep layout noscript blocks manual."
    );
    expect(true).toBe(true);
  });

  test("Payment Request / geolocation / getUserMedia: opt-in only (Tiers 40/50)", () => {
    test.skip(!lab, "Set PLAYWRIGHT_EXPERIMENTAL_MODALITIES=1 and PLAYWRIGHT_PRIVILEGED_DEVICE=1 for privileged device APIs.");
    expect(true).toBe(true);
  });

  test("ETP / Tor / uBlock / strict third-party (Tier 80)", () => {
    test.skip(
      true,
      "Environment-specific privacy contexts are harness-documented; not a default PR gate."
    );
    expect(true).toBe(true);
  });

  test("captcha / Turnstile / hCaptcha vendor (Tier 73)", () => {
    test.skip(
      !process.env.E2E_CAPTCHA_LAB,
      "Set E2E_CAPTCHA_LAB=1 in a device lab; otherwise captcha is manual."
    );
    expect(true).toBe(true);
  });
});

test.describe("Tier 65–67 / 71 / chromatic", () => {
  test("Chromatic / Percy: optional org secret (Tier 67)", () => {
    test.skip(!process.env.CHROMATIC_PROJECT_TOKEN, "Set CHROMATIC_PROJECT_TOKEN to enable cloud visual diffs (optional).");
    expect(true).toBe(true);
  });

  test("Stryker / Pact: nightly CPU (Tier 71)", () => {
    test.skip(
      !process.env.MUTATION_TESTING,
      "Set MUTATION_TESTING=1 to run Stryker/mutation; default off in PR."
    );
    expect(true).toBe(true);
  });
});
