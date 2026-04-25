#!/usr/bin/env node
/**
 * Tier 46 — data hygiene: placeholder for `E2E_TEARDOWN=1` purge of prefixed rows (Supabase/DB).
 * Safe default: no-op with exit 0.
 */
if (process.env.E2E_TEARDOWN === "1" || process.env.E2E_TEARDOWN === "true") {
  console.log("[e2e-teardown] E2E_TEARDOWN is set; implement org purge against your env before use.");
}
process.exit(0);
