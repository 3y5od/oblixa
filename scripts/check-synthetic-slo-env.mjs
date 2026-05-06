#!/usr/bin/env node
/**
 * Validate synthetic / SLO env wiring. In strict mode, staging-backed checks must have a base URL.
 * If monitor mode is explicitly enabled (or the healthcheck ping is configured), the full trio must
 * be present to avoid half-wired monitors. Non-monitor CI jobs may still expose Supabase env.
 */
import process from "node:process";

const SLO_MONITOR_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "HC_SLO_MONITOR_PING"];

function isTruthy(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

export function analyzeSyntheticSloEnv(env = process.env) {
  const strictSynthetic = isTruthy(env.SYNTHETIC_STRICT);
  const strictSloBudgets = isTruthy(env.SLO_BUDGETS_STRICT);
  const requireSloMonitor = isTruthy(env.REQUIRE_SLO_MONITOR);
  const strict = strictSynthetic || strictSloBudgets;
  const hasStagingBaseUrl = Boolean(env.STAGING_BASE_URL?.trim());
  const configuredMonitorKeys = SLO_MONITOR_KEYS.filter((key) => Boolean(env[key]?.trim()));
  const missingMonitorKeys = SLO_MONITOR_KEYS.filter((key) => !env[key]?.trim());
  const monitorPingConfigured = configuredMonitorKeys.includes("HC_SLO_MONITOR_PING");
  const issues = [];

  if (strict && !hasStagingBaseUrl) {
    issues.push({
      issue: "missing_required_env",
      key: "STAGING_BASE_URL",
      reason: strictSynthetic && strictSloBudgets ? "synthetic_and_slo_budgets_strict" : strictSynthetic ? "synthetic_strict" : "slo_budgets_strict",
    });
  }

  if ((requireSloMonitor || monitorPingConfigured) && configuredMonitorKeys.length > 0 && missingMonitorKeys.length > 0) {
    issues.push({
      issue: "partial_slo_monitor_env",
      configured: configuredMonitorKeys,
      missing: missingMonitorKeys,
    });
  }

  return {
    ok: issues.length === 0,
    checkId: "synthetic-slo-env",
    strict,
    strictSynthetic,
    strictSloBudgets,
    requireSloMonitor,
    hasStagingBaseUrl,
    configuredSloMonitorKeys: configuredMonitorKeys,
    issues,
  };
}

const report = analyzeSyntheticSloEnv();
if (!report.ok) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
