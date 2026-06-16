import type { createAdminClient } from "@/lib/supabase/server";
import type { Contract } from "@/lib/types";
import { CONTRACT_LIST_ROW_COLUMNS, CONTRACTS_PAGE_SIZE } from "@/lib/contract-list";
import {
  comparePendingFieldRows,
  formatReviewFieldLabel,
  getImportantFieldLabel,
} from "@/lib/field-review/field-ordering";

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

/**
 * Pending (AI-suggested, not-yet-reviewed) field names per contract, so the
 * Review Queue can name what needs review ("RENEWAL DATE", "COUNTERPARTY")
 * instead of only a count. Names are returned raw (e.g. `renewal_date`); the
 * caller humanizes for display. Capped per contract to keep the row scannable.
 */
export async function getPendingFieldNamesForContractIds(
  admin: Admin,
  contractIds: string[],
  perContractLimit = 5
): Promise<Record<string, string[]>> {
  const empty: Record<string, string[]> = {};
  if (contractIds.length === 0) return empty;

  const { data, error } = await admin
    .from("extracted_fields")
    .select("contract_id, field_name, updated_at")
    .in("contract_id", contractIds)
    .eq("status", "pending")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("getPendingFieldNamesForContractIds", error);
    return empty;
  }

  const map: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const id = row.contract_id as string;
    const name = (row.field_name as string | null)?.trim();
    if (!id || !name) continue;
    const bucket = (map[id] ??= []);
    if (bucket.length < perContractLimit && !bucket.includes(name)) {
      bucket.push(name);
    }
  }

  return map;
}

export interface LeadDetailExcerpt {
  /** Humanized suggested-detail name (e.g. "Renewal date"). */
  label: string;
  /** The cited source text that supports the suggested value. */
  snippet: string;
}

/**
 * One representative source-backed suggested detail per contract, for the
 * dashboard's source-backed review artifact: the canonical "next" pending field
 * that actually carries a locatable source snippet. Returns nothing for
 * contracts whose pending fields have no cited source text (those are suggested
 * values awaiting review, but not source-backed, so they must not be staged as a
 * source excerpt). Caller bounds the contract set; the snippet is truncated for
 * display by the caller.
 */
export async function getLeadDetailExcerptForContractIds(
  admin: Admin,
  contractIds: string[]
): Promise<Record<string, LeadDetailExcerpt>> {
  const result: Record<string, LeadDetailExcerpt> = {};
  if (contractIds.length === 0) return result;

  const { data, error } = await admin
    .from("extracted_fields")
    .select("id, contract_id, field_name, source_snippet, created_at")
    .in("contract_id", contractIds)
    .eq("status", "pending")
    .not("source_snippet", "is", null)
    .neq("source_snippet", "");

  if (error) {
    console.error("getLeadDetailExcerptForContractIds", error);
    return result;
  }

  const byContract = new Map<
    string,
    Array<{ id: string; field_name: string; created_at: string; snippet: string }>
  >();
  for (const row of data ?? []) {
    const contractId = row.contract_id as string;
    const snippet = (row.source_snippet as string | null)?.trim();
    const fieldName = (row.field_name as string | null)?.trim();
    if (!contractId || !snippet || !fieldName) continue;
    const bucket = byContract.get(contractId) ?? [];
    bucket.push({
      id: row.id as string,
      field_name: fieldName,
      created_at: (row.created_at as string | null) ?? "",
      snippet,
    });
    byContract.set(contractId, bucket);
  }

  for (const [contractId, rows] of byContract) {
    // Canonical review order ("what's next") so the staged excerpt matches the
    // detail a reviewer would land on first.
    rows.sort(comparePendingFieldRows);
    const lead = rows[0];
    if (lead) {
      result[contractId] = {
        label: formatReviewFieldLabel(lead.field_name),
        snippet: lead.snippet,
      };
    }
  }

  return result;
}

