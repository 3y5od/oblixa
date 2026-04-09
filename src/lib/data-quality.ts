import { createAdminClient } from "@/lib/supabase/server";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

const CRITICAL_FIELDS = ["end_date", "renewal_date", "notice_window"] as const;

export async function persistContractDataQualitySnapshot(
  admin: AdminClient,
  contractId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return { ok: false, reason: "contract_not_found" };

  const [{ data: fields }, { data: tasks }, { data: obligations }] = await Promise.all([
    admin
      .from("extracted_fields")
      .select("field_name, status, updated_at")
      .eq("contract_id", contractId),
    admin
      .from("contract_tasks")
      .select("id")
      .eq("contract_id", contractId)
      .in("status", ["open", "in_progress", "blocked"]),
    admin
      .from("contract_obligations")
      .select("id")
      .eq("contract_id", contractId)
      .in("status", ["open", "in_progress"]),
  ]);

  const rows = fields ?? [];
  const approved = rows.filter((row) => row.status === "approved");
  const approvedNames = new Set(approved.map((row) => row.field_name));
  const missingCriticalCount = CRITICAL_FIELDS.filter((name) => !approvedNames.has(name)).length;
  const staleCutoffMs = Date.now() - 45 * 24 * 60 * 60 * 1000;
  const staleFieldsCount = rows.filter((row) => {
    if (!row.updated_at) return false;
    return new Date(row.updated_at).getTime() < staleCutoffMs;
  }).length;
  const unresolvedGapWeight =
    missingCriticalCount + (tasks?.length ?? 0) + (obligations?.length ?? 0);
  const totalFieldCount = rows.length;
  const approvedFieldCount = approved.length;
  const completenessScore =
    totalFieldCount === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            (approvedFieldCount / totalFieldCount) * 100 - missingCriticalCount * 5
              - unresolvedGapWeight * 1.5
          )
        );

  const { error } = await admin.from("contract_data_quality_snapshots").insert({
    organization_id: contract.organization_id,
    contract_id: contract.id,
    completeness_score: Number(completenessScore.toFixed(2)),
    stale_fields_count: staleFieldsCount,
    missing_critical_count: missingCriticalCount,
    approved_field_count: approvedFieldCount,
    total_field_count: totalFieldCount,
    generated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}
