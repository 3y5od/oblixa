import type { AdminClient } from "@/lib/assurance/service";
import { createRow, listRows } from "@/lib/assurance/service";

const SEGMENT_PAGE_SIZE = 500;
const SEGMENT_MAX_SCAN = 5_000;

export function listSegments(admin: AdminClient, orgId: string) {
  return listRows(admin, "segment_definitions", orgId, "id, segment_type, key, name, criteria_json, active, updated_at");
}

export function createSegment(
  admin: AdminClient,
  orgId: string,
  userId: string,
  payload: { segmentType: string; key: string; name: string; criteria?: Record<string, unknown> }
) {
  return createRow(admin, "segment_definitions", orgId, {
    segment_type: payload.segmentType,
    key: payload.key,
    name: payload.name,
    criteria_json: payload.criteria ?? {},
    created_by: userId,
  });
}

const MEMBERSHIP_ENTITY_TYPES = new Set(["contract", "account", "counterparty", "program", "owner", "team"]);

export type SegmentCriteriaJson = {
  contract_status_in?: string[];
  regions?: string[];
  counterparty_contains?: string;
  /** Filter contracts linked to this program via contract_program_assignments (active). */
  program_id?: string;
  /** Match contracts.contract_type when set. */
  contract_type_equals?: string;
  /** Match when contract.tags overlaps any of these (case-insensitive), after migration 050. */
  tags_any?: string[];
  /**
   * After contract criteria match, also record memberships for derived entities (v6.md §9.10).
   * Default is ["contract"] only. Example: ["contract","account","counterparty"] for hierarchy rollups.
   */
  membership_entity_types?: string[];
};

/** Normalizes `membership_entity_types` for segment criteria (exported for unit tests). */
export function normalizeMembershipEntityTypes(criteria: SegmentCriteriaJson): string[] {
  const raw = criteria.membership_entity_types;
  if (!Array.isArray(raw) || raw.length === 0) return ["contract"];
  const out = raw.map((x) => String(x).toLowerCase()).filter((t) => MEMBERSHIP_ENTITY_TYPES.has(t));
  return out.length > 0 ? out : ["contract"];
}

async function fetchContractsForSegment(
  admin: AdminClient,
  orgId: string,
  criteria: SegmentCriteriaJson
): Promise<{
  data: Record<string, unknown>[];
  error: { message: string } | null;
  truncated: boolean;
}> {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < SEGMENT_MAX_SCAN; offset += SEGMENT_PAGE_SIZE) {
    let q = admin
      .from("contracts")
      .select("id, counterparty, region, status, contract_type, tags, account_key, owner_id")
      .eq("organization_id", orgId);
    if (criteria.contract_status_in && criteria.contract_status_in.length > 0) {
      q = q.in("status", criteria.contract_status_in);
    }
    if (criteria.regions && criteria.regions.length > 0) {
      q = q.in("region", criteria.regions);
    }
    if (criteria.contract_type_equals?.trim()) {
      q = q.eq("contract_type", criteria.contract_type_equals.trim());
    }

    const result = await q.range(offset, offset + SEGMENT_PAGE_SIZE - 1);
    if (result.error) return { data: rows, error: result.error, truncated: false };
    const page = (result.data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < SEGMENT_PAGE_SIZE) return { data: rows, error: null, truncated: false };
  }
  return { data: rows, error: null, truncated: true };
}

async function fetchProgramAssignments(
  admin: AdminClient,
  orgId: string,
  programId: string
): Promise<{ contractIds: Set<string>; error: { message: string } | null; truncated: boolean }> {
  const contractIds = new Set<string>();
  for (let offset = 0; offset < SEGMENT_MAX_SCAN; offset += SEGMENT_PAGE_SIZE) {
    const result = await admin
      .from("contract_program_assignments")
      .select("contract_id")
      .eq("organization_id", orgId)
      .eq("program_id", programId)
      .eq("status", "active")
      .range(offset, offset + SEGMENT_PAGE_SIZE - 1);
    if (result.error) return { contractIds, error: result.error, truncated: false };
    const page = result.data ?? [];
    for (const assignment of page) {
      contractIds.add(String((assignment as { contract_id: string }).contract_id));
    }
    if (page.length < SEGMENT_PAGE_SIZE) return { contractIds, error: null, truncated: false };
  }
  return { contractIds, error: null, truncated: true };
}

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size) as T[]);
  }
  return chunks;
}

