import type { createAdminClient } from "@/lib/supabase/server";
import { CRITICAL_DATE_FIELDS } from "@/lib/contract-filters";
import type { Contract } from "@/lib/types";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

/**
 * Contracts in pending_review or active with no approved value for any of
 * end_date, renewal_date, or notice_window.
 */
export async function getContractsMissingCriticalFields(
  admin: Admin,
  orgId: string
): Promise<Pick<Contract, "id" | "title" | "counterparty">[]> {
  const { data: contracts } = await admin
    .from("contracts")
    .select("id, title, counterparty")
    .eq("organization_id", orgId)
    .in("status", ["pending_review", "active"])
    .order("updated_at", { ascending: false })
    .limit(200);

  if (!contracts?.length) return [];

  const ids = contracts.map((c) => c.id);
  const { data: fields } = await admin
    .from("extracted_fields")
    .select("contract_id, field_name, field_value, status")
    .in("contract_id", ids)
    .in("field_name", [...CRITICAL_DATE_FIELDS]);

  const covered = new Set<string>();
  for (const f of fields ?? []) {
    if (
      f.status === "approved" &&
      typeof f.field_value === "string" &&
      f.field_value.trim().length > 0
    ) {
      covered.add(f.contract_id as string);
    }
  }

  return contracts.filter((c) => !covered.has(c.id));
}
