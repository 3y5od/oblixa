#!/usr/bin/env node
/**
 * Local maximal QA — mirrors core CI gates without full universe.
 */
import { runNpmScript } from "./lib/process.mjs";

const steps = ["qa:sweep:max:p4", "test:e2e:smoke"];

let failed = null;
for (const script of steps) {
  const r = await runNpmScript(script);
  if (!r.ok) {
    failed = { script, code: r.code };
    break;
  }
}

console.log(JSON.stringify({ pipeline: "qa-local-max", steps, failed }, null, 2));
process.exit(failed ? failed.code ?? 1 : 0);
