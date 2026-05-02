import { getSweepCatalogStats } from "./catalog-index.server";
import { getStubsRegisteredCount, registerDebuggingSweepStubs } from "./stubs/register-stubs";
import { registerProcessDiagnosticsHooks } from "@/lib/observability/process-diagnostics";

let runtimeRegistered = false;

export function getSweepRuntimeStats() {
  const catalog = getSweepCatalogStats();
  return {
    ...catalog,
    runtimeRegistered,
    stubRegistrationCount: getStubsRegisteredCount(),
  };
}

/**
 * Ordered phases: stubs → process hooks. Safe to call multiple times (no-op after first).
 * Call only from Node `instrumentation` (not Edge).
 */
export function registerDebuggingSweepRuntime(): void {
  if (runtimeRegistered) return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  runtimeRegistered = true;
  registerDebuggingSweepStubs();
  registerProcessDiagnosticsHooks();
}
