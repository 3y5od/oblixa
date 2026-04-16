#!/usr/bin/env node

import { elapsedMs } from "./timing.mjs";

export function createResult({
  checkId,
  ok,
  strict = false,
  warnings = [],
  errors = [],
  meta = {},
  startMs,
  exitCode,
}) {
  const code = typeof exitCode === "number" ? exitCode : ok ? 0 : 1;
  return {
    checkId,
    ok,
    strict,
    warnings,
    errors,
    meta,
    generatedAt: new Date().toISOString(),
    durationMs: typeof startMs === "number" ? elapsedMs(startMs) : undefined,
    exitCode: code,
  };
}

export function printResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

export function finishWithResult(result) {
  printResult(result);
  process.exit(result.exitCode ?? (result.ok ? 0 : 1));
}
