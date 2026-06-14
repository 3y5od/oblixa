#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_ORG_ID, DEFAULT_ORG_NAME, seedLocalWorkspaceData } from "./lib/local-auth-workspace-seed.mjs";

const { loadEnvConfig } = nextEnv;
const LOCAL_URL_PREFIXES = ["http://127.0.0.1:", "http://localhost:"];
const LOCAL_AUTH_REACHABILITY_TIMEOUT_MS = 2_000;

function readEnv(env, key) {
  return env[key]?.trim() || null;
}

function requireEnv(key, env = process.env) {
  const value = readEnv(env, key);
  if (!value) throw new Error(`Missing required env var ${key}`);
  return value;
}

function optionalEnv(key, env = process.env) {
  return readEnv(env, key);
}

function assertLocalSupabaseUrl(url) {
  if (!LOCAL_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    throw new Error("Refusing to seed auth against a non-local Supabase URL.");
  }
}

async function assertLocalAuthReachable(supabaseUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOCAL_AUTH_REACHABILITY_TIMEOUT_MS);
  try {
    const healthUrl = new URL("/auth/v1/health", supabaseUrl);
    const response = await fetch(healthUrl, { signal: controller.signal });
    if (response.status >= 500) {
      throw new Error(`Local Supabase Auth returned ${response.status}.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Local Supabase Auth returned ")) {
      throw error;
    }
    throw new Error("Local Supabase Auth is not reachable. Start it with `supabase start` before seeding.");
  } finally {
    clearTimeout(timer);
  }
}

async function findUserByEmail(supabase, email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) return null;
    page += 1;
  }
  throw new Error("Too many local users to scan; clear the local auth database or seed manually.");
}

export function resolveSeedUsers(env = process.env) {
  const users = [
    {
      email: requireEnv("E2E_TEST_EMAIL", env).toLowerCase(),
      password: requireEnv("E2E_TEST_PASSWORD", env),
      // Realistic display name so local/preview dashboards read as production-like
      // (renders as the contract owner across the app) instead of "Local Dev User".
      fullName: "Maya Chen",
      seedWorkspace: true,
    },
  ];
  const warnings = [];
  const configuredEmail = optionalEnv("COMPREHENSIVE_PASS_EMAIL", env);
  const configuredPassword = optionalEnv("COMPREHENSIVE_PASS_PASSWORD", env);
  if (configuredEmail && configuredPassword && configuredEmail.toLowerCase() !== users[0].email) {
    users.push({
      email: configuredEmail.toLowerCase(),
      password: configuredPassword,
      fullName: optionalEnv("COMPREHENSIVE_PASS_FULL_NAME", env),
      seedWorkspace: false,
    });
  } else if (configuredEmail || configuredPassword) {
    warnings.push(
      "COMPREHENSIVE_PASS_EMAIL and COMPREHENSIVE_PASS_PASSWORD must both be set to seed that local login."
    );
  }
  return { users, warnings };
}

async function upsertLocalUser(supabase, { email, password, fullName }) {
  const existing = await findUserByEmail(supabase, email);
  const userMetadata = { full_name: fullName ?? null };
  const userResult = existing
    ? await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      })
    : await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      });

  if (userResult.error || !userResult.data.user) {
    throw userResult.error ?? new Error("Local auth seed did not return a user.");
  }
  return userResult.data.user;
}

export async function seedLocalAuth() {
  loadEnvConfig(process.cwd());

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const seedConfig = resolveSeedUsers();
  const seedUsers = seedConfig.users;

  assertLocalSupabaseUrl(supabaseUrl);
  await assertLocalAuthReachable(supabaseUrl);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error: orgError } = await supabase.from("organizations").upsert({
    id: DEFAULT_ORG_ID,
    name: DEFAULT_ORG_NAME,
    v6_org_settings_json: {
      workspace_mode: "core",
      autopilot_allow_execution: false,
      search_scope: "match_mode",
      advanced_modules_hidden: [],
      assurance_modules_hidden: [],
      onboarding_calibration: {
        version: 2,
        blocking_required: false,
        status: "completed",
      },
    },
  });
  if (orgError) throw orgError;

  const seeded = [];
  for (const seedUser of seedUsers) {
    const user = await upsertLocalUser(supabase, seedUser);

    const { error: membershipError } = await supabase
      .from("organization_members")
      .upsert(
        {
          organization_id: DEFAULT_ORG_ID,
          user_id: user.id,
          role: "admin",
        },
        { onConflict: "organization_id,user_id" }
      );
    if (membershipError) throw membershipError;

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      email: seedUser.email,
      full_name: seedUser.fullName ?? null,
      onboarding_completed_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;

    if (seedUser.seedWorkspace) {
      await seedLocalWorkspaceData(supabase, { userId: user.id, email: seedUser.email });
    }

    seeded.push({ email: seedUser.email, userId: user.id });
  }

  return {
    email: seeded[0]?.email,
    userId: seeded[0]?.userId,
    users: seeded,
    organizationId: DEFAULT_ORG_ID,
    warnings: seedConfig.warnings,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await seedLocalAuth();
    for (const warning of result.warnings) console.warn(`WARN: ${warning}`);
    console.log(
      `OK: seeded ${result.users.length} local auth user(s) in organization ${result.organizationId}.`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
