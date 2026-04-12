/** Pure check for risky debug flags in production (used by `instrumentation.ts` + tests). */
export function hasProductionDebugMisconfiguration(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (env.NODE_ENV !== "production") return false;
  const nodeOpts = env.NODE_OPTIONS ?? "";
  return Boolean(
    env.DEBUG ||
      env.NODE_DEBUG ||
      nodeOpts.includes("--inspect-brk") ||
      nodeOpts.includes("--inspect")
  );
}
