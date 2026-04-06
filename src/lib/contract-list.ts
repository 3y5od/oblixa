import type { createAdminClient } from "@/lib/supabase/server";
import type { Contract } from "@/lib/types";

export const CONTRACTS_PAGE_SIZE = 25;

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

export interface ContractListFilterInput {
  orgId: string;
  status?: string;
  owner?: string;
  /** When non-null and empty, no rows match (deadline preset had no hits). */
  deadlineIds: string[] | null;
  sanitizedSearch: string;
  fieldSearchIds: string[];
}

/**
 * Fetches a page of contracts with total count in one round trip.
 * Returns empty data when deadlineIds is a non-empty filter that matched nothing (caller should short-circuit earlier).
 */
export async function fetchContractsPage(
  admin: Admin,
  filters: ContractListFilterInput,
  page: number
): Promise<{ contracts: Contract[]; total: number }> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (safePage - 1) * CONTRACTS_PAGE_SIZE;
  const to = from + CONTRACTS_PAGE_SIZE - 1;

  if (filters.deadlineIds !== null && filters.deadlineIds.length === 0) {
    return { contracts: [], total: 0 };
  }

  let q = admin
    .from("contracts")
    .select("*", { count: "exact" })
    .eq("organization_id", filters.orgId)
    .order("created_at", { ascending: false });

  if (filters.status) {
    q = q.eq("status", filters.status);
  }
  if (filters.owner) {
    q = q.eq("owner_id", filters.owner);
  }
  if (filters.deadlineIds !== null && filters.deadlineIds.length > 0) {
    q = q.in("id", filters.deadlineIds);
  }

  if (filters.sanitizedSearch) {
    const orParts = [
      `title.ilike.%${filters.sanitizedSearch}%`,
      `counterparty.ilike.%${filters.sanitizedSearch}%`,
      `contract_type.ilike.%${filters.sanitizedSearch}%`,
      `search_document.ilike.%${filters.sanitizedSearch}%`,
    ];
    if (filters.fieldSearchIds.length > 0) {
      orParts.push(`id.in.(${filters.fieldSearchIds.join(",")})`);
    }
    q = q.or(orParts.join(","));
  }

  const { data, count, error } = await q.range(from, to);

  if (error) {
    console.error("fetchContractsPage", error);
    return { contracts: [], total: 0 };
  }

  return {
    contracts: (data ?? []) as Contract[],
    total: count ?? 0,
  };
}
