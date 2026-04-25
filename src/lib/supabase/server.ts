import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
} from "@/lib/env/server";
import type { OrgRole } from "@/lib/types";
import type { V6OrgSettingsJson } from "@/lib/v6/org-settings";
import { ONBOARDING_CALIBRATION_JSON_VERSION } from "@/lib/onboarding/calibration-types";
import {
  ALL_ADVANCED_NAV_MODULE_KEYS,
  ALL_ASSURANCE_NAV_MODULE_KEYS,
} from "@/lib/product-surface/workspace-module-keys";

/** product-surface policy §13.1 / §17.1 — persisted on first org creation via `ensureUserOrg`. */
export const NEW_WORKSPACE_V6_ORG_SETTINGS_JSON: V6OrgSettingsJson = {
  workspace_mode: "core",
  autopilot_allow_execution: false,
  search_scope: "match_mode",
  advanced_modules_hidden: [...ALL_ADVANCED_NAV_MODULE_KEYS],
  assurance_modules_hidden: [...ALL_ASSURANCE_NAV_MODULE_KEYS],
  onboarding_calibration: {
    version: ONBOARDING_CALIBRATION_JSON_VERSION,
    blocking_required: true,
    status: "pending",
  },
};

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicEnv();

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — ignore.
            // Cookies can only be modified in a Server Action or Route Handler.
          }
        },
      },
    }
  );
}

/** One service-role client per request (safe to reuse; avoids duplicate handshakes). */
export const createAdminClient = cache(async () => {
  const { url } = getSupabasePublicEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return createServerClient(
    url,
    serviceRoleKey,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
});

/**
 * Picks one org per user for server-side resolution (dashboard, API routes, server actions).
 * Uses the earliest membership by `created_at`. There is no org switcher yet; users in multiple
 * orgs always resolve to this same row everywhere `getDeterministicMembership` is used.
 */
export async function getDeterministicMembership(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string
): Promise<{ organization_id: string; role: OrgRole } | null> {
  const { data: memberships } = await admin
    .from("organization_members")
    .select("organization_id, role, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  const membership = memberships?.[0];
  if (!membership?.organization_id || !membership?.role) return null;
  return {
    organization_id: membership.organization_id as string,
    role: membership.role as OrgRole,
  };
}

type UserWithOptionalProfile = {
  id: string;
  user_metadata?: {
    full_name?: unknown;
  } | null;
};

export function resolveDefaultOrganizationNameForUser(user: {
  user_metadata?: {
    full_name?: unknown;
  } | null;
}): string {
  const fullName = typeof user.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name.trim()
    : "";
  return fullName ? `${fullName}'s Organization` : "My Organization";
}

export async function getOrEnsureDeterministicMembership(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  user: UserWithOptionalProfile
): Promise<{ organization_id: string; role: OrgRole } | null> {
  const membership = await getDeterministicMembership(admin, user.id);
  if (membership) return membership;
  await ensureUserOrg(user.id, resolveDefaultOrganizationNameForUser(user), admin);
  return await getDeterministicMembership(admin, user.id);
}

export async function getUserOrgId(userId: string): Promise<string | null> {
  const admin = await createAdminClient();
  const membership = await getDeterministicMembership(admin, userId);
  return membership?.organization_id ?? null;
}

/**
 * Returns { user, orgId, admin } after verifying auth and resolving org.
 * Uses the anon client for auth verification and the admin client for
 * data queries, bypassing RLS which can fail when the JWT isn't properly
 * propagated to PostgREST in Server Components.
 *
 * Deduplicated per React request via `cache` so parallel layouts / imports
 * don’t repeat `getUser()` and membership lookups.
 */
export const getAuthContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = await createAdminClient();
  const membership = await getOrEnsureDeterministicMembership(admin, user);

  if (!membership) return null;

  return {
    user,
    orgId: membership.organization_id as string,
    role: membership.role as string,
    admin,
  };
});

export async function ensureUserOrg(
  userId: string,
  orgName: string,
  adminClient?: Awaited<ReturnType<typeof createAdminClient>>
) {
  const admin = adminClient ?? (await createAdminClient());

  const { data: existing } = await admin
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (existing) return;

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: orgName })
    .select("id")
    .single();

  if (orgError || !org) {
    console.error("Failed to create org:", orgError?.message);
    return;
  }

  const { error: memberError } = await admin
    .from("organization_members")
    .upsert(
      {
        organization_id: org.id,
        user_id: userId,
        role: "admin",
      },
      { onConflict: "organization_id,user_id", ignoreDuplicates: true }
    );

  if (memberError) {
    console.error("Failed to create membership:", memberError.message);
    return;
  }

  // product-surface policy §13.1 + §17.1 — new workspaces start in Core with no mutating autopilot execution.
  await admin
    .from("organizations")
    .update({
      v6_org_settings_json: { ...NEW_WORKSPACE_V6_ORG_SETTINGS_JSON },
    })
    .eq("id", org.id);
}
