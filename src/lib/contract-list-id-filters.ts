import type { createAdminClient } from "@/lib/supabase/server";
import { EVIDENCE_GAP_STATUSES } from "@/lib/evidence-status";
import { formatUnknownForServerLog } from "@/lib/observability/log-redaction";
import { getContractsMissingCriticalFields } from "@/lib/missing-critical-fields";
import { applyV10ReadModelVisibility } from "@/lib/v10-visibility";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

export type ContractListSortParam = "activity" | "created";

export function parseContractListSort(raw: string | undefined): ContractListSortParam {
  return raw === "created" ? "created" : "activity";
}

function intersectIdSets(a: string[], b: string[]): string[] {
  if (b.length === 0) return [];
  const bs = new Set(b);
  return a.filter((id) => bs.has(id));
}

/**
 * AND-combines optional contract-id sets from independent filters.
 * `null` means “no constraint from this axis”; `[]` means impossible match.
 */
export function combineContractListIntersectIds(
  parts: Array<string[] | null>
): string[] | null {
  let acc: string[] | null = null;
  for (const p of parts) {
    if (p === null) continue;
    if (p.length === 0) return [];
    acc = acc === null ? [...new Set(p)] : intersectIdSets(acc, p);
    if (acc.length === 0) return [];
  }
  return acc;
}

export async function getContractIdsWithOpenExceptions(
  admin: Admin,
  orgId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("exceptions")
    .select("contract_id")
    .eq("organization_id", orgId)
    .in("status", ["open", "in_progress"])
    .not("contract_id", "is", null);

  if (error) {
    console.error("[contract-list-id-filters] exceptions:", formatUnknownForServerLog(error.message));
    return [];
  }
  return [...new Set((data ?? []).map((r) => r.contract_id as string))];
}

/** Same union semantics as `fetchReviewQueuePage` — pending_review or any pending extracted field. */
export async function getContractIdsNeedingFieldReview(
  admin: Admin,
  orgId: string
): Promise<string[]> {
  const [pendingReviewResult, pendingFieldResult] = await Promise.all([
    admin.from("contracts").select("id").eq("organization_id", orgId).eq("status", "pending_review"),
    admin
      .from("extracted_fields")
      .select("contract_id, contracts!inner(organization_id)")
      .eq("status", "pending")
      .eq("contracts.organization_id", orgId),
  ]);

  if (pendingReviewResult.error) {
    console.error(
      "[contract-list-id-filters] pendingReview:",
      formatUnknownForServerLog(pendingReviewResult.error.message)
    );
  }
  if (pendingFieldResult.error) {
    console.error(
      "[contract-list-id-filters] pendingFields:",
      formatUnknownForServerLog(pendingFieldResult.error.message)
    );
  }

  const ids = new Set<string>();
  for (const r of pendingReviewResult.data ?? []) ids.add(r.id as string);
  for (const r of pendingFieldResult.data ?? []) ids.add(r.contract_id as string);
  return [...ids];
}

export async function getContractIdsWithOutstandingEvidence(
  admin: Admin,
  orgId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("evidence_requirements")
    .select("contract_id")
    .eq("organization_id", orgId)
    .not("contract_id", "is", null)
    .in("status", [...EVIDENCE_GAP_STATUSES]);

  if (error) {
    console.error("[contract-list-id-filters] evidence_requirements:", formatUnknownForServerLog(error.message));
    return [];
  }
  return [...new Set((data ?? []).map((r) => r.contract_id as string))];
}

export async function getContractIdsWithV10HealthWatch(
  admin: Admin,
  orgId: string,
  viewer: { role?: string | null; workspaceMode?: string | null } = {}
): Promise<string[]> {
  const query = applyV10ReadModelVisibility(
    admin.from("v10_contract_health_snapshots").select("contract_id"),
    {
      organizationId: orgId,
      role: viewer.role ?? "admin",
      workspaceMode: viewer.workspaceMode ?? "assurance",
    }
  );
  const { data, error } = await query
    .lt("score", 85)
    .not("contract_id", "is", null);

  if (error) {
    console.error("[contract-list-id-filters] v10_contract_health_snapshots:", formatUnknownForServerLog(error.message));
    return [];
  }
  return [...new Set((data ?? []).map((r) => r.contract_id as string))];
}

export async function getContractIdsMissingCriticalDates(
  admin: Admin,
  orgId: string
): Promise<string[]> {
  const rows = await getContractsMissingCriticalFields(admin, orgId);
  return rows.map((r) => r.id);
}

export interface ContractListAuxFilterParams {
  exceptions?: string;
  review?: string;
  data_quality?: string;
  evidence?: string;
  health?: string;
}

export async function resolveAuxiliaryContractListIntersectIds(
  admin: Admin,
  orgId: string,
  params: ContractListAuxFilterParams
): Promise<string[] | null> {
  const parts: Array<string[] | null> = [];

  if (params.exceptions === "open") {
    parts.push(await getContractIdsWithOpenExceptions(admin, orgId));
  }
  if (params.review === "pending") {
    parts.push(await getContractIdsNeedingFieldReview(admin, orgId));
  }
  if (params.data_quality === "missing_critical") {
    parts.push(await getContractIdsMissingCriticalDates(admin, orgId));
  }
  if (params.evidence === "outstanding") {
    parts.push(await getContractIdsWithOutstandingEvidence(admin, orgId));
  }
  if (params.health === "watch") {
    parts.push(await getContractIdsWithV10HealthWatch(admin, orgId));
  }

  return combineContractListIntersectIds(parts);
}
