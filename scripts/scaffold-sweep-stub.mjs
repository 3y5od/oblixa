#!/usr/bin/env node
/**
 * Scaffold helper: prints a stub-class snippet and reminder to re-run the catalog generator.
 * Usage: node scripts/scaffold-sweep-stub.mjs <kebab-stub-id>
 */
import process from "node:process";

const id = process.argv[2]?.trim();
if (!id) {
  console.error("Usage: node scripts/scaffold-sweep-stub.mjs <kebab-stub-id>");
  process.exit(1);
}

console.log(`
1) Add "${id}" to an appropriate CSV bucket in scripts/debugging-sweep/bucket-definitions.mjs (or extend merge lists).
2) Run: node scripts/debugging-sweep/merge-stub-lists.mjs
3) Run: node scripts/generate-debugging-sweep-catalog.mjs
4) Run: node scripts/validate-debugging-sweep-provenance.mjs

Optional manual stub module (only if you need non-noop behavior):
// src/lib/debugging-sweep/stubs/stub-${id}.ts
export function registerStub${id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}(): void {
  if (process.env.OBLIXA_SWEEP_STUB_VERBOSE === "1") console.debug("[sweep-stub]", "${id}");
}
`);
