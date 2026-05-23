import type { createAdminClient } from "@/lib/supabase/server";
import type { Contract } from "@/lib/types";

export const CONTRACTS_PAGE_SIZE = 25;

/** List/table rows: omits `search_document` (up to ~120k chars) for bandwidth and memory. */
export const CONTRACT_LIST_ROW_COLUMNS =
  "id, organization_id, title, counterparty, contract_type, status, region, owner_id, created_by, created_at, updated_at";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

export type ContractListSortKey = "activity" | "created";

export interface ContractListFilterInput {
  orgId: string;
  status?: string;
  owner?: string;
  counterparty?: string;
  contractType?: string;
  region?: string;
  /**
   * Narrow to these contract ids (AND with all other filters).
   * `null` — no id cap; `[]` — impossible (caller may short-circuit).
   */
  intersectIds: string[] | null;
  sanitizedSearch: string;
  fieldSearchIds: string[];
  /** `activity` → `updated_at` (default operational scan); `created` → `created_at`. */
  sort: ContractListSortKey;
}

type ContractsPageSnapshot = {
  rows?: unknown[];
  total?: unknown;
};

export type ContractsPageResult = {
  contracts: Contract[];
  total: number;
  error?: string | null;
};

function canUseContractsPageSnapshot(filters: ContractListFilterInput): boolean {
  return (
    filters.intersectIds === null &&
    filters.fieldSearchIds.length === 0 &&
    !filters.counterparty &&
    !filters.contractType
  );
}

function parseContractsPageSnapshot(data: unknown): { contracts: Contract[]; total: number } | null {
  if (!data || typeof data !== "object") return null;
  const snapshot = data as ContractsPageSnapshot;
  if (!Array.isArray(snapshot.rows)) return null;
  return {
    contracts: snapshot.rows as Contract[],
    total: Number(snapshot.total) || 0,
  };
}

async function fetchContractsPageSnapshot(
  admin: Admin,
  filters: ContractListFilterInput,
  page: number
): Promise<{ contracts: Contract[]; total: number } | null> {
  if (!canUseContractsPageSnapshot(filters)) return null;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const offset = (safePage - 1) * CONTRACTS_PAGE_SIZE;
  const { data, error } = await admin.rpc("contracts_page_snapshot", {
    p_org_id: filters.orgId,
    p_limit: CONTRACTS_PAGE_SIZE,
    p_offset: offset,
    p_search: filters.sanitizedSearch || null,
    p_status: filters.status || null,
    p_owner_id: filters.owner || null,
    p_region: filters.region || null,
    p_sort: filters.sort,
  });
  if (error) {
    console.error("contracts_page_snapshot", error);
    return null;
  }
  return parseContractsPageSnapshot(data);
}

/**
 * Fetches a page of contracts with total count in one round trip.
 * Returns empty data when `intersectIds` is `[]` (caller may short-circuit earlier).
 */
export async function fetchContractsPage(
  admin: Admin,
  filters: ContractListFilterInput,
  page: number
): Promise<ContractsPageResult> {
  const snapshot = await fetchContractsPageSnapshot(admin, filters, page);
  if (snapshot) return snapshot;

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (safePage - 1) * CONTRACTS_PAGE_SIZE;
  const to = from + CONTRACTS_PAGE_SIZE - 1;

  if (filters.intersectIds !== null && filters.intersectIds.length === 0) {
    return { contracts: [], total: 0 };
  }

  const orderColumn = filters.sort === "created" ? "created_at" : "updated_at";

  let q = admin
    .from("contracts")
    .select(CONTRACT_LIST_ROW_COLUMNS, { count: "exact" })
    .eq("organization_id", filters.orgId)
    .order(orderColumn, { ascending: false });

  if (filters.status) {
    q = q.eq("status", filters.status);
  }
  if (filters.owner) {
    q = q.eq("owner_id", filters.owner);
  }
  if (filters.counterparty) {
    q = q.eq("counterparty", filters.counterparty);
  }
  if (filters.contractType) {
    q = q.eq("contract_type", filters.contractType);
  }
  if (filters.region) {
    q = q.eq("region", filters.region);
  }
  if (filters.intersectIds !== null && filters.intersectIds.length > 0) {
    q = q.in("id", filters.intersectIds);
  }

  if (filters.sanitizedSearch) {
    const orParts = [
      `title.ilike.%${filters.sanitizedSearch}%`,
      `counterparty.ilike.%${filters.sanitizedSearch}%`,
      `contract_type.ilike.%${filters.sanitizedSearch}%`,
    ];
    // Very short probes over large documents are high-cost and low-signal.
    if (filters.sanitizedSearch.length >= 2) {
      orParts.push(`search_document.ilike.%${filters.sanitizedSearch}%`);
    }
    if (filters.fieldSearchIds.length > 0) {
      orParts.push(`id.in.(${filters.fieldSearchIds.join(",")})`);
    }
    q = q.or(orParts.join(","));
  }

  const { data, count, error } = await q.range(from, to);

  if (error) {
    console.error("fetchContractsPage", error);
    return { contracts: [], total: 0, error: error.message };
  }

  return {
    contracts: (data ?? []) as Contract[],
    total: count ?? 0,
  };
}
