#!/usr/bin/env node
/**
 * Tier 18 + 68 — optional strict compare for synthetic p0 (extend when CI publishes JSON metrics).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(new URL("..", import.meta.url)));
const budget = JSON.parse(readFileSync(join(root, "scripts", "slo-budgets.json"), "utf8"));
const strict = process.env.SLO_BUDGETS_STRICT === "1" || process.env.SLO_BUDGETS_STRICT === "true");
const allowPath = join(root, "artifacts", "red-metrics-allowlist.json");
let allow = null;
try {
  allow = JSON.parse(readFileSync(allowPath, "utf8"));
} catch {
  allow = null;
}
if (strict) {
  const burnStub = {
    windowsMinutes: [5, 30, 120],
    allowlistMetricCount: allow?.metricNames?.length ?? 0,
    note: "Burn-rate simulation stub; wire CI Prometheus JSON in SLO_BUDGETS_STRICT follow-up.",
  };
  console.log("[slo-compare] strict mode:", JSON.stringify({ budget, burnStub }, null, 2));
  process.exit(0);
}
process.exit(0);
