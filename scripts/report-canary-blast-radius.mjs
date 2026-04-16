#!/usr/bin/env node
import { CRON_ROUTE_EXPECTED_KEYS } from "./cron-route-expected-keys.mjs";

const routes = Array.from(CRON_ROUTE_EXPECTED_KEYS.keys());
const classes = {
  v4: routes.filter((r) => r.includes("/cron/v4/")).length,
  v5: routes.filter((r) => r.includes("/cron/v5/")).length,
  v6: routes.filter((r) => r.includes("/cron/v6/")).length,
  general: routes.filter((r) => !r.includes("/cron/v")).length,
};
const blastRadiusHint = routes.length > 30 ? "high_surface_area" : "moderate_surface_area";
const recommendedRollbackPath =
  blastRadiusHint === "high_surface_area"
    ? "Disable canary and pause cron rollouts before broad rollback."
    : "Rollback affected cron family and re-run canary.";

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totalCronSurfaceCount: routes.length,
      classes,
      blastRadiusHint,
      recommendedRollbackPath,
    },
    null,
    2
  )
);
