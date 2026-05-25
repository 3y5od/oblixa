import type { createAdminClient } from "@/lib/supabase/server";
import { differenceInCalendarDays, isValid } from "date-fns";
import { CRITICAL_DATE_FIELDS } from "@/lib/contract-filters";
import { EVIDENCE_GAP_STATUSES } from "@/lib/evidence-status";
import { applyV10ReadModelVisibility } from "@/lib/visibility";
import { parseBusinessDateAtNoon } from "@/lib/business-dates";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

export interface ContractListRowSignals {
  openExceptionCount: number;
  openWorkCount: number;
  outstandingEvidenceCount: number;
  missingCriticalDates: boolean;
  nextHorizonField: string | null;
  nextHorizonDate: string | null;
  nextHorizonDays: number | null;
}

const emptySignals = (): ContractListRowSignals => ({
  openExceptionCount: 0,
  openWorkCount: 0,
  outstandingEvidenceCount: 0,
  missingCriticalDates: false,
  nextHorizonField: null,
  nextHorizonDate: null,
  nextHorizonDays: null,
});

/**
 * Batch-loads lightweight operational chips for the contracts table (§9.2).
 */
export async function getContractListRowSignalsMap(
  admin: Admin,
  orgId: string,
  contractIds: string[],
  viewer: { role?: string | null; workspaceMode?: string | null } = {}
): Promise<Record<string, ContractListRowSignals>> {
  const map: Record<string, ContractListRowSignals> = {};
  for (const id of contractIds) map[id] = emptySignals();
  if (contractIds.length === 0) return map;

  const visibleWorkQuery = applyV10ReadModelVisibility(
    admin.from("v10_work_items").select("contract_id"),
    {
      organizationId: orgId,
      role: viewer.role ?? "viewer",
      workspaceMode: viewer.workspaceMode ?? "core",
    }
  );

  const [
    { data: exRows, error: exErr },
    { data: evRows, error: evErr },
    { data: workRows, error: workErr },
    { data: stRows, error: stErr },
  ] =
    await Promise.all([
      admin
        .from("exceptions")
        .select("contract_id")
        .eq("organization_id", orgId)
        .in("contract_id", contractIds)
        .in("status", ["open", "in_progress"]),
      admin
        .from("evidence_requirements")
        .select("contract_id")
        .eq("organization_id", orgId)
        .in("contract_id", contractIds)
        .in("status", [...EVIDENCE_GAP_STATUSES]),
      visibleWorkQuery
        .in("contract_id", contractIds)
        .neq("status", "done")
        .neq("status", "canceled"),
      admin.from("contracts").select("id, status").eq("organization_id", orgId).in("id", contractIds),
    ]);

  if (exErr) console.error("[contract-list-row-signals] exceptions:", exErr.message);
  if (evErr) console.error("[contract-list-row-signals] evidence:", evErr.message);
  if (workErr) console.error("[contract-list-row-signals] work:", workErr.message);
  if (stErr) console.error("[contract-list-row-signals] contracts:", stErr.message);

  for (const r of exRows ?? []) {
    const cid = r.contract_id as string;
    if (map[cid]) map[cid].openExceptionCount += 1;
  }
  for (const r of evRows ?? []) {
    const cid = r.contract_id as string;
    if (map[cid]) map[cid].outstandingEvidenceCount += 1;
  }
  for (const r of workRows ?? []) {
    const cid = r.contract_id as string;
    if (map[cid]) map[cid].openWorkCount += 1;
  }

  const statusById = new Map((stRows ?? []).map((r) => [r.id as string, r.status as string]));
  const needsCriticalCheck = contractIds.filter((id) => {
    const s = statusById.get(id);
    return s === "pending_review" || s === "active";
  });

  if (needsCriticalCheck.length > 0) {
    const { data: fields, error: fErr } = await admin
      .from("extracted_fields")
      .select("contract_id, field_name, field_value, status")
      .in("contract_id", needsCriticalCheck)
      .in("field_name", [...CRITICAL_DATE_FIELDS]);

    if (fErr) {
      console.error("[contract-list-row-signals] extracted_fields:", fErr.message);
    } else {
      const covered = new Set<string>();
      const today = new Date();
      for (const f of fields ?? []) {
        const contractId = f.contract_id as string;
        if (
          f.status === "approved" &&
          typeof f.field_value === "string" &&
          f.field_value.trim().length > 0
        ) {
          covered.add(contractId);
          const parsed = parseBusinessDateAtNoon(f.field_value);
          if (!parsed || !isValid(parsed)) continue;
          const nextDays = differenceInCalendarDays(parsed, today);
          const existingDays = map[contractId]?.nextHorizonDays;
          if (
            map[contractId] &&
            (existingDays == null || nextDays < existingDays)
          ) {
            map[contractId].nextHorizonField = String(f.field_name);
            map[contractId].nextHorizonDate = String(f.field_value);
            map[contractId].nextHorizonDays = nextDays;
          }
        }
      }
      for (const id of needsCriticalCheck) {
        if (map[id] && !covered.has(id)) map[id].missingCriticalDates = true;
      }
    }
  }

  return map;
}
