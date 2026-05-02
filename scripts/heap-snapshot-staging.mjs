#!/usr/bin/env node
/**
 * Tier F only: requires PERF_HEAP_SNAPSHOT_STAGING=1.
 * Writes a heap snapshot when explicitly enabled for staging fixtures.
 */
import fs from "node:fs";
import path from "node:path";
import { writeHeapSnapshot } from "node:v8";

if (process.env.PERF_HEAP_SNAPSHOT_STAGING !== "1") {
  console.error("Refusing: set PERF_HEAP_SNAPSHOT_STAGING=1 only on approved staging fixtures.");
  process.exit(2);
}
const out = path.resolve(
  process.cwd(),
  process.argv[2] ?? path.join(".tmp", `heap-${Date.now()}.heapsnapshot`),
);
fs.mkdirSync(path.dirname(out), { recursive: true });
writeHeapSnapshot(out);
console.log(`Heap snapshot written: ${out}`);
