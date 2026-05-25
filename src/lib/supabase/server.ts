import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache as reactCache } from "react";
import {
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
} from "@/lib/env/server";
import { safeFetch } from "@/lib/security/safe-fetch";
import {
  buildSupabaseUnavailableResponse,
  isTransientSupabaseFetchFailure,
  normalizeSupabaseFetchInit,
  normalizeSupabaseFetchInput,
  SUPABASE_SERVER_FETCH_TIMEOUT_MS,
} from "@/lib/supabase/fetch";
import type { OrgRole } from "@/lib/types";
import type { OrgSettingsJson } from "@/lib/assurance/org-settings";
import { ONBOARDING_CALIBRATION_JSON_VERSION } from "@/lib/onboarding/calibration-types";
import {
  ALL_ADVANCED_NAV_MODULE_KEYS,
  ALL_ASSURANCE_NAV_MODULE_KEYS,
} from "@/lib/product-surface/workspace-module-keys";
import { resolveExplicitOrSingleMembership } from "@/lib/supabase/org-scoped-admin";

export const supabaseServerFetch: typeof fetch = async (input, init) => {
  try {
    return await safeFetch(normalizeSupabaseFetchInput(input), {
      ...normalizeSupabaseFetchInit(input, init),
      allowLocalhostInDev: true,
      timeoutMs: SUPABASE_SERVER_FETCH_TIMEOUT_MS,
    });
  } catch (error) {
    if (isTransientSupabaseFetchFailure(error)) {
      return buildSupabaseUnavailableResponse();
    }
    throw error;
  }
};

/** product-surface policy §13.1 / §17.1 — persisted on first org creation via `ensureUserOrg`. */
export const NEW_WORKSPACE_V6_ORG_SETTINGS_JSON: OrgSettingsJson = {
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
      global: {
        fetch: supabaseServerFetch,
      },
    }
  );
}

/**
 * Service-role Supabase client (bypasses RLS). Not wrapped in `react.cache`:
 * App Router route handlers (including Vercel Cron `GET`) can run outside the React
 * request cache context; `cache()` there has caused opaque 5xx in production.
 */
export async function createAdminClient() {
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
      global: {
        fetch: supabaseServerFetch,
      },
    }
  );
}

/**
 * Backward-compatible membership resolver for older call sites.
 * It no longer chooses an "earliest" organization: callers without explicit org context only
 * resolve when the user has exactly one membership. Multi-org users fail closed.
 */
export async function getDeterministicMembership(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string
): Promise<{ organization_id: string; role: OrgRole } | null> {
  const resolution = await resolveExplicitOrSingleMembership(admin, userId);
  if (!resolution.ok) return null;
  const membership = resolution.membership;
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
  const resolution = await resolveExplicitOrSingleMembership(admin, user.id);
  if (resolution.ok) {
    return {
      organization_id: resolution.membership.organization_id as string,
      role: resolution.membership.role as OrgRole,
    };
  }
  if (resolution.reason !== "organization_membership_missing") return null;
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
 * Deduplicated per React request via `reactCache` so parallel layouts / imports
 * don’t repeat `getUser()` and membership lookups.
 */
export const getAuthContext = reactCache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = await createAdminClient();
  const membership = await getOrEnsureDeterministicMembership(admin, user);

  if (!membership) return null;

  const { data: orgRow } = await admin
    .from("organizations")
    .select("mfa_required")
    .eq("id", membership.organization_id)
    .maybeSingle();

  return {
    user,
    orgId: membership.organization_id as string,
    role: membership.role as string,
    admin,
    mfaRequired: Boolean((orgRow as { mfa_required?: boolean } | null)?.mfa_required),
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

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { NEW_WORKSPACE_V6_ORG_SETTINGS_JSON as NEW_WORKSPACE_ORG_SETTINGS_JSON };
// End version-name compatibility aliases.
