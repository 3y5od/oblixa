import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
} from "@/lib/env/server";
import type { OrgRole } from "@/lib/types";

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
  const membership = await getDeterministicMembership(admin, user.id);

  if (!membership) return null;

  return {
    user,
    orgId: membership.organization_id as string,
    role: membership.role as string,
    admin,
  };
});

export async function ensureUserOrg(userId: string, orgName: string) {
  const admin = await createAdminClient();

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
  }
}
