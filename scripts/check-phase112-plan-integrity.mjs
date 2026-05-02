#!/usr/bin/env node
import { validatePhase112Integrity } from "./lib/phase112-integrity.mjs";

const r = validatePhase112Integrity();
if (!r.ok) {
  console.error(r.detail);
  process.exit(1);
}
console.log(`OK: ${r.detail}`);
