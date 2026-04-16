#!/usr/bin/env node

import { runNpmScript } from "./process.mjs";

async function runOne(step, options = {}) {
  const script = typeof step === "string" ? step : step.script;
  const required = typeof step === "string" ? true : step.required !== false;
  const startedAt = Date.now();
  const result = await runNpmScript(script, options);
  return {
    script,
    required,
    ok: result.ok,
    code: result.code,
    durationMs: Date.now() - startedAt,
  };
}

export async function runSequential(steps, options = {}) {
  const results = [];
  for (const step of steps) {
    const out = await runOne(step, options);
    results.push(out);
    if (!out.ok && out.required) return results;
  }
  return results;
}

export async function runParallel(steps, options = {}) {
  return Promise.all(steps.map((step) => runOne(step, options)));
}
