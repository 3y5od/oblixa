import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSyntheticSloEnv } from "./check-synthetic-slo-env.mjs";

test("synthetic strict requires STAGING_BASE_URL", () => {
  const report = analyzeSyntheticSloEnv({ SYNTHETIC_STRICT: "1" });
  assert.equal(report.ok, false);
  assert.equal(report.issues[0]?.key, "STAGING_BASE_URL");
});

test("partial slo-monitor env is rejected", () => {
  const report = analyzeSyntheticSloEnv({
    STAGING_BASE_URL: "https://staging.example.com",
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.com",
    HC_SLO_MONITOR_PING: "https://hc.example/ping",
  });
  assert.equal(report.ok, false);
  assert.equal(report.issues[0]?.issue, "partial_slo_monitor_env");
  assert.deepEqual(report.issues[0]?.missing, ["SUPABASE_SERVICE_ROLE_KEY"]);
});

test("plain Supabase env without monitor ping is tolerated in non-monitor CI jobs", () => {
  const report = analyzeSyntheticSloEnv({
    STAGING_BASE_URL: "https://staging.example.com",
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.com",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  });
  assert.equal(report.ok, true);
});

test("REQUIRE_SLO_MONITOR enforces the full monitor trio", () => {
  const report = analyzeSyntheticSloEnv({
    REQUIRE_SLO_MONITOR: "1",
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.com",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  });
  assert.equal(report.ok, false);
  assert.equal(report.issues[0]?.issue, "partial_slo_monitor_env");
  assert.deepEqual(report.issues[0]?.missing, ["HC_SLO_MONITOR_PING"]);
});

test("strict synthetic env passes when staging and full monitor trio are present", () => {
  const report = analyzeSyntheticSloEnv({
    SYNTHETIC_STRICT: "true",
    STAGING_BASE_URL: "https://staging.example.com",
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.com",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    HC_SLO_MONITOR_PING: "https://hc.example/ping",
  });
  assert.equal(report.ok, true);
});