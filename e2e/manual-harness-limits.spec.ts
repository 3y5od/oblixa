/**
 * Centralized `test.skip` for harness limits (WebAuthn, biometrics, some native APIs).
 * opt-in: PLAYWRIGHT_EXPERIMENTAL_MODALITIES=1, PLAYWRIGHT_PRIVILEGED_DEVICE=1, E2E_USE_WEBAUTHN=1
 */
import { test, expect } from "@playwright/test";

const allowNative =
  (process.env.PLAYWRIGHT_EXPERIMENTAL_MODALITIES === "1" || process.env.PLAYWRIGHT_EXPERIMENTAL_MODALITIES === "true") &&
  (process.env.PLAYWRIGHT_PRIVILEGED_DEVICE === "1" || process.env.PLAYWRIGHT_PRIVILEGED_DEVICE === "true");
const useWebauthn = process.env.E2E_USE_WEBAUTHN === "1" || process.env.E2E_USE_WEBAUTHN === "true";

test.describe("Manual harness limits (stubs)", () => {
  test("WebAuthn: not run in default CI (requires E2E_USE_WEBAUTHN=1 + device)", () => {
    test.skip(
      !useWebauthn || !allowNative,
      "Set E2E_USE_WEBAUTHN=1 and PLAYWRIGHT_EXPERIMENTAL_MODALITIES=1, PLAYWRIGHT_PRIVILEGED_DEVICE=1 to explore WebAuthn in a local lab"
    );
    expect(true).toBe(true);
  });

  test("getDisplayMedia: not run in default CI (requires opt-in flags)", () => {
    test.skip(
      !allowNative,
      "Set PLAYWRIGHT_EXPERIMENTAL_MODALITIES=1, PLAYWRIGHT_PRIVILEGED_DEVICE=1 to explore screen-capture in a local lab"
    );
    expect(true).toBe(true);
  });
});
