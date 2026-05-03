/**
 * Test-only fault injection (Phase 45). Never enable outside tests.
 * Allowed references are confined to this module + its Vitest.
 */
export type UpstreamFaultKind = "supabase" | "stripe" | "openai";

export function maybeThrowFaultInjection(): void {
  if (process.env.TEST_FAULT_INJECTION === "1") {
    throw new Error("FAULT_INJECTION");
  }
}

/** Epic 9 — opt-in upstream fault simulation for integration-style Vitest. */
export function maybeThrowUpstreamFault(kind: UpstreamFaultKind): void {
  const envMap: Record<UpstreamFaultKind, string | undefined> = {
    supabase: process.env.TEST_FAULT_UPSTREAM_SUPABASE,
    stripe: process.env.TEST_FAULT_UPSTREAM_STRIPE,
    openai: process.env.TEST_FAULT_UPSTREAM_OPENAI,
  };
  if (envMap[kind] === "1") {
    throw new Error(`UPSTREAM_FAULT:${kind}`);
  }
}
