#!/usr/bin/env node
/**
 * Aggregates autonomous security program inventory checks (Phase 0 / env / lockfile).
 * @see scripts/lib/security-program-checks.mjs
 */
import { runSecurityProgramChecks } from "./lib/security-program-checks.mjs";

const { results, failures } = runSecurityProgramChecks();
for (const r of results) {
  console.log(`${r.ok ? "OK" : "FAIL"} [${r.id}] ${r.detail}`);
}
if (failures.length) {
  console.error(`\nautonomous-security-program: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nOK: autonomous security program checks passed");