export async function recomputeSegmentMemberships(admin: AdminClient, orgId: string, segmentId: string) {
  const { error: delErr } = await admin
    .from("segment_memberships")
    .delete()
    .eq("organization_id", orgId)
    .eq("segment_definition_id", segmentId);
  if (delErr) return { count: 0, error: delErr };

  const { data: seg, error: segErr } = await admin
    .from("segment_definitions")
    .select("criteria_json")
    .eq("organization_id", orgId)
    .eq("id", segmentId)
    .maybeSingle();
  if (segErr) return { count: 0, error: segErr };
  if (!seg) return { count: 0, error: { message: "segment_not_found" } };

  const criteria = (seg.criteria_json ?? {}) as SegmentCriteriaJson;
  const contractsResult = await fetchContractsForSegment(admin, orgId, criteria);
  if (contractsResult.error) return { count: 0, error: contractsResult.error, truncated: false };

  const tagNeedle = (criteria.tags_any ?? [])
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean);

  let filtered = contractsResult.data.filter((c) => {
    const row = c as { counterparty?: string | null; tags?: string[] | null };
    if (criteria.counterparty_contains?.trim()) {
      const cp = String(row.counterparty ?? "").toLowerCase();
      if (!cp.includes(criteria.counterparty_contains.trim().toLowerCase())) return false;
    }
    if (tagNeedle.length > 0) {
      const tags = Array.isArray(row.tags) ? row.tags.map((t) => String(t).toLowerCase()) : [];
      if (!tagNeedle.some((n) => tags.some((t) => t === n || t.includes(n)))) return false;
    }
    return true;
  });

  let truncated = contractsResult.truncated;

  if (criteria.program_id?.trim()) {
    const pid = criteria.program_id.trim();
    const assignmentsResult = await fetchProgramAssignments(admin, orgId, pid);
    if (assignmentsResult.error) return { count: 0, error: assignmentsResult.error, truncated };
    truncated = truncated || assignmentsResult.truncated;
    const allowed = assignmentsResult.contractIds;
    filtered = filtered.filter((c) => allowed.has(String((c as { id: string }).id)));
  }

  const entityTypes = normalizeMembershipEntityTypes(criteria);
  type InsRow = {
    organization_id: string;
    segment_definition_id: string;
    entity_type: string;
    entity_ref_id: string;
    metadata_json: Record<string, unknown>;
  };
  const insertRows: InsRow[] = [];
  const metaBase = { source: "criteria_recompute", criteria, membership_entity_types: entityTypes };

  if (entityTypes.includes("contract")) {
    for (const contract of filtered) {
      insertRows.push({
        organization_id: orgId,
        segment_definition_id: segmentId,
        entity_type: "contract",
        entity_ref_id: String((contract as { id: string }).id),
        metadata_json: metaBase,
      });
    }
  }

  if (filtered.length > 0) {
    const contractIds = filtered.map((c) => String((c as { id: string }).id));

    if (entityTypes.includes("account")) {
      const keys = new Set<string>();
      for (const c of filtered) {
        const ak = String((c as { account_key?: string | null }).account_key ?? "").trim();
        if (ak) keys.add(ak);
      }
      for (const k of keys) {
        insertRows.push({
          organization_id: orgId,
          segment_definition_id: segmentId,
          entity_type: "account",
          entity_ref_id: k,
          metadata_json: { ...metaBase, derived_from: "contracts.account_key" },
        });
      }
    }

    if (entityTypes.includes("counterparty")) {
      const cps = new Set<string>();
      for (const c of filtered) {
        const cp = String((c as { counterparty?: string | null }).counterparty ?? "").trim();
        if (cp) cps.add(cp);
      }
      for (const cp of cps) {
        insertRows.push({
          organization_id: orgId,
          segment_definition_id: segmentId,
          entity_type: "counterparty",
          entity_ref_id: cp,
          metadata_json: { ...metaBase, derived_from: "contracts.counterparty" },
        });
      }
    }

    if (entityTypes.includes("owner")) {
      const owners = new Set<string>();
      for (const c of filtered) {
        const oid = (c as { owner_id?: string | null }).owner_id;
        if (oid) owners.add(String(oid));
      }
      for (const uid of owners) {
        insertRows.push({
          organization_id: orgId,
          segment_definition_id: segmentId,
          entity_type: "owner",
          entity_ref_id: uid,
          metadata_json: { ...metaBase, derived_from: "contracts.owner_id" },
        });
      }
    }

    if (entityTypes.includes("program") && contractIds.length > 0) {
      const pids = new Set<string>();
      for (const contractChunk of chunkArray(contractIds, 200)) {
        const assignsResult = await admin
          .from("contract_program_assignments")
          .select("program_id")
          .eq("organization_id", orgId)
          .eq("status", "active")
          .in("contract_id", contractChunk);
        if (assignsResult.error) return { count: 0, error: assignsResult.error, truncated };
        for (const assignment of assignsResult.data ?? []) {
          pids.add(String((assignment as { program_id: string }).program_id));
        }
      }
      for (const pid of pids) {
        insertRows.push({
          organization_id: orgId,
          segment_definition_id: segmentId,
          entity_type: "program",
          entity_ref_id: pid,
          metadata_json: { ...metaBase, derived_from: "contract_program_assignments" },
        });
      }
    }

    if (entityTypes.includes("team") && contractIds.length > 0) {
      const teams = new Set<string>();
      for (const contractChunk of chunkArray(contractIds, 200)) {
        const taskRowsResult = await admin
          .from("contract_tasks")
          .select("team_key")
          .eq("organization_id", orgId)
          .in("contract_id", contractChunk)
          .not("team_key", "is", null);
        if (taskRowsResult.error) return { count: 0, error: taskRowsResult.error, truncated };
        for (const taskRow of taskRowsResult.data ?? []) {
          const tk = String((taskRow as { team_key?: string }).team_key ?? "").trim();
          if (tk) teams.add(tk);
        }
      }
      for (const tk of teams) {
        insertRows.push({
          organization_id: orgId,
          segment_definition_id: segmentId,
          entity_type: "team",
          entity_ref_id: tk,
          metadata_json: { ...metaBase, derived_from: "contract_tasks.team_key" },
        });
      }
    }
  }

  const chunkSize = 400;
  for (let i = 0; i < insertRows.length; i += chunkSize) {
    const chunk = insertRows.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const { error } = await admin.from("segment_memberships").insert(chunk);
    if (error) {
      return { count: 0, error };
    }
  }

  const { count } = await admin
    .from("segment_memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("segment_definition_id", segmentId);

  return {
    count: count ?? 0,
    truncated,
    contracts_scanned: contractsResult.data.length,
    membership_rows_prepared: insertRows.length,
  };
}
