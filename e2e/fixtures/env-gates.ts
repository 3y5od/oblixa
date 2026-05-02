/**
 * Central helpers for optional E2E env — throws with explicit reason for skip governance.
 */
export function requireEnv(name: string, reason: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing ${name}: ${reason}`);
  }
  return v;
}

export function stripePublishableKeyOrSkip(): string | null {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null;
}

/** Depth / matrix E2E — set DEPTH_MATRIX_E2E=1 when the environment mounts optional routes. */
export function requireDepthMatrixE2E(feature: string): void {
  if (process.env.DEPTH_MATRIX_E2E !== "1" && process.env.DEPTH_MATRIX_E2E !== "true") {
    throw new Error(`DEPTH_MATRIX_E2E unset: ${feature}`);
  }
}

/** PWA / service worker E2E — set RUN_PWA_SW_E2E=1 when SW update flows are testable. */
export function requirePwaServiceWorkerE2E(feature: string): void {
  if (process.env.RUN_PWA_SW_E2E !== "1" && process.env.RUN_PWA_SW_E2E !== "true") {
    throw new Error(`RUN_PWA_SW_E2E unset: ${feature}`);
  }
}
