let hooksRegistered = false;

/** Gated process-level diagnostics for sweep / incident hooks (Node only, once). */
export function registerProcessDiagnosticsHooks(): void {
  if (hooksRegistered) return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.OBLIXA_PROCESS_DIAGNOSTICS !== "1") return;
  hooksRegistered = true;

  process.on("unhandledRejection", (reason) => {
    if (process.env.OBLIXA_SWEEP_STUB_VERBOSE === "1") {
      console.error("[process-diagnostics] unhandledRejection", reason);
    }
  });

  process.on("uncaughtException", (err) => {
    if (process.env.OBLIXA_SWEEP_STUB_VERBOSE === "1") {
      console.error("[process-diagnostics] uncaughtException", err);
    }
  });
}
