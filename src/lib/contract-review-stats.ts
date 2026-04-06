import type { createAdminClient } from "@/lib/supabase/server";
import type { Contract } from "@/lib/types";
import { CONTRACT_LIST_ROW_COLUMNS, CONTRACTS_PAGE_SIZE } from "@/lib/contract-list";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

export interface ContractReviewStats {
  total: number;
  pending: number;
  approved: number;
}

/**
 * Aggregates extracted field counts per contract for table progress indicators.
 */
export async function getReviewStatsForContractIds(
  admin: Admin,
  contractIds: string[]
): Promise<Record<string, ContractReviewStats>> {
  const empty: Record<string, ContractReviewStats> = {};
  if (contractIds.length === 0) return empty;

  const { data, error } = await admin
    .from("extracted_fields")
    .select("contract_id, status")
    .in("contract_id", contractIds);

  if (error) {
    console.error("getReviewStatsForContractIds", error);
    return empty;
  }

  const map: Record<string, ContractReviewStats> = {};
  for (const id of contractIds) {
    map[id] = { total: 0, pending: 0, approved: 0 };
  }

  for (const row of data ?? []) {
    const id = row.contract_id as string;
    const bucket = map[id];
    if (!bucket) continue;
    bucket.total += 1;
    if (row.status === "pending") bucket.pending += 1;
    if (row.status === "approved") bucket.approved += 1;
  }

  return map;
}

export interface ReviewQueuePageResult {
  contracts: Contract[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Contracts that need human attention: pending_review status or any pending extracted field.
 * Sorted by pending_review first, then pending field count (desc), then oldest created first.
 */
export async function fetchReviewQueuePage(
  admin: Admin,
  orgId: string,
  page: number
): Promise<ReviewQueuePageResult> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const pageSize = CONTRACTS_PAGE_SIZE;

  const [{ data: pendingReviewRows }, { data: pendingFieldRows }] = await Promise.all([
    admin.from("contracts").select("id").eq("organization_id", orgId).eq("status", "pending_review"),
    admin
      .from("extracted_fields")
      .select("contract_id, contracts!inner(organization_id)")
      .eq("status", "pending")
      .eq("contracts.organization_id", orgId),
  ]);

  const pendingReviewIds = new Set((pendingReviewRows ?? []).map((r) => r.id as string));
  const pendingCountByContractId: Record<string, number> = {};

  for (const row of pendingFieldRows ?? []) {
    const cid = row.contract_id as string;
    pendingCountByContractId[cid] = (pendingCountByContractId[cid] ?? 0) + 1;
  }

  const unionIds = new Set<string>([...pendingReviewIds, ...Object.keys(pendingCountByContractId)]);

  if (unionIds.size === 0) {
    return { contracts: [], total: 0, page: safePage, pageSize };
  }

  const { data: contractRows, error } = await admin
    .from("contracts")
    .select(CONTRACT_LIST_ROW_COLUMNS)
    .eq("organization_id", orgId)
    .in("id", [...unionIds])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchReviewQueuePage", error);
    return { contracts: [], total: 0, page: safePage, pageSize };
  }

  const list = (contractRows ?? []) as Contract[];

  list.sort((a, b) => {
    const ar = a.status === "pending_review" ? 1 : 0;
    const br = b.status === "pending_review" ? 1 : 0;
    if (br !== ar) return br - ar;
    const pa = pendingCountByContractId[a.id] ?? 0;
    const pb = pendingCountByContractId[b.id] ?? 0;
    if (pb !== pa) return pb - pa;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const total = list.length;
  const from = (safePage - 1) * pageSize;
  const pageSlice = list.slice(from, from + pageSize);

  return {
    contracts: pageSlice,
    total,
    page: safePage,
    pageSize,
  };
}
