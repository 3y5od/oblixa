#!/usr/bin/env node
/**
 * Tier 18 + 68 — optional strict compare for synthetic p0 (extend when CI publishes JSON metrics).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(new URL("..", import.meta.url)));
const budget = JSON.parse(readFileSync(join(root, "scripts", "slo-budgets.json"), "utf8"));
const strict = process.env.SLO_BUDGETS_STRICT === "1" || process.env.SLO_BUDGETS_STRICT === "true";
if (strict) {
  console.log("[slo-compare] strict mode: wire CI metrics file path; budgets:", budget);
  process.exit(0);
}
process.exit(0);
