/**
 * Test-only fault injection (Phase 45). Never enable outside tests.
 * Allowed references are confined to this module + its Vitest.
 */
export function maybeThrowFaultInjection(): void {
  if (process.env.TEST_FAULT_INJECTION === "1") {
    throw new Error("FAULT_INJECTION");
  }
}
