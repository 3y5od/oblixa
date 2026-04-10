import type { AdminClient } from "@/lib/v6/service";

const MAX_CONTRACTS_PER_SCOPE = 2000;

export type ResolvedPolicyScope = {
  assignment_id: string | null;
  assignment_type: string;
  label: string;
  contract_ids: string[];
};

/**
 * Resolve contract IDs covered by a control_policy_assignments row (org-scoped).
 */
export async function resolveAssignmentContractIds(
  admin: AdminClient,
  orgId: string,
  row: {
    id: string;
    assignment_type: string;
    segment_id: string | null;
    target_ref_type: string | null;
    target_ref_id: string | null;
  }
): Promise<string[]> {
  const t = row.assignment_type;

  if (t === "global") {
    const { data } = await admin
      .from("contracts")
      .select("id")
      .eq("organization_id", orgId)
      .in("status", ["active", "pending_review"])
      .limit(MAX_CONTRACTS_PER_SCOPE);
    return (data ?? []).map((r) => String((r as { id: string }).id));
  }

  if (t === "segment" && row.segment_id) {
    const { data } = await admin
      .from("segment_memberships")
      .select("entity_ref_id")
      .eq("organization_id", orgId)
      .eq("segment_definition_id", row.segment_id)
      .eq("entity_type", "contract");
    return (data ?? []).map((r) => String((r as { entity_ref_id: string }).entity_ref_id));
  }

  if (t === "account" && row.target_ref_id) {
    const key = String(row.target_ref_id).trim();
    if (!key) return [];
    const { data } = await admin
      .from("contracts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("account_key", key)
      .in("status", ["active", "pending_review"])
      .limit(MAX_CONTRACTS_PER_SCOPE);
    return (data ?? []).map((r) => String((r as { id: string }).id));
  }

  if (t === "counterparty" && row.target_ref_id) {
    const key = String(row.target_ref_id).trim();
    if (!key) return [];
    const byKey = await admin
      .from("contracts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("counterparty_key", key)
      .in("status", ["active", "pending_review"])
      .limit(MAX_CONTRACTS_PER_SCOPE);
    const ids = new Set((byKey.data ?? []).map((r) => String((r as { id: string }).id)));
    if (ids.size === 0) {
      const byName = await admin
        .from("contracts")
        .select("id")
        .eq("organization_id", orgId)
        .ilike("counterparty", `%${key}%`)
        .in("status", ["active", "pending_review"])
        .limit(MAX_CONTRACTS_PER_SCOPE);
      for (const r of byName.data ?? []) ids.add(String((r as { id: string }).id));
    }
    return [...ids];
  }

  if (t === "program" && row.target_ref_id) {
    const programId = String(row.target_ref_id).trim();
    if (!programId) return [];
    const { data } = await admin
      .from("contract_program_assignments")
      .select("contract_id")
      .eq("organization_id", orgId)
      .eq("program_id", programId)
      .eq("status", "active")
      .limit(MAX_CONTRACTS_PER_SCOPE);
    return (data ?? []).map((r) => String((r as { contract_id: string }).contract_id));
  }

  if (t === "contract_class" && row.target_ref_id) {
    const classKey = String(row.target_ref_id).trim();
    if (!classKey) return [];
    const { data } = await admin
      .from("contracts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("contract_type", classKey)
      .in("status", ["active", "pending_review"])
      .limit(MAX_CONTRACTS_PER_SCOPE);
    return (data ?? []).map((r) => String((r as { id: string }).id));
  }

  return [];
}

export function scopeLabel(row: {
  assignment_type: string;
  segment_id: string | null;
  target_ref_type: string | null;
  target_ref_id: string | null;
}): string {
  if (row.assignment_type === "global") return "Global portfolio";
  if (row.assignment_type === "segment" && row.segment_id) return `Segment ${row.segment_id}`;
  if (row.target_ref_id) return `${row.assignment_type}:${row.target_ref_id}`;
  return row.assignment_type;
}
