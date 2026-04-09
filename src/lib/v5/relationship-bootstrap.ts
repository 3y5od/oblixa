import type { createAdminClient } from "@/lib/supabase/server";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

export async function ensureAccountWorkspaceFromContracts(
  admin: Admin,
  organizationId: string,
  accountKey: string
): Promise<{ id: string; display_name: string } | null> {
  const { data: existing } = await admin
    .from("account_workspaces")
    .select("id, display_name")
    .eq("organization_id", organizationId)
    .eq("account_key", accountKey)
    .maybeSingle();
  if (existing) return existing;

  const { data: sample } = await admin
    .from("contracts")
    .select("title, counterparty")
    .eq("organization_id", organizationId)
    .eq("account_key", accountKey)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const displayName =
    sample?.title?.trim() ||
    sample?.counterparty?.trim() ||
    `Account ${accountKey}`;

  const { data: created, error } = await admin
    .from("account_workspaces")
    .insert({
      organization_id: organizationId,
      account_key: accountKey,
      display_name: displayName,
      summary_json: { source: "bootstrap", contract_sample_title: sample?.title ?? null },
    })
    .select("id, display_name")
    .single();
  if (!error && created) return created;
  const { data: raced } = await admin
    .from("account_workspaces")
    .select("id, display_name")
    .eq("organization_id", organizationId)
    .eq("account_key", accountKey)
    .maybeSingle();
  return raced ?? null;
}

export async function ensureCounterpartyWorkspaceFromContracts(
  admin: Admin,
  organizationId: string,
  counterpartyKey: string
): Promise<{ id: string; display_name: string } | null> {
  const { data: existing } = await admin
    .from("counterparty_workspaces")
    .select("id, display_name")
    .eq("organization_id", organizationId)
    .eq("counterparty_key", counterpartyKey)
    .maybeSingle();
  if (existing) return existing;

  const { data: sample } = await admin
    .from("contracts")
    .select("title, counterparty")
    .eq("organization_id", organizationId)
    .eq("counterparty_key", counterpartyKey)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const displayName = sample?.counterparty?.trim() || sample?.title?.trim() || `Counterparty ${counterpartyKey}`;

  const { data: created, error } = await admin
    .from("counterparty_workspaces")
    .insert({
      organization_id: organizationId,
      counterparty_key: counterpartyKey,
      display_name: displayName,
      summary_json: { source: "bootstrap", contract_sample_title: sample?.title ?? null },
    })
    .select("id, display_name")
    .single();
  if (!error && created) return created;
  const { data: raced } = await admin
    .from("counterparty_workspaces")
    .select("id, display_name")
    .eq("organization_id", organizationId)
    .eq("counterparty_key", counterpartyKey)
    .maybeSingle();
  return raced ?? null;
}

export async function ensureTimelineForAccount(
  admin: Admin,
  organizationId: string,
  accountWorkspaceId: string,
  title: string
): Promise<string | null> {
  const { data: existing } = await admin
    .from("relationship_timelines")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("account_workspace_id", accountWorkspaceId)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: row, error } = await admin
    .from("relationship_timelines")
    .insert({
      organization_id: organizationId,
      account_workspace_id: accountWorkspaceId,
      counterparty_workspace_id: null,
      title,
      summary_json: {},
    })
    .select("id")
    .single();
  if (error || !row) return null;
  return row.id;
}

export async function ensureTimelineForCounterparty(
  admin: Admin,
  organizationId: string,
  counterpartyWorkspaceId: string,
  title: string
): Promise<string | null> {
  const { data: existing } = await admin
    .from("relationship_timelines")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("counterparty_workspace_id", counterpartyWorkspaceId)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: row, error } = await admin
    .from("relationship_timelines")
    .insert({
      organization_id: organizationId,
      account_workspace_id: null,
      counterparty_workspace_id: counterpartyWorkspaceId,
      title,
      summary_json: {},
    })
    .select("id")
    .single();
  if (error || !row) return null;
  return row.id;
}