export interface ReviewQueuePageResult {
  contracts: Contract[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReviewQueueContinuity {
  total: number;
  position: number;
  currentPendingCount: number;
  previousContractId: string | null;
  nextContractId: string | null;
  nextPendingCount: number;
}

async function loadRankedReviewQueueContracts(
  admin: Admin,
  orgId: string
): Promise<{ list: Contract[]; pendingCountByContractId: Record<string, number> }> {
  const empty = { list: [] as Contract[], pendingCountByContractId: {} as Record<string, number> };
  const [pendingReviewResult, pendingFieldResult] = await Promise.all([
    admin.from("contracts").select("id").eq("organization_id", orgId).eq("status", "pending_review"),
    admin
      .from("extracted_fields")
      .select("contract_id, contracts!inner(organization_id)")
      .eq("status", "pending")
      .eq("contracts.organization_id", orgId),
  ]);

  if (pendingReviewResult.error) {
    console.error("[contract-review-stats] pendingReview query error:", pendingReviewResult.error.message);
  }
  if (pendingFieldResult.error) {
    console.error("[contract-review-stats] pendingFields query error:", pendingFieldResult.error.message);
  }

  const pendingReviewIds = new Set((pendingReviewResult.data ?? []).map((row) => row.id as string));
  const pendingCountByContractId: Record<string, number> = {};
  for (const row of pendingFieldResult.data ?? []) {
    const contractId = row.contract_id as string;
    pendingCountByContractId[contractId] = (pendingCountByContractId[contractId] ?? 0) + 1;
  }

  const unionIds = new Set<string>([...pendingReviewIds, ...Object.keys(pendingCountByContractId)]);
  if (unionIds.size === 0) return empty;

  const { data: contractRows, error } = await admin
    .from("contracts")
    .select(CONTRACT_LIST_ROW_COLUMNS)
    .eq("organization_id", orgId)
    .in("id", [...unionIds])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchReviewQueuePage", error);
    return empty;
  }

  const list = (contractRows ?? []) as Contract[];
  list.sort((a, b) => {
    const ar = a.status === "pending_review" ? 1 : 0;
    const br = b.status === "pending_review" ? 1 : 0;
    if (br !== ar) return br - ar;
    const pa = pendingCountByContractId[a.id] ?? 0;
    const pb = pendingCountByContractId[b.id] ?? 0;
    if (pb !== pa) return pb - pa;
    const tc = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (tc !== 0) return tc;
    return a.id.localeCompare(b.id);
  });

  return { list, pendingCountByContractId };
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
  const { list } = await loadRankedReviewQueueContracts(admin, orgId);
  if (list.length === 0) {
    return { contracts: [], total: 0, page: safePage, pageSize };
  }
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

export async function fetchReviewQueueContinuity(
  admin: Admin,
  orgId: string,
  contractId: string
): Promise<ReviewQueueContinuity | null> {
  const { list, pendingCountByContractId } = await loadRankedReviewQueueContracts(admin, orgId);
  const index = list.findIndex((contract) => contract.id === contractId);
  if (index === -1) return null;
  const previous = list[index - 1] ?? null;
  const next = list[index + 1] ?? null;
  return {
    total: list.length,
    position: index + 1,
    currentPendingCount: pendingCountByContractId[contractId] ?? 0,
    previousContractId: previous?.id ?? null,
    nextContractId: next?.id ?? null,
    nextPendingCount: next ? (pendingCountByContractId[next.id] ?? 0) : 0,
  };
}

/** Lightweight per-contract signals for EVERY waiting contract — the basis for
 *  cross-page (workspace-wide) review-queue filtering. Deliberately avoids the
 *  ~120k-char `search_document` blob and the heavy `extracted_fields(*)` join:
 *  `hasSourceText` is an id-only presence probe, and the key-field/citation
 *  signals come from one bounded small-column pending-field fetch. */
export interface ReviewQueueSignalRow {
  id: string;
  title: string;
  counterparty: string | null;
  ownerId: string | null;
  updatedAt: string;
  /** Accurate pending-field count (whole org, uncapped). */
  pendingFields: number;
  /** Total extracted fields (reviewed + pending), for the per-contract mini-bar. */
  totalFields: number;
  /** Contract has non-empty searchable document text (a preview can render). */
  hasSourceText: boolean;
  /** Any pending field maps to a Core important-field alias. */
  hasKeyField: boolean;
  /** The next pending field (canonical order) is an AI value with no citation. */
  nextNeedsCitation: boolean;
  /** Id of the next pending field, so the queue row can deep-link to it. */
  nextFieldId: string | null;
}

/** Cap on pending-field rows scanned for signals. The Core ceiling is 500
 *  contracts / soft 2000; even pessimistically the waiting pending-field set
 *  stays well under this bound (mirrors the dashboard's `.range(0, 4999)`). */
const REVIEW_SIGNAL_FIELD_SCAN_LIMIT = 5000;

export async function loadReviewQueueSignals(
  admin: Admin,
  orgId: string
): Promise<ReviewQueueSignalRow[]> {
  const { list, pendingCountByContractId } = await loadRankedReviewQueueContracts(admin, orgId);
  if (list.length === 0) return [];
  const ids = list.map((contract) => contract.id);

  const [stats, withSource, pendingFieldResult] = await Promise.all([
    getReviewStatsForContractIds(admin, ids),
    admin
      .from("contracts")
      .select("id")
      .eq("organization_id", orgId)
      .in("id", ids)
      .not("search_document", "is", null)
      .neq("search_document", ""),
    admin
      .from("extracted_fields")
      .select("id, contract_id, field_name, source, created_at, field_value, source_snippet")
      .eq("status", "pending")
      .in("contract_id", ids)
      .range(0, REVIEW_SIGNAL_FIELD_SCAN_LIMIT - 1),
  ]);

  if (withSource.error) {
    console.error("[contract-review-stats] hasSourceText probe error:", withSource.error.message);
  }
  if (pendingFieldResult.error) {
    console.error("[contract-review-stats] pending-field signal error:", pendingFieldResult.error.message);
  }

  const sourceSet = new Set((withSource.data ?? []).map((row) => row.id as string));

  interface PendingSignalRow {
    id: string;
    field_name: string;
    source: string | null;
    created_at: string;
    field_value: string | null;
    source_snippet: string | null;
  }
  const pendingByContract = new Map<string, PendingSignalRow[]>();
  for (const row of pendingFieldResult.data ?? []) {
    const contractId = row.contract_id as string;
    const bucket = pendingByContract.get(contractId) ?? [];
    bucket.push({
      id: row.id as string,
      field_name: (row.field_name as string | null) ?? "",
      source: (row.source as string | null) ?? null,
      created_at: (row.created_at as string | null) ?? "",
      field_value: (row.field_value as string | null) ?? null,
      source_snippet: (row.source_snippet as string | null) ?? null,
    });
    pendingByContract.set(contractId, bucket);
  }

  return list.map((contract) => {
    const pending = pendingByContract.get(contract.id) ?? [];
    pending.sort(comparePendingFieldRows);
    const next = pending[0] ?? null;
    return {
      id: contract.id,
      title: contract.title,
      counterparty: contract.counterparty,
      ownerId: contract.owner_id ?? null,
      updatedAt: contract.updated_at,
      pendingFields: pendingCountByContractId[contract.id] ?? pending.length,
      totalFields: stats[contract.id]?.total ?? 0,
      hasSourceText: sourceSet.has(contract.id),
      hasKeyField: pending.some((field) => getImportantFieldLabel(field.field_name) !== null),
      nextNeedsCitation:
        !!next && next.source === "ai" && !!next.field_value?.trim() && !next.source_snippet?.trim(),
      nextFieldId: next?.id ?? null,
    };
  });
}
