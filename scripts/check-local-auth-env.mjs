#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
export const AUTH_DOCTOR_TIMEOUT_MS = 2_000;

function parseEnvValue(raw) {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseDotenv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    env[match[1]] = parseEnvValue(match[2] ?? "");
  }
  return env;
}

export function loadAuthDoctorEnv(root = process.cwd(), baseEnv = process.env) {
  const loaded = {};
  for (const file of [".env", ".env.local"]) {
    const abs = path.join(root, file);
    if (fs.existsSync(abs)) {
      Object.assign(loaded, parseDotenv(fs.readFileSync(abs, "utf8")));
    }
  }
  return { ...loaded, ...baseEnv };
}

function parseUrl(value) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function isLocalhostUrl(value) {
  const url = parseUrl(value);
  if (!url) return false;
  const hostname = url.hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isSupabaseCloudUrl(value) {
  const url = parseUrl(value);
  return Boolean(url?.hostname.endsWith(".supabase.co"));
}

function issue(issues, code, message) {
  issues.push({ code, message });
}

async function probeSupabaseAuth(env, fetchImpl, issues) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return;

  const url = parseUrl(supabaseUrl);
  if (!url) return;
  const probeUrl = new URL("/auth/v1/token?grant_type=password", url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_DOCTOR_TIMEOUT_MS);

  try {
    const res = await fetchImpl(probeUrl, {
      method: "POST",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "auth-doctor-invalid@example.invalid",
        password: "invalid-password",
      }),
      signal: controller.signal,
    });
    if (res.status >= 500) {
      issue(
        issues,
        "supabase_auth_unavailable",
        `Supabase Auth returned ${res.status}; local login will fail until the auth service is healthy.`
      );
    }
  } catch (error) {
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
    issue(
      issues,
      name === "AbortError" ? "supabase_auth_timeout" : "supabase_auth_unreachable",
      name === "AbortError"
        ? `Supabase Auth did not answer within ${AUTH_DOCTOR_TIMEOUT_MS}ms.`
        : "Supabase Auth is unreachable. Start local Supabase with `supabase start` or fix NEXT_PUBLIC_SUPABASE_URL."
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeLocalAuthEnv(root = process.cwd(), options = {}) {
  const env = options.env ?? loadAuthDoctorEnv(root, options.baseEnv ?? process.env);
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const issues = [];
  const warnings = [];

  const localMode = env.NODE_ENV !== "production" && env.VERCEL !== "1";
  const appUrl = env.NEXT_PUBLIC_APP_URL ?? "";
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!fs.existsSync(path.join(root, ".env.local"))) {
    warnings.push({
      code: "env_local_missing",
      message: "No .env.local file found. Copy .env.local.example before running the app locally.",
    });
  }

  if (!appUrl) {
    issue(issues, "app_url_missing", "NEXT_PUBLIC_APP_URL is required for auth redirects.");
  } else if (localMode && !isLocalhostUrl(appUrl)) {
    issue(
      issues,
      "local_app_url_not_localhost",
      "NEXT_PUBLIC_APP_URL must be localhost for local development."
    );
  }

  if (!supabaseUrl) {
    issue(issues, "supabase_url_missing", "NEXT_PUBLIC_SUPABASE_URL is required.");
  } else if (!parseUrl(supabaseUrl)) {
    issue(issues, "supabase_url_invalid", "NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  } else if (localMode && !isLocalhostUrl(supabaseUrl)) {
    issue(
      issues,
      isSupabaseCloudUrl(supabaseUrl)
        ? "local_dev_uses_remote_supabase"
        : "local_supabase_url_not_localhost",
      `Local development should use ${LOCAL_SUPABASE_URL}, not a remote Supabase URL.`
    );
  }

  if (!anonKey) {
    issue(issues, "supabase_anon_key_missing", "NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");
  }
  if (!serviceRoleKey) {
    issue(issues, "supabase_service_role_key_missing", "SUPABASE_SERVICE_ROLE_KEY is required.");
  }
  if (env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
    issue(
      issues,
      "service_role_key_public",
      "SUPABASE service-role keys must never be exposed through NEXT_PUBLIC_* variables."
    );
  }
  if (anonKey && serviceRoleKey && anonKey === serviceRoleKey) {
    issue(
      issues,
      "supabase_keys_not_distinct",
      "Supabase anon and service-role keys must be distinct."
    );
  }

  if (options.checkReachability !== false && fetchImpl && supabaseUrl && anonKey) {
    await probeSupabaseAuth(env, fetchImpl, issues);
  }

  return {
    ok: issues.length === 0,
    issues,
    warnings,
  };
}

function printReport(report) {
  if (report.ok) {
    console.log("OK: local auth environment is usable.");
    for (const warning of report.warnings) console.warn(`WARN ${warning.code}: ${warning.message}`);
    return;
  }
  console.error("Local auth environment is not usable:");
  for (const item of report.issues) console.error(`- ${item.code}: ${item.message}`);
  for (const warning of report.warnings) console.warn(`WARN ${warning.code}: ${warning.message}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await analyzeLocalAuthEnv(process.cwd(), {
    checkReachability: !process.argv.includes("--skip-network"),
  });
  printReport(report);
  process.exit(report.ok ? 0 : 1);
}
